import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ui'

/** Evita a tela em branco: qualquer erro de renderização vira uma mensagem com nova tentativa. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <ErrorState title="Algo deu errado nesta tela" message={this.state.error.message} onRetry={() => this.setState({ error: null })} />
        </div>
      )
    }
    return this.props.children
  }
}
