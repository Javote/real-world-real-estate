-- SPEC-219 (anexo de SPEC-218) — un stage no tiene dos evidencias con el
-- mismo SHA-256. `SPEC-218` lo chequea en la aplicación (leer y después
-- escribir), y eso deja abierta la carrera: dos requests simultáneos con el
-- mismo archivo pueden pasar los dos antes de que cualquiera inserte. Solo
-- una restricción de la base lo impide por construcción — mismo criterio que
-- `0006` (dossier por unidad) y `0007` (bundle por stage).
--
-- Paso 0 (medir antes de escribir la migración): cero filas con
-- `(stageId, sha256Hash)` repetido en producción (`turso db shell propnexus`,
-- 2026-09-20, sobre 35 filas de `Evidence` en total). No hace falta volcado
-- ni DELETE previo — a diferencia de 0006/0007, acá no hay nada que
-- resolver antes del índice.
--
-- `stageId` NULL queda fuera a propósito: en SQLite un `UNIQUE` trata los
-- NULL como distintos entre sí, así que los documentos a nivel proyecto
-- (`POST /developer/documents`, sin stage) no quedan cubiertos. Consistente
-- con la regla ("un STAGE no tiene..."), no un descuido.
--
-- Redundante con el índice único de abajo, igual que en 0006/0007: `stageId`
-- sigue siendo el prefijo del compuesto, así que un `WHERE stageId = ?` sigue
-- usando índice igual que antes.
DROP INDEX IF EXISTS `Evidence_stageId_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Evidence_stageId_sha256Hash_key`
  ON `Evidence` (`stageId`, `sha256Hash`);
