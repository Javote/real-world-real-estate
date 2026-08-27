import type { Server } from "node:http";
import app from "./app";
import { initAnchorPort } from "./lib/anchor";
import { db } from "./lib/db";

const port = Number(process.env.PORT || 8787);

// `let` y no `const`: ahora el servidor nace dentro de `arrancar()`, después de
// que el `AnchorPort` esté listo. Hasta entonces no hay nada que cerrar, y por
// eso `cerrar()` lo contempla.
let server: Server | undefined;

/**
 * El arranque, en orden y explícito.
 *
 * **El `AnchorPort` se construye ANTES de escuchar**, igual que las migraciones.
 * Con `ANCHOR_MODE=real` eso levanta Lucid contra Blockfrost y deriva el admin
 * desde la wallet de servicio: si la seed es inválida, si falta la API key o si
 * Blockfrost no responde, el proceso muere acá y queda en los logs de Render
 * —lo único que hay, porque el free tier no da shell—. La alternativa sería
 * descubrirlo en el primer anclaje, con la evidencia ya subida y alguien
 * esperando un TXID que no va a llegar (D-042).
 *
 * Es CommonJS, así que no hay top-level await: de ahí esta función.
 */
async function arrancar() {
  const puerto = await initAnchorPort();
  console.log(`AnchorPort listo en modo "${puerto.mode}"`);

  server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

arrancar().catch((error) => {
  // Sin `listen`: el proceso no llegó a aceptar una sola request, que es
  // exactamente lo que se busca cuando la configuración está mal.
  console.error("[arranque] la API no pudo levantar", error);
  process.exit(1);
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

  // La señal puede llegar mientras el `AnchorPort` todavía se está armando: ahí
  // no hay servidor que cerrar, pero sí una base que soltar.
  if (!server) {
    void cerrarBase();
    return;
  }

  server.close(cerrarBase);
}

process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));
