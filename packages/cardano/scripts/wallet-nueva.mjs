import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Blockfrost, generatePrivateKey, Lucid, paymentCredentialOf } from "@lucid-evolution/lucid";

const REDES = {
  Preprod: { prefijo: "preprod", url: "https://cardano-preprod.blockfrost.io/api/v0" },
  Mainnet: { prefijo: "mainnet", url: "https://cardano-mainnet.blockfrost.io/api/v0" }
};

const RED = process.env.CARDANO_NETWORK?.trim() || "Preprod";
const red = REDES[RED];
if (!red) {
  console.error(`CARDANO_NETWORK="${RED}" no está permitida acá. Valores: Preprod | Mainnet.`);
  process.exit(1);
}

const apiKey = process.env.BLOCKFROST_API_KEY?.trim();
if (!apiKey) {
  console.error(`Falta BLOCKFROST_API_KEY (la de tu proyecto ${RED}).`);
  process.exit(1);
}

if (!apiKey.startsWith(red.prefijo)) {
  console.error(
    `La key no empieza con "${red.prefijo}": ${apiKey.slice(0, 8)}…\n` +
      `Una wallet de ${RED} se crea con la key del proyecto ${RED} de Blockfrost.`
  );
  process.exit(1);
}

const destino = path.resolve(
  process.argv[2] ?? path.join(homedir(), `propnexus-wallet-${red.prefijo}.key`)
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

const lucid = await Lucid(new Blockfrost(red.url, apiKey), RED);
lucid.selectWallet.fromPrivateKey(privateKey);
const address = await lucid.wallet().address();

writeFileSync(destino, `${privateKey}\n`, { mode: 0o600 });

console.log(`Wallet de servicio creada para ${RED}.\n`);
console.log(`  clave     → ${destino}  (permisos 600, NO se imprime)`);
console.log(`  dirección → ${address}`);
console.log(`  admin del validador → ${paymentCredentialOf(address).hash}\n`);
console.log("Fondeá ESA dirección — es la única que el servicio va a mirar.");
console.log(
  RED === "Mainnet"
    ? "  Con ADA real y por tramos: lo que queda en una clave caliente es lo que se pierde (D-105).\n"
    : "  https://docs.cardano.org/cardano-testnets/tools/faucet\n"
);
console.log("Después, una sola variable de entorno y nunca más:");
console.log(`  SERVICE_WALLET_PRIVATE_KEY=<el contenido de ${path.basename(destino)}>\n`);
console.log("No se puede rotar: el admin del validador es su hash, y cambiarla");
console.log("obliga a migrar todos los hilos ya anclados.");
