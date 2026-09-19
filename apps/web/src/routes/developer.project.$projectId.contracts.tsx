import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileSignature, ShieldCheck, Wallet } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { HashChip } from '#/components/domain/HashChip'
import { Loading } from '#/components/domain/Loading'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill, type StatusTone } from '#/components/domain/StatusPill'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatCurrencyCompact, formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

// **M2-D5 filas 40-41 · `/developer/project/:projectId/contracts`** — capturas
// 40 y 41. Test ID: DEV-CONTRACTS-LIST-001.
//
// **Esta pantalla NO se transcribe con el encuadre de las capturas** (D-070).
// Lo que muestran es una plataforma que habilita y ejecuta pagos por etapa:
// "Stage 4/10 released", montos por etapa, "Release stage 5 payment", y un
// estado "In dispute" que solo tiene sentido si hay plata en juego. Este
// producto no administra fondos — refleja y respalda lo que pasa afuera. D-070
// lo dice con todas las letras: *"muestran el contrato como registro y el
// estado comercial de la unidad, no un botón de liberar"*.
//
// **DEV-RELEASE-EXECUTE-002 queda sin reclamar, y es a propósito.** Es el
// segundo test ID de la fila y no se implementa: pintarlo sobre otra cosa para
// que el medidor suba sería mentirle al medidor. El endpoint
// `POST /developer/contracts/:id/releases/:stageNum` sigue en el backend como
// deuda declarada de D-070 y esta pantalla no lo llama; el `ApiPort` ni
// siquiera lo expone.
//
// **Lo que sí queda es lo que se puede sostener.** El contrato como registro
// —quién, qué unidad, cuánto, cuándo se firmó— y el anclaje del acuerdo, que
// es una de las cuatro afirmaciones de D-026: *se registró en este momento*.
// Ese anclaje no lo emite el contrato sino el accept del investor, así que el
// backend lo alcanza por la invitación.
//
// **Los tres StatCard de la fila se quedan; sus tres métricas no.** Activo /
// Liberado / En disputa son estados de un flujo de pagos. En su lugar van tres
// hechos del registro: cuántos contratos hay, cuánto suman y cuántos están
// anclados.
//
// **P1 y P2 componen, no se superponen** (M2-D4 §6.1): el badge contesta
// "¿está anclado?" (profundidad 1) y el chip "¿cuál TXID?" (profundidad 2). El
// chip no abre el TxidModal porque la profundidad 3 no la pide esta fila, y un
// tercer patrón compitiendo por la misma respuesta es redundancia, no rigor.

export const Route = createFileRoute('/developer/project/$projectId/contracts')({
  component: ProjectContracts
})

const TONO: Record<string, StatusTone> = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
}

function ProjectContracts() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  const { data: contratos, isPending } = useQuery({
    queryKey: ['developer', 'project', projectId, 'contracts'],
    queryFn: () => api.listProjectContracts(projectId),
    enabled: ready
  })

  if (!ready) return null

  const lista = contratos ?? []
  // Suma de montos ACORDADOS, no de plata que la plataforma tenga (D-021). En
  // unidades mínimas enteras de punta a punta: la división la hace `Intl`.
  const total = lista.reduce((acc, c) => acc + c.totalMinorUnits, 0)
  const anclados = lista.filter((c) => c.txid !== null).length
  const moneda = lista[0]?.currency ?? 'USD'

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.contracts.title')}
      {...(proyecto ? { context: proyecto.name } : {})}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      <section className="grid grid-cols-3 gap-s3">
        <StatCard
          value={String(lista.length)}
          label={t('developer.contracts.count')}
          icon={FileSignature}
          tone="entity"
        />
        <StatCard
          value={formatCurrencyCompact(total, moneda, locale)}
          label={t('developer.contracts.total')}
          icon={Wallet}
          tone="financial"
        />
        <StatCard
          value={String(anclados)}
          label={t('developer.contracts.anchored')}
          icon={ShieldCheck}
          tone="verification"
        />
      </section>

      <section className="flex flex-col gap-s3" data-testid="DEV-CONTRACTS-LIST-001">
        {isPending ? (
          <Loading />
        ) : lista.length ? (
          lista.map((c) => (
            <article key={c.id} className={cn('flex flex-col gap-s2', CARD_SHELL)}>
              <div className="flex items-start justify-between gap-s2">
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-h2 font-bold text-text-primary">{c.investorName}</h2>
                  <p className="truncate text-body-sm text-text-muted">
                    {t('developer.contracts.unitLine', {
                      unit: c.unitReference,
                      amount: formatCurrency(c.totalMinorUnits, c.currency, locale)
                    })}
                  </p>
                </div>
                <StatusPill tone={TONO[c.unitStatus] ?? 'neutral'}>
                  {t(`unitStatus.${c.unitStatus}`) ?? c.unitStatus}
                </StatusPill>
              </div>

              <p className="text-caption text-text-muted">
                {c.signedAt
                  ? t('developer.contracts.signedOn', { date: formatDate(c.signedAt, locale) })
                  : t('developer.contracts.unsigned')}
              </p>

              <div className="flex flex-wrap items-center gap-s2">
                <VerificationBadge
                  txid={c.txid}
                  verifiedLabel={t('developer.contracts.anchoredBadge')}
                  pendingLabel={t('developer.contracts.pendingBadge')}
                />
                {c.txid ? (
                  <HashChip
                    hash={c.txid}
                    label={t('developer.contracts.txidLabel')}
                    copyLabel={t('hash.copy')}
                    copiedLabel={t('hash.copied')}
                  />
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.contracts.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
