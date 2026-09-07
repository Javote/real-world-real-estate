-- M3 §1 — "≥8 stages con signers/percentages configurables" (D-021): el
-- porcentaje NO es de dinero, es de avance de obra. `progressPercentage` es
-- cuánto pesa este stage sobre el 100% del proyecto cuando llega a
-- `Completed`. Nullable: un stage sembrado antes de esta columna, o uno que
-- un developer crea sin catálogo, no tiene por qué declararlo.
ALTER TABLE `Stage` ADD `progressPercentage` integer;
