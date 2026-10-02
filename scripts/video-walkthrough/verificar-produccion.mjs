#!/usr/bin/env node
// Verifica, SOLO LEYENDO, que producción está como el runbook del video espera
// (specs/archive/GUION-2026-09-21-video-walkthrough.md). Se corre el día anterior y
// otra vez antes de la sesión B:
//
//   node scripts/video-walkthrough/verificar-produccion.mjs            # antes de grabar
//   node scripts/video-walkthrough/verificar-produccion.mjs --despues  # terminada la sesión B
//
// No escribe nada (inicia sesión con cada rol y hace GETs). No abre el dossier
// de la 1A a propósito: esa lectura lo compila, y eso lo hace la pasada de
// calentamiento o T23.
import { API, despertar, entrar, pedir } from "./lib/api.mjs";

const despues = process.argv.includes("--despues");
let fallas = 0;
let avisos = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const mal = (m) => {
  fallas++;
  console.log(`  ✗ ${m}`);
};
const aviso = (m) => {
  avisos++;
  console.log(`  ! ${m}`);
};
const check = (cond, bien, malo) => (cond ? ok(bien) : mal(malo));

console.log(`API: ${API}`);
console.log(`Despertando Render… (en frío puede tardar más de un minuto)`);
console.log(`  ✓ respondió en ${await despertar()} s`);

const koios = await fetch("https://preprod.koios.rest/api/v1/address_info", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    _addresses: ["addr_test1vp3vy56p6lrghhntg8ytydnuugnqh7ctkyxn3rm35g4q2ggtqvncw"]
  })
})
  .then((r) => r.json())
  .catch(() => null);
const tada = koios?.[0] ? Number(koios[0].balance) / 1e6 : null;
console.log("\nWallet de servicio (Preprod)");
if (tada == null) aviso("no pude leer el saldo en Koios; revisalo a mano en cardanoscan");
else
  check(
    tada >= 100,
    `${tada.toFixed(1)} tADA (alcanza: la grabación y el ensayo usan ~35 cada uno)`,
    `${tada.toFixed(1)} tADA — menos de 100: pedí tADA al faucet antes de grabar`
  );

const t = {};
console.log("\nLas cinco cuentas");
for (const rol of ["investor", "developer", "certifier", "notary", "admin"]) {
  try {
    t[rol] = await entrar(rol);
    ok(`${rol} entra`);
  } catch (e) {
    mal(`${rol} no entra: ${e.message}`);
  }
}
if (fallas) process.exit(1);

console.log("\nInvestor (sesión A)");
const proyectos = await pedir("/projects", { token: t.investor });
const volumen = proyectos.filter((p) => p.name.startsWith("Torre Volumen"));
check(
  volumen.length === 3,
  've las tres Torre Volumen en "Buy"',
  `ve ${volumen.length} Torre Volumen, no 3`
);
check(
  volumen.every((p) => p.status === "completed"),
  'las tres en "Delivered"',
  'alguna no está en "Delivered"'
);
const sinCoords = volumen.filter((p) => p.latitude == null || p.longitude == null);
if (sinCoords.length)
  aviso(
    `${sinCoords.map((p) => p.name).join(", ")} sin coordenadas: el modo mapa de T01 sale sin pines ` +
      "y T01/T13 no muestran el mapa."
  );
else ok("las tres tienen coordenadas (el mapa de T01 muestra pines)");
const extra = proyectos.filter((p) => !p.name.startsWith("Torre Volumen"));
if (!despues && extra.length)
  aviso(`el investor ve además: ${extra.map((p) => p.name).join(", ")} (se van a ver en T01)`);
const favoritos = await pedir("/investor/favorites", { token: t.investor });
check(
  favoritos.length === 0,
  "favoritos vacío (T01 guarda Torre Volumen 3)",
  `ya tiene ${favoritos.length} favorito(s): sacalos con el corazón antes de T01`
);
const unidades = await pedir("/investor/units", { token: t.investor });
check(
  unidades.some((u) => u.unitReference === "1A" && u.projectName === "Torre Volumen 3"),
  `"My units" tiene la 1A de Torre Volumen 3 (${unidades.length} unidades en total)`,
  "no aparece la 1A de Torre Volumen 3"
);

console.log("\nDeveloper");
const delDev = await pedir("/developer/projects", { token: t.developer });
ok(`"My projects" muestra ${delDev.length} proyectos: ${delDev.map((p) => p.name).join(", ")}`);
const nuevo = delDev.filter((p) => p.name === "Torres de Palermo");
if (!despues)
  check(
    nuevo.length <= 1,
    nuevo.length
      ? '"Torres de Palermo" existe: es el que creó T07 (2026-10-01)'
      : 'todavía no existe "Torres de Palermo" (nace en T07)',
    `hay ${nuevo.length} "Torres de Palermo": borrá los de prueba antes de seguir`
  );

console.log("\nCertifier");
const cer = await pedir("/certifier/kpis", { token: t.certifier });
if (!despues) {
  check(
    cer.assigned === 0,
    'cola "Assigned" vacía (se llena en T15)',
    `la cola tiene ${cer.assigned} etapa(s): T18 va a mostrar más de una`
  );
  const inv = await pedir("/certifier/invitations", { token: t.certifier });
  check(
    inv.length === 0,
    "sin invitaciones pendientes",
    `hay ${inv.length} invitación(es) pendiente(s) del certifier`
  );
}
ok(`KPIs: ${cer.certified} certificadas, ${cer.observed} observadas`);

console.log("\nNotary");
const pend = await pedir("/notary/dossiers/pending", { token: t.notary });
if (!despues) {
  if (pend.length === 0)
    aviso(
      "cola vacía: la llena la pasada de calentamiento o T23 al abrir el dossier de la 1A (es lo esperado)"
    );
  else ok(`${pend.length} dossier(s) pendiente(s) — T25 firma el de la 1A`);
} else
  check(
    pend.length === 0,
    "cola vacía: el dossier de la 1A ya se firmó",
    `quedan ${pend.length} dossier(s) sin firmar`
  );

console.log("\nAdmin");
const usuarios = await pedir("/users", { token: t.admin });
check(
  usuarios.some((u) => u.role === "verifier" && u.fullName === "Verifier Demo" && u.isActive),
  '"Verifier Demo" activo (es el que se elige en el corte de T07)',
  'no hay un certifier "Verifier Demo" activo'
);

console.log(
  `\n${fallas ? `✗ ${fallas} problema(s)` : "✓ Todo en orden"}${avisos ? `, ${avisos} aviso(s)` : ""}.`
);
process.exit(fallas ? 1 : 0);
