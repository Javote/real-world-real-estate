// Publica el validador como reference script. Superficie 🟡.
//
// **Qué hace y por qué.** Hoy cada transacción de hilo lleva el validador
// entero adentro: 2289 bytes que se pagan y se transmiten cada vez. Un
// reference script es un UTxO que lleva el script una sola vez; a partir de ahí
// las transacciones lo **referencian**. Medido contra el `Emulator`: 2890 → 599
// bytes, y el fee de un `openThread` baja de 0,2976 a 0,2317 tADA.
//
// **Se corre una vez por red, y es idempotente**: vuelve a mirar la cadena
// antes de publicar, así que correrlo dos veces no gasta dos veces.
//
// **Después hay que reiniciar la API.** El reference script se descubre al
// arrancar el proceso: una API que ya está corriendo sigue adjuntando el
// validador hasta el próximo deploy o restart. No rompe nada — solo paga de más.
//
// **El ADA que queda inmovilizado no es valor** (D-021): es el mínimo que
// Cardano exige para que un UTxO con un script adentro exista. Queda en la
// dirección de la wallet de servicio, así que es recuperable con una
// transacción deliberada; ninguna de las nuestras lo va a tocar.
//
//   BLOCKFROST_API_KEY=preprod_xxx \
//   SERVICE_WALLET_PRIVATE_KEY=ed25519e_sk… \
//   pnpm --filter @plataforma/cardano ref:publish

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
