const BASE = import.meta.env.VITE_EXPLORER_BASE ?? 'https://preprod.cardanoscan.io'

export function explorerTxUrl(txid: string): string {
  return `${BASE}/transaction/${txid}`
}
