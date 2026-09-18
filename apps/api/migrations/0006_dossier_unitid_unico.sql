-- SPEC-202 (B-02) — una unidad, un dossier. `Dossier_unitId_idx` (0000_init.sql)
-- es un índice común, no único: dos compilaciones concurrentes de la misma
-- unidad (`compileDossier`, `domain/dossier.ts`) crean dos filas, y la que
-- gana `executeTakeFirst` es cualquiera de las dos. Reproducido con
-- `Promise.all([compileDossier(u), compileDossier(u)])` — dos ids distintos,
-- dos filas. Con dos filas, un `shareToken` o una firma pueden quedar en la
-- que las lecturas NO resuelven: un TXID real apuntando a una fila que la
-- pantalla no lee (regla 17 al revés).
--
-- Antes del índice, se resuelve cualquier duplicado que ya exista. Criterio,
-- el mismo que fija SPEC-202 §Qué se cambia: sobrevive la fila que tenga
-- `shareToken` o firma (`signedById`) — perder esa identidad rompería un link
-- ya compartido o una firma ya hecha; si ninguna de las filas de la unidad
-- tiene ninguna de las dos, sobrevive la de `compiledAt` más antiguo, que es
-- la que más chance tuvo de ya haber sido compartida. `ROW_NUMBER() OVER
-- (PARTITION BY unitId ...)` lo aplica por unidad, sea cual sea la cantidad
-- de duplicados — no hay ningún id de fila hardcodeado como en 0004/0005
-- porque acá no se conoce de antemano si existe alguno.
--
-- Es idempotente sin guarda explícita (regla 8): una vez sin duplicados, cada
-- `unitId` tiene una sola fila con `rn = 1`, así que el `DELETE` no borra
-- nada en una segunda pasada. `IF NOT EXISTS` en el índice cubre el mismo
-- caso si este archivo se re-aplicara a mano.
DELETE FROM `Dossier`
WHERE `id` IN (
	SELECT `id` FROM (
		SELECT
			`id`,
			ROW_NUMBER() OVER (
				PARTITION BY `unitId`
				ORDER BY
					(`shareToken` IS NOT NULL OR `signedById` IS NOT NULL) DESC,
					`compiledAt` ASC
			) AS `rn`
		FROM `Dossier`
	)
	WHERE `rn` > 1
);
--> statement-breakpoint
-- Redundante con el índice único de abajo (toda unique index sirve también
-- de índice de búsqueda por esa columna) — se saca para no mantener dos.
-- `IF EXISTS` por la misma guarda de regla 8 que el índice de más abajo: si
-- este archivo se re-aplicara a mano, ya no estaría.
DROP INDEX IF EXISTS `Dossier_unitId_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Dossier_unitId_key` ON `Dossier` (`unitId`);
