import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMORA_DE_INTENCION_MS, useAbrirConPrecarga, useIntencion } from './intencion'

function Boton({ alIntentar }: { alIntentar?: () => void }) {
  return (
    <button type="button" {...useIntencion(alIntentar)}>
      abrir
    </button>
  )
}

describe('useIntencion', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('el puntero que se queda encima dispara después de la demora, una vez', () => {
    vi.useFakeTimers()
    const alIntentar = vi.fn()
    render(<Boton alIntentar={alIntentar} />)

    fireEvent.pointerEnter(screen.getByRole('button'))
    act(() => vi.advanceTimersByTime(DEMORA_DE_INTENCION_MS - 1))
    expect(alIntentar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(alIntentar).toHaveBeenCalledTimes(1)
  })

  it('el puntero que pasa de largo no dispara', () => {
    vi.useFakeTimers()
    const alIntentar = vi.fn()
    render(<Boton alIntentar={alIntentar} />)

    const boton = screen.getByRole('button')
    fireEvent.pointerEnter(boton)
    fireEvent.pointerLeave(boton)
    act(() => vi.advanceTimersByTime(DEMORA_DE_INTENCION_MS * 2))
    expect(alIntentar).not.toHaveBeenCalled()
  })

  it('volver a entrar reinicia la espera en vez de sumar otra', () => {
    vi.useFakeTimers()
    const alIntentar = vi.fn()
    render(<Boton alIntentar={alIntentar} />)

    const boton = screen.getByRole('button')
    fireEvent.pointerEnter(boton)
    fireEvent.pointerEnter(boton)
    act(() => vi.advanceTimersByTime(DEMORA_DE_INTENCION_MS))
    expect(alIntentar).toHaveBeenCalledTimes(1)
  })

  it('el foco y el toque disparan enseguida', () => {
    const alIntentar = vi.fn()
    render(<Boton alIntentar={alIntentar} />)

    fireEvent.focus(screen.getByRole('button'))
    fireEvent.touchStart(screen.getByRole('button'))
    expect(alIntentar).toHaveBeenCalledTimes(2)
  })

  it('desmontar con una espera pendiente no dispara después', () => {
    vi.useFakeTimers()
    const alIntentar = vi.fn()
    const { unmount } = render(<Boton alIntentar={alIntentar} />)

    fireEvent.pointerEnter(screen.getByRole('button'))
    unmount()
    act(() => vi.advanceTimersByTime(DEMORA_DE_INTENCION_MS))
    expect(alIntentar).not.toHaveBeenCalled()
  })

  it('sin `alIntentar` no agrega manejadores', () => {
    render(<Boton />)
    fireEvent.pointerEnter(screen.getByRole('button'))
    fireEvent.focus(screen.getByRole('button'))
  })
})

describe('useAbrirConPrecarga', () => {
  afterEach(cleanup)

  function montar() {
    const loader = vi.fn()
    const raiz = createRootRoute({ component: Outlet })
    const lista = createRoute({
      getParentRoute: () => raiz,
      path: '/',
      component: function Lista() {
        const abrir = useAbrirConPrecarga()
        const { onOpen, onIntent } = abrir({ to: '/p/$id', params: { id: 'p1' } } as never)
        return (
          <button type="button" onClick={onOpen} onFocus={onIntent}>
            abrir
          </button>
        )
      }
    })
    const detalle = createRoute({
      getParentRoute: () => raiz,
      path: '/p/$id',
      loader: ({ params }) => loader(params.id),
      component: () => <div>DETALLE</div>
    })
    const router = createRouter({
      routeTree: raiz.addChildren([lista, detalle]),
      history: createMemoryHistory({ initialEntries: ['/'] })
    })
    render(<RouterProvider router={router} />)
    return { loader }
  }

  it('onIntent corre el loader del destino sin navegar; onOpen navega', async () => {
    const { loader } = montar()
    const boton = await screen.findByRole('button')

    fireEvent.focus(boton)
    await vi.waitFor(() => expect(loader).toHaveBeenCalledWith('p1'))
    expect(screen.queryByText('DETALLE')).toBeNull()

    fireEvent.click(boton)
    await screen.findByText('DETALLE')
  })
})
