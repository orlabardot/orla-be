# Contexto do projeto — para testes E2E (Playwright) e performance (k6)

> Este documento existe pra dar contexto suficiente a um agente/time responsável por escrever
> testes automatizados de ponta a ponta e testes de carga/performance, sem precisar reconstruir
> esse entendimento lendo os dois repositórios do zero. Cobre as duas metades do produto:
> `orla-be` (API) e `orla-fe` (painel web). Vale a pena manter uma cópia deste arquivo em cada
> repositório, já que os testes provavelmente vão viver em ambos.

## 1. O que é o produto

Não é uma SaaS multi-tenant onde cada cliente gerencia seu próprio catálogo. É uma ferramenta de
vendas de **uma distribuidora de óculos** (hoje só um tenant ativo em produção: "GR Sul
distribuidora"). O modelo:

- A distribuidora (via usuários **admin**) cadastra e mantém **um catálogo único** de produtos,
  variantes (cores) e fotos.
- Clientes da distribuidora (óticas que compram dela) recebem contas **criadas manualmente pelo
  admin** — não existe autocadastro. Esses usuários têm papel **employee** e só enxergam o
  catálogo, o carrinho e os próprios pedidos.
- O cliente monta um carrinho, escolhe quantidade por variante, e ao finalizar informa **CNPJ +
  telefone** — não existe pagamento online. O pedido fica salvo no banco e o time da distribuidora
  entra em contato depois (o fluxo também abre um link de WhatsApp pré-formatado e oferece baixar
  um PDF com a lista de itens escolhidos).
- O modelo `Tenant` existe no schema (pensado para um multi-tenant futuro) mas hoje só há um
  tenant real em uso — isso foi uma decisão consciente de manter a estrutura sem ativar a
  funcionalidade, não uma migração incompleta.

Dois papéis apenas: `admin` (time da distribuidora — CRUD completo de catálogo/usuários/pedidos) e
`employee` (cliente da ótica — só lê catálogo, monta carrinho, vê os próprios pedidos).

## 2. Arquitetura — backend (`orla-be`)

- **Stack**: Fastify 5 + TypeScript + Prisma 5 + PostgreSQL. Deploy em Railway. Banco em Supabase.
- **Padrão de módulo**: `src/http/routes/*.routes.ts` (schema Zod + parsing) → `use-cases/*.ts`
  (regra de negócio, validações) → `*.repository.ts` (acesso ao Prisma). Rotas nunca falam direto
  com o Prisma.
- **Autenticação**: JWT via `@fastify/jwt`. Payload assinado no login: `{ sub, tenantId, role }`
  (não tem `id` — atenção, já causou um bug de segurança real, ver seção 8). Expira em `8h`
  (`JWT_EXPIRES_IN`), sem refresh token — sessão longa e "morre" de vez após expirar (usuário
  precisa logar de novo).
- **Middlewares de auth** (nessa ordem, quando presentes): `authenticate` (valida o JWT e
  resolve o usuário real via `payload.sub`) → `resolveTenantFromAuth` (resolve o tenant a partir
  do `tenantId` **do token**, nunca de um header) → `requireAdmin` (opcional, só nas rotas
  admin-only).
- **Multi-tenancy**: todo dado é escopado por `tenantId`. O header `x-tenant-slug` que o frontend
  ainda envia em algumas chamadas é **decorativo/legado** — nenhuma rota autenticada confia nele
  pra resolver o tenant (só o login antigo usava, isso mudou). Isso é relevante pra testes de
  segurança: mandar um `x-tenant-slug` forjado não deve ter efeito nenhum.
- **Erros**: classe `AppError` com subclasses (`ResourceNotFoundError` 404, `UnauthorizedError`
  401, `ForbiddenError` 403, `ConflictError` 409, `ValidationError` 422, `BadRequestError` 400),
  tratadas por um error handler global (`src/http/error-handler.ts`). Corpo de erro padrão:
  `{ code, message, errors? }` (`errors` é o `.flatten().fieldErrors` do Zod quando é erro de
  validação de schema).
- **Segurança de infraestrutura** (`src/app.ts`): Helmet com CSP restritiva (só permite imagens do
  próprio bucket S3/R2), CORS restrito a `CORS_ORIGIN` em produção (liberado em dev), rate limit
  **global de 100 req/min**, rate limit **de 5 req/min por IP especificamente em `POST
  /auth/login`**, compressão de resposta, upload multipart limitado a **10MB por arquivo**.
- **Health check**: `GET /health` — retorna `{status, db, timestamp}`, faz um `SELECT 1` real no
  banco. Bom candidato pra smoke test / probe de disponibilidade em k6.
- **Banco**: Postgres via Supabase. A connection string de produção usa
  **`pgbouncer=true&connection_limit=1`** — ou seja, o backend roda com o pool do Prisma
  efetivamente limitado a **1 conexão real** por instância, atrás do pgbouncer da Supabase. Isso é
  crítico pra teste de carga: número de instâncias/conexões concorrentes ao banco é baixo por
  design; um teste de k6 agressivo pode saturar isso rápido e o gargalo real vai ser o banco, não
  o Fastify.
- **Storage de imagens**: S3 ou Cloudflare R2 (configurável via `STORAGE_PROVIDER`), R2 é o
  recomendado (sem custo de egress). URLs de imagem são absolutas, servidas direto do bucket (não
  passam pelo Fastify depois do upload).
- **PDF**: gerado com Puppeteer (`src/lib/pdf.ts`, mantém um browser Chromium aberto/reutilizado
  entre requisições — `closeBrowser()` só é chamado no shutdown/testes). É a rota mais lenta da
  API de longe (~6–7s observados localmente pra poucas variantes); o timeout do frontend pra essa
  chamada é propositalmente maior (35s vs. 10s padrão). **Bom alvo de teste de performance
  dedicado** — tanto para saber o tempo por N variantes quanto para ver como o Puppeteer se
  comporta sob concorrência (é o tipo de endpoint que não escala bem com muitas instâncias
  simultâneas do browser).

### Mapa de rotas

Todas as rotas abaixo (exceto `/health` e `/auth/login`) exigem `Authorization: Bearer <jwt>`.
"Admin" na coluna Auth significa que além do JWT válido, o `role` precisa ser `admin`
(`requireAdmin`), senão retorna 403.

| Método | Rota | Auth | Observação |
|---|---|---|---|
| GET | `/health` | pública | checa DB |
| POST | `/auth/login` | pública | rate limit 5/min/IP; login só por e-mail (globalmente único), não usa `x-tenant-slug` |
| POST | `/auth/logout` | JWT | stateless, só existe pra padronizar o fluxo do front |
| GET | `/auth/me` | JWT | retorna o usuário autenticado |
| GET | `/catalog` | JWT | listagem plana de **variantes** (não produtos) pro catálogo público — filtros: `q, frameType, categoryId, brandId, colorCode, sizeMin/Max, bridgeMin/Max, templeMin/Max, tagIds, sort`, paginado (`limit` máx. 100) |
| GET | `/products` | JWT | lista produtos (admin), paginado |
| GET | `/products/:id` | JWT | produto + variantes + imagens |
| POST | `/products` | Admin | cria produto, SKU único por tenant |
| PUT | `/products/:id` | Admin | atualiza produto, incl. `sku` (checa duplicidade) |
| DELETE | `/products/:id` | Admin | **soft delete** (`deletedAt` + `isActive=false`) |
| GET | `/products/:id/variants` | JWT | lista variantes de um produto |
| POST | `/products/:id/variants` | Admin | cria 1 variante |
| POST | `/products/:id/variants/bulk` | Admin | cria várias variantes numa transação (tudo ou nada) |
| PUT | `/products/:id/variants/:variantId` | Admin | atualiza `colorLabel`/`isActive` |
| DELETE | `/products/:id/variants/:variantId` | Admin | soft delete |
| POST | `/variants/:variantId/images` | Admin | upload multipart, máx. 10MB |
| DELETE | `/variants/:variantId/images/:imageId` | Admin | remove imagem |
| PATCH | `/variants/:variantId/images/:imageId/primary` | Admin | marca como imagem principal |
| GET/POST/PUT/DELETE | `/categories`, `/brands`, `/tags` | JWT (GET) / Admin (mutação) | CRUD simples, `slug` único por tenant |
| GET | `/users` | Admin | lista usuários do tenant |
| POST | `/users` | Admin | cria usuário (e-mail único **globalmente**) |
| PUT | `/users/:id` | Admin | edita usuário |
| POST | `/orders` | JWT | cria pedido pro usuário autenticado; revalida variantes no servidor (nunca confia em nome/sku/cor enviados pelo cliente) |
| GET | `/orders` | JWT | **admin vê todos os pedidos do tenant; employee vê só os próprios** — mesmo endpoint, escopo decidido pelo role de quem chama |
| PATCH | `/orders/:id/status` | Admin | marca `pendente`/`atendido` |
| GET | `/tenant/settings` | Admin | dados do tenant (inclui telefone do WhatsApp) |
| PATCH | `/tenant/settings` | Admin | atualiza telefone do WhatsApp |
| POST | `/pdf/generate` | JWT | gera PDF de uma lista de `variantIds` (máx. 100), rota lenta |

## 3. Modelo de dados (resumo)

`Tenant` 1—N `User`, `Product`, `Category`, `Brand`, `Tag`, `ProductVariant`, `Order`.

- `Product` — dados técnicos fixos do modelo (SKU, nome, tipo de armação, medidas em mm, gênero).
  `sku` único por tenant. Soft delete (`deletedAt`).
- `ProductVariant` — a unidade real de venda/exibição (cor específica de um produto).
  `skuVariant` único por tenant, `colorCode` único **por produto** (não por tenant). Tem N
  `VariantImage` (uma marcada `isPrimary`). Soft delete próprio, independente do produto pai. **O
  catálogo lista variantes, não produtos** — um produto sem nenhuma variante ativa simplesmente
  não aparece pra cliente nenhum, mesmo estando cadastrado e ativo (não é bug, é a regra).
- `Order` + `OrderItem` — pedido do cliente. `OrderItem` guarda um **retrato** (sku, nome do
  produto, cor, quantidade) no momento do pedido, com uma FK opcional (`SetNull`) pra
  `ProductVariant` — o pedido continua legível mesmo que a variante seja editada/apagada depois.
  `Order.userId` é `onDelete: Restrict` — **não dá pra apagar um usuário que já tem pedidos**
  (relevante pra testes que criam/limpam dados: apagar um `User` com pedidos associados vai falhar
  por causa dessa constraint).
- `User.email` é **único globalmente** (não por tenant) — mudança recente e importante: antes era
  único só por tenant. Isso é o que permite o login não depender de `x-tenant-slug`.

## 4. Arquitetura — frontend (`orla-fe`)

- **Stack**: Next.js (App Router, Turbopack) + React + TypeScript + Tailwind. Deploy na Vercel.
- **Roteamento**: grupo de rotas `(app)` engloba tudo que exige login. `src/app/(app)/layout.tsx`
  chama `useRequireAuth()` e renderiza `null` até confirmar sessão — **isso é só UX, não é uma
  barreira de segurança real**: não existe `middleware.ts` do Next fazendo guarda no servidor, a
  proteção de verdade é o backend rejeitando requisições sem JWT válido. Bom ponto de teste E2E:
  navegar direto pra uma URL protegida sem estar logado deve redirecionar pro login (client-side),
  mas o dado nunca deveria vazar via alguma chamada de API que rode antes do redirect.
- **Auth**: token + usuário + tenant guardados via `src/lib/auth-storage.ts` (localStorage).
  Interceptor do axios (`src/lib/axios.ts`) injeta `Authorization: Bearer` em toda chamada e faz
  logout automático + redirect pra `/login` em qualquer `401`. Timeout padrão de requisição:
  **10s**; exceção: `/pdf/generate` usa **35s**.
- **Dados do servidor**: TanStack Query. `staleTime` global de **60s**, `retry: 1`. Camada de
  `services/*.ts` (um arquivo por recurso, thin wrapper sobre o axios) — nenhum componente chama
  `api.*` direto.
- **Estado de cliente** (Zustand):
  - `cart.store.ts` — carrinho (persistido em `localStorage`, chave `orla-cart`). `addItem` aceita
    quantidade opcional (default 1, soma se já existir).
  - `selection.store.ts` — seleção pra geração de PDF (**não** persistida, é um recurso à parte do
    carrinho — o mesmo catálogo tem duas seleções independentes: uma pro carrinho, outra pro PDF).
  - `ui.store.ts` — estado de UI (ex: sidebar mobile aberta/fechada).
  - Convenção do projeto: **não expor getters derivados** nas stores (ex: contagem de itens) —
    métodos Zustand têm referência estável e não disparam re-render; componentes devem assinar o
    estado bruto e derivar localmente.
- **Formulários**: `react-hook-form` + `zodResolver`. Padrão: schema Zod em `src/schemas/*.ts`
  exporta também funções `xToCreateBody`/`xToUpdateBody` que traduzem o form pro shape esperado
  pela API (nem sempre 1:1 — ex.: o form de produto tem `sku`, mas por um bom tempo o update não
  aceitava mudar o SKU, e o form não escondia isso — já corrigido).
- **Filtros do catálogo** (`use-filters.ts`): sincronizados na **URL** (query string), não em
  estado React solto — então testes E2E podem (e devem) verificar o estado via URL, e links
  diretos com filtro pré-aplicado precisam funcionar. Filtros de intervalo (Tamanho/Ponte/Haste)
  só aplicam ao clicar em "Aplicar" dentro do popover — arrastar o slider sozinho não muda nada até
  confirmar (mudança recente, antes aplicava ao simplesmente fechar o popover).

### Páginas principais

| Rota | Quem acessa | O que faz |
|---|---|---|
| `/login` | público | login |
| `/` (dashboard) | autenticado | contadores gerais (produtos, variantes, marcas, categorias) |
| `/catalogo` | autenticado | grid de variantes, busca + filtros, seleção pra PDF, modal de detalhe, botão de carrinho por card |
| `/pedidos` | autenticado | "Meus pedidos" — lista os pedidos do próprio usuário (admin também vê essa versão pessoal) |
| `/admin/produtos` | admin | listagem de produtos, botão fixo "Gerenciar variantes", editar no menu de "..." |
| `/admin/produtos/novo`, `/admin/produtos/[id]/editar` | admin | form de produto (criar/editar) |
| `/admin/produtos/[id]/variantes` | admin | CRUD de variantes do produto (criação em lote, upload de imagem, marcar principal) |
| `/admin/marcas`, `/admin/categorias`, `/admin/tags` | admin | CRUD simples (componente genérico `simple-entity-crud.tsx`) |
| `/admin/usuarios` | admin | cria/edita usuários (admin ou employee) |
| `/admin/pedidos` | admin | "Pedidos recebidos" — todos os pedidos do tenant, ação de marcar atendido |
| `/admin/configuracoes` | admin | telefone do WhatsApp usado no checkout |

### Componentes de domínio que mais importam pra E2E

- `variant-card.tsx` — card do catálogo. Tem checkbox de seleção (PDF), botão de ver detalhes
  (só aparece se a variante tiver `productId` — defesa contra skew de versão com o backend), botão
  de adicionar ao carrinho (sempre soma 1 unidade).
- `product-detail-dialog.tsx` — modal de detalhe. Navegação de fotos por miniaturas + setas
  anterior/próxima (não é carrossel de swipe, decisão deliberada). Tem seletor de quantidade e
  "Adicionar ao carrinho"; a lista "Cores disponíveis" agora é um multi-select — marcar outras
  cores as inclui no carrinho **com a mesma quantidade** escolhida, junto com a variante em
  exibição (que vai sempre, não dá pra desmarcar).
- `cart-sheet.tsx` — carrinho lateral, editar quantidade, remover item, abre o checkout.
- `checkout-dialog.tsx` — pede CNPJ + telefone, cria o pedido (`POST /orders`), depois oferece
  baixar PDF (reaproveita `/pdf/generate`) e abrir WhatsApp (`https://wa.me/<telefone>?text=...`,
  mensagem monta quantidade total + data + CNPJ + telefone, sem lista de SKUs).
- `filter-bar.tsx` / `filter-bar-mobile.tsx` — desktop usa popovers com "Aplicar"/"Limpar" pros
  filtros de intervalo; mobile usa um Sheet cheio com inputs numéricos diretos (aplicam ao digitar,
  **inconsistente** com o desktop — se for escrever E2E pros dois, não assuma o mesmo
  comportamento).

## 5. Papéis e regras de autorização (pra roteiros de teste de segurança)

- `admin`: CRUD completo de catálogo, usuários, configurações; vê todos os pedidos do tenant.
- `employee`: só leitura de catálogo, cria pedidos pra si mesmo, vê só os próprios pedidos. Sem
  acesso a nenhuma rota `/admin/*` no front (guarda client-side) nem às rotas `Admin` da tabela
  acima (guarda real, no backend).
- Isolamento entre tenants é garantido pelo backend via `tenantId` do JWT — **nunca** por qualquer
  coisa que o cliente envie (header, query param). Cenário de teste de segurança óbvio: logar
  como usuário do tenant A, tentar acessar/mutar um recurso (produto, pedido, usuário) cujo ID
  pertence ao tenant B — deve dar 404 (não 403, os repositories filtram por tenant na query, então
  "não pertence ao seu tenant" e "não existe" são indistinguíveis de propósito).
- Cenário de teste de autorização: usuário `employee` chamando diretamente (via API, não pela UI)
  uma rota `Admin` — deve retornar 403, mesmo que o token seja válido.

## 6. O que já existe em testes automatizados hoje

- **Backend** (Vitest, `orla-be/tests/e2e/*.spec.ts`): `auth`, `categories`, `pdf`, `products`,
  `variants` — todos batem na API de verdade (`app.inject`, sem HTTP real) contra um Postgres
  descartável, resetando as tabelas a cada teste (`tests/helpers/reset-db.ts`). Rodar localmente:
  precisa de um Postgres apontado em `DATABASE_URL` + `npx prisma migrate deploy` antes.
- **Frontend** (Vitest + Testing Library): testes unitários de componente/hook/store isolados —
  não é E2E, não sobe o app inteiro. Isso é exatamente a lacuna que Playwright deve cobrir.
- **CI**: GitHub Actions nos dois repositórios, roda em toda PR contra `main`.
  - `orla-be`: Node 20, sobe um serviço Postgres 16 no próprio job, aplica migrations, roda os
    testes. **Não** tem lint nem build no workflow atual.
  - `orla-fe`: Node **24** (não 20 — `jsdom@30`, dependência de teste, exige Node ≥22.22/24.15;
    isso já quebrou o CI de verdade uma vez). Lint → type check → testes → build, nessa ordem.
  - Nenhum dos dois workflows roda Playwright ou k6 ainda — é tudo a ser adicionado.
- Branch protection: `main` do `orla-fe` (repositório público) tem proteção configurada (CI
  obrigatório, sem force-push/delete). `orla-be` é privado e está no plano gratuito do GitHub, que
  **não permite** proteção de branch — ainda sem essa rede de segurança lá.

## 7. Fluxos críticos pra roteiro de E2E (Playwright)

Em ordem de criticidade pro negócio:

1. **Login** → dashboard. Credenciais erradas → mensagem genérica (não revela se o e-mail existe).
   Rate limit de 5/min no login — um teste que faz login repetidamente em loop vai começar a
   tomar 429 rapidinho, cuidado ao desenhar isso.
2. **Catálogo → filtrar → ver detalhe → adicionar ao carrinho** (com e sem quantidade > 1, com e
   sem marcar cores extras na modal).
3. **Carrinho → editar quantidade → checkout → pedido criado → PDF baixa → WhatsApp abre com o
   texto certo**.
4. **Admin: criar produto → criar variantes em lote → subir imagem → marcar como principal →
   produto aparece no catálogo** (esse é o fluxo que várias vezes já causou confusão real: produto
   sem variante não aparece; SKU não editável até uma correção recente; etc. — bom candidato a
   suite de regressão).
5. **Admin: pedido aparece em "Pedidos recebidos" assim que um employee finaliza um pedido, marcar
   como atendido reflete pro employee em "Meus pedidos"**.
6. **Isolamento employee vs. admin**: employee nunca vê pedido de outro employee; nunca acessa rota
   admin (nem via URL direta, nem via chamada de API crua).
7. **Gestão de usuários**: admin cria employee, employee loga, employee não aparece pra outro
   tenant (se algum dia isso passar a existir de verdade — hoje só há um tenant real).

## 8. Histórico de bugs de segurança reais (pra não reintroduzir)

- **`authenticate.ts` resolvia sempre o mesmo usuário, não o dono do token** — usava
  `request.user.id` antes desse campo existir de fato (o payload do JWT tem `sub`, não `id`), e
  como `id` vinha `undefined`, o `findFirst` no Prisma silenciosamente ignorava o filtro e
  devolvia o primeiro usuário ativo do tenant (geralmente o admin), não importa quem tivesse
  logado. Corrigido usando `payload.sub` diretamente. Isso é o tipo de bug que só aparece testando
  com **dois usuários reais e distintos** — um teste com um usuário só não pega.
- **Login dependia de `x-tenant-slug`** (header falsificável) pra resolver o tenant — corrigido
  pra resolver sempre pelo dono real do e-mail, ignorando qualquer header.
- **SKU do produto não podia ser editado** — não era falha de segurança, mas é o tipo de bug
  silencioso (o campo aparecia editável na UI, o valor nunca era de fato enviado) que só um teste
  de "editar e reconferir o valor persistido" pega — um teste que só checa "o form submeteu sem
  erro" não pega.

## 9. Candidatos a revisão de performance (ponto de partida, não conclusão)

Isso é pra guiar onde **medir primeiro**, não uma lista de "está errado":

- `POST /pdf/generate` — de longe a rota mais pesada (Puppeteer). Medir tempo por quantidade de
  variantes, e comportamento sob N requisições simultâneas (o browser Chromium é compartilhado
  entre requisições no processo do backend).
- `GET /catalog` — o endpoint mais chamado na prática (toda navegação/filtro do catálogo bate
  aqui). Tem bastante filtro opcional combinável (texto, tipo, marca, categoria, tags, 3 faixas
  numéricas) — vale medir com filtros combinados vs. sem filtro nenhum, e com paginação no limite
  máximo (100).
  Vários dos filtros aumentam a diferença: cor no meio de `contains` case-insensitive.
- Conexão única com o banco em produção (`connection_limit=1` via pgbouncer) — qualquer teste de
  carga que dispare muita coisa em paralelo contra a mesma instância vai serializar no banco antes
  de qualquer outra coisa virar gargalo. Isso é uma característica conhecida do ambiente, não
  necessariamente um bug, mas é essencial documentar no relatório de carga pra não concluir "a API
  é lenta" quando na verdade é essa configuração específica.
- `update-product` e `update-variant` fazem múltiplas queries sequenciais de validação (checar
  categoria, marca, tags, SKU duplicado) antes de gravar — não chega a ser N+1 clássico, mas é
  round-trips sequenciais que dá pra medir e eventualmente paralelizar.
- Frontend: `staleTime` de 60s no React Query já evita bastante re-fetch redundante, mas telas
  como o catálogo disparam `brands`, `categories` e `tags` toda vez que o filtro monta — se o
  usuário navegar entre `/catalogo` e outra tela e voltar, confirmar que isso está vindo do cache
  e não refazendo a chamada.
- Nenhuma rota tem cache HTTP (`Cache-Control`/`ETag`) hoje — candidatas óbvias pra isso são as
  listagens que mudam pouco (`/brands`, `/categories`, `/tags`).

## 10. Observações finais

- Ambiente local de desenvolvimento: backend em `:3333`, frontend em `:3000`,
  `NEXT_PUBLIC_API_URL` aponta pro backend. Seed padrão: `admin@demo.com` / `admin123` (só existe
  localmente — as credenciais de produção são outras e não estão neste documento).
- Pra testes que precisam de um Postgres descartável local (mesmo padrão usado nesta sessão pra
  validar mudanças antes de abrir PR): subir um container Postgres 16 avulso, rodar
  `npx prisma migrate deploy` apontando pra ele, então rodar os testes — não usar o Postgres de
  desenvolvimento local, que acumula dados reais de sessões manuais de teste no navegador.
