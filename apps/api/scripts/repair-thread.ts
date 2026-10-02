import "dotenv/config";
import { createAnchorPort } from "@plataforma/cardano";
import {
  buildStageDatum,
  canTransition,
  refToHex,
  STAGE_STATES,
  type StageState
} from "@plataforma/shared";
import { db } from "../src/lib/db";

interface Args {
  stageId: string;
  to: StageState;
  evidenceRoot: string;
  completedAt: number;
  confirmar: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };

  const stageId = get("--stage");
  const to = get("--to");
  if (!stageId || !to) {
    throw new Error(
      "Uso: tsx repair-thread.ts --stage <stageId> --to <InProgress|Observed|Completed> " +
        "[--evidence-root <hex>] [--completed-at <ms>] [--confirm]"
    );
  }
  if (!STAGE_STATES.includes(to as StageState)) {
    throw new Error(`--to inválido: "${to}". Valores: ${STAGE_STATES.join(" | ")}`);
  }

  return {
    stageId,
    to: to as StageState,
    evidenceRoot: get("--evidence-root") ?? "",
    completedAt: get("--completed-at") ? Number(get("--completed-at")) : Date.now(),
    confirmar: argv.includes("--confirm")
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.BLOCKFROST_API_KEY;
  const privateKey = process.env.SERVICE_WALLET_PRIVATE_KEY;
  if (!apiKey || !privateKey) {
    throw new Error("Faltan BLOCKFROST_API_KEY / SERVICE_WALLET_PRIVATE_KEY en el entorno.");
  }

  const stage = await db
    .selectFrom("Stage")
    .selectAll()
    .where("id", "=", args.stageId)
    .executeTakeFirst();
  if (!stage) throw new Error(`No existe el stage ${args.stageId}`);

  console.log(
    `[repair-thread] stage "${stage.name}" (${stage.id}) — estado en la base: ${stage.state}`
  );

  const port = await createAnchorPort({
    mode: "real",
    blockfrostApiKey: apiKey,
    privateKey,
    network: process.env.CARDANO_NETWORK ?? "Preprod"
  });
  console.log(`[repair-thread] puerto real listo, red: ${port.network}`);

  const stageRef = refToHex(stage.id);
  const vivo = await port.findLiveThread(stageRef);
  if (!vivo) {
    throw new Error(
      `No hay ningún hilo vivo para el stage ${stage.id} — nunca minteó, o el proveedor todavía no lo indexó.`
    );
  }

  console.log("[repair-thread] hilo vivo encontrado:");
  console.log(`  outputRef: ${vivo.outputRef}`);
  console.log(`  datum:     ${JSON.stringify(vivo.datum)}`);

  if (!canTransition(vivo.datum.state, args.to)) {
    throw new Error(`Transición inválida en la FSM: ${vivo.datum.state} → ${args.to}`);
  }

  const next = buildStageDatum({
    id: stage.id,
    projectId: stage.projectId,
    sequenceOrder: stage.sequenceOrder,
    validationCritical: stage.validationCritical,
    state: args.to,
    evidenceRoot: args.evidenceRoot,
    completedAt: args.to === "Completed" ? args.completedAt : 0
  });

  console.log("[repair-thread] datum siguiente que se armaría:");
  console.log(`  ${JSON.stringify(next)}`);

  if (!args.confirmar) {
    console.log(
      "\n[repair-thread] DRY RUN — no se firmó ni envió nada. Volvé a correr con --confirm para mandar la transacción real."
    );
    return;
  }

  console.log("\n[repair-thread] --confirm presente: enviando la transacción real...");
  const recibo = await port.advanceThread({
    outputRef: vivo.outputRef,
    previous: vivo.datum,
    next
  });

  console.log("[repair-thread] RECEIPT txid:", recibo.txid);
  console.log("[repair-thread] RECEIPT outputRef:", recibo.outputRef);
  console.log("[repair-thread] RECEIPT status:", recibo.status);
  console.log(
    "\n[repair-thread] La transacción salió. El bookkeeping de OnChainEvent no se tocó — " +
      "correr POST /evidence/reconcile (o esperar a la próxima lectura, D-077) para que el " +
      "evento correspondiente confirme, si ya existe una fila STAGE_TRANSITION esperando este TXID. " +
      "Si no existe ninguna fila (la transición nunca se había intentado), hay que insertarla a mano " +
      "con este txid/outputRef — revisado, como cualquier otro UPDATE de producción."
  );
}

main().catch((error) => {
  console.error("[repair-thread] FALLÓ:", error);
  process.exit(1);
});
