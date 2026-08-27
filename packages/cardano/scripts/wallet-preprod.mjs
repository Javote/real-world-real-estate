// Genera la wallet de servicio para Preprod. Superficie 🔴.
//
// **La seed se escribe a un archivo y NO se imprime.** Lo único que sale por
// pantalla es la dirección, que es pública y hace falta para el faucet. Un
// secreto en el scrollback de una terminal sobrevive a la sesión, se copia con
// el scroll y termina en capturas de pantalla.
//
// **No pisa un archivo existente, nunca.** La dirección del script de anclaje se
// deriva del admin, que sale de esta wallet: regenerarla encima de una wallet ya
// fondeada y con hilos anclados dejaría esos hilos inalcanzables, sin ningún
// error visible. Si querés otra, mové la anterior a mano y sabé lo que hacés.
//
//   BLOCKFROST_API_KEY=preprod_xxx node scripts/wallet-preprod.mjs [ruta]

import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Blockfrost, generateSeedPhrase, Lucid } from "@lucid-evolution/lucid";

const RED = "Preprod";
const URL_BLOCKFROST = "https://cardano-preprod.blockfrost.io/api/v0";

const apiKey = process.env.BLOCKFROST_API_KEY?.trim();
if (!apiKey) {
  console.error("Falta BLOCKFROST_API_KEY (la de tu proyecto Preprod).");
  process.exit(1);
}

// Un proyecto de mainnet acá sería un error caro y silencioso: la seed quedaría
// asociada a una red que este proyecto no toca (D-013).
if (!apiKey.startsWith("preprod")) {
  console.error(
    `La key no empieza con "preprod": ${apiKey.slice(0, 8)}…\n` +
      "Este proyecto solo opera en Preprod (D-013). Usá la key del proyecto Preprod."
  );
  process.exit(1);
}

const destino = path.resolve(
  process.argv[2] ?? path.join(homedir(), "propnexus-wallet-preprod.txt")
);

if (existsSync(destino)) {
  console.error(
    `Ya existe ${destino} y NO se pisa.\n` +
      "La dirección del script de anclaje se deriva de esta wallet: reemplazarla dejaría\n" +
      "inalcanzables los hilos ya anclados. Si de verdad querés otra, movela a mano primero."
  );
  process.exit(1);
}

const seed = generateSeedPhrase();

const lucid = await Lucid(new Blockfrost(URL_BLOCKFROST, apiKey), RED);
lucid.selectWallet.fromSeed(seed);
const address = await lucid.wallet().address();

writeFileSync(destino, `${seed}\n`, { mode: 0o600 });

console.log("Wallet de servicio creada.\n");
console.log(`  seed      → ${destino}  (permisos 600, NO se imprime)`);
console.log(`  dirección → ${address}\n`);
console.log("Siguiente paso: fondearla desde el faucet de testnet");
console.log("  https://docs.cardano.org/cardano-testnets/tools/faucet\n");
console.log("Copiá la seed de ese archivo a tu gestor de passwords. No se puede rotar:");
console.log("cambiarla obliga a migrar todos los hilos ya anclados.");
