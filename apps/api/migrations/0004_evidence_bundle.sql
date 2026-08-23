-- `EvidenceBundle` es la entidad de `M1-D2/2-core-domain-model.puml`, que la
-- modela con `bundle_commitment_hash` y la ata 1–1 a `OnChainEvent`. Hasta hoy
-- no existía, y por eso un stage `validation_critical` se completaba en el
-- registro pero **no se podía anclar**: el validador exige 32 bytes de
-- commitment y nadie los calculaba (D-061).
--
-- El bundle es el conjunto de evidencia que sostiene el cierre de un stage, y
-- `commitmentHash` es su Merkle root (`packages/shared/src/merkle.ts`, donde
-- vive para que un tercero pueda reproducirlo sin confiar en nosotros).
--
-- Las filas del bundle son un ACTA, no un índice: se escriben una vez, con la
-- evidencia que existía en ese momento, y no se tocan. Si después se sube más
-- evidencia, es otro bundle — porque el root ya anclado tiene que seguir
-- verificando.
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
CREATE TABLE `EvidenceBundleItem` (
	`bundleId` text NOT NULL,
	`evidenceId` text NOT NULL,
	`sha256Hash` text NOT NULL,
	PRIMARY KEY (`bundleId`, `evidenceId`),
	FOREIGN KEY (`bundleId`) REFERENCES `EvidenceBundle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidenceId`) REFERENCES `Evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- El hash se copia en el item a propósito: si mañana se borra la fila de
-- `Evidence`, el bundle tiene que seguir explicando qué root ancló. Un
-- commitment que no se puede reconstruir no prueba nada.
CREATE INDEX `EvidenceBundleItem_evidenceId_idx` ON `EvidenceBundleItem` (`evidenceId`);
