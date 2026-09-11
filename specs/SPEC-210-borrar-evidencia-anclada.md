# SPEC-210 — Borrar evidencia anclada corta el vínculo y devuelve el error equivocado

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-15.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## El problema, en una frase

`DELETE /evidence/:id` (`evidence.routes.ts:369`, admin-only) borra el archivo del storage y la fila,
**sin preguntar si esa evidencia tiene anclaje**. La FK hace `ON DELETE set null` sobre
`OnChainEvent.evidenceId`: **el TXID sobrevive en la cadena y en la tabla, y el vínculo con el archivo
que probaba desaparece.** Queda un evento `EVIDENCE_ANCHOR` que ancló el hash de nada.

Y si la evidencia está adentro de un `EvidenceBundle`, `EvidenceBundleItem` tiene la FK con
`ON DELETE no action`: el borrado corta con `SQLITE_CONSTRAINT_FOREIGNKEY`, que `errorHandler` traduce
a **400 "A referenced resource does not exist"** — **un mensaje que describe el problema inverso al
real**. El cliente lee "el recurso referenciado no existe" cuando lo que pasa es que el recurso *está
referenciado*.

## Qué se cambia

**409 explícito con `EVIDENCE_ANCHORED` antes de intentar el borrado**, mirando las dos condiciones:
que exista un `OnChainEvent` apuntándole, y que pertenezca a un `EvidenceBundle`.

Es **la regla 3 aplicada al otro extremo del ciclo**: si el hash es el ticket de entrada a la cadena de
prueba, borrar la fila de atrás tiene que costar más que un `DELETE`.

## Lo que esta spec no decide

**Qué hacer con una evidencia anclada que de verdad hay que sacar.** Hoy no hay respuesta y esta spec
no inventa una: no agrega un `force`, ni un borrado lógico, ni una ruta nueva. Cierra el camino que
corrompe y **deja la pregunta escrita**. Si aparece el caso real, es una decisión con su nombre.

El orden también importa y hoy está mal aunque no haya anclaje: **el archivo se borra del storage
antes que la fila**. Si el `DELETE` falla después, queda una fila apuntando a un objeto que ya no
existe. La validación nueva va antes de las dos cosas.

## Invariantes

1. **Ninguna evidencia con `OnChainEvent` asociado se borra.**
2. **Ninguna evidencia que participe de un `EvidenceBundle` se borra** — su hash está adentro de un
   Merkle root ya calculado.
3. **Ningún `OnChainEvent` queda con `evidenceId = NULL` por un borrado.**
4. **Ningún archivo se borra del storage si la fila no se va a poder borrar.**
5. El error dice lo que pasa: 409 `EVIDENCE_ANCHORED`, nunca el 400 invertido.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Evidencia sin anclaje ni bundle | 204, como hoy: archivo y fila borrados |
| Evidencia con `OnChainEvent` `Confirmed` | 409 `EVIDENCE_ANCHORED`; **el archivo sigue en el storage** |
| Evidencia con `OnChainEvent` `Pending` o `Failed` | 409 igual — un anclaje en vuelo no es menos vínculo |
| Evidencia dentro de un bundle, sin evento propio | 409, no el 400 de FK |
| Evidencia inexistente | 404, como hoy |
| El `remove` del storage falla | la fila **no** se borra (el orden nuevo lo garantiza) |
