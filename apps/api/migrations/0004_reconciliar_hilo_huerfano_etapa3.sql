-- Corrige el bookkeeping de un anclaje real que la aplicación perdió —
-- specs/REPORTE-2026-09-10-prueba-de-volumen.md §Hallazgo.
--
-- Torre Volumen 1 · Etapa 3 ("Movimiento de suelos y excavación", stageId
-- `htmx2hhsfgazxzl4xsnrh9pz`): la transacción de "Reanudar etapa"
-- (Observed → InProgress) SÍ se ejecutó y confirmó en Preprod —
-- `propnexus-api` se cayó (D-077, ver el reporte) entre que Blockfrost la
-- aceptó y que el `UPDATE OnChainEvent` que guarda el recibo llegó a correr.
-- El evento quedó con `txid`/`outputRef` en NULL para siempre, mientras el
-- UTxO real del hilo (verificado contra Cardano Preprod vía Koios, no solo
-- contra la base) sigue vivo y sin gastar.
--
-- Este UPDATE no ancla nada nuevo — no toca la cadena, no gasta ADA. Solo
-- hace que `cabezaDelHilo()` vuelva a apuntar al UTxO que ya existe de
-- verdad, para que un futuro anclaje sobre este stage (si se decide hacer
-- uno) construya la transacción correcta en vez de intentar gastar el UTxO
-- viejo, ya gastado por esta misma transacción.
--
-- `AND txid IS NULL` es una guarda de idempotencia (regla 8): si este
-- archivo se re-aplicara sobre una base donde el evento ya tiene TXID —la
-- de producción, después de esta migración; o una base nueva donde este id
-- no significa lo mismo—, no hace nada.
UPDATE `OnChainEvent`
SET `txid` = '9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68',
    `outputRef` = '9a57f563e7d5627f22d9a062d26049d48789c91014d8b676298c0eb7c71f9e68#0',
    `network` = 'Preprod',
    `status` = 'Confirmed',
    -- El `block_time` real de Koios (bloque 5161038), no el momento en que
    -- se corrió esta migración: es lo que se puede sustanciar contra la
    -- cadena (regla 17), no cuándo alguien se dio cuenta del problema.
    `blockTimestamp` = 1789059296000,
    `updatedAt` = unixepoch() * 1000
WHERE `id` = 'amc9u0gyovc9tlf5z9ceh4db' AND `txid` IS NULL;
