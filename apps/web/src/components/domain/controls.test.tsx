import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryChip, FilterPill, StageChip } from './Chips'
import { FileDropzone } from './FileDropzone'
import { NumberInput } from './NumberInput'
import { SelectDropdown } from './SelectDropdown'
import { TextArea } from './TextArea'
import { ToggleSwitch } from './ToggleSwitch'

// M2-D3 §Forms & Controls. Lo que fijan estos tests no es el aspecto: son las
// reglas de uso del entregable y las reglas duras del repo.

describe('NumberInput', () => {
  it('vacío es null, no cero', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Precio"
        value={5}
        onChange={onChange}
        stepUpLabel="Subir"
        stepDownLabel="Bajar"
      />
    )

    await userEvent.clear(screen.getByLabelText('Precio'))

    // Cero afirma "el precio es 0"; null dice "todavía no se cargó".
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('el stepper respeta el máximo', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Piso"
        value={10}
        max={10}
        onChange={onChange}
        stepUpLabel="Subir"
        stepDownLabel="Bajar"
      />
    )

    expect(screen.getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', true)
  })

  it('desde vacío arranca en el mínimo, no en cero', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Etapa"
        value={null}
        min={1}
        onChange={onChange}
        stepUpLabel="Subir"
        stepDownLabel="Bajar"
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    // Un stepper que empieza fuera del rango produce un valor inválido.
    expect(onChange).toHaveBeenCalledWith(2)
  })
})

describe('TextArea', () => {
  it('cuenta los caracteres cuando hay máximo', () => {
    render(
      <TextArea id="t" label="Observaciones" value="hola" onChange={vi.fn()} maxLength={100} />
    )
    expect(screen.getByText('4/100')).toBeDefined()
  })

  it('marca el error de forma accesible', () => {
    render(
      <TextArea id="t" label="Nota" value="" onChange={vi.fn()} error="Falta la observación" />
    )
    expect(screen.getByLabelText('Nota').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Falta la observación')).toBeDefined()
  })
})

describe('ToggleSwitch', () => {
  it('se anuncia como switch, no como casilla', () => {
    render(<ToggleSwitch id="s" label="Avisos por mail" checked onChange={vi.fn()} />)

    // "activado/desactivado" y no "casilla marcada": son estados distintos.
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('togglea al valor contrario', async () => {
    const onChange = vi.fn()
    render(<ToggleSwitch id="s" label="Avisos" checked={false} onChange={onChange} />)

    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('los tres chips', () => {
  it('FilterPill y CategoryChip anuncian su selección con aria-pressed', () => {
    const { rerender } = render(
      <FilterPill selected onSelect={vi.fn()}>
        Todos
      </FilterPill>
    )
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true')

    rerender(
      <CategoryChip selected={false} onSelect={vi.fn()}>
        Etapas
      </CategoryChip>
    )
    expect(screen.getByRole('button', { name: 'Etapas' }).getAttribute('aria-pressed')).toBe(
      'false'
    )
  })

  it('StageChip anclado se puede seguir eligiendo: el anclaje es señal, no permiso', async () => {
    const onSelect = vi.fn()
    render(
      <StageChip
        number={3}
        anchored
        selected={false}
        onSelect={onSelect}
        ariaLabel="Etapa 3, anclada"
      />
    )

    // Un stage anclado admite más evidencia: se le suma y se ancla otro bundle.
    await userEvent.click(screen.getByRole('button', { name: 'Etapa 3, anclada' }))
    expect(onSelect).toHaveBeenCalled()
  })
})

describe('FileDropzone', () => {
  // SPEC-218: el dropzone valida con las reglas de `packages/shared` (tipo real
  // por magic bytes, tamaño, cupo y repetidos). Los archivos de estos tests
  // llevan la firma real, y la validación es ASÍNCRONA (lee los bytes).
  const labels = {
    primary: 'Arrastrá archivos',
    remove: 'Quitar',
    rejected: (n: string, motivo: string) => `${n} no se puede subir (${motivo})`
  }
  const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]
  const pdfReal = (nombre: string, cola = nombre) =>
    new File([Uint8Array.from(PDF_BYTES), cola], nombre, { type: 'application/pdf' })

  it('acepta solo los tipos de la regla 10 — probado por DROP, no por el picker', async () => {
    // **El picker no sirve para probar esto y es interesante por qué.** El
    // atributo `accept` del input ya filtra: `userEvent.upload` lo respeta y el
    // .exe nunca llega a la validación de JS. O sea que el picker prueba el
    // atributo, no el código.
    //
    // Arrastrar-y-soltar NO pasa por `accept` —el navegador entrega lo que sea
    // que se soltó—, así que es la ruta por la que un archivo prohibido llega
    // de verdad al componente. Es la que hay que probar.
    const onChange = vi.fn()
    const { container } = render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)

    const pdf = pdfReal('plano.pdf')
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' })
    const zona = container.querySelector('[class*="border-dashed"]')!

    fireEvent.drop(zona, { dataTransfer: { files: [pdf, exe] } })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([pdf]))
    expect(screen.getByText('virus.exe no se puede subir (type)')).toBeDefined()
  })

  it('rechaza un ejecutable que se hace pasar por PDF: mira los bytes, no el `type`', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)

    const falso = new File(['MZ\x90\x00 ejecutable'], 'falso.pdf', { type: 'application/pdf' })
    fireEvent.drop(container.querySelector('[class*="border-dashed"]')!, {
      dataTransfer: { files: [falso] }
    })

    expect(await screen.findByText('falso.pdf no se puede subir (type)')).toBeDefined()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rechaza lo que pasa el tamaño máximo', async () => {
    // El tamaño sí se puede probar por el picker: `accept` filtra por tipo, no
    // por bytes, así que el archivo grande llega a la validación.
    const onChange = vi.fn()
    render(<FileDropzone files={[]} onChange={onChange} labels={labels} maxSizeMb={0.000001} />)

    const grande = pdfReal('grande.pdf', 'x'.repeat(500))
    await userEvent.upload(screen.getByLabelText('Arrastrá archivos'), grande)

    expect(await screen.findByText('grande.pdf no se puede subir (size)')).toBeDefined()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('no deja agregar dos archivos con el mismo contenido, aunque tengan otro nombre', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)

    const original = pdfReal('original.pdf', 'igual')
    const copia = pdfReal('copia.pdf', 'igual')
    fireEvent.drop(container.querySelector('[class*="border-dashed"]')!, {
      dataTransfer: { files: [original, copia] }
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([original]))
    expect(screen.getByText('copia.pdf no se puede subir (duplicate)')).toBeDefined()
  })

  it('muestra el aviso que le pasa quien lo usa (el motivo del backend) debajo del archivo', () => {
    const rechazado = pdfReal('viejo.pdf')
    render(
      <FileDropzone
        files={[rechazado]}
        onChange={vi.fn()}
        labels={labels}
        notes={new Map([[rechazado, 'Ya se subió a esta etapa antes.']])}
      />
    )

    expect(screen.getByText('viejo.pdf')).toBeDefined()
    expect(screen.getByText('Ya se subió a esta etapa antes.')).toBeDefined()
  })

  it('no sube nada por su cuenta', async () => {
    const onChange = vi.fn()
    render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)

    const pdf = pdfReal('a.pdf')
    await userEvent.upload(screen.getByLabelText('Arrastrá archivos'), pdf)

    // Solo avisa: quien lo usa decide cuándo mandar. Un dropzone que dispara la
    // request haría un anclaje sin que el usuario lo pida (M2-D4 §6.3).
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([pdf]))
  })
})

describe('SelectDropdown', () => {
  it('el placeholder es una opción deshabilitada, no un valor elegible', () => {
    render(
      <SelectDropdown
        id="u"
        label="Unidad"
        value=""
        onChange={vi.fn()}
        placeholder="Elegí una unidad"
        options={[{ value: '1', label: '7B' }]}
      />
    )

    expect(screen.getByRole('option', { name: 'Elegí una unidad' })).toHaveProperty(
      'disabled',
      true
    )
  })
})
