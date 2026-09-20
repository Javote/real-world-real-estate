-- SPEC-406 (AUDITORIA-2026-09-11-calidad-de-packages.md §C-01) — el simulador
-- olvidaba todo lo que había confirmado cada vez que el proceso se reiniciaba:
-- `proofs` y `bloques` eran dos `Map` en memoria de la instancia, y solo los
-- UTxOs pasaban por `SimulatedLedgerUtxo`. Un anclaje por metadata
-- (`anchorCommitment`) nunca crea una fila ahí —no hay UTxO de por medio—, así
-- que no alcanza con una columna en esa tabla: hace falta una propia, indexada
-- por txid, sea cual sea el camino que lo produjo.
CREATE TABLE `SimulatedLedgerBlock` (
	`txid` text PRIMARY KEY NOT NULL,
	`blockAt` integer NOT NULL
);
