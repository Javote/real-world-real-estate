import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, api } from '../api/port'
import { ROLE_LANDING } from '../auth/roles'
import { setSession } from '../auth/session'
import { GradientHeader } from '../components/domain/GradientHeader'
import { LanguageToggle } from '../components/domain/LanguageToggle'
import { PrimaryButton } from '../components/domain/PrimaryButton'
import { TextInput } from '../components/domain/TextInput'
import type { TranslationKey } from '../i18n/dictionary'
import { useTranslation } from '../i18n/useTranslation'
import { useAnnounce } from '../lib/announce'

export const Route = createFileRoute('/login')({ component: LoginScreen })

// Perfiles del seed (apps/api/src/db/seed.ts). El rol "certifier" y
// "investor" de la maqueta corresponden a los roles globales `verifier` y
// `buyer` del backend — ver SPEC-011 §Preguntas abiertas.
//
// La solapa precarga solo el usuario, nunca la contraseña: la del seed depende
// de `SEED_DEMO_PASSWORD` en cada entorno, y un default local escrito acá
// autocompletaba una password que en producción no existe (y la publicaba en
// el bundle).
export const ROLE_PRESETS = [
  { key: 'buyer', tabKey: 'login.tabs.investor', email: 'buyer@example.com' },
  { key: 'developer', tabKey: 'login.tabs.developer', email: 'developer@example.com' },
  { key: 'notary', tabKey: 'login.tabs.notary', email: 'notary@example.com' },
  { key: 'verifier', tabKey: 'login.tabs.certifier', email: 'verifier@example.com' }
] as const satisfies ReadonlyArray<{
  key: string
  tabKey: TranslationKey
  email: string
}>

function errorKeyFor(err: unknown): TranslationKey {
  if (err instanceof ApiError && err.status === 401) return 'login.errors.invalidCredentials'
  if (err instanceof ApiError && err.status === 429) return 'login.errors.rateLimited'
  return 'login.errors.networkError'
}

export function LoginScreen() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const announce = useAnnounce()
  const [preset, setPreset] = useState(0)
  const [email, setEmail] = useState<string>(ROLE_PRESETS[0].email)
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  function selectPreset(i: number, p: (typeof ROLE_PRESETS)[number]) {
    setPreset(i)
    setEmail(p.email)
    setPassword('')
    setErrorKey(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorKey(null)
    try {
      const res = await api.login(email, password)
      setSession({ token: res.token, user: res.user })
      // Invariante 2: el ruteo usa el rol que devolvió la API, nunca la
      // solapa que el usuario tocó antes de enviar el formulario.
      const landing = ROLE_LANDING[res.user.role]
      void navigate({ to: landing })
    } catch (err) {
      const key = errorKeyFor(err)
      setErrorKey(key)
      // assertive: invalida la acción en curso, se anuncia el mismo texto que
      // ya se ve en pantalla (invariante 2, no una segunda redacción).
      announce(t(key), 'assertive')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md" style={{ backgroundColor: '#F4F1ED' }}>
      <GradientHeader
        title={t('app.name')}
        subtitle={t('login.subtitle')}
        right={<LanguageToggle />}
      />

      <form className="px-4 py-6" onSubmit={submit}>
        <p className="mb-4 text-center text-sm" style={{ color: '#6B7280' }}>
          {t('login.demoHint')}
        </p>

        <div className="mb-5 grid grid-cols-2 gap-2" role="tablist">
          {ROLE_PRESETS.map((p, i) => (
            <button
              type="button"
              key={p.key}
              role="tab"
              aria-selected={i === preset}
              onClick={() => selectPreset(i, p)}
              className="rounded-xl border px-3 py-2 text-sm font-medium"
              style={
                i === preset
                  ? { borderColor: '#6D4AFF', backgroundColor: '#EEEAFF', color: '#5538DD' }
                  : { borderColor: '#E5E7EB', color: '#374151' }
              }
            >
              {t(p.tabKey)}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-lg bg-white p-4">
          <TextInput
            label={t('login.usernameLabel')}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
          />
          <TextInput
            label={t('login.passwordLabel')}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        {errorKey ? (
          <p className="mb-4 text-sm" style={{ color: '#EF4444' }}>
            {t(errorKey)}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={busy} loading={busy}>
          {busy ? t('login.submitting') : t('login.submit')}
        </PrimaryButton>
      </form>
    </div>
  )
}
