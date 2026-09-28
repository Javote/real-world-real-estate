import type { GeocodeResult } from "@plataforma/shared";

// D-097 — La dirección del alta de proyecto se convierte en un punto con
// Nominatim (el geocodificador de OpenStreetMap), y el front mueve el "Map
// preview" de la captura 34b hasta ahí. Pasa por la API y no por el navegador
// por dos razones: la regla del front de no hacer `fetch` fuera de `ApiPort`, y
// la política de uso de Nominatim, que exige un User-Agent que identifique a
// la aplicación (un navegador no lo deja fijar) y como máximo **un pedido por
// segundo** para todo el servicio — por eso la cola de acá abajo es una sola,
// compartida por todos los usuarios, y no un rate limit por usuario.
// https://operations.osmfoundation.org/policies/nominatim/
//
// La dirección de una obra no es PII (regla 2), pero igual no se loguea: no
// hace falta para nada.

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const USER_AGENT = "PropNexus/1.0 (+https://propnexus-web.onrender.com)";

/**
 * Sesgo hacia CABA: `viewbox` prioriza resultados dentro de la Ciudad, sin
 * excluir los de afuera (`bounded` queda en 0), y `countrycodes` los acota a
 * Argentina. Una obra en pozo de otra provincia se sigue encontrando.
 */
const PARAMETROS_FIJOS = {
  format: "jsonv2",
  limit: "1",
  countrycodes: "ar",
  viewbox: "-58.5315,-34.5265,-58.3351,-34.7057",
  "accept-language": "es"
};

export class GeocodificadorNoDisponible extends Error {}

interface Opciones {
  fetch?: typeof globalThis.fetch;
  /** Milisegundos mínimos entre dos pedidos a Nominatim. */
  espaciado?: number;
  timeout?: number;
  tamanoCache?: number;
}

export function crearGeocodificador({
  fetch: fetchInyectado,
  espaciado = 1100,
  timeout = 8000,
  tamanoCache = 500
}: Opciones = {}) {
  const cache = new Map<string, GeocodeResult>();
  let cola: Promise<unknown> = Promise.resolve();
  let ultimo = 0;

  async function pedir(q: string): Promise<GeocodeResult> {
    const espera = ultimo + espaciado - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimo = Date.now();

    const url = `${NOMINATIM_URL}?${new URLSearchParams({ ...PARAMETROS_FIJOS, q })}`;
    let respuesta: Response;
    try {
      // Sin `fetch` inyectado se lee el global en cada pedido, no al crear el
      // geocodificador: así los tests de ruta pueden reemplazarlo.
      respuesta = await (fetchInyectado ?? globalThis.fetch)(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeout)
      });
    } catch {
      throw new GeocodificadorNoDisponible("sin respuesta");
    }
    if (!respuesta.ok) throw new GeocodificadorNoDisponible(`HTTP ${respuesta.status}`);

    let lista: Array<{ lat: string; lon: string; display_name: string }>;
    try {
      lista = await respuesta.json();
    } catch {
      throw new GeocodificadorNoDisponible("respuesta ilegible");
    }
    const primero = lista[0];
    if (!primero) return { match: null };
    return {
      match: {
        latitude: Number(primero.lat),
        longitude: Number(primero.lon),
        label: primero.display_name
      }
    };
  }

  return {
    /**
     * El punto de una dirección. Los pedidos se encolan (uno por vez, con
     * `espaciado` entre cada uno) y los aciertos y los "no encontrado" quedan
     * en caché: la misma dirección no vuelve a salir a Nominatim.
     */
    buscar(q: string): Promise<GeocodeResult> {
      const clave = q.trim().toLowerCase();
      const guardado = cache.get(clave);
      if (guardado) return Promise.resolve(guardado);

      const resultado = cola.then(() => pedir(q.trim()));
      cola = resultado.catch(() => undefined);
      return resultado.then((r) => {
        if (cache.size >= tamanoCache) cache.delete(cache.keys().next().value as string);
        cache.set(clave, r);
        return r;
      });
    }
  };
}

export const geocodificador = crearGeocodificador();
