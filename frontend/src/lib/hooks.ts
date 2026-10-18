import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Errors } from './validators'
import { hasErrors } from './validators'

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    window.document.title = title ? `${title} | Alimenta+` : 'Alimenta+'
  }, [title])
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FormValues = Record<string, string | boolean | string[]>

/** Formulário controlado, com validação no envio e foco no primeiro campo inválido. */
export function useForm<T extends FormValues>(initial: T, validate: (values: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors<T>>({})

  const setValue = <K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  /** Props de um campo de texto, select ou textarea. */
  const bind = (name: keyof T & string) => ({
    name,
    value: values[name] as string,
    onChange: (e: ChangeEvent<Control>) => setValue(name, e.target.value as T[typeof name]),
  })

  const submit = (onValid: (values: T) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const found = validate(values)
    setErrors(found)
    if (hasErrors(found)) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    onValid(values)
  }

  const reset = () => {
    setValues(initial)
    setErrors({})
  }

  return { values, errors, setValue, bind, submit, reset }
}
