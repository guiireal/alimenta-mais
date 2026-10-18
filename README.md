# Alimenta+

Projeto de extensão em Governança de TI de Ciência da Computação da UNINOVE. O Alimenta+ apoia bancos de alimentos e ONGs na gestão de doações, estoque e entregas.

## Executar localmente

O PostgreSQL deve estar disponível, com o banco criado. O arquivo local `backend/.env` é ignorado pelo Git.

No terminal do backend:

```powershell
cd backend
# Em uma instalação nova: copie .env.example para .env e configure DATABASE_URL e JWT_SECRET.
go mod download
go run ./cmd/migrate up
go run .
```

No terminal do frontend:

```powershell
cd frontend
npm install
npm run dev
```

Abra **http://localhost:5173**. O proxy do Vite encaminha `/api` ao Go na porta 8080. Use localhost de forma consistente: a origem configurada no backend deve coincidir com a URL do navegador.

Entre com uma conta existente. Não há contas ou senhas de demonstração no código. O administrador inicial pode ser criado por `go run ./cmd/admin`, seguindo [backend/README.md](backend/README.md). Contas criadas em `/cadastro` começam como Operador; o Administrador altera os acessos.

## Integração

Todas as telas usam a API e o PostgreSQL. Configure categorias, produtos e depósitos em **Cadastros** antes de registrar lotes ou doações. A triagem gera saldo apenas dos lotes aprovados; a confirmação disponibiliza a doação. Cadastre as famílias e registre o consentimento recebido antes de criar suas entregas.

O login usa JWT de 15 minutos e refresh rotativo, com limite absoluto de 30 dias. Credenciais ficam em cookies HttpOnly; o cliente HTTP inclui CSRF nas escritas, renova a sessão após expiração e repete a chamada uma única vez. Logout revoga a sessão no servidor. Não há persistência de tokens, senhas ou dados demonstrativos no localStorage.

Perfis: Administrador, Gestor e Operador. O backend confere as permissões em todas as operações. Rotas exibem endereços e paradas reais; não há serviço externo de mapas ou veículos fictícios.

Em produção, sirva frontend e `/api/v1` no **mesmo host HTTPS**, configure `ALLOWED_ORIGIN` exatamente e `COOKIE_SECURE=true`. `JWT_SECRET` deve ser aleatória, exclusiva do ambiente e ter ao menos 32 bytes. Nunca use a chave local em produção. Sem Web Locks, navegadores antigos podem encerrar a sessão se duas abas renovarem simultaneamente.

## Arquitetura e verificações

Frontend: React, TypeScript, Vite, Tailwind e TanStack Query; services HTTP, hooks de consultas, contexto de autenticação e componentes compartilhados.

Backend: Go com `net/http`, PostgreSQL, SQL explícito e Clean Architecture: domínio → casos de uso → adapters. Transações preservam estoque e auditoria; alocação FEFO e regras operacionais ficam no servidor.

```powershell
# frontend
npm test
npm run build

# backend
go test ./...
go vet ./...
# Defina TEST_DATABASE_URL para incluir integração em schemas isolados.
go test -race -p 1 ./... -count=1
```

Detalhes em [backend/README.md](backend/README.md), [contrato da API](docs/api.md), [frontend/src/README.md](frontend/src/README.md) e [modelo do banco](docs/database.dbml).
