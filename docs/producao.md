# Publicação em produção — Alimenta+

Roteiro para o Hermes Agent executar no servidor Linux, usando Bash como root. Este documento foi conferido contra o código; os comandos ainda precisam ser executados e validados no servidor.

## Ambiente e resultado esperado

- Projeto: `/var/www/alimentamais.devgui.dev`.
- Frontend: `https://alimentamais.devgui.dev`.
- API: `https://alimentamais.devgui.dev/api`.
- PostgreSQL instalado no servidor; banco `alimenta_mais` já criado; usuário de conexão **`postgres`**, conforme definido pelo responsável. Não criar outro usuário nem alterar a senha existente.
- Backend Go em `127.0.0.1:8080`, gerenciado pelo systemd.
- Nginx serve o frontend compilado e encaminha `/api/` ao Go preservando o caminho.
- Configuração do site em `/etc/nginx/conf.d`; HTTPS com Certbot; DNS na Cloudflare já configurado.
- Instalação nativa, sem Docker. PHP não participa desta aplicação.

## Instruções para o Hermes

Execute as etapas em ordem, confira o resultado e interrompa a sequência se um comando falhar. Inspecione o estado existente antes de modificar arquivos. Preserve os demais sites, serviços e certificados deste servidor. Não execute limpeza global, `git reset --hard`, migrations `down`, remoção de banco ou restauração automática de backup.

As únicas informações pessoais necessárias são a senha atual do PostgreSQL e nome, e-mail e senha do primeiro administrador. Solicite somente o que ainda não estiver disponível de forma segura. Não publique credenciais, arquivos de ambiente ou cookies em logs, relatórios ou commits. Não habilite `set -x` nos comandos com segredos.

## 1. Conferir o servidor e o checkout

```bash
cd /var/www/alimentamais.devgui.dev
git status --short
git log -1 --oneline
node --version
npm --version
go version
psql --version
nginx -v
certbot --version
ss -ltnp
systemctl status nginx postgresql --no-pager
```

Atualize com `git pull --ff-only` apenas se não houver alterações locais que precisem ser preservadas. Confirme que as rotas do checkout usam `/api`.

O frontend usa Node.js 22. O `backend/go.mod` declara **Go 1.27.0**: disponibilize uma toolchain compatível antes do build, seguindo a distribuição oficial do Go em <https://go.dev/doc/install>. Não reduza a versão no projeto para contornar uma toolchain ausente. Se a versão declarada não estiver disponível, reporte esse bloqueio antes de prosseguir.

Se a porta 8080 estiver ocupada por outro serviço, escolha uma porta local livre e use o mesmo valor no ambiente, no proxy e nas verificações deste guia.

Confira o site existente com `nginx -T` e os certificados com `certbot certificates`. Guarde uma cópia dos arquivos específicos que serão alterados fora de `/etc/nginx/conf.d`, para que o backup não seja carregado como outro site.

## 2. Conferir e resguardar o banco já criado

Use a conexão que já funcionou. A senha será solicitada pelo PostgreSQL:

```bash
psql -U postgres -h localhost -d alimenta_mais -W
```

Dentro do psql:

```sql
SELECT current_database(), current_user;
\dt public.*
\q
```

O banco já existe: **não execute `CREATE DATABASE` novamente**. As tabelas serão criadas pelas migrations do projeto, sem importar o DBML e sem executar os arquivos SQL manualmente.

Antes das migrations, gere um backup, inclusive se o banco estiver vazio:

```bash
install -d -m 700 /var/backups/alimenta-mais
pg_dump -U postgres -h localhost -W -Fc \
  -f "/var/backups/alimenta-mais/alimenta_mais-$(date +%Y%m%d-%H%M%S).dump" \
  alimenta_mais
```

Confirme o sucesso do comando e confira o arquivo com `pg_restore --list CAMINHO_DO_BACKUP`. Mantenha o backup restrito ao root. Se houver tabelas pré-existentes sem histórico compatível de migrations, analise a origem antes de aplicar: não apague tabelas nem marque migrations como executadas manualmente.

## 3. Configurar o ambiente de produção

Use os arquivos já configurados em `backend/.env` e `frontend/.env`, preservando seus valores. Não crie cópias em `/etc`. O backend carrega `.env` automaticamente a partir do diretório de execução; o Vite carrega o ambiente do frontend no build. Não é necessário um `.env` na raiz nesta instalação.

Confira se `backend/.env` contém as configurações de produção abaixo. Os campos indicados são exemplos: preserve as credenciais reais já configuradas.

```dotenv
DATABASE_URL='postgres://postgres:SENHA_CODIFICADA_PARA_URL@localhost:5432/alimenta_mais?sslmode=disable'
HTTP_ADDR=127.0.0.1:8080
ALLOWED_ORIGIN=https://alimentamais.devgui.dev
JWT_SECRET=CHAVE_HEXADECIMAL_GERADA
COOKIE_SECURE=true
```

Use a senha atual de `postgres`. Codifique somente a senha com percent-encoding caso contenha caracteres reservados de URL, como `@`, `:`, `/`, `#`, `%` ou `?`. Por exemplo, `@` vira `%40`. Não mude a senha do banco. Não execute `source` no arquivo: use o carregamento dotenv já implementado pelo backend.

Gere a chave JWT uma única vez com `openssl rand -hex 32` e grave-a no arquivo sem incluí-la no relatório. Preserve essa chave nas próximas publicações. `sslmode=disable` aqui pressupõe conexão com PostgreSQL na mesma máquina, via loopback; banco remoto exige configuração TLS própria.

```bash
chown root:root /var/www/alimentamais.devgui.dev/backend/.env
chmod 600 /var/www/alimentamais.devgui.dev/backend/.env
```

Não use a senha do PostgreSQL como chave JWT. Não exponha as portas 5432 ou 8080 para publicar o site. O uso de `postgres` segue a configuração solicitada; essa conta normalmente tem privilégios de superusuário no banco.

## 4. Compilar os executáveis e o frontend

```bash
cd /var/www/alimentamais.devgui.dev/backend
go mod download
install -d -m 755 /usr/local/lib/alimenta-mais
go build -trimpath -o /usr/local/lib/alimenta-mais/server.next .
go build -trimpath -o /usr/local/lib/alimenta-mais/migrate.next ./cmd/migrate
go build -trimpath -o /usr/local/lib/alimenta-mais/admin.next ./cmd/admin
```

Após os três builds passarem, instale os executáveis. Em uma atualização, copie os executáveis anteriores para uma pasta de backup antes desta troca:

```bash
mv /usr/local/lib/alimenta-mais/server.next /usr/local/lib/alimenta-mais/server
mv /usr/local/lib/alimenta-mais/migrate.next /usr/local/lib/alimenta-mais/migrate
mv /usr/local/lib/alimenta-mais/admin.next /usr/local/lib/alimenta-mais/admin

cd /var/www/alimentamais.devgui.dev/frontend
npm ci
npm run build
```

Confirme que `frontend/dist/index.html` existe e que o usuário worker do Nginx consegue ler o `dist` e atravessar seus diretórios pais. Ajuste apenas as permissões necessárias; não use `chmod -R 777`. Em atualizações, preserve o `dist` anterior antes de recompilar ou publique o novo build por troca de diretórios.

## 5. Aplicar as migrations

Na primeira instalação, a API ainda deve estar parada. Em atualizações, compile primeiro, faça backup e pare somente `alimenta-mais.service` antes de migrar.

Execute no diretório `backend` para carregar seu `.env` automaticamente:

```bash
(
  set -e
  cd /var/www/alimentamais.devgui.dev/backend
  /usr/local/lib/alimenta-mais/migrate status
  /usr/local/lib/alimenta-mais/migrate up
  /usr/local/lib/alimenta-mais/migrate status
)
```

No estado atual do projeto, devem constar como aplicadas as migrations **1, 2 e 3**. As migrations estão embutidas no executável; não é necessário instalar a CLI Goose. `up` aplica somente as pendentes. O servidor Go não executa migrations automaticamente.

Se falhar, preserve o erro sem credenciais e investigue antes de iniciar o serviço. Não execute `down` como correção: o rollback inicial apaga tabelas e a migration 3 altera sessões de autenticação.

## 6. Criar o primeiro administrador

Execute uma única vez após as migrations. Configure no `backend/.env` os valores reais das variáveis abaixo, preservando as demais configurações. A senha deve ter pelo menos 8 caracteres, letras e números, e no máximo 72 bytes:

```dotenv
DEFAULT_ADMIN_NAME="Seu nome"
DEFAULT_ADMIN_EMAIL=seu-email@example.com
DEFAULT_ADMIN_PASSWORD="Sua senha"
```

O comando carrega essas variáveis do `.env` automaticamente:

```bash
(
  set -e
  cd /var/www/alimentamais.devgui.dev/backend
  /usr/local/lib/alimenta-mais/admin
)
```

Se essas variáveis já estiverem configuradas no `.env`, use os valores existentes sem solicitar novamente. Não exponha o arquivo em logs ou relatórios. Após a criação, remova `DEFAULT_ADMIN_PASSWORD` do `.env`; o login passa a usar o cadastro salvo no banco. Alterar essas variáveis não atualiza uma conta existente. O servidor não cria o administrador automaticamente: execute o comando acima.

O resultado esperado é `Administrador inicial criado`. Se já houver administrador ativo, o comando bloqueia uma segunda criação; preserve a conta existente. Não insira usuário diretamente por SQL. O cadastro público cria Operadores.

## 7. Configurar o serviço Go

Crie uma conta **do Linux**, exclusiva para executar o processo, se ainda não existir. Ela não é um novo usuário do PostgreSQL:

```bash
id alimenta-mais || useradd --system --no-create-home --shell /usr/sbin/nologin alimenta-mais
```

Crie `/etc/systemd/system/alimenta-mais.service`:

```ini
[Unit]
Description=Alimenta Mais API
After=network.target postgresql.service

[Service]
Type=simple
User=alimenta-mais
Group=alimenta-mais
WorkingDirectory=/var/www/alimentamais.devgui.dev/backend
ExecStart=/usr/local/lib/alimenta-mais/server
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

O backend precisa ler seu `.env` ao iniciar. Após criar a conta Linux, permita leitura somente ao root e ao grupo do serviço, preservando o conteúdo:

```bash
chown root:alimenta-mais /var/www/alimentamais.devgui.dev/backend/.env
chmod 640 /var/www/alimentamais.devgui.dev/backend/.env
```

Confirme que a conta do serviço consegue atravessar os diretórios pais. Confira `VITE_API_URL=/api` no ambiente existente do frontend antes do build. Não inclua credenciais do backend no frontend.

```bash
systemctl daemon-reload
systemctl enable --now alimenta-mais.service
systemctl status alimenta-mais.service --no-pager
curl --fail http://127.0.0.1:8080/health/ready
```

Se o serviço já estiver em execução e tiver sido atualizado, execute `systemctl restart alimenta-mais.service`. A readiness deve retornar HTTP 200 e `{"status":"ok"}`. Consulte falhas com `journalctl -u alimenta-mais.service -n 100 --no-pager`.

## 8. Configurar o Nginx do domínio

Se já existir um bloco para este domínio, adapte-o preservando o certificado válido. Não crie outro `server_name` duplicado. Confirme que `/etc/nginx/nginx.conf` inclui `/etc/nginx/conf.d/*.conf`.

Para uma instalação sem bloco existente, crie `/etc/nginx/conf.d/alimentamais.devgui.dev.conf` inicialmente em HTTP:

```nginx
server {
    listen 80;
    server_name alimentamais.devgui.dev;

    root /var/www/alimentamais.devgui.dev/frontend/dist;
    index index.html;

    location = /api {
        return 404;
    }

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache off;
        add_header Cache-Control "no-store" always;
    }

    location ^~ /health/ {
        return 404;
    }

    location ~ /\.(?!well-known/) {
        deny all;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Mantenha `proxy_pass http://127.0.0.1:8080;` sem barra final**: assim `/api/auth/login` chega ao Go como `/api/auth/login`. A base `/api` isolada não é um endpoint; seu 404 é esperado. O root público deve ser somente `frontend/dist`, nunca a raiz do repositório.

O backend atualmente usa o endereço da conexão para identificar IPs e não interpreta `X-Forwarded-For`; atrás deste proxy, o limite de login pode ser compartilhado entre visitantes. Este roteiro não altera essa regra do código.

```bash
nginx -t
systemctl reload nginx
```

Recarregue somente se a configuração for válida.

## 9. Certbot

Se já houver certificado válido para este domínio, reutilize-o e confira a configuração HTTPS. Caso contrário, com DNS e acesso HTTP ao desafio funcionando:

```bash
certbot --nginx -d alimentamais.devgui.dev --redirect
nginx -t
systemctl reload nginx
certbot certificates
```

Forneça o e-mail real de contato e aceite os termos pelo fluxo do Certbot. Confirme que o bloco HTTPS mantém o root, o proxy e o fallback de SPA acima. Confira o mecanismo de renovação existente (timer ou cron) e teste a renovação **do certificado deste site**, usando o nome exato listado pelo Certbot:

```bash
certbot renew --cert-name NOME_EXATO_DO_CERTIFICADO --dry-run
```

O DNS e a configuração da Cloudflare já estão definidos pelo responsável e atendem outros projetos. Preserve os registros, o estado do proxy e o modo SSL existentes. Esta publicação não exige reconfigurar a Cloudflare.

Se a emissão falhar, confira o desafio HTTP e a configuração deste site no Nginx antes de tentar novamente. Reporte o bloqueio sem alterar a Cloudflare ou os demais sites.

## 10. Validar a publicação

```bash
curl --fail http://127.0.0.1:8080/health/ready
curl -I https://alimentamais.devgui.dev
curl -i https://alimentamais.devgui.dev/api/auth/me
systemctl is-enabled alimenta-mais.service
systemctl is-active alimenta-mais.service
```

Esperado: readiness 200; site HTTPS 200; `/api/auth/me` sem sessão retorna **401 em JSON**, não HTML nem 404/502. Confira também HTTPS diretamente na origem, por exemplo com `curl --resolve alimentamais.devgui.dev:443:127.0.0.1 -I https://alimentamais.devgui.dev`, se o Nginx estiver ouvindo no loopback. Não use `-k` para considerar TLS validado.

No navegador, valide login com o administrador, carregamento do painel, navegação e atualização de uma URL interna e logout. Confira cookies `alimenta_access` em `/api`, `alimenta_refresh` em `/api/auth` e `alimenta_csrf` em `/`, todos Secure; access e refresh devem ser HttpOnly. Requisições devem ir ao mesmo domínio, sem localhost nem `/api/v1`.

As rotas de saúde são verificadas localmente; não precisam ficar públicas. No banco, confirme as tabelas com `\dt public.*` e as migrations com `migrate status`. Os cadastros operacionais começam vazios: cadastrar categorias, produtos e depósitos faz parte da configuração inicial pelo sistema, não existe carga obrigatória de dados fictícios.

Ao concluir, relate: commit publicado, migrations aplicadas, serviço ativo, resultado dos testes HTTP, validade e renovação do certificado e validação do login. Separe o que foi verificado por terminal do que foi verificado no navegador; não inclua segredos.

## Próximas atualizações

1. Confira alterações locais e atualize com `git pull --ff-only`.
2. Compile os novos executáveis e frontend antes da troca; preserve os anteriores.
3. Gere e confira backup do banco antes de migrar.
4. Pare somente o serviço da aplicação, instale os novos executáveis e aplique `migrate up` com o ambiente de produção.
5. Publique o novo frontend e reinicie o serviço; valide readiness, API e login.
6. Preserve o ambiente e a chave JWT. Não repita bootstrap do administrador nem recrie o banco.

Se uma atualização falhar, avalie compatibilidade do executável anterior com o schema antes de revertê-lo. Não restaure o banco automaticamente: isso pode descartar dados posteriores ao backup. Defina separadamente a rotina recorrente de backup e cópia externa, incluindo teste de restauração em ambiente isolado.

## Referências

- Comandos do projeto: [backend](../backend/README.md), [contrato da API](api.md) e `backend/cmd/migrate`, `backend/cmd/admin`.
- [Nginx: comportamento de proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).
- [Certbot com Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap), usando a instalação já existente no servidor.
