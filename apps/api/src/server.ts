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
 * desde la wallet de servicio, y el resultado queda en los logs de Render —lo
 * único que hay, porque el free tier no da shell—.
 *
 * **Pero una configuración de anclaje rota ya no mata el proceso** (D-075). Si
 * falta la key, si la seed es inválida o si Blockfrost no responde, el puerto
 * queda inhabilitado y la API levanta igual: anclar falla, el resto del
 * producto funciona. Matar el proceso castigaba a las otras cincuenta
 * funciones por el problema de una, y hacía que un push con una variable mal
 * puesta dejara todo abajo.
 *
 * La línea a mirar en los logs sigue siendo la misma, y ahora tiene un tercer
 * valor posible: `"disabled"`.
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
  // Sin `listen`. Queda para lo que de verdad no tiene modo degradado —una
  // migración que no corre, la base inalcanzable—; el anclaje ya no llega acá
  // (D-075), porque para él sí existe un modo seguro de seguir vivo.
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
