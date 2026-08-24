-- Esquema inicial. **Es el único archivo de migraciones y describe la base entera.**
--
-- Colapsa las seis migraciones que existieron hasta el 2026-08-23 (D-063). No
-- se hizo por prolijidad: la cadena vieja arrastraba una reconstrucción de
-- tabla —SQLite no sabe cambiar un DEFAULT— y un ALTER que agregaba una columna
-- al final, así que el esquema real no se podía leer en ningún lado. Había que
-- reconstruirlo mentalmente aplicando seis archivos en orden.
--
-- **Si tenías una `dev.db` anterior, borrala.** El runner lleva registro por
-- nombre de archivo en `_migrations`: una base que ya aplicó el `0000_init.sql`
-- viejo NO va a aplicar este, y se va a quedar con el esquema anterior sin
-- avisar.

-- ── Identidad y acceso ──────────────────────────────────────────────────────

CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	-- bcrypt cost 10 (regla 4). NUNCA sale en una respuesta.
	`passwordHash` text NOT NULL,
	`role` text NOT NULL,
	`fullName` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);
--> statement-breakpoint

CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`latitude` real,
	`longitude` real,
	`totalUnits` integer DEFAULT 0 NOT NULL,
	`estimatedDelivery` integer,
	`status` text DEFAULT 'planning' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Project_slug_key` ON `Project` (`slug`);
--> statement-breakpoint

-- La segunda capa de autorización (regla 5): el rol global dice qué podés
-- hacer, la membresía dice en qué proyecto. `admin` no necesita fila acá.
CREATE TABLE `ProjectMember` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`membershipRole` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ProjectMember_userId_projectId_membershipRole_key` ON `ProjectMember` (`userId`,`projectId`,`membershipRole`);
--> statement-breakpoint

-- ── El trámite de obra ──────────────────────────────────────────────────────

-- Los stages cuelgan del PROYECTO, no de la unidad: un desarrollo tiene un solo
-- trámite y no se hace movimiento de suelos por departamento (D-029).
--
-- Se llama `Milestone` por herencia y **es deuda conocida**: el dominio dice
-- `ConstructionStage` y "milestone" queda reservado para los hitos de Catalyst
-- (D-023). El rename son 370 ocurrencias en 22 archivos y va en su propio
-- commit, con el frontend.
CREATE TABLE `Milestone` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	-- Orden dentro del proyecto. Es parte de la IDENTIDAD on-chain: el
	-- validador rechaza que cambie con el hilo ya abierto (D-057).
	`sequenceOrder` integer NOT NULL,
	-- FSM de D-020, espejada en `packages/shared` y en el validador Aiken.
	-- `Pending → InProgress → {Observed ⇄ InProgress, Completed}`.
	`state` text DEFAULT 'Pending' NOT NULL,
	-- **Todo stage es crítico** (D-061): sin evidencia no se completa. El
	-- default era `false` y nadie lo llenaba, así que la regla más fuerte del
	-- whitepaper colgaba de una casilla que alguien podía olvidarse de marcar.
	`validationCritical` integer DEFAULT true NOT NULL,
	`certifiedAt` integer,
	`certifiedById` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`certifiedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Milestone_projectId_sequenceOrder_key` ON `Milestone` (`projectId`,`sequenceOrder`);
--> statement-breakpoint

-- ── Evidencia ───────────────────────────────────────────────────────────────

-- `storagePath` es opaco y **jamás sale al cliente** (D-011): con
-- `STORAGE_DRIVER=disk` es una ruta, con `s3` es la key del objeto.
CREATE TABLE `Evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`milestoneId` text,
	`uploadedById` text NOT NULL,
	`evidenceType` text NOT NULL,
	`category` text NOT NULL,
	`authoritative` integer DEFAULT false NOT NULL,
	`originalFilename` text NOT NULL,
	`storedFilename` text NOT NULL,
	`mimeType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`storagePath` text NOT NULL,
	-- SHA-256 de los bytes GUARDADOS, no del temporal: con `s3` el port relee
	-- el objeto subido y lo rehashea. Es el ticket de entrada a la cadena de
	-- prueba (D-027).
	`sha256Hash` text NOT NULL,
	`uploadedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Evidence_projectId_idx` ON `Evidence` (`projectId`);
--> statement-breakpoint
CREATE INDEX `Evidence_milestoneId_idx` ON `Evidence` (`milestoneId`);
--> statement-breakpoint

-- El conjunto de evidencia que sostiene el cierre de un stage, con su Merkle
-- root (`bundle_commitment_hash` de M1-D2 §2). Es lo que hace anclable un stage
-- crítico: el validador exige 32 bytes de commitment para completar.
--
-- **Es un acta, no un índice:** se escribe con la evidencia que existía en el
-- momento del cierre y no se toca. Si después se sube más evidencia, es otro
-- bundle — el root ya anclado tiene que seguir verificando.
CREATE TABLE `EvidenceBundle` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`milestoneId` text NOT NULL,
	`commitmentHash` text NOT NULL,
	`createdById` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `EvidenceBundle_milestoneId_idx` ON `EvidenceBundle` (`milestoneId`);
--> statement-breakpoint

-- `sha256Hash` se copia acá a propósito, contra el principio 1: si mañana se
-- borra la fila de `Evidence`, el bundle tiene que seguir explicando qué root
-- ancló. Un commitment que no se puede reconstruir no prueba nada.
CREATE TABLE `EvidenceBundleItem` (
	`bundleId` text NOT NULL,
	`evidenceId` text NOT NULL,
	`sha256Hash` text NOT NULL,
	PRIMARY KEY (`bundleId`, `evidenceId`),
	FOREIGN KEY (`bundleId`) REFERENCES `EvidenceBundle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidenceId`) REFERENCES `Evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `EvidenceBundleItem_evidenceId_idx` ON `EvidenceBundleItem` (`evidenceId`);
--> statement-breakpoint

-- ── Anclaje en Cardano ──────────────────────────────────────────────────────

-- `OnChainEvent` de M1-D2 §2. Cada fila es un evento del hilo on-chain, y se
-- escribe **en el mismo momento que la declaración**, con `status: 'Pending'` y
-- sin `txid`: el registro avanza y la prueba queda pendiente. Al revés no puede
-- pasar (D-059), y mientras no haya TXID la UI muestra "Pendiente" (regla 17).
CREATE TABLE `OnChainEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`milestoneId` text,
	-- Solo en `EVIDENCE_ANCHOR`: qué archivo ancló esta transacción.
	`evidenceId` text,
	-- Posición en la secuencia de eventos on-chain del stage. El índice único
	-- con `milestoneId` es lo que vuelve **idempotente** el anclaje (regla 8):
	-- escribir dos veces el evento N choca contra el índice en vez de anclar
	-- dos veces la misma transición.
	`eventIndex` integer NOT NULL,
	`eventType` text NOT NULL,
	`fromState` text,
	`toState` text,
	-- Qué commitment quedó anclado: el Merkle root del bundle al completar, o
	-- el SHA-256 del archivo en un anclaje de evidencia.
	`commitment` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`txid` text,
	-- UTxO del thread token: `txid#index`. **Estado crítico**: si se pierde, el
	-- token queda en un UTxO que nadie sabe cuál es y ese stage no se puede
	-- volver a mover nunca (D-058).
	`outputRef` text,
	`blockTimestamp` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`evidenceId`) REFERENCES `Evidence`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OnChainEvent_milestoneId_eventIndex_key` ON `OnChainEvent` (`milestoneId`,`eventIndex`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_milestoneId_idx` ON `OnChainEvent` (`milestoneId`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_evidenceId_idx` ON `OnChainEvent` (`evidenceId`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_status_idx` ON `OnChainEvent` (`status`);
--> statement-breakpoint
-- Un TXID ancla un solo evento. En SQLite dos NULL son distintos, así que esto
-- no estorba a los eventos todavía sin anclar.
CREATE UNIQUE INDEX `OnChainEvent_txid_key` ON `OnChainEvent` (`txid`);
--> statement-breakpoint

-- Ledger del adaptador simulado del `AnchorPort` (D-060). **Solo se escribe con
-- `ANCHOR_MODE=simulated`**; con el adaptador real el ledger es Cardano y esta
-- tabla queda muerta.
--
-- Está en el esquema y no en memoria porque el simulador es producto, no un
-- stub: si el ledger muere con el proceso, reiniciar `pnpm dev` deja huérfanos
-- los hilos abiertos y se pierde la detección de doble gasto, que es lo único
-- que lo hace valer algo.
CREATE TABLE `SimulatedLedgerUtxo` (
	`outputRef` text PRIMARY KEY NOT NULL,
	`assetName` text NOT NULL,
	`datumJson` text NOT NULL,
	`spentByTxid` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
-- La propiedad del thread token, verificada sin cadena: **un solo UTxO vivo por
-- stage**.
CREATE UNIQUE INDEX `SimulatedLedgerUtxo_live_thread_key` ON `SimulatedLedgerUtxo` (`assetName`) WHERE `spentByTxid` IS NULL;
--> statement-breakpoint

-- ── Auditoría ───────────────────────────────────────────────────────────────

-- Append-only (regla 7): toda mutación relevante escribe acá vía
-- `writeAuditLog`, con actor, entidad, acción y timestamp.
CREATE TABLE `AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`actorUserId` text,
	`action` text NOT NULL,
	`entityType` text NOT NULL,
	`entityId` text NOT NULL,
	`metadataJson` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog` (`createdAt`);
