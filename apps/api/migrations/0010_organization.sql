-- SPEC-220 — la organización desarrolladora existe como entidad.
--
-- Las capturas 59 y 60 de M2-D2 (`DEVELOPER-REPUTATION-A/B`) muestran el perfil
-- de un desarrollador: "Grupo Alpine", su bio, sus años en el rubro y sus obras
-- previas y activas. Hasta hoy eso no tenía dónde vivir: un developer es un
-- `User` con `role='developer'`, cuyos únicos campos de identidad son `email` y
-- `fullName` — que es una PERSONA. `ProjectCard.developerName` ya documentaba
-- esta deuda palabra por palabra: *"no hay entidad de organización en ningún
-- lado… poner el `fullName` del developer acá diría que el desarrollo lo hace
-- una persona física, que es una afirmación distinta y probablemente falsa"*.
--
-- **Qué se guarda y qué se deriva.** Solo se guarda lo que nadie puede calcular:
-- el nombre, la bio y el año de fundación (los tres, autodeclarados por el
-- desarrollador). Obras entregadas, unidades vendidas, inversores y los
-- listados de obras previas y activas **se derivan** de `Project` y `Unit` en
-- cada lectura — son hechos del registro, no campos que alguien mantiene.
--
-- **El rating NO está, y es una decisión, no un olvido** (D-094). Las capturas
-- muestran "4.8 / 5.0 · 127 investors". Un rating es una afirmación sobre la
-- calidad del desarrollador, y D-026 limita lo que la plataforma sostiene a
-- cuatro afirmaciones, todas sobre documentos y atestaciones. No hay reseñas,
-- no hay quién las firme y no hay de dónde recalcularlo: una columna `rating`
-- solo podría llenarse a mano, que es fabricar la señal. Mismo criterio que
-- D-070 con el botón de liberar pagos.
--
-- **Aditiva y reversible.** Tabla nueva más una columna anulable: ninguna fila
-- existente cambia de forma y un proyecto sin organización sigue siendo válido
-- (se dibuja como ausencia, igual que hoy). No hace falta backfill para que la
-- base quede consistente — el seed la puebla para la demo.
CREATE TABLE `Organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`foundedYear` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Organization_slug_key` ON `Organization` (`slug`);
--> statement-breakpoint

-- Anulable a propósito: los 7 proyectos que ya existen en Preprod no tienen
-- organización y no se les inventa una.
ALTER TABLE `Project` ADD COLUMN `organizationId` text REFERENCES `Organization`(`id`);
--> statement-breakpoint
CREATE INDEX `Project_organizationId_idx` ON `Project` (`organizationId`);
