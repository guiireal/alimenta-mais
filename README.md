# Alimenta+

Projeto de extensão em Governança de TI do curso de Ciência da Computação da Universidade Nove de Julho (UNINOVE). O Alimenta+ apoia bancos de alimentos e ONGs na gestão de doações, estoque e distribuição para famílias em situação de vulnerabilidade social.

O projeto considera boas práticas de COBIT, PMBOK e ITIL, além de segurança da informação, privacidade e qualidade de software. Período do projeto acadêmico: 11/08/2026 a 23/11/2026.

## Status

O MVP está em desenvolvimento e já conta com um front-end funcional com dados demonstrativos, sem backend conectado. Os documentos de planejamento, wireframe e banco de dados permanecem em [`docs/`](docs/).

## Front-end

React 18, TypeScript, Vite, Tailwind CSS v4, React Router e TanStack Query.

```bash
npm install
npm run dev        # desenvolvimento
npm run test       # testes (Vitest)
npm run build      # checagem de tipos + build
```

Entre com um dos perfis de demonstração na tela de login (senha `alimenta123`). Cada perfil enxerga e altera telas diferentes.

Também dá para criar uma conta em `/cadastro`. Contas novas começam como Voluntário (o menor acesso); o gestor amplia o perfil em Acessos e auditoria. Sem backend, as contas ficam salvas só no navegador (localStorage) e a senha é guardada como hash. Com backend real, isso passa a ser do servidor.

## Arquitetura

```
src/
  pages/        uma tela por arquivo (lazy), sem acesso direto a dados
  components/   UI compartilhada, layout, guards de rota, diálogo, paginação, busca
  hooks/        queries.ts: todas as leituras e escritas (TanStack Query)
  services/     camada de dados. Hoje responde com um banco em memória (db.ts);
                depois cada função troca `simulate(...)` por uma chamada em http.ts
  context/      AuthContext (sessão e permissões) e ToastContext (avisos)
  lib/          regras puras: validadores, permissões, formatadores, FEFO, CSV, hooks
  data/mock.ts  dados iniciais
```

## Responsabilidades do front-end cobertas

- **Roteamento e navegação:** rotas aninhadas, 404, tela de acesso negado, botões que levam a telas de formulário e detalhe, foco e rolagem ao trocar de tela.
- **Sessão e permissões:** login, cadastro de conta, rota protegida, perfis (gestor, logística, voluntário, auditor) que mudam o menu, os botões e as rotas.
- **Busca:** barra global com Enter para `/busca?q=...`, resultados agrupados e filtrados pelo perfil; filtros, ordenação e página do estoque ficam na URL.
- **Dados:** cache, recarga após cada alteração, estados de carregamento, erro com nova tentativa e vazio.
- **Formulários:** validação por campo, foco no primeiro erro, regras de negócio (perecível na câmara fria, validade obrigatória para item aprovado, consentimento LGPD).
- **Notificações:** painel do sino com lotes vencidos ou críticos e famílias sem consentimento, sem sair da tela atual.
- **Feedback:** avisos (toast), confirmação em ações destrutivas, erros de servidor dentro do formulário.
- **Acessibilidade e responsividade:** menu em gaveta no celular, tabelas com rolagem contida, rótulos e `aria-*`, link para pular ao conteúdo, respeito a `prefers-reduced-motion`.
- **Resiliência:** ErrorBoundary por tela e tratamento de falha do `localStorage`.

## Ligando o backend

1. Defina `VITE_API_URL` (veja `.env.example`).
2. Em cada arquivo de `src/services`, troque `simulate(() => ...)` por `http.get/post/patch(...)`. Os tipos de entrada e saída já estão em `src/types.ts`.
3. Mantenha as validações no servidor: as do front só guiam o usuário, e a matriz de permissões do front não protege dados.
