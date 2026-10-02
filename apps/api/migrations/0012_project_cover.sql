-- D-099 — la portada del proyecto: una imagen comercial (un render, una foto de
-- fachada) que se carga en el alta y se dibuja en la card del listado.
--
-- M2-D3 la exige en `ProjectCard` ("Cover image (16:9) with overlaid developer
-- chip") y las capturas 2 y 6 de M2-D2 la muestran, pero el alta (34b/34C) no
-- tiene dónde cargarla: el entregable se contradice. Hasta hoy la card dibujaba
-- una superficie neutra y el detalle tomaba como portada la primera evidencia
-- que fuera foto.
--
-- **No es evidencia.** No se hashea, no se ancla y no entra a ningún bundle: un
-- render es material comercial y D-026 limita lo que la plataforma afirma a los
-- documentos y sus atestaciones. Por eso no vive en `Evidence`.
--
-- **Tabla propia para lo guardado, columna en `Project` para la versión.**
-- `storageRef` es opaco y nunca sale al cliente (D-011), y `Project` se lee con
-- `selectAll()` en decenas de lugares contra un `projectSchema` estricto: una
-- columna con la ref ahí la haría viajar o rompería esas lecturas. En `Project`
-- queda solo `coverUpdatedAt`, que es lo que el front necesita — si hay imagen,
-- y con qué versión pedirla para que la caché no la tape al cambiarla.
--
-- **Aditiva.** Tabla nueva más una columna anulable: ninguna fila existente
-- cambia, y un proyecto sin portada se dibuja como hasta hoy.
CREATE TABLE `ProjectCover` (
	`projectId` text PRIMARY KEY NOT NULL,
	`storageRef` text NOT NULL,
	`mimeType` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`uploadedById` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

ALTER TABLE `Project` ADD COLUMN `coverUpdatedAt` integer;
