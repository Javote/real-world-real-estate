import { render as renderRTL, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import { BuildingSchematic } from './BuildingSchematic'
import { DocumentViewerModal } from './DocumentViewerModal'
import { ImageGalleryModal } from './ImageGalleryModal'
import { InvitationAcceptModal } from './InvitationAcceptModal'
import { ObserveStageModal } from './ObserveStageModal'
import { ShareDossierModal } from './ShareDossierModal'

// M2-D3 §Modals & Overlays. Lo que fijan: las reglas de uso del entregable.

// `ui/dialog.tsx` traduce su propio botón de cierre (SPEC-102), así que
// cualquier modal de este archivo necesita el contexto de idioma para
// montar — no porque estos tests prueben i18n, sino porque el primitivo que
// todos comparten ahora lo usa.
function render(ui: ReactElement) {
  return renderRTL(ui, { wrapper: LocaleProvider })
}

const TXID = '3f8a9b2c1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c'

describe('ObserveStageModal', () => {
  const labels = {
    title: 'Observar etapa',
    helper: 'Detallá para el developer.',
    noteLabel: 'Observaciones',
    notePlaceholder: 'Qué falta…',
    cancel: 'Cancelar',
    send: 'Enviar',
    sending: 'Enviando…'
  }

  it('una observación vacía deshabilita Enviar', () => {
    render(<ObserveStageModal open onClose={vi.fn()} onSubmit={vi.fn()} labels={labels} />)
    // Textual del entregable: "Empty textarea disables Send".
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveProperty('disabled', true)
  })

  it('con texto habilita y manda la nota recortada', async () => {
    const onSubmit = vi.fn()
    render(<ObserveStageModal open onClose={vi.fn()} onSubmit={onSubmit} labels={labels} />)

    await userEvent.type(screen.getByLabelText('Observaciones'), '  falta el permiso  ')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(onSubmit).toHaveBeenCalledWith('falta el permiso')
  })

  it('el botón de enviar NO es rojo: observar no es destructivo', () => {
    render(<ObserveStageModal open onClose={vi.fn()} onSubmit={vi.fn()} labels={labels} />)

    // M2-D3: "uses the orange 'danger-corrective' treatment, not red —
    // observation is not destructive". Devuelve trabajo, no borra nada.
    const enviar = screen.getByRole('button', { name: 'Enviar' })
    expect(enviar.className).toContain('bg-pending')
    expect(enviar.className).not.toContain('bg-danger')
  })
})

describe('InvitationAcceptModal', () => {
  const props = {
    open: true,
    onClose: vi.fn(),
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    details: {
      developerLine: 'Alpine Desarrollos te invitó',
      project: 'Torre A',
      unit: '7B',
      amount: 'US$ 120.000',
      handover: '12/2027'
    },
    labels: {
      title: 'Invitación a proyecto',
      projectLabel: 'Proyecto',
      unitLabel: 'Unidad',
      amountLabel: 'Monto total',
      handoverLabel: 'Entrega estimada',
      termsTitle: 'Condiciones',
      anchoredNotice: 'Esta invitación queda anclada on-chain',
      decline: 'Rechazar',
      accept: 'Aceptar invitación',
      submitting: 'Aceptando…'
    }
  }

  it('la línea de anclaje es NO opcional', () => {
    render(<InvitationAcceptModal {...props} />)
    // "Anchored-on-chain badge is non-optional — invitations are always
    // anchored". No hay prop para ocultarla, así que siempre está.
    expect(screen.getByText('Esta invitación queda anclada on-chain')).toBeDefined()
  })

  it('muestra los cuatro bloques etiquetados de la ficha', () => {
    render(<InvitationAcceptModal {...props} />)
    for (const v of ['Torre A', '7B', 'US$ 120.000', '12/2027']) {
      expect(screen.getByText(v)).toBeDefined()
    }
  })

  it('mientras envía, los dos botones quedan bloqueados', () => {
    render(<InvitationAcceptModal {...props} submitting />)
    expect(screen.getByRole('button', { name: 'Rechazar' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Aceptando…' })).toHaveProperty('disabled', true)
  })
})

describe('DocumentViewerModal', () => {
  const labels = {
    verified: 'Verificado',
    pending: 'Pendiente',
    download: 'Descargar PDF',
    watermark: 'VERIFICADO'
  }
  const base = {
    open: true,
    onClose: vi.fn(),
    title: 'Permiso de obra',
    filename: 'permiso.pdf',
    pageUrl: '/permiso.png',
    dateLabel: '12/05/2026'
  }

  it('sin TXID no estampa el sello: la mentira más creíble del sistema', () => {
    render(<DocumentViewerModal {...base} txid={null} labels={labels} />)
    expect(screen.queryByText('VERIFICADO')).toBeNull()
    expect(screen.getByText('Pendiente')).toBeDefined()
  })

  it('con TXID estampa el sello', () => {
    render(<DocumentViewerModal {...base} txid={TXID} labels={labels} />)
    expect(screen.getByText('VERIFICADO')).toBeDefined()
  })
})

describe('ImageGalleryModal', () => {
  const images = [
    { url: '/1.jpg', alt: 'Fachada', caption: 'Fachada' },
    { url: '/2.jpg', alt: 'Hall', caption: 'Hall' }
  ]
  const labels = {
    title: 'Galería',
    close: 'Cerrar',
    previous: 'Anterior',
    next: 'Siguiente',
    counter: (a: number, t: number) => `${a}/${t}`
  }

  it('navega circularmente y lleva el contador', async () => {
    render(<ImageGalleryModal open onClose={vi.fn()} images={images} labels={labels} />)
    expect(screen.getByText('1/2')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('2/2')).toBeDefined()

    // Circular: desde la última, "siguiente" vuelve a la primera.
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('1/2')).toBeDefined()
  })

  it('con una sola foto no ofrece flechas', () => {
    render(<ImageGalleryModal open onClose={vi.fn()} images={[images[0]!]} labels={labels} />)
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
  })

  it('sin fotos no renderiza nada', () => {
    const { container } = render(
      <ImageGalleryModal open onClose={vi.fn()} images={[]} labels={labels} />
    )
    expect(container.textContent).toBe('')
  })
})

describe('ShareDossierModal', () => {
  it('muestra la URL para copiar', () => {
    render(
      <ShareDossierModal
        open
        onClose={vi.fn()}
        shareUrl="https://app.example/api/v1/public/dossier/abc123def456"
        labels={{
          title: 'Compartir dossier',
          helper: 'Link de solo lectura, sin acceso a la plataforma.',
          urlLabel: 'Link',
          copy: 'Copiar',
          copied: 'Copiado',
          close: 'Cerrar',
          openView: 'Abrir vista'
        }}
      />
    )
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDefined()
    expect(screen.getByText('Compartir dossier')).toBeDefined()
  })
})

describe('BuildingSchematic', () => {
  const units = [
    { id: '1', unitReference: '1A', floor: 1, state: 'occupied' as const },
    { id: '2', unitReference: '1B', floor: 1, state: 'available' as const },
    { id: '3', unitReference: '7A', floor: 7, state: 'occupied' as const },
    { id: '4', unitReference: '7B', floor: 7, state: 'mine' as const }
  ]
  const labels = {
    title: 'Esquema del edificio',
    available: 'Disponible',
    occupied: 'Ocupada',
    mine: 'Tu unidad',
    access: 'ACCESO',
    floorPrefix: 'P'
  }

  it('dibuja los pisos de mayor a menor, como se ve un edificio', () => {
    render(<BuildingSchematic projectName="Torre A" units={units} labels={labels} />)

    const textos = screen.getAllByText(/^P\d+$/).map((e) => e.textContent)
    expect(textos).toEqual(['P7', 'P1'])
  })

  it('marca la unidad del investor con aria-current', () => {
    render(<BuildingSchematic projectName="Torre A" units={units} labels={labels} />)
    expect(screen.getByText('7B').getAttribute('aria-current')).toBe('true')
    expect(screen.getByText('7A').getAttribute('aria-current')).toBeNull()
  })
})
