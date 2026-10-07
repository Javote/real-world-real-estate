import type { Server } from "node:http";
import app from "./app.js";
import { initAnchorPort } from "./lib/anchor.js";
import { db } from "./lib/db.js";
import { avisosDelEntorno, entorno } from "./platform/config.js";

// Una variable mal formada se ve acá y no en la primera request que la usa; ninguna frena el arranque.
const port = entorno().PORT;
for (const aviso of avisosDelEntorno()) console.warn(`[arranque] ${aviso}`);

console.log("[arranque] migraciones listas, levantando la API");

const server: Server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// Después de escuchar: Render mata el deploy si el puerto no abre, y el anclaje no frena el resto.
initAnchorPort()
  .then((puerto) => {
    console.log(`AnchorPort listo en modo "${puerto.mode}"`);

    if ("walletAddress" in puerto) {
      console.log(`Wallet de servicio: ${(puerto as { walletAddress: string }).walletAddress}`);
    }
  })
  .catch((error) => {
    console.error("[arranque] el AnchorPort no pudo inicializarse", error);
  });

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

  server.close(cerrarBase);
}

process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));
