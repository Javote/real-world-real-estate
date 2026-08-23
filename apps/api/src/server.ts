import app from "./app";
import { db } from "./lib/db";

const port = Number(process.env.PORT || 8787);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
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

  server.close(async () => {
    try {
      await db.destroy();
    } catch (error) {
      console.error("[cierre] fallo al cerrar la base", error);
    }
    console.log("[cierre] listo");
    process.exit(0);
  });
}

process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));
