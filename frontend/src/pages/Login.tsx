import { useState } from 'react'
import { HandHeart } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, controlClass, Field, FormError } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { DEMO_PASSWORD, users } from '../data/mock'
import { useDocumentTitle, useForm } from '../lib/hooks'
import { ROLE_LABEL } from '../lib/permissions'
import { validateLogin, type LoginValues } from '../lib/validators'

export default function Login() {
  useDocumentTitle('Entrar')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [serverError, setServerError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const form = useForm<LoginValues>({ email: '', password: '' }, validateLogin)

  if (user) return <Navigate to={from} replace />

  const onSubmit = form.submit(async (values) => {
    setPending(true)
    setServerError(null)
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(error)
    } finally {
      setPending(false)
    }
  })

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-carrot-500 text-ink-900"><HandHeart size={24} aria-hidden="true" /></span>
          <div>
            <h1 className="text-2xl font-extrabold text-leaf-900">Alimenta+</h1>
            <p className="text-sm text-ink-600">Entre para gerenciar doações, estoque e entregas.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border border-cream-200 bg-white p-5">
          <FormError error={serverError} />
          <Field label="E-mail" error={form.errors.email}>
            {(a11y) => <input {...a11y} {...form.bind('email')} type="email" autoComplete="username" className={controlClass} />}
          </Field>
          <Field label="Senha" error={form.errors.password}>
            {(a11y) => <input {...a11y} {...form.bind('password')} type="password" autoComplete="current-password" className={controlClass} />}
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</Button>
        </form>

        <p className="text-center text-sm">Não tem conta? <Link to="/cadastro" className="font-bold text-leaf-700 hover:underline">Criar conta</Link></p>

        <section className="rounded-xl border border-dashed border-cream-300 p-4 text-sm">
          <h2 className="font-bold">Perfis de demonstração</h2>
          <p className="mt-1 text-ink-600">Cada perfil enxerga e altera telas diferentes. Clique para preencher o formulário (senha: {DEMO_PASSWORD}).</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {users.filter((u) => u.active).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => { form.setValue('email', u.email); form.setValue('password', DEMO_PASSWORD) }}
                  className="w-full rounded-lg border border-cream-200 px-3 py-2 text-left hover:bg-cream-100"
                >
                  <span className="block font-bold">{u.name}</span>
                  <span className="text-xs text-ink-600">{ROLE_LABEL[u.role]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
