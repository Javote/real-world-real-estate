import { fireEvent, render as renderRTL, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger
} from '#/components/ui/dialog'
import { LocaleProvider } from '#/i18n/useTranslation'
import { AnnounceProvider } from '#/lib/announce'
import { AnchoringSuccessModal } from './AnchoringSuccessModal'
import { DocumentViewerModal } from './DocumentViewerModal'
import { ImageGalleryModal } from './ImageGalleryModal'
import { InvitationAcceptModal } from './InvitationAcceptModal'
import { ObserveStageModal } from './ObserveStageModal'
import { ShareDossierModal } from './ShareDossierModal'
import { TxidModal } from './TxidModal'

// SPEC-019 W7. Completa modals.test.tsx: las ramas de props, el Escape de cada
// modal (R7) y el primitivo `ui/dialog`.

function render(ui: ReactElement) {
  return renderRTL(ui, { wrapper: LocaleProvider })
}

function apretarEscape() {
  fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
}

const TXID = '3f8a9b2c1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c'
const ROOT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'

afterEach(() => vi.restoreAllMocks())

describe('ui/dialog', () => {
  const cierreDeEsquina = '[data-slot="dialog-content"] > [data-slot="dialog-close"]'

  function Caso({ cierre, pie }: { cierre?: boolean; pie?: boolean }) {
    return (
      <Dialog open>
        <DialogContent {...(cierre === undefined ? {} : { showCloseButton: cierre })}>
          <DialogTitle>Título</DialogTitle>
          <DialogFooter {...(pie === undefined ? {} : { showCloseButton: pie })}>pie</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  it('por defecto muestra el botón de cierre de la esquina', () => {
    render(<Caso />)
    expect(document.querySelector(cierreDeEsquina)).not.toBeNull()
  })

  it('con showCloseButton=false no lo dibuja', () => {
    render(<Caso cierre={false} />)
    expect(document.querySelector(cierreDeEsquina)).toBeNull()
  })

  it('el pie no agrega botón por defecto; con showCloseButton, sí', () => {
    const { unmount } = render(<Caso />)
    expect(document.querySelector('[data-slot="dialog-footer"] button')).toBeNull()
    unmount()
    render(<Caso pie />)
    expect(document.querySelector('[data-slot="dialog-footer"] button')).not.toBeNull()
  })
})

describe('ui/dialog — Trigger y Close', () => {
  it('el Trigger abre el diálogo y el Close lo cierra', async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Título</DialogTitle>
          <DialogClose>Cerrar ya</DialogClose>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText('Título')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByText('Título')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar ya' }))
    expect(screen.queryByText('Título')).toBeNull()
  })
})

describe('ObserveStageModal', () => {
  const labels = {
    title: 'Observar etapa',
    helper: 'Detallá.',
    noteLabel: 'Observaciones',
    notePlaceholder: 'Qué falta…',
    cancel: 'Cancelar',
    send: 'Enviar',
    sending: 'Enviando…'
  }

  it('Escape cierra y descarta la nota escrita', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ObserveStageModal open onClose={onClose} onSubmit={vi.fn()} labels={labels} />
    )
    await userEvent.type(screen.getByLabelText('Observaciones'), 'algo')
    apretarEscape()
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<ObserveStageModal open onClose={onClose} onSubmit={vi.fn()} labels={labels} />)
    expect((screen.getByLabelText('Observaciones') as HTMLTextAreaElement).value).toBe('')
  })

  it('Cancelar cierra', async () => {
    const onClose = vi.fn()
    render(<ObserveStageModal open onClose={onClose} onSubmit={vi.fn()} labels={labels} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('mientras envía muestra "Enviando…" y bloquea todo', () => {
    render(
      <ObserveStageModal open onClose={vi.fn()} onSubmit={vi.fn()} submitting labels={labels} />
    )
    expect(screen.getByRole('button', { name: 'Enviando…' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
  })
})

describe('ShareDossierModal', () => {
  const labels = {
    title: 'Compartir dossier',
    helper: 'Solo lectura.',
    urlLabel: 'Link',
    copy: 'Copiar',
    copied: 'Copiado',
    close: 'Volver',
    openView: 'Abrir vista'
  }
  const url = 'https://app.example/api/v1/public/dossier/abc123def456'

  it('Escape y Volver llaman a onClose', async () => {
    const onClose = vi.fn()
    render(<ShareDossierModal open onClose={onClose} shareUrl={url} labels={labels} />)
    apretarEscape()
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('Abrir vista abre la URL en otra pestaña sin opener', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ShareDossierModal open onClose={vi.fn()} shareUrl={url} labels={labels} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir vista' }))
    expect(abrir).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer')
  })
})

describe('TxidModal', () => {
  const labels = {
    title: 'Prueba',
    anchoredAtLabel: 'Anclado',
    txidLabel: 'TXID',
    openExplorer: 'Ver en explorador',
    copy: 'Copiar',
    copied: 'Copiado'
  }
  const props = {
    open: true,
    onClose: vi.fn(),
    label: 'Permiso de obra',
    anchoredAt: '2026-05-12T10:00:00Z',
    txid: TXID,
    labels,
    formatDateTime: (iso: string) => `fecha:${iso}`
  }

  it('muestra el TXID completo y la fecha formateada', () => {
    render(<TxidModal {...props} testId="TXID-1" />)
    expect(screen.getByTestId('TXID-1')).toBeDefined()
    expect(screen.getByText(TXID)).toBeDefined()
    expect(screen.getByText('fecha:2026-05-12T10:00:00Z')).toBeDefined()
  })

  it('Escape cierra', () => {
    const onClose = vi.fn()
    render(<TxidModal {...props} onClose={onClose} />)
    apretarEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('el botón del explorador abre en otra pestaña sin opener', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<TxidModal {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Ver en explorador/ }))
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(abrir.mock.calls[0]?.[0]).toContain(TXID)
    expect(abrir.mock.calls[0]?.[1]).toBe('_blank')
    expect(abrir.mock.calls[0]?.[2]).toBe('noopener,noreferrer')
  })
})

describe('InvitationAcceptModal', () => {
  const labels = {
    title: 'Invitación',
    projectLabel: 'Proyecto',
    unitLabel: 'Unidad',
    amountLabel: 'Monto',
    handoverLabel: 'Entrega',
    termsTitle: 'Condiciones',
    anchoredNotice: 'Anclada',
    decline: 'Rechazar',
    accept: 'Aceptar',
    submitting: 'Aceptando…',
    resolved: 'Ya respondiste'
  }
  const details = {
    developerLine: 'Alpine te invitó',
    project: 'Torre A',
    unit: '7B',
    amount: 'US$ 1'
  }
  const base = {
    open: true,
    onClose: vi.fn(),
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    details,
    labels
  }

  it('sin handover no dibuja el bloque de entrega', () => {
    render(<InvitationAcceptModal {...base} />)
    expect(screen.queryByText('Entrega')).toBeNull()
  })

  it('con handover lo dibuja', () => {
    render(<InvitationAcceptModal {...base} details={{ ...details, handover: '12/2027' }} />)
    expect(screen.getByText('Entrega')).toBeDefined()
    expect(screen.getByText('12/2027')).toBeDefined()
  })

  it('con termsLines lista las condiciones', () => {
    render(<InvitationAcceptModal {...base} termsLines={['30% al firmar']} />)
    expect(screen.getByText('Condiciones')).toBeDefined()
    expect(screen.getByText('30% al firmar')).toBeDefined()
  })

  it('con termsLines vacío no dibuja la sección', () => {
    render(<InvitationAcceptModal {...base} termsLines={[]} />)
    expect(screen.queryByText('Condiciones')).toBeNull()
  })

  it('sin termsLines no dibuja la sección', () => {
    render(<InvitationAcceptModal {...base} />)
    expect(screen.queryByText('Condiciones')).toBeNull()
  })

  it('el chip del TXID aparece con txid y las dos etiquetas de copia', () => {
    render(
      <InvitationAcceptModal
        {...base}
        txid={TXID}
        hashCopyLabel="Copiar"
        hashCopiedLabel="Copiado"
      />
    )
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDefined()
  })

  it('sin txid, o sin alguna de las dos etiquetas, no hay chip (regla 17)', () => {
    const casos: ReactElement[] = [
      <InvitationAcceptModal
        key="a"
        {...base}
        txid={null}
        hashCopyLabel="Copiar"
        hashCopiedLabel="Copiado"
      />,
      <InvitationAcceptModal key="b" {...base} txid={TXID} hashCopiedLabel="Copiado" />,
      <InvitationAcceptModal key="c" {...base} txid={TXID} hashCopyLabel="Copiar" />
    ]
    for (const caso of casos) {
      const { unmount } = render(caso)
      expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
      unmount()
    }
  })

  it('con pending=false muestra el estado en vez de los botones', () => {
    render(<InvitationAcceptModal {...base} pending={false} />)
    expect(screen.getByText('Ya respondiste')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull()
  })

  it('Aceptar y Rechazar llaman a sus callbacks; Escape cierra', async () => {
    const onAccept = vi.fn()
    const onDecline = vi.fn()
    const onClose = vi.fn()
    render(
      <InvitationAcceptModal
        {...base}
        onAccept={onAccept}
        onDecline={onDecline}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    apretarEscape()
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AnchoringSuccessModal', () => {
  const labels = {
    title: 'Anclado',
    body: 'Listo el anclaje',
    merkleLabel: 'Merkle',
    txidLabel: 'TXID',
    openExplorer: 'Explorador',
    done: 'Hecho',
    copy: 'Copiar',
    copied: 'Copiado'
  }
  const props = { onDone: vi.fn(), merkleRoot: ROOT, txid: TXID, labels }

  function conAnuncios(ui: ReactElement) {
    return renderRTL(ui, {
      wrapper: ({ children }) => (
        <LocaleProvider>
          <AnnounceProvider>{children}</AnnounceProvider>
        </LocaleProvider>
      )
    })
  }
  const region = () => document.querySelector('[aria-live="polite"]')?.textContent ?? ''
  const sinInvisible = (s: string) => s.replace(/​/g, '')

  it('anuncia una sola vez al abrirse, y de nuevo si se cierra y reabre', () => {
    const { rerender } = conAnuncios(<AnchoringSuccessModal open {...props} />)
    expect(region()).toContain('Anclado: ')
    const primero = region()

    rerender(<AnchoringSuccessModal open {...props} testId="X" />)
    expect(region()).toBe(primero)

    rerender(<AnchoringSuccessModal open={false} {...props} />)
    expect(region()).toBe(primero)

    rerender(<AnchoringSuccessModal open {...props} />)
    expect(region()).not.toBe(primero)
    expect(sinInvisible(region())).toBe(sinInvisible(primero))
  })

  it('cerrado no anuncia nada', () => {
    conAnuncios(<AnchoringSuccessModal open={false} {...props} />)
    expect(region()).toBe('')
  })

  it('Hecho y Escape llaman a onDone', async () => {
    const onDone = vi.fn()
    render(<AnchoringSuccessModal open {...props} onDone={onDone} testId="ANC" />)
    expect(screen.getByTestId('ANC')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Hecho' }))
    apretarEscape()
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('el explorador abre el TXID en otra pestaña', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<AnchoringSuccessModal open {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Explorador' }))
    expect(abrir.mock.calls[0]?.[0]).toContain(TXID)
    expect(abrir.mock.calls[0]?.[2]).toBe('noopener,noreferrer')
  })
})

describe('DocumentViewerModal', () => {
  const labels = {
    verified: 'Verificado',
    pending: 'Pendiente',
    download: 'Descargar',
    watermark: 'SELLO'
  }
  const base = {
    open: true,
    onClose: vi.fn(),
    title: 'Permiso',
    filename: 'permiso.pdf',
    pageUrl: '/p.png',
    dateLabel: '12/05/2026',
    labels
  }

  it('con paginationLabel lo agrega al nombre del archivo', () => {
    render(<DocumentViewerModal {...base} txid={TXID} paginationLabel="1 de 3" />)
    expect(screen.getByText('permiso.pdf · 1 de 3')).toBeDefined()
  })

  it('sin paginationLabel muestra solo el nombre del archivo', () => {
    render(<DocumentViewerModal {...base} txid={TXID} />)
    expect(screen.getByText('permiso.pdf')).toBeDefined()
  })

  it('sin pageUrl no dibuja la imagen', () => {
    render(<DocumentViewerModal {...base} txid={TXID} pageUrl="" />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('anclado: pill Verificado y descarga habilitada que llama a onDownload', async () => {
    const onDownload = vi.fn()
    render(<DocumentViewerModal {...base} txid={TXID} onDownload={onDownload} />)
    expect(screen.getByText('Verificado')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: /Descargar/ }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('sin anclar: la descarga queda deshabilitada', () => {
    render(<DocumentViewerModal {...base} txid={null} onDownload={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Descargar/ })).toHaveProperty('disabled', true)
  })

  it('sin onDownload no hay botón de descarga', () => {
    render(<DocumentViewerModal {...base} txid={TXID} />)
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull()
  })

  it('Escape cierra', () => {
    const onClose = vi.fn()
    render(<DocumentViewerModal {...base} txid={TXID} onClose={onClose} />)
    apretarEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ImageGalleryModal', () => {
  const images = [
    { url: '/1.jpg', alt: 'Fachada', caption: 'Pie 1' },
    { url: '/2.jpg', alt: 'Hall' },
    { url: '/3.jpg', alt: 'Terraza', caption: 'Pie 3' }
  ]
  const labels = {
    title: 'Galería',
    close: 'Cerrar',
    previous: 'Anterior',
    next: 'Siguiente',
    counter: (a: number, t: number) => `${a}/${t}`
  }
  const galeria = (extra: Partial<Parameters<typeof ImageGalleryModal>[0]> = {}) => (
    <ImageGalleryModal open onClose={vi.fn()} images={images} labels={labels} {...extra} />
  )

  it('Anterior desde la primera vuelve a la última (circular)', async () => {
    render(galeria({ testId: 'GAL' }))
    expect(screen.getByTestId('GAL')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByText('3/3')).toBeDefined()
    expect(screen.getByAltText('Terraza')).toBeDefined()
  })

  it('reabrir arranca en el índice que pide quien abre', () => {
    const { rerender } = render(galeria({ initialIndex: 2 }))
    expect(screen.getByText('3/3')).toBeDefined()
    rerender(galeria({ open: false, initialIndex: 2 }))
    rerender(galeria({ initialIndex: 1 }))
    expect(screen.getByText('2/3')).toBeDefined()
  })

  it('un índice inicial fuera de rango muestra la última foto', () => {
    render(galeria({ initialIndex: 9 }))
    expect(screen.getByAltText('Terraza')).toBeDefined()
  })

  it('la X y Escape llaman a onClose', async () => {
    const onClose = vi.fn()
    render(galeria({ onClose }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    apretarEscape()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('con el modal cerrado no se renderiza el contenido', () => {
    render(galeria({ open: false }))
    expect(screen.queryByRole('img')).toBeNull()
  })
})
