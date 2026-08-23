-- Todo stage es `validation_critical` (D-061).
--
-- `validation_critical` venía con DEFAULT false y **nadie lo llenaba**: en todo
-- `docs/` aparece dos veces —como atributo en `M1-D2/2-core-domain-model.puml` y
-- como "optional criticality metadata" en M2-D6— y ningún entregable dice qué
-- stage lo es. Era un flag que dependía de que quien crea el stage se acordara,
-- y del que dependía si la evidencia era obligatoria para completar. El dueño
-- cerró el hueco: todos.
--
-- SQLite no sabe cambiar el DEFAULT de una columna, así que la tabla se
-- reconstruye. El orden importa: se crea la nueva, se copia, se BORRA la vieja
-- y recién ahí se renombra. Renombrar primero reescribiría las cláusulas
-- FOREIGN KEY de `Evidence` y `OnChainEvent` para que apunten al nombre viejo
-- (`legacy_alter_table` está OFF por default), y quedarían colgando.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `Milestone_new` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`name` text NOT NULL,
	`sequenceOrder` integer NOT NULL,
	`state` text DEFAULT 'Pending' NOT NULL,
	`validationCritical` integer DEFAULT true NOT NULL,
	`certifiedAt` integer,
	`certifiedById` text,
	`scopeType` text DEFAULT 'project_wide' NOT NULL,
	`scopeUnitCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`certifiedById`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Los stages que ya existen pasan a críticos: la decisión es "todos", no
-- "todos los nuevos". Un proyecto sembrado antes de hoy no puede quedar con
-- reglas distintas al de mañana.
INSERT INTO `Milestone_new` (`id`, `projectId`, `name`, `sequenceOrder`, `state`, `validationCritical`, `certifiedAt`, `certifiedById`, `scopeType`, `scopeUnitCount`, `createdAt`, `updatedAt`)
SELECT `id`, `projectId`, `name`, `sequenceOrder`, `state`, 1, `certifiedAt`, `certifiedById`, `scopeType`, `scopeUnitCount`, `createdAt`, `updatedAt` FROM `Milestone`;
--> statement-breakpoint
DROP TABLE `Milestone`;
--> statement-breakpoint
ALTER TABLE `Milestone_new` RENAME TO `Milestone`;
--> statement-breakpoint
CREATE UNIQUE INDEX `Milestone_projectId_sequenceOrder_key` ON `Milestone` (`projectId`,`sequenceOrder`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
