import type { Server } from "node:http";
import app from "./app";
import { initAnchorPort } from "./lib/anchor";
import { db } from "./lib/db";

const port = Number(process.env.PORT || 8787);

// El otro extremo del par que abre `migrate`: si el log muestra
// `[migrate] sin migraciones pendientes` y NO muestra esta línea, el proceso
// murió entre los dos pasos del `startCommand`. Sin esto, los dos casos se ven
// igual desde afuera — que es lo que costó catorce minutos el 2026-09-04.
console.log("[arranque] migraciones listas, levantando la API");

/**
 * El puerto abre PRIMERO. Antes esperaba a `initAnchorPort()` — mismo orden
 * que las migraciones, con el mismo argumento: que un anclaje mal configurado
 * quede visible en los logs de Render (el free tier no da shell) en vez de
 * fallar en silencio en la primera evidencia subida.
 *
 * **Ese argumento seguía siendo válido para el LOG, pero no para el ORDEN.**
 * Desde D-075 una configuración de anclaje rota ya no mata el proceso —
 * `initAnchorPort()` atrapa todo lo esperable y deja el puerto inhabilitado,
 * el resto de la API funciona igual. Con `ANCHOR_MODE=real`, construir el
 * puerto es un round-trip real a Blockfrost, y **tanto el camino que falla
 * como el que funciona tardan lo mismo en avisar** — lo único que hacía
 * esperar antes de escuchar era retrasar el puerto, no evitar nada. El
 * 2026-09-22 un Blockfrost lento hizo que ese round-trip tardara más que la
 * ventana de port-scan de Render: el puerto SÍ abrió, después de que Render ya
 * había mandado `SIGTERM` por "Timed Out" — un commit sin ningún cambio de
 * código, redeployado solo por el bug de `buildFilter` documentado en
 * `render.yaml`, tumbó el deploy por la latencia de un servicio externo.
 *
 * `anchorPort()` (`lib/anchor.ts`) sigue tirando si algo la usa antes de que
 * esta promesa resuelva, así que la ventana real es chica y explícita: quien
 * pida anclar en los primeros segundos de un arranque en frío recibe un 500
 * claro en vez de que el resto de la API — login, listados, subir evidencia,
 * nada de lo cual toca Cardano — espere sin motivo.
 */
const server: Server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

initAnchorPort()
  .then((puerto) => {
    console.log(`AnchorPort listo en modo "${puerto.mode}"`);

    // **Qué dirección hay que fondear.** Sin esta línea, "el anclaje falla" y
    // "la wallet está vacía" son el mismo síntoma en los logs, y distinguirlos
    // obliga a derivar la dirección a mano desde la clave. La dirección es
    // pública; la clave no se imprime nunca.
    if ("walletAddress" in puerto) {
      console.log(`Wallet de servicio: ${(puerto as { walletAddress: string }).walletAddress}`);
    }
  })
  .catch((error) => {
    // Este `catch` debería ser inalcanzable — `initAnchorPort()` atrapa todo
    // lo esperable y nunca rechaza (D-075) — pero si algo se escapa, se
    // loguea y la API sigue viva igual: para esto ya no hay `process.exit`,
    // el puerto lleva minutos abierto y aceptando requests.
    console.error("[arranque] el AnchorPort no pudo inicializarse", error);
  });

/**
 * Cierre ordenado. **Render manda `SIGTERM` en cada deploy** y espera un rato
 * antes de matar el proceso: sin esto, las requests en vuelo se cortaban a la
 * mitad y la conexión a la base quedaba sin cerrar en cada redeploy.
 *
 * El `setTimeout` es el seguro: si algo queda colgado —una request eterna, un
 * socket que no cierra— igual salimos. Un proceso que se niega a morir hace que
 * la plataforma lo mate a la fuerza, que es peor que salir solo.
 */
function cerrar(senal: NodeJS.Signals) {
  console.log(`[${senal}] cerrando: no se aceptan requests nuevas`);

  const forzar = setTimeout(() => {
    console.error("[cierre] no terminó a tiempo, saliendo a la fuerza");
    process.exit(1);
  }, 10_000);
  forzar.unref();

  const cerrarBase = async () => {
    try {
      await db.destroy();
    } catch (error) {
      console.error("[cierre] fallo al cerrar la base", error);
    }
    console.log("[cierre] listo");
    process.exit(0);
  };

  // El servidor ya existe apenas arranca el proceso (`app.listen` corre
  // sincrónico, antes de que el `AnchorPort` termine de armarse) — a
  // diferencia de antes, acá ya no hay ventana sin servidor que cerrar.
  server.close(cerrarBase);
}

process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));
