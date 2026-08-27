import type { CapitalMonthlyPoint } from '@plataforma/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, DollarSign } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatCurrencyCompact } from '#/i18n/format'
import type { Locale } from '#/i18n/locale'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 42-43 · `/developer/capital`** — capturas 42 y 43, que son una
// sola pantalla larga. Test IDs: DEV-CAPITAL-SUMMARY-001,
// DEV-CAPITAL-MONTHLY-002.
//
// **El `Chart` de la fila no es un componente nuevo** (D-073). M2-D5 lo nombra
// y M2-D3 no lo define entre sus 36; la resolución está escrita en la decisión,
// y el resumen es que estas barras son composición de ESTA pantalla —divs con
// una altura porcentual y tokens existentes—, no una entrada de la biblioteca.
// El día que una segunda superficie necesite barras verticales, ahí sí es un
// componente y ahí sí es una decisión.
//
// **Nada de esto es plata que la plataforma tenga** (D-021). "Capital
// levantado" es la suma de los contratos firmados: montos declarados. El
// endpoint ya lo dice y el copy de la pantalla no lo contradice.
//
// **`released` y `pending` no se muestran, aunque el summary los traiga.** Son
// del encuadre de liberaciones que D-070 declaró fuera del producto. La
// captura tampoco los tiene: muestra total levantado, evolución mensual y
// desglose por proyecto, y nada más.
//
// **La serie mensual es POR MES, no acumulada.** Los valores de la captura
// terminan justo en el total —3980k con "Total raised: 3,980,000"—, o sea que
// dibuja un acumulado; pero eso es el dato mock, y lo normativo de una captura
// es la estructura. El endpoint devuelve lo que entró cada mes y solo los meses
// con movimiento, que es lo que la pantalla dice: "Evolución mensual".
//
// **Sin la foto del proyecto de la captura.** `capitalByProject` no trae imagen
// y `Project` no tiene columna para una. Un placeholder gris ocuparía el lugar
// sin decir nada; el badge con ícono es lo que el resto de la app ya usa
// cuando hay una entidad y no hay foto.

export const Route = createFileRoute('/developer/capital')({ component: DeveloperCapital })

function DeveloperCapital() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()

  const { data: resumen } = useQuery({
    queryKey: ['developer', 'capital', 'summary'],
    queryFn: api.getCapitalSummary,
    enabled: ready
  })

  const { data: mensual } = useQuery({
    queryKey: ['developer', 'capital', 'monthly'],
    queryFn: api.getCapitalMonthly,
    enabled: ready
  })

  const { data: porProyecto } = useQuery({
    queryKey: ['developer', 'capital', 'by-project'],
    queryFn: api.getCapitalByProject,
    enabled: ready
  })

  if (!ready) return null

  const moneda = resumen?.currency
  const total = resumen?.raisedMinorUnits ?? 0

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.capital.title')}
      context={t('developer.capital.context')}
    >
      <section
        className="flex flex-col gap-s5 rounded-xl bg-card p-s4 shadow-e1"
        data-testid="DEV-CAPITAL-SUMMARY-001"
      >
        <div className="flex items-center gap-s3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-verified text-white">
            <DollarSign size={20} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-stat font-bold text-text-primary">
              {/* Sin moneda única no se suma: el guión es la respuesta honesta
                  a "cuánto", no un cero (regla 17). */}
              {moneda ? formatCurrency(total, moneda, locale) : t('panel.emptyValue')}
            </span>
            <span className="text-body-sm text-text-muted">
              {t('developer.capital.totalRaised')}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-s3" data-testid="DEV-CAPITAL-MONTHLY-002">
          <h2 className="text-body font-bold text-text-primary">
            {t('developer.capital.monthly')}
          </h2>
          {mensual?.length ? (
            <BarrasMensuales serie={mensual} moneda={moneda ?? null} locale={locale} />
          ) : (
            <p className="text-body-sm text-text-muted">{t('developer.capital.monthlyEmpty')}</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-s3">
        <h2 className="text-h2 font-bold text-text-primary">{t('developer.capital.byProject')}</h2>

        {porProyecto?.length ? (
          porProyecto.map((p) => (
            <article
              key={p.projectId}
              className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1"
            >
              <div className="flex items-center gap-s3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                  <Building2 className="size-icon-stat text-primary" aria-hidden="true" />
                </span>
                <h3 className="min-w-0 truncate text-body font-bold text-text-primary">
                  {p.projectName}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-s3">
                <div className="flex flex-col">
                  <span className="text-body-sm text-text-muted">
                    {t('developer.capital.raised')}
                  </span>
                  <span className="text-body font-bold text-text-primary tabular-nums">
                    {p.currency
                      ? formatCurrency(p.raisedMinorUnits, p.currency, locale)
                      : t('panel.emptyValue')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-body-sm text-text-muted">
                    {t('developer.capital.investors')}
                  </span>
                  <span className="text-body font-bold text-text-primary tabular-nums">
                    {p.investors}
                  </span>
                </div>
              </div>

              {/* "Share of total" — la barra de M2-D3, no una nueva. El total
                  puede ser cero cuando todavía no hay contratos: dividir ahí
                  daría NaN y la barra se dibujaría vacía sin decir por qué. */}
              <div className="flex flex-col gap-s1">
                <div className="flex items-baseline justify-between gap-s2">
                  <span className="text-body-sm text-text-muted">
                    {t('developer.capital.share')}
                  </span>
                </div>
                <ProgressBar
                  percent={total > 0 ? Math.round((p.raisedMinorUnits / total) * 100) : 0}
                  showValue
                />
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.capital.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}

/**
 * La "Monthly evolution" de la captura 42: una barra por mes, con su valor
 * arriba y la etiqueta del mes abajo.
 *
 * **No tiene ejes, ni grilla, ni tooltip, ni leyenda** — la captura tampoco. Es
 * lo que hace que sea composición y no un `Chart` (D-073): la altura de cada
 * barra es un porcentaje del máximo de la serie, y eso es todo lo que hay.
 *
 * **Se normaliza contra el máximo, no contra el total.** Contra el total, un
 * mes fuerte entre once flojos deja diez barras de un píxel: el gráfico dejaría
 * de comunicar la forma de la serie, que es lo único que un gráfico sin eje
 * puede comunicar. El piso de 4% existe por lo mismo — un mes con movimiento
 * chico tiene que verse distinto de un mes sin movimiento.
 */
function BarrasMensuales({
  serie,
  moneda,
  locale
}: {
  serie: CapitalMonthlyPoint[]
  moneda: string | null
  locale: Locale
}) {
  const maximo = Math.max(...serie.map((p) => p.raisedMinorUnits), 1)

  return (
    <ol className="flex items-end gap-s2 overflow-x-auto">
      {serie.map((punto) => (
        // **La columna tiene techo.** Con `flex-1` a secas, un solo mes con
        // movimiento se estira a todo el ancho y deja de leerse como una barra
        // para leerse como un bloque de color. El tope hace que una serie corta
        // siga pareciendo una serie.
        <li
          key={punto.month}
          className="flex min-w-12 max-w-24 flex-1 flex-col items-center gap-s1"
        >
          <span className="text-caption text-text-muted tabular-nums">
            {moneda ? formatCurrencyCompact(punto.raisedMinorUnits, moneda, locale) : '—'}
          </span>
          {/* El alto del área sale de la escala de Tailwind y no de un número
              suelto; lo único que calcula el componente es el PORCENTAJE, que
              es dato. */}
          <div className="flex h-32 w-full items-end">
            <div
              className="w-full rounded-t-md bg-primary"
              style={{
                height: `${Math.max(Math.round((punto.raisedMinorUnits / maximo) * 100), 4)}%`
              }}
            />
          </div>
          <span className="text-caption text-text-muted">{nombreDeMes(punto.month, locale)}</span>
        </li>
      ))}
    </ol>
  )
}

/** "2026-06" → "jun". El mes viene en UTC y se muestra sin husos de por medio. */
function nombreDeMes(month: string, locale: Locale): string {
  const [anio, mes] = month.split('-')
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(anio), Number(mes) - 1, 1))
  )
}
