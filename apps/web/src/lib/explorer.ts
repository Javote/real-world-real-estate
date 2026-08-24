// La URL del explorador sale de UNA plantilla configurable por entorno
// (M2-D5 §3 [ASSUMPTION]): `$EXPLORER_BASE/tx/:txid`.
//
// Hardcodear cardanoscan sería atarse a un explorador y a una red. El default
// es Preprod porque D-013 dice Preprod siempre en M3; mainnet está fuera de
// alcance y cambiarla es una variable, no un deploy de código.
const BASE = import.meta.env.VITE_EXPLORER_BASE ?? 'https://preprod.cardanoscan.io'

export function explorerTxUrl(txid: string): string {
  return `${BASE}/transaction/${txid}`
}
