# API Alimenta+

Base: `http://localhost:8080/api`. HTTP nativo do Go. Respostas e corpos JSON usam `snake_case`; IDs são inteiros. Quantidades, pesos, coordenadas e indicadores decimais são strings, por exemplo `"12.500"`. Campos opcionais podem ser `null`.

Datas de calendário usam `YYYY-MM-DD`; instantes usam RFC3339 com timezone e são normalizados para UTC. As respostas de entidades seguem os campos de [`database.dbml`](database.dbml), com a senha/hash sempre omitida.

## Autenticação e acesso

| Método | Caminho | Corpo / resultado |
| --- | --- | --- |
| POST | `/auth/register` | `{name,email,password}` → usuário `operator`, sem sessão automática |
| POST | `/auth/login` | `{email,password}` → `{user,expires_at} + cookies` |
| POST | `/auth/refresh` | Cookie de refresh + `X-CSRF-Token` → novo JWT e refresh rotativo; `{user,expires_at}` |
| GET | `/auth/me` | Usuário autenticado |
| POST | `/auth/logout` | Revoga a sessão; `204` |
| PUT | `/auth/password` | `{current_password,password}`; revoga todas as sessões do usuário; `204` |
| GET | `/users` | Página de usuários, sem hashes |
| GET | `/users/{id}` | Usuário, sem hash |
| PUT | `/users/{id}/access` | `{role,is_active}`; somente administrador |
| GET | `/audit` | Página de eventos de auditoria |

Login, autocadastro e refresh são públicos, com limite conjunto de 10 requisições por minuto por IP. As demais rotas exigem o cookie de acesso. Senhas precisam ter no mínimo 8 caracteres, no máximo 72 bytes, com letras e números. Não há recuperação de senha por e-mail neste contrato.

O login/refresh envia `alimenta_access` (JWT de 15 minutos, HttpOnly, Path=/api), `alimenta_refresh` (aleatório, rotativo, HttpOnly, Path=/api/auth) e `alimenta_csrf` (legível pelo front, Path=/). Todos são host-only e SameSite=Lax, com Secure em HTTPS. Não há tokens no JSON ou localStorage. A sessão tem limite absoluto de 30 dias; renovar não estende esse limite.

Use `credentials: 'include'`. Em POST/PUT autenticados por cookie e no refresh, envie o valor de `alimenta_csrf` no header `X-CSRF-Token`. Ausência/valor inválido retorna 403. Reuso de refresh consumido revoga a sessão e retorna 401. Logout apaga os três cookies e revoga a sessão. Senha ou acesso alterado revoga todas as sessões daquele usuário.

Clientes nativos podem usar um cookie jar ou o JWT recebido no Set-Cookie como `Authorization: Bearer JWT`; requisições Bearer não precisam de CSRF. O refresh continua usando seu cookie e o header CSRF. O navegador nunca lê o access/refresh token.

O cliente do front renova após 401 e repete a requisição uma única vez. A renovação é compartilhada no contexto e, com Web Locks, entre abas. Falhas de rede/5xx não repetem escritas nem apagam uma sessão válida. Sem Web Locks, duas abas antigas podem disputar a rotação e encerrar a sessão; use navegadores atuais.

Na troca de senha, senha atual incorreta retorna 422 em `fields.current_password`, preservando a sessão. Assim, esse erro de formulário não é confundido com um token expirado.

O desenvolvimento usa proxy do Vite. A publicação deve manter front e API no mesmo host HTTPS (o cookie CSRF precisa ser legível nesse host), definir ALLOWED_ORIGIN exatamente e COOKIE_SECURE=true.

| Perfil | Permissões |
| --- | --- |
| `administrator` | Todas as operações, inclusive alterações de acesso |
| `manager` | Cadastros, estoque, doações, famílias, entregas, relatórios e consulta de usuários/auditoria; sem alterações de acesso |
| `operator` | Consulta de catálogo, estoque e doações; registro de doações, triagem e confirmação |

Autocadastro não aceita `role`, `is_active` ou campos internos. As permissões são verificadas pelos casos de uso, inclusive nas consultas e na busca. O front usa os mesmos três perfis.

## Consultas para as telas

| Caminho GET | Resultado |
| --- | --- |
| `/inventory` | Página de lotes com saldo, produto/categoria/unidade e saldos por depósito |
| `/inventory/{id}` | Lote e saldos, inclusive quando zerado |
| `/overview/donors` | Doadores com total em kg, número e data da última doação; filtro donor_id |
| `/overview/donations` | Doações com doador e peso; filtros donor_id e status |
| `/overview/families` | Famílias com última entrega; status=granted/pending filtra consentimento |
| `/overview/routes` | Rotas com responsável, origem e entregas ordenadas; filtro route_id |

Essas consultas mantêm as permissões dos módulos e usam paginação normal. Inventário aceita `q`, `category_id`, `product_id`, `warehouse_id`, `status` (expired, critical, warning, ok, none, alert), `sort` (expiresAt, item, quantity, id) e `dir` (asc/desc). Crítico: hoje até 2 dias; atenção: 3 a 7 dias. `alert` inclui vencidos e críticos. Valores decimais permanecem strings. As consultas combinam as informações no PostgreSQL, sem uma chamada HTTP por linha da tabela.

## Cadastros

Para cada recurso abaixo existem `GET /recurso`, `GET /recurso/{id}`, `POST /recurso` e `PUT /recurso/{id}`. PUT substitui os campos editáveis; não é um patch parcial. `is_active` é opcional e assume `true` quando omitido. Os demais campos obrigatórios são indicados abaixo.

| Recurso | Campos obrigatórios | Campos opcionais |
| --- | --- | --- |
| `categories` | `name` | `is_perishable` (padrão false) |
| `products` | `category_id`, `name`, `unit` (`un` ou `kg`) | `is_active` |
| `warehouses` | `name` | `address`, `latitude`, `longitude`, `is_cold_storage` (false), `is_active` |
| `donors` | `type` (`individual`/`company`), `name` | `tax_id`, `contact_name`, `email`, `phone`, `address`, `is_active` |
| `families` | `reference_code`, `contact_name`, `household_size` (1–20), `address`, `neighborhood`, `city`, `state` | `phone`, `postal_code`, `latitude`, `longitude`, `is_active` |
| `partners` | `name`, `address` | `tax_id`, `contact_name`, `phone`, `latitude`, `longitude`, `is_active` |

Latitude e longitude devem ser informadas juntas; os intervalos são −90..90 e −180..180. Documento fiscal tem 11 ou 14 dígitos, CEP tem 8 dígitos e UF tem duas letras. Nomes e textos respeitam os limites do DBML; textos livres são limitados a 10.000 caracteres pela API. O formato do documento é validado; esta API não consulta cadastros externos.

O consentimento da família tem endpoint próprio e não pode ser informado por timestamps arbitrários no cadastro:

```http
PUT /api/families/1/consent
Content-Type: application/json
Authorization: Bearer TOKEN

{"granted":true,"privacy_notice_version":"v1"}
```

Para revogar: `{"granted":false}`. O servidor registra os instantes e o usuário na auditoria. Consentimento revogado bloqueia novas alocações e despachos para a família.

## Doações e lotes

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET | `/donations` | Página de doações |
| GET | `/donations/{id}` | `{donation,batches}` |
| POST | `/donations` | Registra doação, lotes e entradas dos aprovados, atomicamente |
| POST | `/donations/{id}/confirm` | Confirma após triagem; não repete entradas de estoque |
| GET | `/batches` | Página de lotes, ordenados por validade e ID |
| GET | `/batches/{id}` | `{batch,balances,movements}`; últimos 100 movimentos |
| POST | `/batches` | Entrada manual de lote aprovado, sem doação vinculada |
| POST | `/batches/{id}/triage` | Aprova/rejeita um lote pendente, uma única vez |
| GET | `/batches/{id}/movements` | Histórico paginado do lote |
| POST | `/batches/{id}/movements` | Transferência, perda ou ajuste; não aceita distribuição/entrada inicial/devolução |
| GET | `/stock/movements` | Histórico paginado de todas as movimentações |
| GET | `/stock/stats` | Lotes vencidos, críticos, com vencimento em 7 dias e percentual com validade |

Exemplo de doação:

```json
{
  "donor_id": 1,
  "received_at": "2026-10-17T12:00:00Z",
  "document_reference": "REC-001",
  "document_path": null,
  "notes": null,
  "items": [
    {
      "product_id": 1,
      "batch_code": "LOTE-001",
      "quantity": "10.000",
      "unit_weight_kg": "1.000000",
      "expires_on": "2026-11-01",
      "triage_status": "approved",
      "triage_notes": null,
      "warehouse_id": 1
    }
  ]
}
```

`received_at` não pode ser futuro. Uma doação aceita de 1 a 100 itens. Triagem omitida assume `pending`; os demais valores são `approved` e `rejected`. Lotes pendentes/rejeitados ficam no registro, sem saldo. A doação começa `in_triage` ou `stored`, e a confirmação muda para `available`.

POST `/batches` usa o formato de um item do exemplo e sempre exige as condições de um lote aprovado. Na aprovação posterior, envie `{"status":"approved","warehouse_id":1,"expires_on":"2026-11-01","notes":null}`. O campo `expires_on` pode ser omitido se o lote já tiver validade vigente. Rejeição usa `"status":"rejected"`. Um lote já triado não pode ser reclassificado pela API.

Transferência parcial:

```json
{"type":"transfer","quantity":"2.500","from_warehouse_id":1,"to_warehouse_id":2,"reason":null}
```

Perda ou ajuste de saída:

```json
{"type":"other_loss","quantity":"1.000","from_warehouse_id":1,"to_warehouse_id":null,"reason":"Avaria"}
```

Tipos permitidos neste endpoint: `transfer`, `expiration_loss`, `other_loss`, `adjustment_in`, `adjustment_out`. Ajuste de entrada usa somente `to_warehouse_id`; saídas usam somente `from_warehouse_id`; transferência exige ambos, diferentes. Motivo é obrigatório para perdas e ajustes. `expiration_loss` exige lote vencido. Ajustes de entrada exigem lote vigente e produto ativo. Quantidades têm até 3 casas e pesos até 6; produtos em `un` exigem quantidade inteira. Produto em `kg` exige `unit_weight_kg` igual a `1`.

## Rotas e entregas

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET/POST | `/routes` | Lista/cria rota |
| GET/PUT | `/routes/{id}` | `{route,deliveries}` na leitura; PUT edita rota aguardando |
| PUT | `/routes/{id}/status` | `{status}`: `in_transit`, `completed` ou `cancelled` |
| GET/POST | `/deliveries` | Lista/planeja entrega |
| GET/PUT | `/deliveries/{id}` | `{delivery,items}`; edição permitida somente aguardando |
| POST | `/deliveries/{id}/dispatch` | Recalcula FEFO e baixa estoque em uma transação |
| PUT | `/deliveries/{id}/status` | `{status,reason}`: `delivered`, `failed` ou `cancelled` |
| POST | `/deliveries/{id}/returns` | Registra retorno parcial/total ao depósito |

Corpo para criar/editar rota:

```json
{"reference_code":"R-001","origin_warehouse_id":1,"scheduled_on":"2026-10-17","assigned_to":1}
```

Uma rota com entregas não pode mudar de depósito. Para iniciar, precisa de responsável ativo, pelo menos uma entrega e data não futura. A conclusão exige todas as entregas encerradas. Cancelamento só é permitido enquanto aguarda e cancela as entregas que ainda aguardam.

Corpo para criar/editar entrega:

```json
{
  "family_id": 1,
  "partner_organization_id": null,
  "route_id": 1,
  "stop_sequence": 1,
  "source_warehouse_id": 1,
  "destination_address": "Endereço da entrega",
  "destination_latitude": null,
  "destination_longitude": null,
  "scheduled_at": "2026-10-17T15:00:00Z",
  "description": "Cesta de alimentos",
  "notes": null,
  "items": [{"product_id":1,"quantity":"3.000"}]
}
```

Escolha família ou organização. `route_id` e `stop_sequence` são opcionais, mas devem aparecer juntos. A origem precisa coincidir com a rota. Produtos não podem se repetir no pedido; são permitidos de 1 a 100. O servidor escolhe os lotes por FEFO e retorna seus IDs em `items`.

O planejamento não reserva estoque. No despacho, os lotes são recalculados e os itens podem mudar. A operação falha sem alterações se o saldo disponível já tiver sido consumido. Se houver rota, ela deve estar `in_transit`. Concluir/falhar exige entrega despachada; cancelar exige entrega aguardando. Falha/cancelamento exigem motivo. Falhar não devolve alimentos automaticamente: o retorno físico tem registro próprio.

Devolução:

```json
{"delivery_item_id":1,"warehouse_id":1,"quantity":"1.000","reason":"Retorno de item não entregue"}
```

O item deve pertencer à entrega despachada. A soma devolvida nunca pode exceder a distribuída. O depósito deve estar ativo e atender à refrigeração exigida. Lotes devolvidos já vencidos continuam inelegíveis para outra distribuição.

## Consultas, filtros e indicadores

Listagens retornam `{items,total,page,page_size}`. Parâmetros: `page` (padrão 1), `page_size` (padrão 20, máximo 100), `q` e `status`. As ordenações são estáveis por ID, data ou validade; não há SQL de ordenação vindo do cliente.

Filtros específicos:

- `/products`: `category_id`; cadastros ativos usam `status=active|inactive`.
- `/batches`: `product_id`, `category_id`, `donation_id`, `warehouse_id` (somente com saldo positivo), `status=pending|approved|rejected|expired|critical|warning|ok|none`.
- Movimentações: `warehouse_id` e `status` como tipo da movimentação.
- `/deliveries`: `route_id` e `status`; `/routes` e `/donations` aceitam os estados do DBML.

`GET /search?q=arroz` devolve até 8 registros por grupo em `{batches,donors,families,donations}`. A busca exige de 2 a 200 caracteres e respeita o perfil no servidor.

`GET /reports?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z` retorna totais, série mensal e perdas por categoria. O período é `[from,to)`, limitado a cinco anos; sem filtro, começa no primeiro dia de cinco meses atrás e termina no instante atual.

- `donated_kg`: quantidade recebida × peso unitário dos lotes de doações recebidas no período, incluindo itens rejeitados; entradas manuais ficam fora.
- `distributed_kg`: distribuições menos devoluções registradas no período, em kg.
- `loss_kg`: perdas por vencimento/outras perdas no período, em kg; ajustes não são contabilizados como perda.
- `turnover`: kg distribuídos líquidos ÷ média dos saldos inicial e final em kg; zero se a média for zero.
- `average_delivery_hours`: média entre despacho e conclusão das entregas concluídas no período.
- `coverage_pct`: famílias ativas e com consentimento vigente que receberam no período ÷ total atual de famílias ativas com consentimento vigente × 100.

Séries e totais do relatório usam um snapshot consistente. `GET /dashboard` acrescenta estatísticas de estoque, até 8 lotes críticos e 8 rotas. Crítico significa vencimento entre hoje e dois dias; alerta de sete dias inclui hoje.

## Status HTTP e limites

Criações e operações com corpo via POST retornam `201`; leituras, PUT, confirmação de doação e despacho retornam `200`; logout/troca de senha retornam `204`. Conflitos retornam `409`; não repita POSTs de movimentação/cadastro automaticamente após falha de rede sem primeiro conferir o resultado.

```json
{"message":"dados inválidos","code":"validation_error","fields":{"quantity":"quantidade inválida"},"request_id":"..."}
```

Erros da aplicação usam `401`, `403`, `404`, `409`, `422`, `413`, `429`, `500` ou `504`. Corpos precisam ser objetos JSON com `Content-Type: application/json`, limitados a 1 MiB, sem campos desconhecidos ou conteúdo adicional. Falhas internas não expõem SQL. O roteador nativo responde 404/405 para caminhos ou métodos não registrados.

Fora da base `/api`: `GET /` mantém o Hello World; `GET /health/live` verifica o processo e `GET /health/ready` verifica a conexão com PostgreSQL.
