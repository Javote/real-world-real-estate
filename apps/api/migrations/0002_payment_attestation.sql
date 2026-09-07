-- "PaymentRelease" sonaba a que la plataforma ejecuta el pago. No lo hace
-- (D-021, D-070): registra que alguien DECLARÓ que una liberación ya ocurrió
-- afuera, y ancla esa declaración. `PaymentAttestation` es el nombre que
-- coincide con lo que el dato realmente es — mismo lenguaje que D-026 ("esta
-- persona atestiguó haberlo revisado"). Las rutas y los test IDs de M2-D5
-- (`/contracts/:contractId/releases`, `INV-RELEASES-LIST-002`, etc.) NO
-- cambian: son literales del entregable, ajenos al nombre interno de la tabla.
ALTER TABLE `PaymentRelease` RENAME TO `PaymentAttestation`;
--> statement-breakpoint
DROP INDEX `PaymentRelease_contractId_stageNumber_key`;
--> statement-breakpoint
CREATE UNIQUE INDEX `PaymentAttestation_contractId_stageNumber_key` ON `PaymentAttestation` (`contractId`,`stageNumber`);
