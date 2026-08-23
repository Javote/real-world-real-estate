-- Un `OnChainEvent` de tipo `EVIDENCE_ANCHOR` tiene que poder decir **qué
-- archivo** ancló, o el TXID no sirve para nada en la UI: sin esto, la pantalla
-- de una evidencia no puede mostrar su propia prueba.
--
-- Y una precisión sobre `eventIndex`, que la migración 0001 definía como "0 es
-- el mint, 1..n las transiciones": desde acá es **la posición en la secuencia de
-- eventos on-chain del stage**, y los anclajes de evidencia también consumen
-- un índice. La garantía que importa —el único `(milestoneId, eventIndex)`, que
-- es lo que vuelve idempotente el anclaje— no cambia.
ALTER TABLE `OnChainEvent` ADD COLUMN `evidenceId` text REFERENCES `Evidence`(`id`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_evidenceId_idx` ON `OnChainEvent` (`evidenceId`);
