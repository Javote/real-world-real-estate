-- SPEC-503 — la encuesta NPS del investor: una pregunta, del 0 al 10, y un
-- comentario opcional. Se manda una sola vez por investor, proyecto y evento
-- que la dispara (D-104: la primera liberación de un contrato suyo), y se
-- responde con un token opaco, sin sesión, como el link público del dossier.
--
-- **No es prueba**: no se hashea ni se ancla. Es el dato con el que se
-- sustancia el criterio "buyer NPS ≥70" de M4, y por eso se mide en vez de
-- declararse.
--
-- `score` y `respondedAt` son nulos hasta que responde: "no sé" es no
-- responder, y un 0 es un detractor.
--
-- **Aditiva.** Tabla nueva: ninguna fila existente cambia.
CREATE TABLE `NpsSurvey` (
	`id` text PRIMARY KEY NOT NULL,
	`investorId` text NOT NULL,
	`projectId` text NOT NULL,
	`triggerEventType` text NOT NULL,
	`token` text NOT NULL,
	`score` integer,
	`comment` text,
	`sentAt` integer NOT NULL,
	`respondedAt` integer,
	FOREIGN KEY (`investorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `NpsSurvey_token_key` ON `NpsSurvey` (`token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `NpsSurvey_investorId_projectId_triggerEventType_key` ON `NpsSurvey` (`investorId`, `projectId`, `triggerEventType`);
