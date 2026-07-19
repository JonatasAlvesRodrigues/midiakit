# Midiakit

Aplicacao web simples para criacao e edicao de media kit com autenticacao, `profiles`, `media_kits` e upload de arquivos via Supabase.

## Stack

- Node.js + Express
- HTML, CSS e JavaScript vanilla
- Supabase Auth
- Supabase Postgres
- Supabase Storage

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` com base no `.env.example`:

```env
PORT=3000
APP_URL=http://localhost:3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_publica_anon
SUPABASE_STORAGE_BUCKET=media-assets
```

3. Inicie o servidor:

```bash
npm start
```

4. Abra:

```text
http://localhost:3000
```

## Configuracao do Supabase

### Banco

Execute as migrations da pasta `supabase/migrations` no seu projeto Supabase.

- `20260719015540_init_profiles_and_media_kits.sql`
- `20260719020000_create_media_assets_bucket.sql`

### Auth

Adicione estes redirect URLs no painel do Supabase:

- `http://localhost:3000/login.html`
- `http://localhost:3000/login.html?mode=reset`

Se usar outra URL local ou de producao, ajuste `APP_URL` e os redirects no painel.

### Storage

O projeto usa o bucket publico `media-assets`.

- Uploads de imagens e portfolio sao salvos em `storage.objects`
- Cada usuario acessa apenas sua propria pasta por RLS
- Os URLs publicos sao gravados dentro de `media_kits.payload`

## Fluxos implementados

- Cadastro com e-mail e senha
- Login com e-mail e senha
- Recuperacao de senha por e-mail
- Atualizacao de senha
- Persistencia de `profiles`
- Persistencia de `media_kits`
- Upload de imagens e portfolio via Supabase Storage
- Fallback local com `localStorage` em caso de falha de sincronizacao

## Estrutura principal

```text
public/
  index.html
  login.html
  script.js
  login.js
  supabase-config.js
supabase/
  config.toml
  migrations/
server.js
package.json
```

## Observacoes

- O backend serve apenas arquivos estaticos e a configuracao publica do Supabase.
- Nao coloque a service role key no frontend.
- O `.env` esta ignorado no `.gitignore`.
