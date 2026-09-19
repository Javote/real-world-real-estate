import { render as renderRTL, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { AnnounceProvider } from '#/lib/announce'
import { AnchoringSuccessModal } from './AnchoringSuccessModal'
import { MerkleRootProof } from './MerkleRootProof'
import { ReleaseProofList } from './ReleaseProofList'
import { StageChips } from './StageChips'
import { TxidModal } from './TxidModal'
import { VerifiedWatermark } from './VerifiedWatermark'

// M2-D4 §6.2 · "Patterns never claim more than they can prove". Estos tests son
// esa regla, ejecutada: cada patrón que puede mostrar una señal de prueba tiene
// un caso que verifica que NO la muestra cuando no hay anclaje.

// `ui/dialog.tsx` traduce su propio botón de cierre (SPEC-102): TxidModal y
// AnchoringSuccessModal (P3/P4) lo usan y necesitan el contexto de idioma
// para montar, aunque este archivo no pruebe i18n.
function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <AnnounceProvider>{children}</AnnounceProvider>
    </LocaleProvider>
  )
}

function render(ui: ReactElement) {
  return renderRTL(ui, { wrapper: Providers })
}

const TXID = 'b'.repeat(64)
const ROOT = 'a'.repeat(64)

const labelsTxid = {
  title: 'Verificación',
  anchoredAtLabel: 'Anclado el',
  txidLabel: 'TXID',
  openExplorer: 'Ver en el explorador',
  copy: 'Copiar',
  copied: 'Copiado'
}

describe('P3 · TxidModal', () => {
  it('cerrado no renderiza nada — nunca se abre solo', () => {
    render(
      <TxidModal
        open={false}
        onClose={vi.fn()}
        label="Permiso de obra"
        anchoredAt="2026-03-09T12:00:00.000Z"
        txid={TXID}
        labels={labelsTxid}
        formatDateTime={() => '9 mar 2026, 12:00'}
      />
    )
    expect(screen.queryByText('Verificación')).toBeNull()
  })

  it('abierto muestra el TXID COMPLETO — es el único lugar donde se permite', () => {
    render(
      <TxidModal
        open
        onClose={vi.fn()}
        label="Permiso de obra"
        anchoredAt="2026-03-09T12:00:00.000Z"
        txid={TXID}
        labels={labelsTxid}
        formatDateTime={() => '9 mar 2026, 12:00'}
      />
    )
    expect(screen.getByText(TXID)).toBeDefined()
    expect(screen.getByText('Permiso de obra')).toBeDefined()
  })
})

describe('P4 · AnchoringSuccessModal', () => {
  it('muestra LOS DOS artefactos: Merkle root y TXID', async () => {
    // Es lo que lo distingue del TxidModal: la acción produjo dos cosas y las
    // dos son el artefacto.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    render(
      <AnchoringSuccessModal
        open
        onDone={vi.fn()}
        merkleRoot={ROOT}
        txid={TXID}
        labels={{
          title: 'Evidencia anclada',
          body: 'Se generaron los dos artefactos',
          merkleLabel: 'Merkle root',
          txidLabel: 'TXID',
          openExplorer: 'Ver en el explorador',
          done: 'Listo',
          copy: 'Copiar',
          copied: 'Copiado'
        }}
      />
    )

    expect(screen.getByText('Merkle root')).toBeDefined()
    expect(screen.getByText('TXID')).toBeDefined()
    // Dos chips: uno por artefacto.
    expect(screen.getAllByLabelText('Copiar')).toHaveLength(2)
  })

  it('SPEC-104: al abrirse, anuncia el título + el TXID truncado (no el hash entero)', () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    render(
      <AnchoringSuccessModal
        open
        onDone={vi.fn()}
        merkleRoot={ROOT}
        txid={TXID}
        labels={{
          title: 'Evidencia anclada',
          body: 'Se generaron los dos artefactos',
          merkleLabel: 'Merkle root',
          txidLabel: 'TXID',
          openExplorer: 'Ver en el explorador',
          done: 'Listo',
          copy: 'Copiar',
          copied: 'Copiado'
        }}
      />
    )

    const anunciado = document.querySelector('[aria-live="polite"]')?.textContent ?? ''
    expect(anunciado).toContain('Evidencia anclada')
    expect(anunciado).toContain(`${TXID.slice(0, 6)}...${TXID.slice(-4)}`)
    expect(anunciado).not.toContain(TXID)
  })
})

describe('P5 · MerkleRootProof', () => {
  const labels = {
    rootLabel: 'Merkle root',
    txidLabel: 'TXID',
    filesLabel: 'Archivos',
    pending: 'Pendiente',
    copy: 'Copiar',
    copied: 'Copiado'
  }

  it('sin TXID no muestra chip: dice Pendiente', () => {
    render(<MerkleRootProof merkleRoot={ROOT} txid={null} labels={labels} />)
    expect(screen.getByText('Pendiente')).toBeDefined()
    // Un chip vacío insinuaría una prueba que no existe.
    expect(screen.getAllByLabelText('Copiar')).toHaveLength(1)
  })

  it('los hashes por archivo son un nivel más adentro: solo si se los pasan', () => {
    const { rerender } = render(<MerkleRootProof merkleRoot={ROOT} txid={TXID} labels={labels} />)
    expect(screen.queryByText('Archivos')).toBeNull()

    rerender(
      <MerkleRootProof
        merkleRoot={ROOT}
        txid={TXID}
        archivos={[{ id: '1', nombre: 'acta.pdf', sha256: 'c'.repeat(64) }]}
        labels={labels}
      />
    )
    expect(screen.getByText('Archivos')).toBeDefined()
    expect(screen.getByText('acta.pdf')).toBeDefined()
  })
})

describe('P7 · VerifiedWatermark', () => {
  it('sin anclaje NO estampa el sello', () => {
    // El anti-patrón explícito del entregable.
    render(
      <VerifiedWatermark txid={null} label="VERIFICADO">
        <img src="/doc.png" alt="documento" />
      </VerifiedWatermark>
    )
    expect(screen.queryByText('VERIFICADO')).toBeNull()
  })

  it('con anclaje lo estampa, y no intercepta clics', () => {
    render(
      <VerifiedWatermark txid={TXID} label="VERIFICADO">
        <img src="/doc.png" alt="documento" />
      </VerifiedWatermark>
    )
    const sello = screen.getByText('VERIFICADO')
    expect(sello).toBeDefined()
    // `pointer-events-none`: el sello es visual, no una capa que bloquee el
    // documento debajo.
    expect(sello.parentElement?.className).toContain('pointer-events-none')
  })
})

describe('P9 · StageChips', () => {
  const stages = Array.from({ length: 10 }, (_, i) => ({
    number: i + 1,
    anchored: i < 3,
    ...(i < 3 ? { bundleId: `bundle-${i}` } : {})
  }))

  it('son diez chips discretos, no una barra', () => {
    render(<StageChips stages={stages} ariaLabel="Anclaje por etapa" />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  it('solo los anclados se pueden tocar', async () => {
    const abrir = vi.fn()
    render(<StageChips stages={stages} onOpenStage={abrir} ariaLabel="Anclaje por etapa" />)

    await userEvent.click(screen.getByText('1'))
    expect(abrir).toHaveBeenCalledOnce()

    // El 8 no está anclado: tocarlo no puede abrir una prueba que no existe.
    await userEvent.click(screen.getByText('8'))
    expect(abrir).toHaveBeenCalledOnce()
  })
})

describe('P10 · ReleaseProofList', () => {
  const releases = [
    {
      stageNumber: 1,
      amountMinorUnits: 400000,
      currency: 'USD',
      releasedAt: '2026-03-09T12:00:00.000Z',
      txid: TXID
    },
    {
      stageNumber: 2,
      amountMinorUnits: 250000,
      currency: 'USD',
      releasedAt: '2026-04-09T12:00:00.000Z',
      txid: null
    }
  ]

  it('cada liberación lleva su propio TXID, y la que no confirmó dice Pendiente', () => {
    render(
      <ReleaseProofList
        releases={releases}
        formatCurrency={(m, c) => `${c} ${m / 100}`}
        formatDate={(iso) => iso.slice(0, 10)}
        labels={{ stage: 'Etapa', pending: 'Pendiente', copy: 'Copiar', copied: 'Copiado' }}
      />
    )

    expect(screen.getByText('Etapa 1')).toBeDefined()
    expect(screen.getByText('Etapa 2')).toBeDefined()
    // Un chip para la anclada, "Pendiente" para la otra: la cardinalidad
    // on-chain es por release, no por contrato.
    expect(screen.getAllByLabelText('Copiar')).toHaveLength(1)
    expect(screen.getByText('Pendiente')).toBeDefined()
  })
})
