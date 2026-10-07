import { db } from "../lib/db.js";
import { audit, type EntradaDeAudit } from "../platform/audit.js";

// La forma vieja, sobre `audit()` de `platform/`: las llamadas se van con su módulo en A4 (SPEC-616).
export async function writeAuditLog(params: EntradaDeAudit) {
  await insertAuditLog(params).execute();
}

// Sin ejecutar: para mandarlo con `enLote` junto con la mutación que audita.
export function insertAuditLog(params: EntradaDeAudit) {
  return audit(db, params);
}
