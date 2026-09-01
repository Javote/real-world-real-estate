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
-- Se llama `Stage` por herencia y **es deuda conocida**: el dominio dice
-- `ConstructionStage` y "milestone" queda reservado para los hitos de Catalyst
-- (D-023). El rename son 370 ocurrencias en 22 archivos y va en su propio
-- commit, con el frontend.
CREATE TABLE `Stage` (
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
CREATE UNIQUE INDEX `Stage_projectId_sequenceOrder_key` ON `Stage` (`projectId`,`sequenceOrder`);
--> statement-breakpoint

-- ── Evidencia ───────────────────────────────────────────────────────────────

-- `storagePath` es opaco y **jamás sale al cliente** (D-011): con
-- `STORAGE_DRIVER=disk` es una ruta, con `s3` es la key del objeto.
CREATE TABLE `Evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`stageId` text,
	`uploadedById` text NOT NULL,
	`evidenceType` text NOT NULL,
	`category` text NOT NULL,
	`authoritative` integer DEFAULT false NOT NULL,
	-- Quién declara haber emitido este documento (D-028 (a), acotada por D-084).
	-- Es una DECLARACIÓN, no una verificación: la plataforma no valida (D-026).
	-- Obligatoria cuando `authoritative = true`, y el rechazo ocurre en la
	-- transición, no en el upload — subir siempre se puede, avanzar no.
	`issuingAuthority` text,
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
	FOREIGN KEY (`stageId`) REFERENCES `Stage`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Evidence_projectId_idx` ON `Evidence` (`projectId`);
--> statement-breakpoint
CREATE INDEX `Evidence_stageId_idx` ON `Evidence` (`stageId`);
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
	`stageId` text NOT NULL,
	`commitmentHash` text NOT NULL,
	`createdById` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stageId`) REFERENCES `Stage`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `EvidenceBundle_stageId_idx` ON `EvidenceBundle` (`stageId`);
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
	`stageId` text,
	-- Solo en `EVIDENCE_ANCHOR`: qué archivo ancló esta transacción.
	`evidenceId` text,
	-- Ref OPACA al registro off-chain que este evento ancla, para los eventos
	-- de commitment que no cuelgan de un stage ni de una evidencia: la
	-- invitación aceptada, la liberación, la firma del dossier, el documento
	-- suelto. Sin ella el TXID de un release no se puede volver a encontrar
	-- salvo recomputando su commitment, que incluye un timestamp.
	-- **Es el id del registro, nunca un nombre ni un email** (regla 2).
	`referenceId` text,
	-- Posición en la secuencia de eventos on-chain del stage. El índice único
	-- con `stageId` es lo que vuelve **idempotente** el anclaje (regla 8):
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
	-- Contra qué ledger resuelve `txid` (D-080). Un TXID sin red es
	-- inverificable en cuanto exista más de una, y mainnet es inminente.
	-- Sale del `AnchorPort`, no de `CARDANO_NETWORK`: el env es lo que se pidió,
	-- el puerto es lo que se construyó, y leer el env acá los dejaría
	-- desincronizarse en silencio.
	-- NULL solo mientras no hay TXID —una fila nace `Pending` y puede terminar
	-- `Failed` sin anclar nunca—; el CHECK de abajo hace imposible el par
	-- (txid sin red), que es lo único que esta columna existe para impedir.
	`network` text,
	-- UTxO del thread token: `txid#index`. **Estado crítico**: si se pierde, el
	-- token queda en un UTxO que nadie sabe cuál es y ese stage no se puede
	-- volver a mover nunca (D-058).
	`outputRef` text,
	`blockTimestamp` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stageId`) REFERENCES `Stage`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`evidenceId`) REFERENCES `Evidence`(`id`) ON UPDATE no action ON DELETE set null,
	-- Un TXID sin red es inverificable: que sea estructuralmente imposible, y no
	-- una regla que alguien tiene que acordarse de respetar.
	CONSTRAINT `OnChainEvent_txid_exige_network` CHECK (`txid` IS NULL OR `network` IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `OnChainEvent_stageId_eventIndex_key` ON `OnChainEvent` (`stageId`,`eventIndex`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_stageId_idx` ON `OnChainEvent` (`stageId`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_evidenceId_idx` ON `OnChainEvent` (`evidenceId`);
--> statement-breakpoint
CREATE INDEX `OnChainEvent_referenceId_idx` ON `OnChainEvent` (`referenceId`);
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
--> statement-breakpoint

-- Preferencias de notificación del usuario (M2-D5 `PATCH /profile/notifications`).
-- JSON en una columna y no una tabla: es un blob de preferencias por usuario,
-- sin relaciones ni consultas por su contenido. El día que haga falta filtrar
-- por una preferencia, será una tabla.
ALTER TABLE `User` ADD COLUMN `notificationPrefsJson` text;
--> statement-breakpoint

-- Favoritos del investor (M2-D1 §Investor bottom nav · M2-D5 fila 13).
-- Es la entidad más chica del backlog y no toca la cadena de prueba: un usuario
-- marca un proyecto, nada más.
CREATE TABLE `Favorite` (
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY (`userId`, `projectId`),
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Favorite_userId_idx` ON `Favorite` (`userId`);
--> statement-breakpoint

-- ── Lo comercial: unidad, invitación, contrato, liberaciones ───────────────
--
-- D-029: los stages son del PROYECTO; la unidad es lo comercial y **nace en la
-- subdivisión**, un paso tardío. Un proyecto pasa tiempo acumulando stages y
-- evidencia con cero unidades, y el modelo lo soporta: `Unit` no es requisito
-- de nada anterior.

CREATE TABLE `Unit` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`unitReference` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`floor` integer,
	`sizeM2` integer,
	-- Unidades mínimas enteras (regla 1): jamás float para dinero.
	`priceMinorUnits` integer,
	`currency` text,
	-- El investor asignado. Null hasta que acepta una invitación.
	`investorId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Unit_projectId_unitReference_key` ON `Unit` (`projectId`,`unitReference`);
--> statement-breakpoint
CREATE INDEX `Unit_investorId_idx` ON `Unit` (`investorId`);
--> statement-breakpoint

-- El developer invita; el investor acepta o rechaza. Aceptar ancla (M3-SC-01).
CREATE TABLE `Invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`unitId` text NOT NULL,
	`investorEmail` text NOT NULL,
	`amountMinorUnits` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`respondedAt` integer,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Invitation_unitId_idx` ON `Invitation` (`unitId`);
--> statement-breakpoint

-- Un contrato por unidad e investor. **No custodia nada** (D-021): es el
-- registro del acuerdo, y el cronograma de pagos es dato, no plata que se mueva.
CREATE TABLE `Contract` (
	`id` text PRIMARY KEY NOT NULL,
	`unitId` text NOT NULL,
	`investorId` text NOT NULL,
	`totalMinorUnits` integer NOT NULL,
	`currency` text NOT NULL,
	`signedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Contract_unitId_key` ON `Contract` (`unitId`);
--> statement-breakpoint

-- **Cada liberación es un evento on-chain propio** (M2-D4 P10): el contrato es
-- una entidad lógica, el artefacto anclado es cada release. "Release" significa
-- anclar el evento, no ejecutar el pago (D-021).
CREATE TABLE `PaymentRelease` (
	`id` text PRIMARY KEY NOT NULL,
	`contractId` text NOT NULL,
	`stageNumber` integer NOT NULL,
	`amountMinorUnits` integer NOT NULL,
	`releasedById` text,
	`releasedAt` integer NOT NULL,
	FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`releasedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PaymentRelease_contractId_stageNumber_key` ON `PaymentRelease` (`contractId`,`stageNumber`);
--> statement-breakpoint

-- ── El dossier (M2-D4 P8) ──────────────────────────────────────────────────
--
-- "El dossier tiene un hash": `masterHash` compromete el artefacto compilado en
-- un momento. Si algo adentro cambia, el hash cambia — y eso es lo que vuelve
-- verificable el link de solo lectura que se le pasa a un notario.
CREATE TABLE `Dossier` (
	`id` text PRIMARY KEY NOT NULL,
	`unitId` text NOT NULL,
	`masterHash` text NOT NULL,
	`compiledAt` integer NOT NULL,
	-- Token opaco del link público. Null mientras no se comparta.
	`shareToken` text,
	`status` text DEFAULT 'compiled' NOT NULL,
	`signedById` text,
	`signedAt` integer,
	`rejectionNote` text,
	FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Dossier_shareToken_key` ON `Dossier` (`shareToken`);
--> statement-breakpoint
CREATE INDEX `Dossier_unitId_idx` ON `Dossier` (`unitId`);
--> statement-breakpoint

-- ── Notificaciones ─────────────────────────────────────────────────────────
--
-- Las cinco categorías son las mismas del audit log (M2-D4 P6): stage,
-- document, release, signature, certificate.
CREATE TABLE `Notification` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`category` text NOT NULL,
	`titleKey` text NOT NULL,
	-- Datos para interpolar en la clave. El backend manda CLAVES, no copy
	-- (regla 15): el cliente renderiza según su locale.
	`paramsJson` text,
	`unitId` text,
	`readAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Notification_userId_readAt_idx` ON `Notification` (`userId`,`readAt`);
