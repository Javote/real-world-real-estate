import { describe, expect, it } from 'vitest'
import { explorerTxUrl } from './explorer'

describe('explorerTxUrl', () => {
  it('arma la URL del explorador de Preprod con el TXID verbatim', () => {
    expect(explorerTxUrl('AbC123')).toBe('https://preprod.cardanoscan.io/transaction/AbC123')
  })
})
