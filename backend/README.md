# Backend Alimenta+

Go, `net/http`, PostgreSQL 16+, `database/sql` com pgx, migrations Goose e bcrypt. O HTTP usa o roteador nativo do Go. Não há ORM nem framework HTTP.

## Executar localmente

Execute dentro de `backend`. O banco `alimenta_mais` deve existir.

```powershell
# Somente se ainda não houver .env:
Copy-Item .env.example .env
# Preencha DATABASE_URL e JWT_SECRET (chave aleatória com pelo menos 32 bytes).
go mod download
go run ./cmd/migrate up
go run .
```

O `.env` local já configurado é ignorado pelo Git. Variáveis de ambiente têm prioridade sobre o arquivo.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Obrigatória. Conexão PostgreSQL; use `sslmode=disable` somente na conexão local. |
| `JWT_SECRET` | Obrigatória. Chave aleatória com ao menos 32 bytes, exclusiva deste ambiente. |
| `COOKIE_SECURE` | Padrão `true`. `false` permitido somente para origem localhost/loopback em desenvolvimento. |
| `HTTP_ADDR` | Endereço HTTP, padrão `:8080`. |
| `ALLOWED_ORIGIN` | Origem exata permitida no navegador, padrão `http://localhost:5173`. |

O servidor verifica a conexão com timeout de 5 segundos. Usa pool limitado, timeouts HTTP, cancelamento por contexto, logs JSON com request ID e encerramento gracioso ao receber Ctrl+C. Datas operacionais usam UTC; os timestamps do modelo original continuam sem timezone e recebem valores UTC. Campos de calendário usam `YYYY-MM-DD`.

## Administrador inicial

Não existem contas ou senhas padrão. Configure suas credenciais no `backend/.env`:

```dotenv
DEFAULT_ADMIN_NAME="Seu nome"
DEFAULT_ADMIN_EMAIL=seu-email@example.com
DEFAULT_ADMIN_PASSWORD="SubstituaPorUmaSenha123"
```

Execute dentro de `backend`, após aplicar as migrations:

```powershell
go run ./cmd/admin
```

As variáveis também podem ser fornecidas pelo ambiente, com prioridade sobre o `.env`. Após a criação, remova `DEFAULT_ADMIN_PASSWORD` do arquivo. Alterar essas variáveis não modifica uma conta já criada; o servidor não executa esse comando automaticamente.

O comando cria somente o primeiro administrador ativo, com auditoria e bloqueio transacional. Ele não promove nem sobrescreve uma conta existente. O autocadastro HTTP sempre cria `operator`.

## Organização e dependências

```text
main.go                        composição das dependências e ciclo de vida HTTP
cmd/admin/                     criação inicial do administrador
cmd/migrate/                   execução explícita de migrations
internal/domain/               entidades, enums, decimais exatos e permissões
internal/usecase/              regras da aplicação e interfaces dos repositórios
internal/adapter/postgres/     SQL, transações, conversão de erros e consultas
internal/adapter/httpapi/      rotas, JSON, autenticação HTTP, CORS e limites
internal/adapter/security/     bcrypt e assinatura/validação de JWT
internal/database/             configuração e conexão PostgreSQL
internal/testutil/             banco isolado usado pelos testes de integração
migrations/                    migrations SQL embutidas no executável
```

O domínio usa somente a biblioteca padrão. Casos de uso dependem do domínio e de interfaces locais; não importam SQL, HTTP, pgx ou bcrypt. Os adapters implementam essas interfaces. `main.go` conecta as implementações aos casos de uso e ao HTTP.

Cada alteração de negócio e sua auditoria são gravadas na mesma transação. O `UnitOfWork` entrega repositórios vinculados à transação, evitando operações acidentalmente fora dela. As interfaces são organizadas por módulo. As consultas SQL são explícitas e parametrizadas; os pequenos helpers de paginação e leitura não descobrem tabelas ou campos por reflexão.

## Regras principais

- Estoque é derivado das movimentações, por lote e depósito. A API não edita ou apaga movimentos; correções usam ajustes com motivo.
- Quantidades, pesos e coordenadas são strings decimais na API. Não há cálculos de estoque com `float64`: quantidades usam inteiros em milésimos e relatórios usam `numeric` no PostgreSQL.
- Lotes aprovados exigem validade vigente. Produtos em `un` exigem quantidades inteiras; produtos em `kg` usam peso unitário de 1 kg. Categorias perecíveis exigem depósito refrigerado.
- Lotes pendentes ou rejeitados não geram entrada. A aprovação gera uma única entrada. Doações só são disponibilizadas após toda a triagem e com pelo menos um lote aprovado.
- Operações de estoque bloqueiam o produto e o lote antes de consultar saldo. Baixas e despachos concorrentes não podem consumir o mesmo saldo. Conflitos/deadlocks retornam `409`, sem gravações parciais.
- A alocação FEFO usa apenas lotes aprovados, vigentes e com saldo no depósito de origem, ordenados por validade e ID. O planejamento não reserva saldo: o despacho recalcula os lotes, podendo bloquear por insuficiência.
- Despacho e baixa de estoque são atômicos. Um segundo despacho é bloqueado. Devoluções exigem item da própria entrega e não podem exceder a quantidade distribuída.
- Entregas para famílias exigem cadastro ativo e consentimento vigente tanto no planejamento quanto no despacho. O destinatário é uma família ou uma organização, nunca ambos.
- Cadastros com histórico são inativados; não há exclusão física via API. Não é possível mudar unidade/categoria de um produto que já tem lotes, nem retirar refrigeração de um depósito com saldo.
- Mudanças de acesso e de senha revogam as sessões do usuário. Não é permitido alterar o próprio acesso ou remover o último administrador ativo. Senhas e hashes não aparecem em respostas ou na auditoria.

O access token é um JWT HS256 de 15 minutos, com emissor, audiência, expiração, tipo e sessão validados. O refresh token é aleatório, rotativo e tem limite absoluto de 30 dias; apenas seu SHA-256 fica no banco. Reutilizar um refresh já consumido revoga toda a sessão. Logout, senha e mudança de acesso revogam a sessão no servidor imediatamente; cada requisição confere a sessão e o usuário atual.

Os tokens são enviados somente por cookies HttpOnly, SameSite=Lax, host-only, com caminhos limitados à API. O cookie CSRF é separado, legível pelo front e validado por hash no servidor em toda escrita autenticada por cookie e no refresh. Em HTTPS os cookies usam Secure. O modo local permite HTTP com COOKIE_SECURE=false; não use esse modo em produção. Login, autocadastro e refresh compartilham limite de 10 requisições por minuto por IP. Esse limite é local ao processo; múltiplas instâncias exigem um limite compartilhado no gateway. O IP vem da conexão direta; cabeçalhos de proxy não são confiados automaticamente.

POSTs de cadastro e de movimentação representam novas operações; o cliente não deve repeti-los automaticamente após uma resposta de rede ambígua. Transições repetidas de despacho e retornos acima do limite são bloqueados pelas regras do domínio.

## Migrations

```powershell
go run ./cmd/migrate status
go run ./cmd/migrate up
go run ./cmd/migrate down
```

`up` aplica apenas versões pendentes, dentro de transações. O servidor não executa migrations automaticamente. `down` reverte a última versão; o rollback da migration inicial apaga as tabelas e seus dados.

A versão 1 preserva o DBML original. A versão 2 acrescenta sessões, flags de refrigeração/perecibilidade e origem das entregas. Também cria a view `stock_balances`, unicidade de e-mail sem distinção de caixa e um índice parcial que impede duas entradas iniciais do mesmo lote. Esses dois índices e a view são específicos do SQL; os campos/tabelas novos também estão no DBML. Entregas antigas sem rota mantêm origem nula até serem editadas, pois não é possível deduzi-la com segurança.

A versão 3 troca os tokens opacos de acesso por sessões JWT, adiciona o hash CSRF e o histórico de refresh tokens. Aplicar ou reverter essa versão encerra as sessões existentes, preservando usuários e dados de negócio.

## Verificar

```powershell
go test ./...
go vet ./...

# URL de um PostgreSQL local com permissão para criar schemas:
$env:TEST_DATABASE_URL = 'postgres://USER:PASSWORD@localhost:5432/alimenta_mais?sslmode=disable'
go test ./... -count=1
go test -race -p 1 ./... -count=1
```

Sem `TEST_DATABASE_URL`, os testes de integração são pulados explicitamente. Com ela, são criados schemas exclusivos para os testes e removidos ao terminar. Os testes não inserem dados nas tabelas da aplicação em `public`.

Há testes de migração/rollback, autenticação, permissões, JSON, CORS, limite de requisições, sigilo de credenciais, triagem, refrigeração, consentimento, FEFO, devoluções, indicadores, rollback de operações e baixas simultâneas. O teste de corrida exige suporte de C/C++ para o Go na máquina.

O [contrato da API](../docs/api.md) detalha rotas, formatos e os três perfis. O front-end já consome esse contrato por um cliente HTTP com cookies e renovação automática. No desenvolvimento, inicie o Vite em http://localhost:5173 e o Go na porta 8080. Em produção, publique o front e o caminho /api sob o mesmo host HTTPS; o cookie CSRF precisa estar disponível no host do front.
