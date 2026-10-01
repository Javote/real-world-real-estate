import { publicarReferenceScript } from "../dist/index.js";

const red = process.env.CARDANO_NETWORK?.trim() || "Preprod";

try {
  const resultado = await publicarReferenceScript({
    mode: "real",
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY,
    privateKey: process.env.SERVICE_WALLET_PRIVATE_KEY,
    network: red,
    blockfrostUrl: process.env.BLOCKFROST_URL
  });

  const ada = (Number(resultado.lovelace) / 1_000_000).toFixed(6);

  if (resultado.txid === null) {
    console.log(`El validador YA estaba publicado en ${red}. No se gastó nada.\n`);
  } else {
    console.log(`Validador publicado como reference script en ${red}.\n`);
    console.log(`  transacción → ${resultado.txid}`);
  }

  console.log(`  UTxO        → ${resultado.outputRef}`);
  console.log(`  inmovilizado→ ${ada} ADA (el mínimo del UTxO, no es valor)`);
  console.log(`  wallet      → ${resultado.walletAddress}`);
  console.log(`  script      → ${resultado.scriptAddress}\n`);

  if (resultado.txid !== null) {
    console.log("Falta un paso: esperá el bloque y REINICIÁ la API.");
    console.log("El reference script se descubre al arrancar; hasta entonces");
    console.log("la instancia desplegada sigue adjuntando el validador entero.");
  }
} catch (error) {
  console.error(`No se pudo publicar el reference script: ${error.message}`);
  process.exit(1);
}
