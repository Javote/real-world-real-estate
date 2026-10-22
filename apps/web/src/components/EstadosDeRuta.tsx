import { type ErrorComponentProps, notFound } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { claveDeError } from '#/api/claveDeError'
import { ApiError } from '#/api/port'
import { Loading } from '#/components/domain/Loading'
import type { TranslationKey } from '#/i18n/dictionary'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

type Marco = (props: { children: ReactNode }) => ReactNode

interface Opciones {
  testId?: string
  noEncontrado?: TranslationKey
}

/**
 * Los tres estados de una ruta que lee con `useSuspenseQuery`, dentro del marco de la pantalla:
 * mientras el loader espera, si falla y si lo pedido no existe. Un error nunca se dibuja como el
 * estado vacío de la pantalla.
 */
export function estadosDeRuta(Marco: Marco, { testId, noEncontrado }: Opciones = {}) {
  function Aviso({ clave }: { clave: TranslationKey }) {
    const { t } = useTranslation()
    return (
      <Marco>
        <p role="alert" data-testid={testId} className={CARD_SHELL_EMPTY}>
          {t(clave)}
        </p>
      </Marco>
    )
  }

  return {
    pendingMs: 150,
    pendingComponent: () => (
      <Marco>
        <section data-testid={testId}>
          <Loading />
        </section>
      </Marco>
    ),
    errorComponent: ({ error }: ErrorComponentProps) => <Aviso clave={claveDeError(error)} />,
    notFoundComponent: () => <Aviso clave={noEncontrado ?? 'error.notFound'} />
  }
}

/** En un loader, un 404 de la API es la ruta que no existe: lo dibuja su `notFoundComponent`. */
export async function oNoEncontrado<T>(pedido: Promise<T>): Promise<T> {
  try {
    return await pedido
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw notFound()
    throw err
  }
}
