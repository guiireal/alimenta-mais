# Frontend Alimenta+

React 18, TypeScript, Vite, Tailwind, React Router e TanStack Query.

## Desenvolvimento

Execute o Go na porta 8080 e `npm run dev` em frontend. Abra http://localhost:5173. O proxy do Vite atende `/api`; não é necessário configurar uma URL externa.

```text
pages/       telas e formulários
components/  UI, layout, guards e campos de lote compartilhados
hooks/       consultas, mutations e invalidação de cache
services/    HTTP, conversão de contratos e operações da API
context/     sessão e avisos
lib/         validadores, permissões, datas e CSV
```

Não há mocks em execução. O login consulta o servidor e restaura a sessão via `/auth/me`. O cliente HTTP envia cookies, usa apenas o cookie CSRF legível, coordena o refresh com uma promise e Web Locks entre abas e repete a requisição uma única vez após 401. Login/logout são sincronizados entre abas via BroadcastChannel, sem transmitir credenciais. Falhas de rede não são tratadas como logout.

Tokens e credenciais não ficam em localStorage. Os cookies de acesso e refresh são HttpOnly. As permissões da UI seguem administrator/manager/operator; a API repete todas as verificações.

Quantidade e peso permanecem strings ao enviar formulários; números são convertidos apenas na apresentação de leituras. Categorias/produtos/depósitos vêm da API. O estoque tem paginação e ordenação no servidor; o CSV percorre todas as páginas do filtro. Doações permitem triagem e confirmação; rotas permitem incluir entregas com produtos, iniciar e confirmar a distribuição.

A auditoria mostra os 100 eventos mais recentes. As demais listas simples percorrem páginas da API; se crescerem muito, substitua a listagem completa por paginação visível. O estoque já usa paginação visível.

## Verificação e publicação

`npm test` valida o cliente HTTP, login, renovação, tratamento de falhas, precisão dos envios, exportação e validadores. `npm run build` verifica os tipos e gera os arquivos estáticos.

Na publicação, configure um proxy HTTPS para `/api` no mesmo host do frontend. O backend deve ter COOKIE_SECURE=true, ALLOWED_ORIGIN exata e JWT_SECRET própria. Navegadores antigos sem Web Locks podem disputar a rotação entre abas e exigir novo login.

Consulte [o contrato](../../docs/api.md) e [a configuração do backend](../../backend/README.md).
