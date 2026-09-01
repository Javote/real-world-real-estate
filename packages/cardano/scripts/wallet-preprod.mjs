// Genera la wallet de servicio. Superficie 🔴.
//
// **Una sola clave, una sola vez.** El servicio recibe una CLAVE DE PAGO en
// bech32 y nada más (D-078). No hay seed, y no hay una segunda variable con la
// dirección: la dirección se **deriva** de la clave, así que es imposible
// configurar una que la clave no controle.
//
// **Por qué la dirección es "enterprise" y no una base.** Una dirección base es
// pago + staking: dos credenciales, o sea dos claves. Con una sola clave de pago
// no existe la opción de armar una base. No es una limitación de la librería, es
// la consecuencia de tener una sola clave — que es exactamente lo que queremos
// en un servicio que paga fees y nunca delega.
//
// **La clave se escribe a un archivo y NO se imprime.** Lo único que sale por
// pantalla es la dirección, que es pública y es la que hay que fondear. Un
// secreto en el scrollback de una terminal sobrevive a la sesión, se copia con
// el scroll y termina en capturas de pantalla.
//
// **No pisa un archivo existente, nunca.** El admin del validador es el hash de
// esta clave: regenerarla encima de una wallet ya fondeada y con hilos anclados
// dejaría esos hilos inalcanzables, sin ningún error visible.
//
//   BLOCKFROST_API_KEY=preprod_xxx node scripts/wallet-preprod.mjs [ruta]

import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Blockfrost, generatePrivateKey, Lucid, paymentCredentialOf } from "@lucid-evolution/lucid";

const RED = "Preprod";
const URL_BLOCKFROST = "https://cardano-preprod.blockfrost.io/api/v0";

const apiKey = process.env.BLOCKFROST_API_KEY?.trim();
if (!apiKey) {
  console.error("Falta BLOCKFROST_API_KEY (la de tu proyecto Preprod).");
  process.exit(1);
}

// Un proyecto de mainnet acá sería un error caro y silencioso: la clave quedaría
// asociada a una red que este proyecto no toca (D-013).
if (!apiKey.startsWith("preprod")) {
  console.error(
    `La key no empieza con "preprod": ${apiKey.slice(0, 8)}…\n` +
      "Este proyecto solo opera en Preprod (D-013). Usá la key del proyecto Preprod."
  );
  process.exit(1);
}

const destino = path.resolve(
  process.argv[2] ?? path.join(homedir(), "propnexus-wallet-preprod.key")
);

if (existsSync(destino)) {
  console.error(
    `Ya existe ${destino} y NO se pisa.\n` +
      "El admin del validador es el hash de esta clave: reemplazarla dejaría\n" +
      "inalcanzables los hilos ya anclados. Si de verdad querés otra, movela a mano primero."
  );
  process.exit(1);
}

const privateKey = generatePrivateKey();

// La dirección la deriva Lucid, la misma pieza que va a usar el servicio en
// producción: si acá saliera una y allá otra, este número no serviría de nada.
const lucid = await Lucid(new Blockfrost(URL_BLOCKFROST, apiKey), RED);
lucid.selectWallet.fromPrivateKey(privateKey);
const address = await lucid.wallet().address();

writeFileSync(destino, `${privateKey}\n`, { mode: 0o600 });

console.log(`Wallet de servicio creada para ${RED}.\n`);
console.log(`  clave     → ${destino}  (permisos 600, NO se imprime)`);
console.log(`  dirección → ${address}`);
console.log(`  admin del validador → ${paymentCredentialOf(address).hash}\n`);
console.log("Fondeá ESA dirección — es la única que el servicio va a mirar.");
console.log("  https://docs.cardano.org/cardano-testnets/tools/faucet\n");
console.log("Después, una sola variable de entorno y nunca más:");
console.log(`  SERVICE_WALLET_PRIVATE_KEY=<el contenido de ${path.basename(destino)}>\n`);
console.log("No se puede rotar: el admin del validador es su hash, y cambiarla");
console.log("obliga a migrar todos los hilos ya anclados.");
