-- SPEC-221 / D-095 — el admin invita a un certifier a un proyecto, y el
-- certifier acepta o rechaza.
--
-- Hasta hoy la única forma de que un certifier viera las etapas de un proyecto
-- nuevo era `POST /projects/:id/members`, admin-only y sin pantalla: se corrió
-- por consola en la prueba de volumen (3 proyectos) y hacía falta otra vez para
-- el video. El buyer, en cambio, ya entraba por un flujo: invitación del
-- developer → aceptación → membresía (`investor.routes.ts`).
--
-- **Tabla propia y no una columna más en `Invitation`.** Esa tabla es la
-- invitación a COMPRAR: `unitId`, `amountMinorUnits` y `currency` son NOT NULL,
-- y aceptarla crea un contrato. Una invitación a certificar no tiene unidad ni
-- monto; meterla ahí obligaba a volver anulables tres columnas —en SQLite,
-- reconstruir la tabla— y a que cada lector de `Invitation` distinguiera dos
-- cosas que no se parecen.
--
-- **Por `certifierId` y no por email.** La del buyer viaja al email porque
-- existe antes de que el investor tenga cuenta. Un certifier ya es un `User`
-- con rol `verifier`: el admin lo elige de la lista.
--
-- **Aditiva.** Tabla nueva: ninguna fila existente cambia.
CREATE TABLE `CertifierInvitation` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`certifierId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdById` text,
	`createdAt` integer NOT NULL,
	`respondedAt` integer,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`certifierId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `CertifierInvitation_certifierId_idx` ON `CertifierInvitation` (`certifierId`);
--> statement-breakpoint

-- Una sola invitación PENDIENTE por (proyecto, certifier). Parcial a propósito:
-- después de un rechazo se puede volver a invitar, y el historial queda.
CREATE UNIQUE INDEX `CertifierInvitation_pending_key` ON `CertifierInvitation` (`projectId`, `certifierId`) WHERE `status` = 'pending';
