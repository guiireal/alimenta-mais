import { useState } from 'react'
import { HandHeart } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Button, controlClass, Field, FormError } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle, useForm } from '../lib/hooks'
import { validateRegister, type RegisterValues } from '../lib/validators'

export default function Register() {
  useDocumentTitle('Criar conta')
  const { user, register } = useAuth()
  const [serverError, setServerError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<RegisterValues>({ name: '', email: '', password: '', confirm: '', accept: false }, validateRegister)

  // depois do cadastro o usuário já fica logado e este redirecionamento leva ao início
  if (user) return <Navigate to="/" replace />

  const onSubmit = form.submit(async (values) => {
    setPending(true)
    setServerError(null)
    try {
      await register({ name: values.name, email: values.email, password: values.password })
    } catch (error) {
      setServerError(error)
    } finally {
      setPending(false)
    }
  })

  const passwordType = showPassword ? 'text' : 'password'

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md space-y-5">
        <Link to="/login" className="flex items-center gap-3" aria-label="Alimenta+, voltar para o login">
          <span className="grid size-11 place-items-center rounded-full bg-carrot-500 text-ink-900"><HandHeart size={24} aria-hidden="true" /></span>
          <span>
            <span className="block text-2xl font-extrabold text-leaf-900">Alimenta+</span>
            <span className="text-sm text-ink-600">Crie a sua conta para ajudar na operação.</span>
          </span>
        </Link>

        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border border-cream-200 bg-white p-5">
          <FormError error={serverError} />
          <Field label="Nome completo" error={form.errors.name}>
            {(a11y) => <input {...a11y} {...form.bind('name')} autoComplete="name" className={controlClass} />}
          </Field>
          <Field label="E-mail" error={form.errors.email}>
            {(a11y) => <input {...a11y} {...form.bind('email')} type="email" autoComplete="email" className={controlClass} />}
          </Field>
          <Field label="Senha" error={form.errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
            {(a11y) => <input {...a11y} {...form.bind('password')} type={passwordType} autoComplete="new-password" className={controlClass} />}
          </Field>
          <Field label="Repetir a senha" error={form.errors.confirm}>
            {(a11y) => <input {...a11y} {...form.bind('confirm')} type={passwordType} autoComplete="new-password" className={controlClass} />}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="size-4 accent-leaf-600" />
            Mostrar senhas
          </label>

          <div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.values.accept}
                onChange={(e) => form.setValue('accept', e.target.checked)}
                aria-invalid={form.errors.accept ? true : undefined}
                aria-describedby={form.errors.accept ? 'aceite-erro' : undefined}
                className="mt-0.5 size-4 accent-leaf-600"
              />
              <span>Concordo com o uso dos meus dados para acesso ao sistema, conforme a LGPD.</span>
            </label>
            {form.errors.accept && <p id="aceite-erro" className="mt-1 text-sm font-semibold text-tomato-600">{form.errors.accept}</p>}
          </div>

          <p className="rounded-lg bg-cream-100 px-3 py-2 text-sm text-ink-600">Contas novas começam como Voluntário. O gestor pode ampliar o seu acesso depois.</p>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Criando conta…' : 'Criar conta'}</Button>
        </form>

        <p className="text-center text-sm">Já tem conta? <Link to="/login" className="font-bold text-leaf-700 hover:underline">Entrar</Link></p>
      </div>
    </div>
  )
}
