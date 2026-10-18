import { EmptyState, LinkButton } from '../components/ui'

export default function Forbidden() {
  return <EmptyState title="Você não tem acesso a esta tela" description="O seu perfil não inclui esta função. Peça ao gestor para ajustar o acesso, se precisar dela." action={<LinkButton to="/" variant="secondary">Voltar ao dashboard</LinkButton>} />
}
