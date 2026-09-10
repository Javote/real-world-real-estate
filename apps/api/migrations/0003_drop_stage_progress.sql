-- M3 §Tanda 1.1 — "signers/percentages configurables" (criterio 3 del SOM) no
-- existe en ningún entregable (M2-D1 §4, M2-D3, M2-D5, la captura 34C):
-- ninguno declara un peso por stage ni una pantalla para cargarlo. El avance
-- de un proyecto es derivado (`completadas/total`, captura 45), no una suma
-- ponderada. `progressPercentage` nació en 0001_stage_progress.sql leyendo el
-- SOM en vez de los entregables — la regla de precedencia (entregables M2/M3
-- sobre el SOM, dueño 2026-09-09) la resuelve: no se construye, se borra.
-- Ningún call site quedaba escribiéndola con un valor real (siempre `null`).
ALTER TABLE `Stage` DROP COLUMN `progressPercentage`;
