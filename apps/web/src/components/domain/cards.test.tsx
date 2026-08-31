import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { AuditEventCard } from './AuditEventCard'
import { DocumentCard } from './DocumentCard'
import { InvestorCard, iniciales } from './InvestorCard'
import { InvitationCard } from './InvitationCard'
import { NotificationCard } from './NotificationCard'
import { ProgressTimeline } from './ProgressTimeline'
import { UnitCard } from './UnitCard'

// M2-D3 §Cards. Estos tests fijan las reglas del entregable, no el aspecto.

const TXID = '3f8a9b2c1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c'
const COPIA = { copy: 'Copiar', copied: 'Copiado' }

describe('DocumentCard', () => {
  const labels = {
    ...COPIA,
    verified: 'Verificado',
    pending: 'Pendiente',
    view: 'Ver',
    download: 'Descargar'
  }

  it('sin TXID el estado es Pendiente, aunque tenga hash (regla 17)', () => {
    render(
      <DocumentCard
        filename="permiso.pdf"
        uploadedAtLabel="12/05/2026"
        format="PDF"
        sha256={'a'.repeat(64)}
        txid={null}
        labels={labels}
      />
    )

    expect(screen.getByText('Pendiente')).toBeDefined()
    expect(screen.queryByText('Verificado')).toBeNull()
  })

  it('con TXID el estado es Verificado', () => {
    render(
      <DocumentCard
        filename="permiso.pdf"
        uploadedAtLabel="12/05/2026"
        format="PDF"
        txid={TXID}
        labels={labels}
      />
    )
    expect(screen.getByText('Verificado')).toBeDefined()
  })

  it('no se ofrece descargar lo que no está anclado', () => {
    render(
      <DocumentCard
        filename="permiso.pdf"
        uploadedAtLabel="12/05/2026"
        format="PDF"
        txid={null}
        labels={labels}
        onDownload={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Descargar' })).toHaveProperty('disabled', true)
  })
})

describe('AuditEventCard', () => {
  const base = {
    timestampLabel: '17/05/2026',
    title: 'Subió evidencia: Estructura PB',
    category: { key: 'etapa' as const, label: 'etapa' },
    actor: { role: 'developer' as const, roleLabel: 'desarrollador', name: 'Admin Alpine' },
    labels: COPIA
  }

  it('sin TXID no dibuja el chip: no se muestra una prueba que no existe', () => {
    render(<AuditEventCard {...base} txid={null} />)
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
  })

  it('con TXID muestra el chip truncado', () => {
    render(<AuditEventCard {...base} txid={TXID} />)
    expect(screen.getByText('3f8a9b...2b3c')).toBeDefined()
  })
})

describe('UnitCard', () => {
  it('la variante del investor muestra avance; la del developer no (D-029)', () => {
    const { rerender } = render(
      <UnitCard
        variant="investor"
        unitReference="7B"
        projectName="Torre A"
        progress={60}
        status={{ tone: 'verified', label: 'Vendida' }}
      />
    )
    // El avance es del PROYECTO y es el mismo para todas las unidades hermanas.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60')

    rerender(
      <UnitCard
        variant="developer"
        unitReference="7B"
        detailLine="Piso 7 · 85 m²"
        investorLabel="Sin asignar"
        status={{ tone: 'neutral', label: 'Disponible' }}
      />
    )
    // Repetir el mismo número en cuarenta filas no informa nada.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('ProgressTimeline', () => {
  it('dibuja un nodo por stage real, no diez fijos', () => {
    render(
      <ProgressTimeline
        ariaLabel="Avance"
        stages={[
          { sequenceOrder: 1, name: 'Cimientos', state: 'completed' },
          { sequenceOrder: 2, name: 'Estructura', state: 'current' },
          { sequenceOrder: 3, name: 'Techos', state: 'pending' }
        ]}
      />
    )
    // Un proyecto de tres etapas no puede dibujar siete nodos fantasma.
    expect(screen.getByRole('list', { name: 'Avance' }).children).toHaveLength(3)
  })
})

describe('NotificationCard', () => {
  it('la leída muestra el check y la no leída no', () => {
    const { rerender } = render(
      <NotificationCard
        icon={FileText}
        title="Evidencia anclada"
        timestampLabel="hace 2 h"
        read={false}
        readLabel="Leída"
      />
    )
    expect(screen.queryByRole('img', { name: 'Leída' })).toBeNull()

    rerender(
      <NotificationCard
        icon={FileText}
        title="Evidencia anclada"
        timestampLabel="hace 2 h"
        read
        readLabel="Leída"
      />
    )
    expect(screen.getByRole('img', { name: 'Leída' })).toBeDefined()
  })
})

describe('InvitationCard', () => {
  it('resuelta esconde el CTA: ya no hay nada que hacer', () => {
    const { rerender } = render(
      <InvitationCard
        title="Invitación a proyecto"
        body="Torre A · Unidad 7B"
        ctaLabel="Ver invitación →"
        timestampLabel="hace 1 d"
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Ver invitación →')).toBeDefined()

    rerender(
      <InvitationCard
        title="Invitación a proyecto"
        body="Aceptada"
        ctaLabel="Ver invitación →"
        timestampLabel="hace 1 d"
        resolved
        onOpen={vi.fn()}
      />
    )
    expect(screen.queryByText('Ver invitación →')).toBeNull()
  })
})

describe('InvestorCard', () => {
  it('deriva las iniciales del nombre en vez de pedirlas al backend', () => {
    expect(iniciales('Mariano Diaz')).toBe('MD')
    expect(iniciales('ana')).toBe('A')
    expect(iniciales('  Ana  Maria  Torres ')).toBe('AM')
  })

  it('muestra al investor con su estado', () => {
    render(
      <InvestorCard
        fullName="Mariano Diaz"
        email="m@example.com"
        investedLabel="US$ 120.000"
        unitLabel="7B"
        projectName="Torre A"
        investmentHeading="Inversión"
        unitHeading="Unidad"
        status={{ tone: 'verified', label: 'Activo' }}
      />
    )
    expect(screen.getByText('MD')).toBeDefined()
    expect(screen.getByText('Activo')).toBeDefined()
    expect(screen.getByText('Inversión')).toBeDefined()
    expect(screen.getByText('Unidad')).toBeDefined()
  })
})
