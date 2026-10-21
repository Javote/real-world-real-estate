-- SPEC-502 — el registro de disputas: una de las partes de un stage no está de
-- acuerdo, o el desenlace no es subir mejor evidencia sino devolver lo liberado.
-- `Observed` (D-020) sigue siendo la remediación cuando las dos partes están de
-- acuerdo; esto es lo que pasa cuando no.
--
-- **Nunca toca la cadena ni el valor** (D-021): `reason` y `resolution` son
-- 100% off-chain y ninguna disputa produce un `OnChainEvent`. Un `RefundAgreed`
-- registra la declaración de un reembolso acordado fuera de la plataforma.
--
-- `projectId` se guarda directo, no por join a `Stage`: listar las disputas de
-- un proyecto es la consulta que se hace, y la que la guarda de dos capas
-- resuelve (`accesoPorEntidad` lee `Dispute.projectId`).
--
-- **Aditiva.** Tabla nueva: ninguna fila existente cambia.
CREATE TABLE `Dispute` (
	`id` text PRIMARY KEY NOT NULL,
	`stageId` text NOT NULL,
	`projectId` text NOT NULL,
	`openedById` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`outcome` text,
	`resolution` text,
	`resolvedById` text,
	`createdAt` integer NOT NULL,
	`resolvedAt` integer,
	FOREIGN KEY (`stageId`) REFERENCES `Stage`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`openedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Dispute_projectId_status_idx` ON `Dispute` (`projectId`, `status`);
