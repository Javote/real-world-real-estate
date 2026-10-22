import type { ReactNode } from 'react'
import { claveDeError } from '#/api/claveDeError'
import { Loading } from '#/components/domain/Loading'
import type { TranslationKey } from '#/i18n/dictionary'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

// Los tres estados de una ruta que lee con `useSuspenseQuery`, dentro del marco de su pantalla. La
// ruta los declara en línea (`pendingComponent: () => <RutaCargando … />`): un spread o una llamada
// en las opciones no lo separa el code-splitting del router, y el marco entra al JS inicial.

type Marco = (props: { children: ReactNode }) => ReactNode

interface Estado {
  Marco: Marco
  testId?: string
}

export function RutaCargando({ Marco, testId }: Estado) {
  return (
    <Marco>
      <section data-testid={testId}>
        <Loading />
      </section>
    </Marco>
  )
}

/** Un error nunca se dibuja como el estado vacío de la pantalla. */
export function RutaConError({ Marco, testId, error }: Estado & { error: unknown }) {
  return <Aviso Marco={Marco} testId={testId} clave={claveDeError(error)} />
}

export function RutaNoEncontrada({
  Marco,
  testId,
  clave = 'error.notFound'
}: Estado & { clave?: TranslationKey }) {
  return <Aviso Marco={Marco} testId={testId} clave={clave} />
}

function Aviso({ Marco, testId, clave }: Estado & { clave: TranslationKey }) {
  const { t } = useTranslation()
  return (
    <Marco>
      <p role="alert" data-testid={testId} className={CARD_SHELL_EMPTY}>
        {t(clave)}
      </p>
    </Marco>
  )
}
