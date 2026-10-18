import { EmptyState, LinkButton } from '../components/ui'

export default function NotFound() {
  return <EmptyState title="Página não encontrada" description="O endereço não existe ou foi movido." action={<LinkButton to="/" variant="secondary">Voltar ao dashboard</LinkButton>} />
}
