import type { GeocodeResult } from "@plataforma/shared";

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const USER_AGENT = "PropNexus/1.0 (+https://propnexus-web.onrender.com)";

const PARAMETROS_FIJOS = {
  format: "jsonv2",
  limit: "1",
  countrycodes: "ar",
  viewbox: "-58.5315,-34.5265,-58.3351,-34.7057",
  "accept-language": "es"
};

export class GeocodificadorNoDisponible extends Error {
  constructor(motivo: string) {
    super(motivo);
    console.warn(`[geocode] Nominatim no disponible: ${motivo}`);
  }
}

interface Opciones {
  fetch?: typeof globalThis.fetch;
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
      respuesta = await (fetchInyectado ?? globalThis.fetch)(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new GeocodificadorNoDisponible(
        `sin respuesta (${error instanceof Error ? error.name : "desconocido"})`
      );
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
