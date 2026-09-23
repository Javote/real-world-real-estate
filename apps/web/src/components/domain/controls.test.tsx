import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryChip, FilterPill, StageChip } from './Chips'
import { FileDropzone } from './FileDropzone'
import { NumberInput } from './NumberInput'
import { SelectDropdown } from './SelectDropdown'
import { TextArea } from './TextArea'
import { TextInput } from './TextInput'
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

// R11 — SPEC-019 W8: variantes de props de los controles.

describe('NumberInput · variantes', () => {
  const steppers = { stepUpLabel: 'Subir', stepDownLabel: 'Bajar' }

  it('subir y bajar suman y restan el paso', async () => {
    const onChange = vi.fn()
    render(<NumberInput id="n" label="Piso" value={5} step={2} onChange={onChange} {...steppers} />)

    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    expect(onChange).toHaveBeenLastCalledWith(7)
    await userEvent.click(screen.getByRole('button', { name: 'Bajar' }))
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('en el mínimo no se puede bajar, y en el máximo no se puede subir', () => {
    const { rerender } = render(
      <NumberInput
        id="n"
        label="Piso"
        value={1}
        min={1}
        max={10}
        onChange={vi.fn()}
        {...steppers}
      />
    )
    expect(screen.getByRole('button', { name: 'Bajar' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', false)

    rerender(
      <NumberInput
        id="n"
        label="Piso"
        value={10}
        min={1}
        max={10}
        onChange={vi.fn()}
        {...steppers}
      />
    )
    expect(screen.getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Bajar' })).toHaveProperty('disabled', false)
  })

  it('desde vacío bajar arranca en el mínimo y no lo pasa', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput id="n" label="Etapa" value={null} min={3} onChange={onChange} {...steppers} />
    )
    // Con el valor vacío se toma el mínimo: ya está en el piso.
    expect(screen.getByRole('button', { name: 'Bajar' })).toHaveProperty('disabled', true)
  })

  it('desde vacío y sin mínimo el primer paso arranca en cero', async () => {
    const onChange = vi.fn()
    render(<NumberInput id="n" label="Etapa" value={null} onChange={onChange} {...steppers} />)

    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('un paso que se pasa del máximo se acota', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Piso"
        value={9}
        max={10}
        step={5}
        onChange={onChange}
        {...steppers}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('un paso que baja del mínimo se acota', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Piso"
        value={2}
        min={1}
        step={5}
        onChange={onChange}
        {...steppers}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Bajar' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('lo tipeado fuera de rango se acota en los dos extremos', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        id="n"
        label="Piso"
        value={5}
        min={1}
        max={10}
        onChange={onChange}
        {...steppers}
      />
    )
    const campo = screen.getByLabelText('Piso')

    fireEvent.change(campo, { target: { value: '99' } })
    expect(onChange).toHaveBeenLastCalledWith(10)
    fireEvent.change(campo, { target: { value: '-4' } })
    expect(onChange).toHaveBeenLastCalledWith(1)
    fireEvent.change(campo, { target: { value: '7' } })
    expect(onChange).toHaveBeenLastCalledWith(7)
  })

  it('con error marca el campo como inválido y muestra el mensaje', () => {
    render(
      <NumberInput
        id="n"
        label="Precio"
        value={5}
        onChange={vi.fn()}
        error="Ingresá un precio"
        placeholder="0"
        className="extra"
        {...steppers}
      />
    )

    const campo = screen.getByLabelText('Precio')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-errormessage')).toBe('n-error')
    expect(screen.getByText('Ingresá un precio').id).toBe('n-error')
  })

  it('sin error no hay atributos ni mensaje', () => {
    render(<NumberInput id="n" label="Precio" value={5} onChange={vi.fn()} {...steppers} />)

    expect(screen.getByLabelText('Precio').getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByLabelText('Precio').getAttribute('aria-errormessage')).toBeNull()
  })

  it('deshabilitado apaga el campo y los dos botones', () => {
    render(
      <NumberInput id="n" label="Precio" value={5} onChange={vi.fn()} disabled {...steppers} />
    )

    expect(screen.getByLabelText('Precio')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Subir' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Bajar' })).toHaveProperty('disabled', true)
  })
})

describe('TextInput', () => {
  it('el label queda asociado al campo y tipear avisa el valor', async () => {
    const onChange = vi.fn()
    render(<TextInput label="Nombre" value="" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Nombre'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
    expect(screen.getByLabelText('Nombre').getAttribute('type')).toBe('text')
  })

  it('pasa tipo, placeholder, autocomplete y required al input', () => {
    render(
      <TextInput
        label="Clave"
        value=""
        onChange={vi.fn()}
        type="password"
        placeholder="••••"
        autoComplete="current-password"
        required
      />
    )

    const campo = screen.getByLabelText('Clave')
    expect(campo.getAttribute('type')).toBe('password')
    expect(campo.getAttribute('placeholder')).toBe('••••')
    expect(campo.getAttribute('autocomplete')).toBe('current-password')
    expect(campo).toHaveProperty('required', true)
  })

  it('con error lo marca inválido, lo describe y lo muestra', () => {
    render(<TextInput label="Email" value="" onChange={vi.fn()} error="Falta el email" />)

    const campo = screen.getByLabelText('Email')
    const mensaje = screen.getByText('Falta el email')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-describedby')).toBe(mensaje.id)
    expect(campo.className).toContain('border-danger')
  })

  it('sin error no hay mensaje ni atributos', () => {
    render(<TextInput label="Email" value="" onChange={vi.fn()} />)

    const campo = screen.getByLabelText('Email')
    expect(campo.getAttribute('aria-invalid')).toBeNull()
    expect(campo.getAttribute('aria-describedby')).toBeNull()
    expect(campo.className).toContain('border-border')
  })

  it('el adorno va dentro del campo y le deja lugar', () => {
    const { rerender } = render(<TextInput label="Clave" value="" onChange={vi.fn()} />)
    expect(screen.queryByText('ojo')).toBeNull()
    expect(screen.getByLabelText('Clave').className).not.toContain('pr-s12')

    rerender(<TextInput label="Clave" value="" onChange={vi.fn()} adornment={<i>ojo</i>} />)
    expect(screen.getByText('ojo')).toBeDefined()
    expect(screen.getByLabelText('Clave').className).toContain('pr-s12')
  })
})

describe('ToggleSwitch · variantes', () => {
  it('la descripción solo se dibuja si viene', () => {
    const { rerender } = render(<ToggleSwitch id="s" label="Avisos" checked onChange={vi.fn()} />)
    expect(screen.queryByText('Por mail')).toBeNull()

    rerender(
      <ToggleSwitch id="s" label="Avisos" checked onChange={vi.fn()} description="Por mail" />
    )
    expect(screen.getByText('Por mail')).toBeDefined()
  })

  it('encendido, tocarlo avisa que se apaga', async () => {
    const onChange = vi.fn()
    render(<ToggleSwitch id="s" label="Avisos" checked onChange={onChange} className="extra" />)

    await userEvent.click(screen.getByRole('switch', { name: 'Avisos' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('apagado se anuncia sin marcar', () => {
    render(<ToggleSwitch id="s" label="Avisos" checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })

  it('deshabilitado no responde', async () => {
    const onChange = vi.fn()
    render(<ToggleSwitch id="s" label="Avisos" checked={false} onChange={onChange} disabled />)

    await userEvent.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toHaveProperty('disabled', true)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SelectDropdown · variantes', () => {
  const options = [
    { value: '1', label: '7B' },
    { value: '2', label: '8C', disabled: true }
  ]

  it('sin placeholder no hay opción vacía', () => {
    render(<SelectDropdown id="u" label="Unidad" value="1" onChange={vi.fn()} options={options} />)

    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('elegir una opción avisa su valor', async () => {
    const onChange = vi.fn()
    render(
      <SelectDropdown
        id="u"
        label="Unidad"
        value=""
        onChange={onChange}
        placeholder="Elegí una unidad"
        options={[{ value: '1', label: '7B' }]}
      />
    )

    await userEvent.selectOptions(screen.getByLabelText('Unidad'), '1')
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('una opción puede venir deshabilitada', () => {
    render(<SelectDropdown id="u" label="Unidad" value="1" onChange={vi.fn()} options={options} />)

    expect(screen.getByRole('option', { name: '8C' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('option', { name: '7B' })).toHaveProperty('disabled', false)
  })

  it('con error lo marca inválido y lo muestra', () => {
    render(
      <SelectDropdown
        id="u"
        label="Unidad"
        value="1"
        onChange={vi.fn()}
        options={options}
        error="Elegí una unidad"
        className="extra"
      />
    )

    const campo = screen.getByLabelText('Unidad')
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-errormessage')).toBe('u-error')
    expect(screen.getByText('Elegí una unidad').id).toBe('u-error')
  })

  it('sin error no hay atributos; con valor vacío el texto va atenuado', () => {
    const { rerender } = render(
      <SelectDropdown id="u" label="Unidad" value="1" onChange={vi.fn()} options={options} />
    )
    expect(screen.getByLabelText('Unidad').getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByLabelText('Unidad').className).not.toMatch(/(^| )text-disabled/)

    rerender(
      <SelectDropdown
        id="u"
        label="Unidad"
        value=""
        onChange={vi.fn()}
        placeholder="Elegí"
        options={options}
      />
    )
    expect(screen.getByLabelText('Unidad').className).toMatch(/(^| )text-disabled/)
  })

  it('deshabilitado apaga el select', () => {
    render(
      <SelectDropdown
        id="u"
        label="Unidad"
        value="1"
        onChange={vi.fn()}
        options={options}
        disabled
      />
    )
    expect(screen.getByLabelText('Unidad')).toHaveProperty('disabled', true)
  })
})

describe('Chips · variantes', () => {
  it('FilterPill y CategoryChip disparan onSelect y respetan disabled', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <FilterPill selected={false} onSelect={onSelect} className="extra">
        Todos
      </FilterPill>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(onSelect).toHaveBeenCalledOnce()

    rerender(
      <CategoryChip selected onSelect={onSelect} disabled className="extra">
        Etapas
      </CategoryChip>
    )
    expect(screen.getByRole('button', { name: 'Etapas' })).toHaveProperty('disabled', true)
  })

  it('StageChip sin label es el cuadrado numérico; con label, la píldora ancha', () => {
    const { rerender } = render(
      <StageChip number={3} selected={false} onSelect={vi.fn()} ariaLabel="Etapa 3" />
    )
    expect(screen.getByRole('button', { name: 'Etapa 3' }).textContent).toBe('3')
    expect(screen.getByRole('button', { name: 'Etapa 3' }).className).toContain('size-10')

    rerender(
      <StageChip
        number={3}
        label="Estructura"
        selected={false}
        onSelect={vi.fn()}
        ariaLabel="Etapa 3"
        className="extra"
      />
    )
    expect(screen.getByRole('button', { name: 'Etapa 3' }).textContent).toBe('3. Estructura')
    expect(screen.getByRole('button', { name: 'Etapa 3' }).className).toContain('whitespace-nowrap')
  })

  it('el anillo de anclado solo se ve si no está elegido', () => {
    const { rerender } = render(
      <StageChip number={1} anchored selected={false} onSelect={vi.fn()} ariaLabel="Etapa 1" />
    )
    expect(screen.getByRole('button').className).toContain('ring-verified')

    rerender(<StageChip number={1} anchored selected onSelect={vi.fn()} ariaLabel="Etapa 1" />)
    expect(screen.getByRole('button').className).not.toContain('ring-verified')
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')

    rerender(
      <StageChip number={1} selected={false} onSelect={vi.fn()} ariaLabel="Etapa 1" disabled />
    )
    expect(screen.getByRole('button').className).not.toContain('ring-verified')
    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  })
})

describe('FileDropzone · variantes', () => {
  const labels = {
    primary: 'Arrastrá archivos',
    secondary: 'PDF, JPG o PNG',
    remove: 'Quitar',
    rejected: (n: string, motivo: string) => `${n} no se puede subir (${motivo})`
  }
  const pdf = (nombre: string) =>
    new File([Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), nombre], nombre, {
      type: 'application/pdf'
    })
  // Al arrastrar encima la clase `border-dashed` cambia: se busca por el input.
  const zona = (c: HTMLElement) => c.querySelector('input')?.parentElement as HTMLElement

  it('la línea de ayuda solo se dibuja si viene', () => {
    const { rerender } = render(
      <FileDropzone files={[]} onChange={vi.fn()} labels={{ ...labels, secondary: undefined }} />
    )
    expect(screen.queryByText('PDF, JPG o PNG')).toBeNull()

    rerender(<FileDropzone files={[]} onChange={vi.fn()} labels={labels} />)
    expect(screen.getByText('PDF, JPG o PNG')).toBeDefined()
  })

  it('arrastrar encima resalta la zona y salir la suelta', () => {
    const { container } = render(<FileDropzone files={[]} onChange={vi.fn()} labels={labels} />)

    fireEvent.dragOver(zona(container))
    expect(zona(container).className).toContain('bg-primary-light')

    fireEvent.dragLeave(zona(container))
    expect(zona(container).className).not.toContain('bg-primary-light')
  })

  it('deshabilitado no se resalta al arrastrar ni recibe lo que se suelta', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileDropzone files={[]} onChange={onChange} labels={labels} disabled className="extra" />
    )

    fireEvent.dragOver(zona(container))
    expect(zona(container).className).not.toContain('bg-primary-light')

    fireEvent.drop(zona(container), { dataTransfer: { files: [pdf('a.pdf')] } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Arrastrá archivos')).toHaveProperty('disabled', true)
  })

  it('soltar algo sin archivos no hace nada', () => {
    const onChange = vi.fn()
    const { container } = render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)

    fireEvent.drop(zona(container), { dataTransfer: {} })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('quitar un archivo devuelve la lista sin él', async () => {
    const a = pdf('a.pdf')
    const b = pdf('b.pdf')
    const onChange = vi.fn()
    render(<FileDropzone files={[a, b]} onChange={onChange} labels={labels} />)

    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]!)
    expect(onChange).toHaveBeenCalledWith([b])
  })

  it('un archivo sin aviso no muestra nota, y deshabilitado no se puede quitar', () => {
    const a = pdf('a.pdf')
    render(
      <FileDropzone files={[a]} onChange={vi.fn()} labels={labels} disabled notes={new Map()} />
    )

    expect(screen.getByText('a.pdf')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Quitar' })).toHaveProperty('disabled', true)
  })

  it('agrega lo aceptado a lo que ya había', async () => {
    const previo = pdf('previo.pdf')
    const nuevo = pdf('nuevo.pdf')
    const onChange = vi.fn()
    render(<FileDropzone files={[previo]} onChange={onChange} labels={labels} />)

    await userEvent.upload(screen.getByLabelText('Arrastrá archivos'), nuevo)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([previo, nuevo]))
  })

  it('vacía el input al elegir, para poder elegir el mismo archivo otra vez', async () => {
    const onChange = vi.fn()
    render(<FileDropzone files={[]} onChange={onChange} labels={labels} />)
    const input = screen.getByLabelText('Arrastrá archivos') as HTMLInputElement

    await userEvent.upload(input, pdf('a.pdf'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(input.files).toHaveLength(0)
  })

  it('un cupo de archivos lleno rechaza el que sobra con su motivo', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileDropzone files={[]} onChange={onChange} labels={labels} maxFiles={1} />
    )

    fireEvent.drop(zona(container), { dataTransfer: { files: [pdf('uno.pdf'), pdf('dos.pdf')] } })

    expect(await screen.findByText(/dos\.pdf no se puede subir/)).toBeDefined()
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
  })
})
