# Contrato: máquina de estados de Milestone (Aiken)

## Los 4 estados (del diseño aprobado)

```
Pending ──Start──▶ InProgress ──Certify──▶ Certified
                      │  ▲                    │
                  Flag│  │Reopen          Flag│
                      ▼  │                    ▼
                     Observed ◀───────────────┘
```

| Acción | Transición | Firma requerida | Regla extra on-chain |
|---|---|---|---|
| `Start` | Pending → InProgress | developer | no toca evidencia ni `certified_at` |
| `Certify` | InProgress → Certified | certifier | `evidence_root` (Merkle) obligatorio + `certified_at` coherente con el validity range de la tx |
| `Flag` | InProgress/Certified → Observed | certifier | preserva evidencia y fecha previas |
| `Reopen` | Observed → InProgress | developer | preserva evidencia |

## Cómo funciona (patrón state-thread)

- Cada milestone es **un UTxO** en la dirección del script, identificado por un **thread token** (NFT de la misma policy, `asset_name = milestone_ref`). El token garantiza que existe un único "hilo" por milestone y que nadie puede falsificar el estado creando UTxOs paralelos.
- **Crear** un milestone = acuñar el token (`Init`) depositándolo en el script con datum `Pending`. Requiere la firma del developer.
- **Transicionar** = gastar el UTxO con el redeemer de la acción y recrearlo en la misma dirección con el datum nuevo. El validador exige: transición válida según la tabla, firma del actor correcto, identidad inmutable (`milestone_ref`, `developer`, `certifier`) y exactamente una salida de continuación con el token.
- El **TXID de cada transición** es la prueba pública: se guarda en `onchain_events` con `event_type` correspondiente y alimenta los `TxidModal`/`HashChip` del frontend.

## Instalación en el monorepo

```bash
# desde la raíz del repo
cp lib/plataforma/milestone.ak      contracts/lib/plataforma/milestone.ak
cp validators/milestone_state.ak    contracts/validators/milestone_state.ak
cd contracts
aiken check    # corre los 10 tests del núcleo puro
aiken build    # regenera plutus.json con el nuevo validador
```

## Integración desde `packages/cardano` (Lucid Evolution, esbozo)

```ts
import { Lucid, Data, fromText, validatorToAddress, validatorToScriptHash } from "@lucid-evolution/lucid";
import blueprint from "../../../contracts/plutus.json";

// Schemas Data espejando el datum/redeemer de Aiken
const MilestoneState = Data.Enum([
  Data.Literal("Pending"), Data.Literal("InProgress"),
  Data.Literal("Certified"), Data.Literal("Observed"),
]);
const MilestoneDatum = Data.Object({
  milestone_ref: Data.Bytes(),
  developer: Data.Bytes(),
  certifier: Data.Bytes(),
  state: MilestoneState,
  evidence_root: Data.Bytes(),
  certified_at: Data.Integer(),
});

// Init: mint del thread token + lock en Pending
// Certify (ejemplo): gastar el UTxO del milestone y recrearlo Certified
async function certify(lucid: Lucid, utxo, old, merkleRootHex: string) {
  const now = BigInt(Date.now());
  const newDatum = { ...old, state: "Certified", evidence_root: merkleRootHex, certified_at: now };
  const tx = await lucid.newTx()
    .collectFrom([utxo], Data.to({ Certify: { evidence_root: merkleRootHex, now } }, /* Action */))
    .pay.ToContract(scriptAddress, { kind: "inline", value: Data.to(newDatum, MilestoneDatum) },
      { [policyId + assetName]: 1n })
    .validFrom(Number(now))                 // lower bound = now (lo exige el validador)
    .addSignerKey(certifierKeyHash)          // co-firma CIP-30 del certificador
    .attach.SpendingValidator(validator)
    .complete();
  // ...firmar (servicio + certificador) y submit → txid
}
```

## Encaje con la arquitectura aprobada

El baseline (§11) es explícito: la primera fase **no** exige enforcement on-chain del ciclo de vida — el backend sigue siendo la fuente de verdad operativa. Este validador es la pieza de **Fase B** para los milestones donde el enforcement on-chain se justifique (p. ej. `validation_critical = true`, o como precondición del release de pagos M3-SC-03, que puede verificar la certificación vía reference input al UTxO del milestone en estado `Certified`). Para el resto, el anclaje por metadata de Fase A sigue siendo suficiente y más barato.

## Tests pendientes antes de considerarlo listo

Los 10 tests incluidos cubren el núcleo puro (tabla de transiciones y matriz de firmantes). Falta agregar tests de validador con transacciones mockeadas (`cardano/transaction` de prueba o `mocktail`/fixtures según la stdlib instalada) para:

- [ ] Certify sin firma del certificador → rechaza
- [ ] Certify con `evidence_root` vacío → rechaza
- [ ] Continuación que cambia `developer`/`certifier`/`milestone_ref` → rechaza
- [ ] Dos salidas de continuación con el token (split del hilo) → rechaza
- [ ] Init que acuña 2 tokens o deposita fuera del script → rechaza
- [ ] Gasto de dos milestones satisfaciendo un solo chequeo (double-satisfaction) → rechaza
- [ ] Retire con cantidad positiva → rechaza
