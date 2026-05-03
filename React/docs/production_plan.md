# Plan — Hotel WhatsApp Bot: production-ready dla k3s

## Context

Aplikacja `React/01_hotel_whatsapp_bot` (Next.js 16 + React 19 + MUI v9 + Prisma + NextAuth + Stripe + Anthropic SDK) została zbudowana zgodnie z planem `React/docs/plan.md` i przechodzi 29 testów. Wymagania funkcjonalne (`React/docs/whatsapp_booking_bot.md`) są pokryte: bot prowadzi konwersację po francusku, rezerwuje pokój, wysyła link Stripe, potwierdza po payment webhooku.

Użytkownik chce wrzucić ją na **własny mini-klaster k3s** (single-node, bez chmury, Traefik default ingress, local-path-provisioner). Trzy zewnętrzne integracje muszą być skonfigurowane od zera: Meta WhatsApp Cloud API, Anthropic Console (uwaga: konto Claude Pro **nie obejmuje** API — to osobny billing), Stripe (test mode).

**Decyzje (zatwierdzone):**
- Pakowanie: **raw YAML** w `deploy/k8s/`
- Postgres + Redis: **StatefulSet w klastrze** (PVC z local-path-provisioner)
- Registry obrazów: **Docker Hub** (`docker.io/<user>/hotel-bot`)
- CI/CD: **Azure DevOps** (`azure-pipelines.yml`: test → build → push)

**Co zastane (mocne strony, nie ruszamy):**
- Zod env walidacja (`src/config/env.ts`) — fail-fast, AUTH_SECRET min 32, APP_BASE_URL jako URL
- HMAC timing-safe + raw body capture + idempotency `ProcessedWebhookEvent` (`src/whatsapp/signature.ts`, `src/app/api/whatsapp/webhook/route.ts`)
- Stripe `webhooks.constructEvent` + idempotency (`src/payments/stripeWebhookHandler.ts`)
- ClaudeProvider: model `claude-sonnet-4-6`, prompt caching (`cache_control: ephemeral` na system+toole), 10s timeout, 2 retry (`src/ai/ClaudeProvider.ts`)
- `RateLimiter` interface (`src/security/rateLimit.ts`) — wystarczy dorobić Redis store, kontrakt już jest
- NextAuth JWT (`src/auth/config.ts`, strategia `jwt`, 8h) — stateless, k3s-friendly
- Security headers + CSP nonce (`next.config.ts`, `proxy.ts`, `src/security/csp.ts`)
- pino logger z redaction (`src/logging/logger.ts`)

## Krytyczne braki do naprawy w kodzie (przed Dockerem)

### F1. Wadliwy import `after()` — webhook nie zadziała w prod
**Plik:** `src/app/api/whatsapp/webhook/route.ts` linia 8
```ts
// ŹLE — to import z node test runnera:
import { after } from "node:test";
// MA BYĆ:
import { after } from "next/server";
```
**Why:** w prod Next.js `node:test` nie istnieje — pierwszy webhook wywali 500.

### F2. `pino-pretty` jako transport niezależnie od env
**Plik:** `src/logging/logger.ts` linia ~7
- Aktualnie `transport: { target: "pino-pretty" }` jest bezwarunkowy.
- `pino-pretty` jest devDependency — w obrazie produkcyjnym (`npm ci --omit=dev`) nie będzie zainstalowane, logger crashuje przy pierwszym wpisie.
- **Fix:** transport tylko gdy `NODE_ENV !== "production"`. W prod default JSON do stdout.

### F3. PII (numery telefonu) trafia do logów
**Plik:** `src/whatsapp/webhookHandler.ts` ~linia 43
- `logger.info({ from: message.from, ... })` — surowy numer.
- Helper `maskPhone()` istnieje w `src/security/maskPII.ts` ale nie jest tu użyty.
- **Fix:** opakować każdą wartość phone/email przez `maskPhone()`/`maskEmail()` w log payloadzie. Sprawdzić wszystkie `logger.*` calle w `src/whatsapp/`, `src/conversation/`, `src/payments/`.

### F4. Stack trace może wycieknąć
**Plik:** `src/whatsapp/webhookHandler.ts` ~linia 134
- `logger.error({ err })` — pino `serializers.err` daje `stack`. W prod chcemy `code` + `message`, bez `stack` w polu odpowiedzi i bez surowego `err.cause`.
- **Fix:** w `logger.ts` ustawić customowy `serializers.err` który omija `stack` gdy `NODE_ENV === "production"`.

### F5. Brak SIGTERM handlera = ucinane requesty przy rolloutach
- k8s wysyła SIGTERM, czeka `terminationGracePeriodSeconds` (default 30s), potem SIGKILL.
- **Fix:** dodać `instrumentation.ts` w roocie projektu (Next.js 16 standard hook):
  ```ts
  export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { setupGracefulShutdown } = await import("./src/lifecycle/shutdown");
      setupGracefulShutdown();
    }
  }
  ```
  Plik `src/lifecycle/shutdown.ts` zarejestruje `process.on("SIGTERM"/"SIGINT")` → flush pino → `prisma.$disconnect()` → close Redis client → `process.exit(0)`. `readinessProbe` zacznie zwracać 503 gdy flag `isShuttingDown=true` żeby k8s przestał kierować ruch.

### F6. `.env` z sekretami w repo
- `.env` z testowym `STRIPE_SECRET_KEY=sk_test_...` i `AUTH_SECRET=...` jest w katalogu projektu.
- **Fix:** dodać do `.gitignore` jeśli nie jest. Dorzucić `AUTH_SECRET` i `AUTH_URL` do `.env.example` (są używane, ale nieudokumentowane).

## Migracja SQLite → PostgreSQL

SQLite w k8s = utrata danych przy restarcie poda. Postgres jako StatefulSet.

**Kroki:**
1. `prisma/schema.prisma`: zmienić `provider = "sqlite"` → `provider = "postgresql"`. Uwagi:
   - Pole `payload Json` w `OutboxMessage` — w sqlite było `String`. W postgres mapuje się na `jsonb`. Sprawdź czy wszystkie zapisy używają `JSON.stringify(...)`/parse — Prisma zrobi to automatycznie po zmianie typu na `Json`.
   - Indexy na `@@unique([roomId, date])` w `RatePlan` i `RoomNight` — działają identycznie.
2. Wygenerować nową migrację baseline: usunąć `prisma/migrations/20260420083257_init/`, uruchomić `npx prisma migrate dev --name init` przy pustej Postgres (lokalnie via docker run).
3. **Strategia migracji w klastrze:** init container w Deployment app, który robi `npx prisma migrate deploy` zanim uruchomi się Next.js. Alternatywnie dedykowany `Job` aplikowany przed Deployment (cleaner, trzymamy się tej opcji w manifestach).
4. **Seed:** osobny one-shot Job `prisma-seed-job.yaml` z `tsx prisma/seed.ts`, ręcznie aplikowany raz po migracji (3 pokoje + 60 dni RatePlan + AdminUser).

## Distributed rate limiting (Redis w prod, in-memory w dev)

Aktualnie `src/security/rateLimit.ts` ma `RateLimiter` interface i `createTokenBucketLimiter()` z `Map`. Dorabiamy drugą implementację Redis i fabrykę.

**Struktura po zmianie:**
```
src/security/rateLimit/
├─ index.ts                    # public API: createRateLimiter() — fabryka
├─ types.ts                    # RateLimiter, RateLimitDecision (z istniejącego pliku)
├─ inMemoryTokenBucket.ts      # przeniesiona istniejąca logika
├─ redisTokenBucket.ts         # NOWE — atomic Lua script
└─ redisTokenBucket.test.ts    # NOWE — z testcontainers albo z mockiem ioredis
```

**redisTokenBucket.ts:**
- Lua script atomowo: refill bucketa po `(now - last) * refillPerMs`, capnij do `capacity`, jeśli `tokens >= cost` → decrement + zwrot allow, inaczej deny + retryAfterMs.
- Klucz: `rl:{namespace}:{key}` (np. `rl:wa-webhook:48123456789`).
- TTL: `2 * (capacity / refillPerMs)` — Redis sam wyczyści nieużywane.

**Fabryka (`src/security/rateLimit/index.ts`):**
```ts
export function createRateLimiter(opts) {
  if (env.RATE_LIMIT_BACKEND === "redis") {
    return createRedisTokenBucket(getRedisClient(), opts);
  }
  return createInMemoryTokenBucket(opts);
}
```
**Env:** `RATE_LIMIT_BACKEND=memory|redis`, `REDIS_URL=redis://hotel-bot-redis:6379`. Dodać do `env.ts` (Zod) + `.env.example`.

**Klient Redis:** `src/redis.ts` — lazy singleton `ioredis` z reconnect strategy + `lazyConnect: true` (żeby unit testy z dev profilem nie próbowały łączyć się przy imporcie).

**Dependency:** `npm i ioredis` (`@types/ioredis` nie jest potrzebne, typings są wbudowane).

## Health endpoints (k8s probes)

Brak. Dodać dwa proste route handlery:

`src/app/api/health/route.ts` (liveness — czy proces żyje, NIC nie sprawdza zewnętrznie):
```ts
export const dynamic = "force-dynamic";
export function GET() {
  if (isShuttingDown()) return new Response("draining", { status: 503 });
  return Response.json({ status: "ok" });
}
```

`src/app/api/ready/route.ts` (readiness — czy może obsługiwać ruch):
- `prisma.$queryRaw\`SELECT 1\`` z timeoutem 1s
- `redis.ping()` z timeoutem 500ms
- jeśli oba ok → 200, inaczej 503 z payloadem `{ db: "ok"|"down", redis: ... }`
- `export const revalidate = 0`

W manifeście Deployment:
- `livenessProbe`: GET `/api/health`, initialDelay 20s, period 10s, failureThreshold 3
- `readinessProbe`: GET `/api/ready`, initialDelay 10s, period 5s, failureThreshold 2

## Konfiguracja zewnętrznych integracji (krok po kroku)

### A. Meta WhatsApp Cloud API

1. **developers.facebook.com → My Apps → Create App → typ "Business" → use case: WhatsApp.**
2. W panelu aplikacji: **WhatsApp → API Setup**:
   - Skopiuj `Phone number ID` → `META_WHATSAPP_PHONE_NUMBER_ID`
   - Skopiuj tymczasowy `Access token` (24h, do pierwszych testów). Na prod wygeneruj **System User Access Token** (Settings → Business Settings → System Users → Add → Admin → Generate token z permissions: `whatsapp_business_messaging`, `whatsapp_business_management`). Token bez wygasania → `META_WHATSAPP_ACCESS_TOKEN`.
3. **Settings → Basic → App Secret → Show** → `META_WHATSAPP_APP_SECRET`.
4. **Wymyśl losowy string** (np. `openssl rand -hex 24`) → `META_WHATSAPP_VERIFY_TOKEN`. Ten sam string ustawisz w panelu Meta i jako env w aplikacji.
5. **Webhook URL:** musi być publiczny HTTPS. Trzy opcje:
   - **Faza testów (dev):** `ngrok http 3000` → URL `https://abcd-1234.ngrok-free.app/api/whatsapp/webhook` wklej w Meta. APP_BASE_URL = ten sam URL.
   - **Faza produkcji:** k3s Ingress + Traefik + cert-manager + Let's Encrypt → `https://hotel-bot.twoja-domena.pl/api/whatsapp/webhook`. Wymaga publicznego DNS A-record na IP klastra i otwartego portu 80/443.
6. **WhatsApp → Configuration → Webhook → Edit:**
   - Callback URL: jak wyżej
   - Verify token: ten sam string z `META_WHATSAPP_VERIFY_TOKEN`
   - Save → Meta wykona GET na `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`. Twój kod w `webhookHandler.ts` linie 40–62 to obsługuje (zwraca challenge gdy token się zgadza).
   - Webhook fields → subscribe: **messages**, **message_status** (drugi nie jest krytyczny ale przydatny do debug).
7. **Test number:** Meta automatycznie daje numer testowy (np. +1 555…). Tylko wpisane "tester" numery (To/From) mogą wymieniać wiadomości. Dodaj swój numer prywatny w API Setup → Recipients.
8. **Prod number:** musi być zweryfikowany business phone, WhatsApp BSP onboarding (Display Name approval, ~1–3 dni). Dla MVP zostań na test number.

### B. Anthropic Console (Claude API)

⚠️ **Ważne — Claude.ai Pro to nie API.** Subskrypcja Claude.ai ($20/mc) daje dostęp do chat UI. **API ma osobny billing pay-as-you-go** w Anthropic Console (`console.anthropic.com`). Konto można założyć tym samym mailem.

1. **console.anthropic.com → sign up / log in.**
2. **Workspaces → Create workspace** (np. "hotel-bot-prod"). Workspace = osobny billing/usage scope.
3. **Plan & Billing → Add payment method** (karta). Dolej $5–10 kredytu na start.
4. **Workspace → Usage limits → Set monthly spend limit** (np. 50 USD) — twardy hardstop, polecam zawsze.
5. **API Keys → Create Key** — typ "Workspace key", scope ten workspace. Zapisz raz, nie da się odzyskać → `ANTHROPIC_API_KEY`.
6. **Model:** `claude-sonnet-4-6` (już ustawiony w `src/ai/ClaudeProvider.ts:21`). Sonnet 4.6 jest dostępny od razu, nie wymaga rate-limit tier upgrade.
7. **Prompt caching** już zaimplementowane w kodzie (`cache_control: { type: "ephemeral" }` na system prompt + 2 toole). Cache hit reduces input cost o ~90% — istotne dla bota który przy każdym evencie wysyła ten sam system prompt.
8. **Rate limits** dla Workspace tier 1 (default): 50 requests/min Sonnet — dla MVP wystarczy. Jeśli skala rośnie, kup tier 2 (auto upgrade po $100 przepalonym).
9. **(Opcjonalnie) OpenAI fallback:** w env `AI_PROVIDER=claude`. Możesz w przyszłości przełączyć na `openai` bez zmiany kodu (`OpenAiProvider.ts` istnieje).

### C. Stripe (test mode)

1. **dashboard.stripe.com → register / log in.** Tryb **Test mode** ON (toggle u góry).
2. **Developers → API keys**:
   - `Publishable key` (`pk_test_...`) — niepotrzebny aplikacji backendowej, ignorujemy
   - `Secret key` (`sk_test_...`) → `STRIPE_SECRET_KEY`
3. **Developers → Webhooks → Add endpoint:**
   - Endpoint URL: `https://<APP_BASE_URL>/api/stripe/webhook`
   - Events to listen: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Save → na stronie eventu **Reveal signing secret** → `whsec_...` → `STRIPE_WEBHOOK_SECRET`
4. **Test cards:**
   - **Success:** `4242 4242 4242 4242`, dowolna data ≥ teraz, dowolny CVC, dowolny ZIP
   - **Auth required (3DS):** `4000 0027 6000 3184`
   - **Declined:** `4000 0000 0000 9995` (insufficient funds)
   - **Expired:** session ma `expires_at` ustawiane przez `StripeService.ts` — dla testu możesz odpalić `stripe trigger checkout.session.expired` przez Stripe CLI.
5. **Stripe CLI dla lokalnego testu webhooków (zamiast ngrok):**
   ```
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   CLI poda lokalny `whsec_...` — ustaw w `.env.local` na czas testów.

## Manualny test E2E (od wiadomości do potwierdzonej rezerwacji)

**Setup przed testem:**
- `npm run build && npm start` lokalnie albo `kubectl rollout` w k3s
- ngrok tuneluje do localhost:3000 (jeśli dev)
- Meta webhook URL ustawiony, verify zaakceptowany
- Stripe webhook URL ustawiony, signing secret w env
- Postgres/Redis żyją (`kubectl get pods -n hotel-bot`)
- Twój numer dodany jako tester w Meta API Setup
- W Postgres są pokoje + RatePlans (po `prisma-seed-job`)

**Scenariusz (z `whatsapp_booking_bot.md` przykład #1):**

| Krok | Ty (z WhatsApp) wysyłasz | Bot powinien odpowiedzieć | Co się dzieje pod spodem |
|---|---|---|---|
| 1 | "Bonjour, je voudrais réserver une chambre du 12 au 15 août pour 2 adultes" | Powitanie + lista 3 pokoi z cenami | Webhook → signature OK → idempotency miss → enqueue `after()` → Orchestrator: state GREETING→COLLECT_DATES→SHOW_OFFERS, Claude classify intent `start_booking` z slotami, BookingService.searchAvailability |
| 2 | "La supérieure" | "360€ za 3 noce, rezerwujemy?" | state SHOW_OFFERS→SELECT_ROOM, pricing.calculateTotal |
| 3 | "Oui" | "Podaj imię, email, telefon" | state SELECT_ROOM→COLLECT_GUEST_INFO |
| 4 | "Marie Dupont, marie.dupont@email.com, 0612345678" | "Petit-déjeuner 12€/os/dzień?" | Claude wyciąga 3 sloty z jednego user message, state→OFFER_EXTRAS |
| 5 | "Oui" | "432€ total. Link płatności: https://checkout.stripe.com/..." | state→SUMMARY→PAYMENT_SENT, BookingService.hold (10 min TTL na RoomNight), StripeService.createCheckoutSession |
| 6 | (klik w link, karta `4242 4242 4242 4242`) | (po ~5s) "RES-2026-0812-XXXX, dziękujemy" | Stripe webhook `checkout.session.completed` → idempotency check → BookingService.confirm w transakcji → unique(roomId,date) trzyma → Reservation.status=CONFIRMED → WhatsAppClient.sendText |

**Co weryfikować w trakcie:**
- `kubectl logs -f deploy/hotel-bot -n hotel-bot` — każdy log ma `correlationId`, brak surowego phone (powinno być `+33 6** ** ** 78`)
- `psql` → `SELECT * FROM "Conversation" ORDER BY "updatedAt" DESC LIMIT 1;` — `state` przechodzi po kolei
- `SELECT * FROM "Message" WHERE "conversationId"=...` — wszystkie wiadomości in/out zapisane, `whatsappMessageId` unique
- `SELECT * FROM "Reservation"` — code wygenerowany, status leci PENDING→PAYMENT_SENT→CONFIRMED
- `SELECT * FROM "ProcessedWebhookEvent"` — po każdym Meta/Stripe webhooku wpis (idempotency)
- Admin panel `https://<host>/login` (`admin@hotel.local` z seed) → `/admin/conversations` → kliknij konwersację → transkrypt zgodny

**Smoke negatywny (bezpieczeństwo):**
- `curl -X POST <url>/api/whatsapp/webhook -d '{}'` bez `X-Hub-Signature-256` → 401, log warn `invalid_signature`
- Drugi raz wyślij ten sam komunikat (ten sam `whatsappMessageId`) → 200 OK, ale brak duplikatu w bazie
- Zalej webhook 11+ wiadomościami z tego samego numeru w 60s → 11. dropped (rate limit), wcześniejsze przeszły
- `curl <url>/api/admin/conversations` bez sesji → 401 (proxy.ts blokuje)

## Artefakty wdrożeniowe (nowe pliki)

### `Dockerfile` (multi-stage, standalone)

```
# 1. deps
FROM node:20.18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2. build
FROM node:20.18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 3. runtime — minimalny
FROM node:20.18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```
Wymaga: `output: 'standalone'` w `next.config.ts` + `engines.node: "20.x"` w `package.json` + `.nvmrc` z `20.18.0`.

### `.dockerignore`

```
node_modules
.next
.git
.env
.env.local
coverage
tests
*.test.ts
*.test.tsx
docs
README.md
.vscode
prisma/dev.db
prisma/test.db
```

### `deploy/k8s/` — manifesty (raw YAML, namespace `hotel-bot`)

```
deploy/k8s/
├─ 00-namespace.yaml
├─ 10-postgres-secret.yaml          # POSTGRES_PASSWORD
├─ 11-postgres-statefulset.yaml     # 1 replica, image postgres:16-alpine, PVC 5Gi, local-path
├─ 12-postgres-service.yaml         # ClusterIP, port 5432
├─ 20-redis-statefulset.yaml        # 1 replica, image redis:7-alpine, PVC 1Gi, --appendonly yes
├─ 21-redis-service.yaml            # ClusterIP, port 6379
├─ 30-app-secret.yaml               # template — ANTHROPIC_API_KEY, META_*, STRIPE_*, AUTH_SECRET, DB connection (referencja do postgres-secret)
├─ 31-app-configmap.yaml            # NODE_ENV=production, AI_PROVIDER, RATE_LIMIT_BACKEND=redis, REDIS_URL, APP_BASE_URL, AUTH_URL
├─ 32-app-migrate-job.yaml          # one-shot Job: prisma migrate deploy
├─ 33-app-deployment.yaml           # 2 replicas (HA), image docker.io/<user>/hotel-bot:tag, envFrom secret+configmap, probes, resources, securityContext (non-root, readOnlyRootFilesystem=false bo .next cache)
├─ 34-app-service.yaml              # ClusterIP, port 80→3000
├─ 35-app-ingress.yaml              # Traefik IngressRoute albo standardowy Ingress; TLS przez cert-manager (issuer letsencrypt-prod)
├─ 36-app-hpa.yaml                  # opcjonalny HPA min=2 max=4 cpu=70%
└─ 99-prisma-seed-job.yaml          # one-shot Job: tsx prisma/seed.ts (aplikuj raz po pierwszej migracji)
```

**Kluczowe detale w `33-app-deployment.yaml`:**
- `replicas: 2` (po dorobieniu Redis rate limit jest bezpieczne)
- `strategy.rollingUpdate: maxUnavailable: 0, maxSurge: 1`
- `terminationGracePeriodSeconds: 30` (synchronizuje z SIGTERM handlerem F5)
- `livenessProbe` → `/api/health`, `readinessProbe` → `/api/ready`
- `resources.requests: { cpu: 200m, memory: 256Mi }`, `limits: { cpu: 1, memory: 512Mi }`
- `securityContext.runAsNonRoot: true, runAsUser: 1001`
- `imagePullSecrets`: jeśli obraz na Docker Hub jako private → secret `dockerhub-pull` z `kubernetes.io/dockerconfigjson`. Dla public obraz secret nie potrzebny.

**Ingress (Traefik na k3s):**
```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  ingressClassName: traefik
  tls:
    - hosts: [hotel-bot.twoja-domena.pl]
      secretName: hotel-bot-tls
  rules:
    - host: hotel-bot.twoja-domena.pl
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: hotel-bot, port: { number: 80 } }
```
Wymaga: cert-manager zainstalowany w klastrze (`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml`) + `ClusterIssuer` letsencrypt-prod (osobny `deploy/k8s/cluster/cert-manager-issuer.yaml`).

### `azure-pipelines.yml`

```yaml
trigger:
  branches: { include: [main] }
  paths: { include: [React/01_hotel_whatsapp_bot/*] }

pool: { vmImage: ubuntu-latest }

variables:
  - group: hotel-bot-secrets   # zmienna DOCKERHUB_TOKEN
  - name: imageRepo
    value: docker.io/<user>/hotel-bot
  - name: workdir
    value: React/01_hotel_whatsapp_bot

stages:
  - stage: Test
    jobs:
      - job: lint_typecheck_test
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.18.0' }
          - script: npm ci
            workingDirectory: $(workdir)
          - script: npx prisma generate
            workingDirectory: $(workdir)
          - script: npm run lint
            workingDirectory: $(workdir)
          - script: npm run type-check
            workingDirectory: $(workdir)
          - script: npm test
            workingDirectory: $(workdir)
            env: { DATABASE_URL: 'file:./test.db', AI_PROVIDER: claude, ANTHROPIC_API_KEY: dummy, OPENAI_API_KEY: dummy, META_WHATSAPP_PHONE_NUMBER_ID: dummy, META_WHATSAPP_ACCESS_TOKEN: dummy, META_WHATSAPP_APP_SECRET: dummy, META_WHATSAPP_VERIFY_TOKEN: dummy, STRIPE_SECRET_KEY: dummy, STRIPE_WEBHOOK_SECRET: dummy, AUTH_SECRET: '0123456789abcdef0123456789abcdef', APP_BASE_URL: 'http://localhost:3000', NODE_ENV: test }

  - stage: BuildPush
    dependsOn: Test
    condition: succeeded()
    jobs:
      - job: docker
        steps:
          - task: Docker@2
            inputs:
              command: login
              containerRegistry: dockerhub-service-connection   # service connection w Azure DevOps → Project Settings
          - task: Docker@2
            inputs:
              command: buildAndPush
              repository: <user>/hotel-bot
              dockerfile: $(workdir)/Dockerfile
              buildContext: $(workdir)
              tags: |
                $(Build.SourceVersion)
                latest
```

Deploy na k3s **manualnie** z hosta (Azure DevOps nie ma dostępu do prywatnego klastra):
```
kubectl set image -n hotel-bot deploy/hotel-bot app=docker.io/<user>/hotel-bot:<commit-sha>
kubectl rollout status -n hotel-bot deploy/hotel-bot
```

## Krytyczne pliki do modyfikacji / utworzenia

**Modyfikacje (kod aplikacji):**
- `src/app/api/whatsapp/webhook/route.ts` — fix import `after()` (F1)
- `src/logging/logger.ts` — conditional pino-pretty + custom err serializer (F2, F4)
- `src/whatsapp/webhookHandler.ts` (i wszystkie inne `logger.*` calle) — `maskPhone`/`maskEmail` przy logowaniu PII (F3)
- `src/security/rateLimit.ts` → split do `src/security/rateLimit/` (Redis backend)
- `src/config/env.ts` — dodać `RATE_LIMIT_BACKEND`, `REDIS_URL`, `AUTH_URL`
- `prisma/schema.prisma` — provider postgresql
- `next.config.ts` — `output: "standalone"`
- `package.json` — `engines.node: "20.x"` + dependency `ioredis`
- `.env.example` — dodać `AUTH_SECRET`, `AUTH_URL`, `RATE_LIMIT_BACKEND`, `REDIS_URL`
- `.gitignore` — upewnić się że `.env` jest

**Nowe pliki (kod):**
- `instrumentation.ts` (root)
- `src/lifecycle/shutdown.ts` (F5)
- `src/redis.ts` (klient ioredis)
- `src/security/rateLimit/redisTokenBucket.ts` + `.test.ts`
- `src/app/api/health/route.ts`
- `src/app/api/ready/route.ts`
- `.nvmrc`

**Nowe pliki (deployment):**
- `Dockerfile`, `.dockerignore`
- `deploy/k8s/*.yaml` (lista wyżej)
- `deploy/k8s/cluster/cert-manager-issuer.yaml`
- `azure-pipelines.yml`
- `deploy/README.md` — runbook: build/push, kubectl apply, rollout, troubleshooting

## Weryfikacja end-to-end

1. **Lokalnie (dev parity):**
   ```
   docker compose up postgres redis            # tymczasowy compose tylko do dev
   DATABASE_URL=postgresql://... npm run build
   DATABASE_URL=postgresql://... npm start
   ```
   Wszystkie testy `npm test` zielone (29+ z nowych Redis token bucket).

2. **Build obrazu:**
   ```
   docker build -t docker.io/<user>/hotel-bot:dev React/01_hotel_whatsapp_bot
   docker run --rm -p 3000:3000 --env-file .env.prod docker.io/<user>/hotel-bot:dev
   curl localhost:3000/api/health   # 200 ok
   curl localhost:3000/api/ready    # 503 jeśli postgres/redis nieosiągalne
   ```

3. **Deploy na k3s:**
   ```
   kubectl apply -f deploy/k8s/00-namespace.yaml
   kubectl apply -f deploy/k8s/10-postgres-secret.yaml -f deploy/k8s/11-postgres-statefulset.yaml -f deploy/k8s/12-postgres-service.yaml
   kubectl apply -f deploy/k8s/20-redis-statefulset.yaml -f deploy/k8s/21-redis-service.yaml
   # czekaj aż Postgres ma status Ready
   kubectl apply -f deploy/k8s/30-app-secret.yaml -f deploy/k8s/31-app-configmap.yaml
   kubectl apply -f deploy/k8s/32-app-migrate-job.yaml      # czekaj na completion
   kubectl apply -f deploy/k8s/99-prisma-seed-job.yaml      # raz, pierwszy raz
   kubectl apply -f deploy/k8s/33-app-deployment.yaml -f deploy/k8s/34-app-service.yaml -f deploy/k8s/35-app-ingress.yaml
   kubectl rollout status -n hotel-bot deploy/hotel-bot
   curl https://hotel-bot.twoja-domena.pl/api/health
   ```

4. **Pełny test manualny** wg tabeli "Manualny test E2E" wyżej. Zaliczone gdy:
   - WhatsApp dialog kończy się "RES-... CONFIRMED"
   - Postgres `Reservation.status = CONFIRMED`
   - admin panel pokazuje konwersację z PII zamaskowanym w UI ale pełnym w `Conversation` row
   - logi w `kubectl logs` w JSON, z `correlationId`, **bez surowych numerów telefonów**, bez stack tracek poza polem `code`+`message`
   - Rolling update: `kubectl rollout restart deploy/hotel-bot` → 0 zerwanych connection (graceful shutdown działa, readiness wyłącza pod przed SIGTERM)

5. **Smoke-y bezpieczeństwa** (sekcja "Smoke negatywny" wyżej): 401 dla niepodpisanego webhooka, idempotency dla duplikatu, rate limit dla 11+ wiadomości w 60s, redirect/401 dla `/admin` bez sesji.

## Świadomie poza zakresem (nie robimy teraz)

- OpenTelemetry / metryki Prometheus (logi structured wystarczą do MVP; metryki to iteracja 2)
- Multi-region / HA Postgres (CloudNativePG operator) — single-node k3s nie potrzebuje
- MFA dla admin panelu
- Wielojęzyczność (FR jest w briefie i wystarczy)
- Channel manager integration (Cloudbeds/Mews)
- Backup automation Postgres → S3/MinIO (warto dorobić, ale nie blokuje produkcji)
