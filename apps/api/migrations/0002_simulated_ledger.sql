-- El ledger del adaptador simulado del `AnchorPort` (SPEC-013 §A, D-014).
--
-- **Solo se escribe con `ANCHOR_MODE=simulated`.** Está en el schema real, y no
-- en memoria, porque el simulador es producto y no un stub: si el ledger muere
-- con el proceso, reiniciar `pnpm dev` deja huérfanos todos los hilos abiertos
-- y el simulador deja de poder detectar el doble gasto, que es lo único que lo
-- hace valer algo.
--
-- `assetName` es el `stageRef` del datum — el asset name del thread token. El
-- índice parcial es la propiedad del NFT, verificada sin cadena: **un solo UTxO
-- vivo por stage**.
CREATE TABLE `SimulatedLedgerUtxo` (
	`outputRef` text PRIMARY KEY NOT NULL,
	`assetName` text NOT NULL,
	`datumJson` text NOT NULL,
	`spentByTxid` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SimulatedLedgerUtxo_live_thread_key` ON `SimulatedLedgerUtxo` (`assetName`) WHERE `spentByTxid` IS NULL;
