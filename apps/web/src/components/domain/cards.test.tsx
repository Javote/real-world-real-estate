import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText, Plus } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { ActionCard } from './ActionCard'
import { AuditEventCard } from './AuditEventCard'
import { DocumentCard } from './DocumentCard'
import { InvestorCard, iniciales } from './InvestorCard'
import { InvitationCard } from './InvitationCard'
import { NotificationCard } from './NotificationCard'
import { ProgressTimeline } from './ProgressTimeline'
import { ProjectCard } from './ProjectCard'
import { StatCard } from './StatCard'
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

// R11 — SPEC-019 W8: una variante de props por `it`, cada una con algo visible.

describe('ProjectCard · variante buy', () => {
  const base = {
    name: 'Torre Alpine',
    status: { label: 'En obra', tone: 'pending' as const },
    labels: { from: 'Desde' },
    onOpen: vi.fn()
  }

  it('con precio: la card abre con "Desde" + el precio, y el nombre no es el título', () => {
    render(<ProjectCard {...base} priceLabel="US$ 90.000" testId="card" />)

    expect(screen.getByText('Desde')).toBeDefined()
    expect(screen.getByText('US$ 90.000')).toBeDefined()
    expect(screen.queryByText('Torre Alpine')).toBeNull()
    expect(screen.getByTestId('card')).toBeDefined()
  })

  it('sin precio: el título es el nombre y no hay línea "Desde"', () => {
    render(<ProjectCard {...base} />)

    expect(screen.getByText('Torre Alpine')).toBeDefined()
    expect(screen.queryByText('Desde')).toBeNull()
  })

  it('sin imagen es una superficie neutra; con imagen, la foto', () => {
    const { container, rerender } = render(<ProjectCard {...base} />)
    expect(container.querySelector('img')).toBeNull()

    rerender(<ProjectCard {...base} imageUrl="/portada.jpg" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/portada.jpg')
  })

  it('con ubicación, medidas y developer los dibuja; sin ellos no', () => {
    const { rerender } = render(<ProjectCard {...base} />)
    expect(screen.queryByText('Palermo')).toBeNull()
    expect(screen.queryByText('45-80 m²')).toBeNull()
    expect(screen.queryByText('Grupo Alpine')).toBeNull()

    rerender(
      <ProjectCard {...base} location="Palermo" sizeLabel="45-80 m²" developerName="Grupo Alpine" />
    )
    expect(screen.getByText('Palermo')).toBeDefined()
    expect(screen.getByText('45-80 m²')).toBeDefined()
    expect(screen.getByText('Grupo Alpine')).toBeDefined()
  })

  it('el pill de estado va siempre; el avance solo si viene, y con su porcentaje', () => {
    const { rerender } = render(<ProjectCard {...base} progress={null} />)
    expect(screen.getByText('En obra')).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()

    rerender(<ProjectCard {...base} progress={40} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')
    expect(screen.getByText('40%')).toBeDefined()
  })

  it('un avance en 0 igual dibuja la barra (0 no es "sin dato")', () => {
    render(<ProjectCard {...base} progress={0} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('tocar la card la abre', async () => {
    const onOpen = vi.fn()
    render(<ProjectCard {...base} onOpen={onOpen} />)

    await userEvent.click(screen.getByText('Torre Alpine'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('sin handler no hay favorito fantasma', () => {
    render(<ProjectCard {...base} favorited favoriteAriaLabel="Guardar" />)
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('el favorito anuncia su estado, dispara solo su handler y no abre la card', async () => {
    const onOpen = vi.fn()
    const onToggle = vi.fn()
    const { rerender } = render(
      <ProjectCard
        {...base}
        onOpen={onOpen}
        onToggleFavorite={onToggle}
        favorited
        favoriteAriaLabel="Quitar de favoritos"
        favoriteTestId="fav"
      />
    )

    const corazon = screen.getByRole('button', { name: 'Quitar de favoritos' })
    expect(corazon.getAttribute('aria-pressed')).toBe('true')
    expect(corazon.getAttribute('data-testid')).toBe('fav')
    await userEvent.click(corazon)
    expect(onToggle).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()

    // `favorited` ausente es "no favorito", y sin etiqueta el nombre queda vacío.
    rerender(<ProjectCard {...base} onToggleFavorite={onToggle} favoriteTestId="fav" />)
    expect(screen.getByTestId('fav').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('fav').getAttribute('aria-label')).toBe('')
  })
})

describe('ProjectCard · variante developer', () => {
  const base = {
    variant: 'developer' as const,
    name: 'Torre Alpine',
    status: { label: 'En obra', tone: 'pending' as const },
    labels: { from: 'Desde', units: 'Unidades', progress: 'Avance' },
    onOpen: vi.fn()
  }

  it('el nombre y el pill van arriba, y no hay pill suelto debajo', () => {
    render(<ProjectCard {...base} />)

    expect(screen.getByText('Torre Alpine')).toBeDefined()
    expect(screen.getAllByText('En obra')).toHaveLength(1)
  })

  it('con precio y unidades: dos columnas', () => {
    render(<ProjectCard {...base} priceLabel="US$ 90.000" unitsLabel="120 unidades" />)

    expect(screen.getByText('Desde')).toBeDefined()
    expect(screen.getByText('US$ 90.000')).toBeDefined()
    expect(screen.getByText('Unidades')).toBeDefined()
    expect(screen.getByText('120 unidades')).toBeDefined()
  })

  it('solo precio: no dibuja la columna de unidades', () => {
    render(<ProjectCard {...base} priceLabel="US$ 90.000" />)

    expect(screen.getByText('US$ 90.000')).toBeDefined()
    expect(screen.queryByText('Unidades')).toBeNull()
  })

  it('solo unidades: no dibuja la columna del precio', () => {
    render(<ProjectCard {...base} unitsLabel="120 unidades" />)

    expect(screen.getByText('120 unidades')).toBeDefined()
    expect(screen.queryByText('Desde')).toBeNull()
  })

  it('sin precio ni unidades no hay grilla', () => {
    const { container } = render(<ProjectCard {...base} />)
    expect(container.querySelector('.grid')).toBeNull()
  })

  it('el tamaño de la variante buy no aplica: aunque venga, no se dibuja', () => {
    render(<ProjectCard {...base} sizeLabel="45-80 m²" />)
    expect(screen.queryByText('45-80 m²')).toBeNull()
  })

  it('la fecha solo se dibuja si viene', () => {
    const { rerender } = render(<ProjectCard {...base} />)
    expect(screen.queryByText('Diciembre 2027')).toBeNull()

    rerender(<ProjectCard {...base} dateLabel="Diciembre 2027" />)
    expect(screen.getByText('Diciembre 2027')).toBeDefined()
  })

  it('el avance lleva su rótulo y el porcentaje redondeado arriba de la barra', () => {
    render(<ProjectCard {...base} progress={42.6} />)

    expect(screen.getByText('Avance')).toBeDefined()
    // El "43%" del encabezado; la barra no repite el valor en esta variante.
    expect(screen.getAllByText('43%')).toHaveLength(1)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('43')
  })
})

describe('ActionCard', () => {
  it('tile común: título, descripción e ícono sobre fondo de card', () => {
    render(
      <ActionCard
        title="Subir evidencia"
        description="Sumá archivos a una etapa"
        icon={Plus}
        onClick={vi.fn()}
        testId="accion"
      />
    )

    expect(screen.getByText('Subir evidencia')).toBeDefined()
    expect(screen.getByText('Sumá archivos a una etapa').className).toContain('text-text-muted')
    const tile = screen.getByTestId('accion')
    expect(tile.querySelector('svg')).not.toBeNull()
    expect(tile.className).toContain('bg-card')
  })

  it('featured pinta el fondo lleno con texto blanco, ícono y descripción incluidos', () => {
    render(
      <ActionCard
        title="Nuevo proyecto"
        description="Empezá acá"
        icon={Plus}
        featured
        onClick={vi.fn()}
        testId="accion"
      />
    )

    expect(screen.getByTestId('accion').className).toContain('bg-primary')
    expect(screen.getByText('Empezá acá').className).toContain('text-white/80')
  })

  it('sin ícono ni descripción es solo el título', () => {
    render(<ActionCard title="Ver todo" onClick={vi.fn()} testId="accion" />)

    const tile = screen.getByTestId('accion')
    expect(tile.querySelector('svg')).toBeNull()
    expect(tile.textContent).toBe('Ver todo')
  })

  it('compact es una fila y esconde la descripción aunque venga', () => {
    render(
      <ActionCard
        title="Documentos"
        description="Oculta"
        icon={Plus}
        compact
        onClick={vi.fn()}
        testId="accion"
      />
    )

    expect(screen.getByTestId('accion').className).toContain('flex-row')
    expect(screen.queryByText('Oculta')).toBeNull()
  })

  it('dispara onClick', async () => {
    const onClick = vi.fn()
    render(<ActionCard title="Ir" onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ir' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('StatCard', () => {
  it('siempre lleva número y rótulo; sin ícono ni helper, nada más', () => {
    const { container } = render(<StatCard value="12" label="Proyectos" />)

    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('Proyectos')).toBeDefined()
    expect(container.querySelector('svg')).toBeNull()
    // Sin onClick es un div, no un botón.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('con onClick es un botón que dispara', async () => {
    const onClick = vi.fn()
    render(<StatCard value="12" label="Proyectos" onClick={onClick} />)

    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('el color del badge es semántico: un tono por significado', () => {
    const tonos = {
      financial: 'bg-verified',
      entity: 'bg-primary',
      trend: 'bg-pending',
      portfolio: 'bg-info',
      people: 'bg-people',
      verification: 'bg-verified'
    } as const

    for (const [tone, clase] of Object.entries(tonos)) {
      const { container, unmount } = render(
        <StatCard value="1" label="x" icon={Plus} tone={tone as keyof typeof tonos} />
      )
      expect(container.querySelector('svg')?.parentElement?.className).toContain(clase)
      unmount()
    }
  })

  it('sin tone es entity (púrpura)', () => {
    const { container } = render(<StatCard value="1" label="x" icon={Plus} />)
    expect(container.querySelector('svg')?.parentElement?.className).toContain('bg-primary')
  })

  it('highlighted pinta fondo lleno, con el badge y el helper en blanco', () => {
    const { container } = render(
      <StatCard value="1" label="Nuevo" helper="ayuda" icon={Plus} tone="financial" highlighted />
    )

    expect(container.firstElementChild?.className).toContain('bg-primary')
    expect(container.querySelector('svg')?.parentElement?.className).toContain('bg-white/20')
    expect(screen.getByText('ayuda').className).toContain('text-white/80')
  })

  it('el helper normal es gris', () => {
    render(<StatCard value="1" label="x" helper="3 en total" />)
    expect(screen.getByText('3 en total').className).toContain('text-text-muted')
  })
})

describe('UnitCard · variantes', () => {
  const status = { tone: 'neutral' as const, label: 'Disponible' }
  const investor = {
    variant: 'investor' as const,
    unitReference: '7B',
    projectName: 'Torre A',
    progress: 10,
    status
  }

  it('investor con imagen la muestra; sin imagen, una superficie vacía', () => {
    const { container, rerender } = render(<UnitCard {...investor} />)
    expect(container.querySelector('img')).toBeNull()

    rerender(<UnitCard {...investor} imageUrl="/u.jpg" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/u.jpg')
  })

  it('investor con onOpen es un botón; sin él, no', async () => {
    const onOpen = vi.fn()
    const { rerender } = render(<UnitCard {...investor} />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<UnitCard {...investor} onOpen={onOpen} className="extra" />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('developer: precio solo si viene, y abre si tiene onOpen', async () => {
    const onOpen = vi.fn()
    const developer = {
      variant: 'developer' as const,
      unitReference: '7B',
      detailLine: 'Piso 7',
      investorLabel: 'Sin asignar',
      status
    }
    const { rerender } = render(<UnitCard {...developer} />)
    expect(screen.queryByText('US$ 90.000')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<UnitCard {...developer} priceLabel="US$ 90.000" onOpen={onOpen} />)
    expect(screen.getByText('US$ 90.000')).toBeDefined()
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })
})

describe('ProgressTimeline · variantes', () => {
  const stages = [
    { sequenceOrder: 1, name: 'Cimientos', state: 'completed' as const },
    { sequenceOrder: 2, name: 'Estructura', state: 'current' as const },
    { sequenceOrder: 3, name: 'Techos', state: 'pending' as const }
  ]

  it('sin onSelectStage los nodos no son botones y marcan el actual con aria-current', () => {
    render(<ProgressTimeline ariaLabel="Avance" stages={stages} />)

    expect(screen.queryByRole('button')).toBeNull()
    const nodos = screen
      .getByRole('list', { name: 'Avance' })
      .querySelectorAll('li > span:first-child')
    expect(nodos[0]?.getAttribute('aria-current')).toBeNull()
    expect(nodos[1]?.getAttribute('aria-current')).toBe('step')
    expect(nodos[1]?.getAttribute('title')).toBe('Estructura')
  })

  it('con onSelectStage cada nodo es un botón con el nombre de su etapa', async () => {
    const onSelect = vi.fn()
    render(<ProgressTimeline ariaLabel="Avance" stages={stages} onSelectStage={onSelect} />)

    expect(screen.getByRole('button', { name: 'Estructura' }).getAttribute('aria-current')).toBe(
      'step'
    )
    expect(
      screen.getByRole('button', { name: 'Cimientos' }).getAttribute('aria-current')
    ).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Techos' }))
    expect(onSelect).toHaveBeenCalledWith(stages[2])
  })

  it('la etiqueta actual y la fecha estimada aparecen si vienen, juntas o por separado', () => {
    const { rerender } = render(<ProgressTimeline ariaLabel="Avance" stages={stages} />)
    expect(screen.queryByText('Etapa 2 de 3')).toBeNull()

    rerender(<ProgressTimeline ariaLabel="Avance" stages={stages} currentLabel="Etapa 2 de 3" />)
    expect(screen.getByText('Etapa 2 de 3')).toBeDefined()

    rerender(
      <ProgressTimeline
        ariaLabel="Avance"
        stages={stages}
        currentLabel="Etapa 2 de 3"
        finalizationLabel="dic 2027"
      />
    )
    expect(screen.getByText('dic 2027')).toBeDefined()

    rerender(<ProgressTimeline ariaLabel="Avance" stages={stages} finalizationLabel="dic 2027" />)
    expect(screen.queryByText('Etapa 2 de 3')).toBeNull()
    expect(screen.getByText('dic 2027')).toBeDefined()
  })
})

describe('NotificationCard · variantes', () => {
  const base = {
    icon: FileText,
    title: 'Evidencia anclada',
    timestampLabel: 'hace 2 h',
    readLabel: 'Leída'
  }

  it('con onOpen es un botón con su test ID; sin él, un div', async () => {
    const onOpen = vi.fn()
    const { rerender } = render(<NotificationCard {...base} read={false} />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<NotificationCard {...base} read={false} onOpen={onOpen} testId="notif" />)
    await userEvent.click(screen.getByTestId('notif'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('el cuerpo solo se dibuja si viene', () => {
    const { rerender } = render(<NotificationCard {...base} read={false} />)
    expect(screen.queryByText('Se anclaron 3 archivos')).toBeNull()

    rerender(<NotificationCard {...base} read={false} body="Se anclaron 3 archivos" />)
    expect(screen.getByText('Se anclaron 3 archivos')).toBeDefined()
  })

  it('el borde de categoría solo aparece si la lista está filtrada, y cada una tiene el suyo', () => {
    const esperados = {
      etapa: 'border-l-primary',
      certificador: 'border-l-pending',
      firma: 'border-l-verified',
      liberacion: 'border-l-verified',
      documento: 'border-l-info'
    } as const

    const { container, rerender } = render(<NotificationCard {...base} read />)
    expect(container.firstElementChild?.className).not.toContain('border-l-4')

    for (const [categoria, clase] of Object.entries(esperados)) {
      rerender(<NotificationCard {...base} read category={categoria as keyof typeof esperados} />)
      expect(container.firstElementChild?.className).toContain(clase)
    }
  })
})

describe('InvestorCard · variantes', () => {
  const base = {
    fullName: 'Mariano Diaz',
    email: 'm@example.com',
    investedLabel: 'US$ 120.000',
    unitLabel: '7B',
    projectName: 'Torre A',
    investmentHeading: 'Inversión',
    unitHeading: 'Unidad'
  }

  it('sin status (deuda declarada) no dibuja ningún pill', () => {
    render(<InvestorCard {...base} />)
    expect(screen.queryByText('Activo')).toBeNull()
    expect(screen.getByText('US$ 120.000')).toBeDefined()
    expect(screen.getByText('Torre A')).toBeDefined()
  })

  it('con onOpen es un botón que dispara; sin él no', async () => {
    const onOpen = vi.fn()
    const { rerender } = render(<InvestorCard {...base} />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<InvestorCard {...base} onOpen={onOpen} className="extra" />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('un nombre vacío no rompe las iniciales', () => {
    expect(iniciales('')).toBe('')
  })
})

describe('DocumentCard · variantes', () => {
  const labels = {
    verified: 'Verificado',
    pending: 'Pendiente',
    view: 'Ver',
    download: 'Descargar',
    copy: 'Copiar',
    copied: 'Copiado'
  }
  const base = { filename: 'permiso.pdf', uploadedAtLabel: '12/05/2026', format: 'PDF', labels }

  it('con onView el nombre y el ojo abren el visor; sin él el nombre es texto', async () => {
    const onView = vi.fn()
    const { rerender } = render(<DocumentCard {...base} txid={null} />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<DocumentCard {...base} txid={null} onView={onView} />)
    await userEvent.click(screen.getByRole('button', { name: 'permiso.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(onView).toHaveBeenCalledTimes(2)
  })

  it('anclado y con onDownload, descarga', async () => {
    const onDownload = vi.fn()
    render(<DocumentCard {...base} txid={TXID} onDownload={onDownload} className="extra" />)

    // Sin onView no hay ojo, pero sí la fila de acciones.
    expect(screen.queryByRole('button', { name: 'Ver' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }))
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it('showHash dibuja el chip solo si hay sha256, con su etiqueta', () => {
    const { rerender } = render(<DocumentCard {...base} txid={null} showHash sha256={null} />)
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()

    rerender(<DocumentCard {...base} txid={null} showHash sha256={'a'.repeat(64)} />)
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDefined()

    rerender(<DocumentCard {...base} txid={null} sha256={'a'.repeat(64)} />)
    // Sin showHash el hash no se muestra aunque exista.
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()

    rerender(
      <DocumentCard
        {...base}
        txid={null}
        showHash
        sha256={'a'.repeat(64)}
        labels={{ ...labels, hashLabel: 'hash' }}
      />
    )
    expect(screen.getByText('hash')).toBeDefined()
  })

  it('el chip abre la prueba solo si el documento está anclado', async () => {
    const onOpenProof = vi.fn()
    const { rerender } = render(
      <DocumentCard
        {...base}
        txid={null}
        showHash
        sha256={'a'.repeat(64)}
        onOpenProof={onOpenProof}
      />
    )
    // Pendiente: solo el botón de copia.
    expect(screen.getAllByRole('button')).toHaveLength(1)

    rerender(
      <DocumentCard
        {...base}
        txid={TXID}
        showHash
        sha256={'a'.repeat(64)}
        onOpenProof={onOpenProof}
      />
    )
    await userEvent.click(screen.getByText('aaaaaa...aaaa'))
    expect(onOpenProof).toHaveBeenCalledOnce()
  })
})
