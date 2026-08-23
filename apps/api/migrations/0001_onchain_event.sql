-- `OnChainEvent` es la entidad de M1-D2 §2 (`onchain_event_id`, `event_type`,
-- `txid`, `block_timestamp`). Hasta hoy no existía, así que aunque hubiera
-- anclaje no había dónde aterrizar el TXID — y sin TXID la regla 17 obliga a
-- mostrar "Pendiente", que es exactamente lo que esta tabla representa.
--
-- Guarda dos cosas que M1 no modela y el hilo on-chain necesita (D-058):
--   `outputRef`  — el UTxO del thread token. **Estado crítico**: si se pierde,
--                  ese stage no se puede volver a mover nunca, porque el token
--                  está en un UTxO que no sabés cuál es.
--   `eventIndex` — la posición en el hilo. 0 es el `mint`, 1..n las
--                  transiciones. Es lo que vuelve idempotente el anclaje
--                  (regla 8): escribir dos veces el evento N viola el índice
--                  único, en vez de anclar dos veces la misma transición.
CREATE TABLE `OnChainEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`milestoneId` text,
	`eventIndex` integer NOT NULL,
	`eventType` text NOT NULL,
	`fromState` text,
	`toState` text,
	`commitment` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`txid` text,
	`outputRef` text,
	`blockTimestamp` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OnChainEvent_milestoneId_eventIndex_key` ON `OnChainEvent` (`milestoneId`,`eventIndex`);--> statement-breakpoint
CREATE INDEX `OnChainEvent_milestoneId_idx` ON `OnChainEvent` (`milestoneId`);--> statement-breakpoint
CREATE INDEX `OnChainEvent_status_idx` ON `OnChainEvent` (`status`);--> statement-breakpoint
-- Un TXID ancla un solo evento. En SQLite dos NULL son distintos, así que esto
-- no estorba a los eventos todavía sin anclar.
CREATE UNIQUE INDEX `OnChainEvent_txid_key` ON `OnChainEvent` (`txid`);
