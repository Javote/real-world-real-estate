-- SPEC-615, decisión 2: el dossier nace con la venta (al aceptar la invitación) y
-- las lecturas lo calculan sin escribir. Hasta acá la fila la creaba la primera
-- lectura (`compileDossier`), así que una unidad vendida cuyo dossier nadie abrió
-- no la tiene. Esta migración se la da, con lo mismo que le pone la aceptación:
-- `compiled`, `masterHash` vacío (es el hash que el notary firme o rechace) y
-- `compiledAt` en el momento de la venta (`Unit.updatedAt`).
--
-- El id sigue la forma de `cuidParamSchema` (una letra y 23 de [a-z0-9]): una
-- `d` y 23 dígitos hex aleatorios.
--
-- Idempotente (regla 8): solo inserta donde falta, y el índice único de
-- `Dossier.unitId` (0006) impide un segundo dossier para la misma unidad.
INSERT INTO `Dossier` (`id`, `unitId`, `masterHash`, `compiledAt`, `status`)
SELECT
	'd' || substr(lower(hex(randomblob(12))), 1, 23),
	`Unit`.`id`,
	'',
	`Unit`.`updatedAt`,
	'compiled'
FROM `Unit`
WHERE `Unit`.`investorId` IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM `Dossier` WHERE `Dossier`.`unitId` = `Unit`.`id`);
