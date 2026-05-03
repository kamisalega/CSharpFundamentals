# Plan — WhatsApp Hotel Booking Bot (Next.js + MUI + AI, TDD + Security-first)

## Context

Klient (hotelarz) potrzebuje konwersacyjnego bota na WhatsApp, który prowadzi gościa przez cały proces rezerwacji: od powitania, przez sprawdzenie dostępności i prezentację pokoi, po zebranie danych, link płatności i potwierdzenie. Brief (`whatsapp_booking_bot.md`) wymienia też obsługę FAQ, zmianę/anulację rezerwacji po rozpoznaniu numeru telefonu oraz przekazanie konwersacji do człowieka.

Cel MVP: **Next.js 15 (App Router) + React 19 + MUI v6 + TypeScript strict**, integracja z **WhatsApp Cloud API (Meta developer platform)**, pluggable warstwą AI (Claude + OpenAI za adapterem), mockowanym silnikiem rezerwacji na **Prisma + SQLite** oraz minimalnym admin panelem dla recepcji.

**Tryb pracy:** użytkownik pisze kod samodzielnie, Claude proponuje kod i wyjaśnia krok po kroku w roli nauczyciela.

**Filary jakości (nienegocjowalne):**
1. **TDD** — każda jednostka kodu produkcyjnego powstaje po czerwonym teście (Red → Green → Refactor).
2. **Security-first** — walidacja wejść, weryfikacja podpisów, brak sekretów w kliencie, defense-in-depth.
3. **Defensive coding** — strict TypeScript, Zod na granicach, timeouty, retry, structured errors, structured logging.

Projekt jest greenfield — katalog `React/` jest pusty.

## Stack i kluczowe decyzje

| Warstwa | Wybór |
|---|---|
| Framework | **Next.js 16.2+** (App Router, Turbopack default) + React 19.2 Canary + TypeScript **strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes** |
| UI | MUI v6 + Emotion + MUI X Date Pickers + `@mui/material-nextjs` (oficjalny AppRouterCacheProvider) |
| AI | Adapter `AiProvider` → `ClaudeProvider` (`@anthropic-ai/sdk`, `claude-sonnet-4-6`, prompt caching) + `OpenAiProvider` (`openai` SDK, function calling). Wybór via `AI_PROVIDER` env |
| Persystencja | Prisma + SQLite (plik `prisma/dev.db`); osobny plik `prisma/test.db` dla testów integracyjnych |
| WhatsApp | Meta Cloud API (Graph v21) |
| Płatności | Stripe Checkout (test mode) |
| Walidacja | **Zod** na każdej granicy (env, webhook, API route, response AI, tool-call) |
| Logowanie | **pino** + `pino-pretty` w dev, structured JSON w prod, correlation ID per request |
| Testy | **Vitest** (unit + integration), **@testing-library/react** (UI), **MSW** (mock HTTP), **Playwright** (e2e admin — opcjonalnie) |
| Rate limiting | `@upstash/ratelimit` z in-memory store dla dev (token bucket per phone) |
| Auth admin | **NextAuth (Credentials)** od początku — nawet MVP nie zostawia panelu otwartym |

## Architektura — przepływ wiadomości

```
WhatsApp (gość)
   └─► Meta Cloud API ──webhook──► /api/whatsapp/webhook
                                      │  [verify X-Hub-Signature-256]
                                      │  [idempotency on whatsappMessageId]
                                      │  [rate limit per phone]
                                      │  [respond 200 immediately]
                                      ▼  (async via after())
                        ConversationOrchestrator.handle(phone, text, correlationId)
                          ├─ loadConversation (state machine)
                          ├─ AiProvider.classifyIntent (tool use, timeout 10s)
                          ├─ dispatcher intencji
                          ├─ BookingService (transactional, idempotent)
                          ├─ AiProvider.generateReply (Zod-validated output)
                          └─ WhatsAppClient.sendText (retry z backoff)
```

State machine: `GREETING → COLLECT_DATES → SHOW_OFFERS → SELECT_ROOM → COLLECT_GUEST_INFO → OFFER_EXTRAS → SUMMARY → PAYMENT_SENT → CONFIRMED` + `MANAGE_EXISTING`, `HUMAN_HANDOFF`, `ERROR`.

## Zasady TDD

### Cykl pracy dla każdej jednostki

1. **Red** — napisz test opisujący zachowanie w języku biznesowym (`it("zwraca 3 oferty dla dat 12-15 sierpnia")`). Test musi się nie kompilować lub nie przechodzić.
2. **Green** — najprostszy kod, który zmienia test na zielony. Żadnej dekoracji.
3. **Refactor** — czyść kod przy zielonych testach. Tylko po wszystkich zielonych.
4. Commit na końcu każdej rundy (lub po 2-3 rundach w tej samej jednostce).

### Piramida testów

| Poziom | Narzędzie | Co testuje | Przykład |
|---|---|---|---|
| **Unit** | Vitest | Czyste funkcje, logika domenowa | `pricing.calculateTotal(3 noce, breakfast, 2 osoby)` |
| **Integration** | Vitest + SQLite + MSW | Service + DB + zewnętrzne API (zamockowane) | `BookingService.confirm()` z transakcją Prisma |
| **Contract** | Vitest + fixtures Meta/Stripe | Parsowanie prawdziwych payloadów | `webhookSchema.parse(metaFixture)` |
| **API route** | Vitest + `node-mocks-http` lub `next/testing` | Handlery `route.ts` end-to-end | webhook: nieprawidłowy podpis → 401 |
| **UI** | Testing Library + jsdom | Komponenty React | Transkrypt renderuje wiadomości w kolejności |
| **E2E (opcjonalnie)** | Playwright | Admin panel w przeglądarce | Login + takeover konwersacji |

### Konwencje

- Pliki testów: `*.test.ts` / `*.test.tsx` obok kodu (colocated), plus `tests/` tylko na cross-cutting i fixtures.
- Nazwy: `describe("BookingService.quote", ...)` + `it("oblicza 360€ dla 3 nocy po 120€")` — po polsku, opisowo.
- **AAA** (Arrange-Act-Assert) w każdym teście, z pustymi liniami jako separatorami.
- **Fixture-builder pattern** zamiast `JSON.stringify` dużych obiektów: `aMetaWebhook().withText("Bonjour").build()`.
- `beforeEach` resetuje test DB (truncate + seed) — testy integracyjne są niezależne.
- **No mocks w unit testach własnego kodu** — jeśli coś trzeba mockować, to znak, że to ma być test integracyjny.
- Pokrycie: docelowo 80% gałęzi w warstwie domenowej (`src/booking`, `src/conversation`), 60% w adapterach.
- `npm test` uruchamia unit + integration; `npm run test:watch` w dev.

### Test doubles

- **MSW** dla Anthropic/OpenAI/Meta/Stripe HTTP — realistyczne fixtures, przechwytywane na poziomie `fetch`.
- **Prisma w testach integracyjnych** — prawdziwa baza (`file:./test.db`), nie `jest-mock`.
- **`FakeClock`** (vi.useFakeTimers) dla testów z czasem (wygasanie linku płatności).

### Debugowanie testów (VS Code)

Gdy test się sypie w nieoczywisty sposób i `console.log` nie wystarcza, używamy VS Code debuggera. Kolejność narzędzi od lekkich do ciężkich:

1. **`test:watch` + `console.log`** — 90% przypadków.
2. **`it.only(...)` / `describe.only(...)`** — izolacja jednego testu. CLI: `npx vitest run -t "fragment nazwy"`.
3. **Rozszerzenie VS Code "Vitest"** (autor: Vitest team) — przyciski Run/Debug nad każdym `it`, drzewo testów w panelu Testing, inline dot indicators. Zero configu po instalacji.
4. **JavaScript Debug Terminal** (`Ctrl+Shift+P` → "Debug: JavaScript Debug Terminal") — wpisz `npx vitest run <plik>`, VS Code auto-attachuje debugger. Breakpoint stawiasz klikiem po lewej od numeru linii.
5. **`.vscode/launch.json`** — trwała konfiguracja, gdy trzeba debugger pod `F5`.

Stwórz `.vscode/launch.json` **dopiero gdy** punkty 1-4 są niewystarczające (np. złożony test integracyjny orchestratora w kroku 5-6):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Vitest: bieżący plik",
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "smartStep": true,
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Vitest: wszystkie testy",
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run"],
      "smartStep": true,
      "console": "integratedTerminal"
    }
  ]
}
```

**Higiena:** `.only` nigdy nie trafia do commita — dodać do code-review checklisty. ESLint plugin `eslint-plugin-vitest` ma regułę `no-focused-tests` którą można włączyć żeby CI odpalał alarm.

## Bezpieczeństwo

### Weryfikacja webhooków

- **Meta**: `X-Hub-Signature-256` = `HMAC-SHA256(META_WHATSAPP_APP_SECRET, rawBody)`. Porównanie **timing-safe** (`crypto.timingSafeEqual`). Przechowujemy raw body przed parsowaniem JSON.
- **Stripe**: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` — robi timing-safe comparison i weryfikację timestampu (tolerancja 5 min).
- Odrzucone webhooki → log `warn` + 401, bez szczegółów w odpowiedzi (enumeration resistance).

### Idempotency i replay protection

- `Message.whatsappMessageId` — **unique index**. Duplikat → no-op + 200 OK.
- Stripe: zapis `event.id` do tabeli `ProcessedWebhookEvent` przed wykonaniem efektu; duplikat → 200 OK bez efektu.
- `BookingService.confirm` idempotentne po `reservationCode`.

### Rate limiting

- Webhook WhatsApp: **10 msg / 60s per phone** (token bucket). Nadmiar → drop + metryka (nie odpowiadamy użytkownikowi, żeby nie kosztować).
- Admin API: **60 req / 60s per session**.
- Implementacja: `@upstash/ratelimit` (w dev in-memory adapter, w prod Redis).

### Walidacja wejść

- **Zod na każdej granicy**: env (`src/config/env.ts` parsuje `process.env` przy starcie — failfast), webhook body, API request body, response z AI providera (schema tool arguments).
- Max rozmiar body dla webhooków: **100 KB** (Next.js route config).
- Sanityzacja wiadomości przed wrzuceniem do AI: strip znaków kontrolnych, limit 4000 znaków.

### Defense przed prompt injection

- **Separacja ról**: user input NIGDY nie trafia do `system` promptu. Zawsze jako `user` message z jasnym obramowaniem:
  ```
  <user_message>
  {{raw input}}
  </user_message>
  ```
- **Output validation**: odpowiedź AI musi pasować do Zod schema (np. `IntentResponse`). Niepasująca → fallback na `unknown` intent, log `warn`.
- **Allowlista toolcalls**: AI może wołać tylko jawnie zarejestrowane narzędzia; argumenty parsowane przez Zod, odrzucenie poza zakresem.
- **No URL injection**: linki płatności generujemy my (Stripe), AI może tylko dostać instrukcję "wyślij link" — nigdy nie generuje URL-a.
- **Logi konwersacji** nie są reinjektowane do promptu bez filtrowania — wycinamy znaczniki `<system>`, `[INST]`, etc.

### Sekrety i konfiguracja

- Sekrety **tylko po stronie serwera**. Żadnej zmiennej `NEXT_PUBLIC_*` z kluczem.
- `src/config/env.ts` — Zod schema, `env.ANTHROPIC_API_KEY` zamiast `process.env.ANTHROPIC_API_KEY` w kodzie. Brak klucza = crash przy starcie.
- `.env.local` w `.gitignore`, `.env.example` bez wartości.
- Rotacja: dokumentacja w README jakie klucze rotować i gdzie.

### Nagłówki bezpieczeństwa (middleware / next.config)

- `Content-Security-Policy` (strict, bez `unsafe-inline` — MUI wymaga nonce, dokumentacja MUI ma gotowy guide)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### Uwierzytelnianie admin panelu

- **NextAuth v5** + Credentials provider + bcrypt hash w tabeli `AdminUser` (seed konto `admin/admin` tylko w dev).
- Middleware na `/admin/*` i `/api/admin/*` — brak sesji → redirect.
- Hasła: bcrypt cost 12, walidacja siły (zod.refine).
- Sesje: JWT z `HttpOnly`, `Secure`, `SameSite=Lax`.

### PII i logowanie

- **Phone/email maskowane w logach**: `+33 6** ** ** 78`, `m****@email.com`. Helper `maskPII()`.
- Pełne dane tylko w tabelach Prisma, dostępne przez admin panel (uwierzytelniony).
- Nie logujemy pełnej treści odpowiedzi AI w prod (tylko intent + long-hash).
- Correlation ID w każdym logu (`requestId: uuid()`).

### SQL i ORM

- **Tylko Prisma**. Raw queries zabronione, wyjątkiem są transakcje z `$queryRaw` — wtedy **tylko** z parameterized input.
- Unique constraint na `(roomId, date)` w tabeli `RoomNight` — anti-double-booking na poziomie DB.

## Defensive coding

### TypeScript

- `tsconfig.json`:
  ```json
  {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
  ```
- **Zero `any`**. `unknown` + Zod, gdy nie znamy kształtu.
- **Zero `as` castów** poza testami (gdzie potrzeba narrow dla fixtures).
- ESLint z `@typescript-eslint/strict` + `eslint-plugin-security`.

### Error handling

- **Result pattern** w warstwie domenowej: `Result<T, DomainError>` (neverthrow lub własny). Nie rzucamy błędów domenowych — zwracamy `err(...)`.
- Błędy zewnętrzne (fetch, Prisma) zamykamy w `Result` na granicy adaptera.
- **Własne klasy błędów** z kodami: `RoomUnavailableError`, `InvalidDatesError`, `AiTimeoutError`. Każda z `code`, `userMessage` (po francusku), `logMessage`.
- **Global error boundary** w API routes: wrapper `withApiHandler` → łapie, loguje z correlationId, odpowiada bez wycieków stack trace.

### Timeouty i retry

- **Wszystkie `fetch`** mają `AbortController` z timeoutem:
  - AI calls: 10s
  - Meta WhatsApp send: 5s
  - Stripe: 8s
- **Retry z exponential backoff** (p-retry lub własny) tylko dla idempotentnych operacji:
  - `WhatsAppClient.sendText`: 3 próby (500ms, 1.5s, 4.5s)
  - AI providers: 2 próby
- **Circuit breaker** na AiProvider (`opossum`): 5 fails w 30s → open na 60s → fallback "chwilowy problem techniczny, proszę spróbować za chwilę".

### Zod przy granicach

- `env.ts` — parsowanie `process.env` przy starcie, failfast.
- `webhookSchema.ts` — Meta payload, 100+ opcjonalnych pól, ale my walidujemy tylko to, czego używamy (principle of least knowledge).
- **AI response schema** — każdy `classifyIntent` / tool-call ma Zod schema; niezgodność → `AiResponseValidationError`.

### Invarianty i guards

- Guard clauses zamiast zagnieżdżania: `if (!conversation) return err(...)`, potem happy path.
- **Never nulls for collections** — zawsze `[]`, nigdy `null`/`undefined`.
- Asercje biznesowe w krytycznych miejscach: `assert(reservation.total > 0, 'invariant: reservation.total must be positive')`.
- Readonly wszędzie gdzie możliwe: `readonly Room[]`, `as const` dla enumów.

### Structured logging

- **pino** + correlationId propagowane przez `AsyncLocalStorage`.
- Log levels: `error` (błąd do ogarnięcia), `warn` (nietypowe ale spodziewane, np. invalid signature), `info` (biznesowe zdarzenia), `debug` (tylko dev).
- Każdy log ma: `timestamp`, `level`, `correlationId`, `event`, `context` (obiekt, maskowane PII).

### Graceful degradation

- AI down → statyczna odpowiedź + propozycja handoffu.
- DB read replica fail (N/A dla SQLite, ale pattern zachowany) → fallback.
- Meta API down → kolejka retry (tabela `OutboxMessage`), w MVP najprościej: log + alert.

## Struktura katalogów

```
React/hotel-whatsapp-bot/
├─ src/
│  ├─ app/
│  │  ├─ (admin)/
│  │  │  ├─ layout.tsx
│  │  │  ├─ conversations/page.tsx
│  │  │  ├─ conversations/[id]/page.tsx
│  │  │  └─ reservations/page.tsx
│  │  ├─ api/
│  │  │  ├─ whatsapp/webhook/route.ts         # + route.test.ts
│  │  │  ├─ stripe/webhook/route.ts           # + route.test.ts
│  │  │  ├─ admin/conversations/route.ts
│  │  │  └─ admin/handoff/route.ts
│  │  ├─ layout.tsx                           # AppRouterCacheProvider + CSP nonce
│  │  └─ page.tsx
│  ├─ ai/
│  │  ├─ AiProvider.ts                        # interfejs + typy
│  │  ├─ ClaudeProvider.ts                    # + ClaudeProvider.test.ts (MSW)
│  │  ├─ OpenAiProvider.ts                    # + OpenAiProvider.test.ts (MSW)
│  │  ├─ schemas.ts                           # Zod dla intent/tool responses
│  │  ├─ prompts/system.ts
│  │  └─ tools.ts
│  ├─ booking/
│  │  ├─ BookingService.ts                    # + BookingService.test.ts (integration + SQLite)
│  │  ├─ pricing.ts                           # + pricing.test.ts (unit)
│  │  ├─ availability.ts                      # + availability.test.ts
│  │  └─ errors.ts                            # RoomUnavailableError, etc.
│  ├─ conversation/
│  │  ├─ Orchestrator.ts                      # + Orchestrator.test.ts (integration)
│  │  ├─ stateMachine.ts                      # + stateMachine.test.ts (unit)
│  │  └─ handoff.ts
│  ├─ whatsapp/
│  │  ├─ WhatsAppClient.ts                    # + WhatsAppClient.test.ts (MSW)
│  │  ├─ webhookSchema.ts                     # + webhookSchema.test.ts (fixtures)
│  │  └─ signature.ts                         # + signature.test.ts (timing-safe)
│  ├─ payments/
│  │  ├─ StripeService.ts                     # + StripeService.test.ts
│  │  └─ webhookSchema.ts
│  ├─ security/
│  │  ├─ rateLimit.ts                         # + rateLimit.test.ts
│  │  ├─ maskPII.ts                           # + maskPII.test.ts
│  │  └─ withApiHandler.ts                    # global wrapper
│  ├─ config/
│  │  └─ env.ts                               # Zod parse process.env
│  ├─ logging/
│  │  ├─ logger.ts                            # pino
│  │  └─ correlationId.ts                     # AsyncLocalStorage
│  ├─ db/
│  │  └─ prisma.ts
│  └─ shared/
│     ├─ result.ts                            # Result<T, E>
│     └─ errors.ts                            # DomainError base
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts
│  └─ test-seed.ts
├─ tests/
│  ├─ fixtures/
│  │  ├─ meta-webhook.ts                      # fixture-builder
│  │  ├─ stripe-webhook.ts
│  │  └─ ai-responses.ts
│  ├─ msw/
│  │  ├─ handlers.ts                          # default success handlers
│  │  └─ server.ts                            # setupServer
│  ├─ helpers/
│  │  ├─ testDb.ts                            # reset + seed test DB
│  │  └─ withCorrelationId.ts
│  └─ e2e/                                    # Playwright (opcjonalnie)
├─ vitest.config.ts
├─ vitest.setup.ts                            # MSW setup, test DB reset
├─ .env.example
├─ proxy.ts                              # NextAuth + security headers
└─ next.config.ts                             # security headers + CSP
```

## Model danych (Prisma)

Modele zostają jak wcześniej (`Room`, `RatePlan`, `Conversation`, `Message`, `Reservation`, `PaymentLink`), plus:

- `AdminUser` — id, email, passwordHash, createdAt.
- `ProcessedWebhookEvent` — id, source (enum: META/STRIPE), externalId (unique), processedAt.
- `RoomNight` — roomId, date (date), reservationId nullable, unique(roomId, date). Gwarantuje brak double-booking.
- `OutboxMessage` — id, conversationId, payload, attempts, nextRetryAt, status — dla gracefull retry WhatsApp send.

## Kolejność implementacji (TDD, fail-first)

Każdy krok zaczyna się od testu. Commit dopiero po "Green + Refactor".

### Krok 1 — Bootstrap i fundament testowy

Cel: działa `npm test` z co najmniej jednym czerwono-zielonym testem, MUI SSR renderuje, Prisma ma migrację, env jest walidowane.

**1.1 Projekt Next.js + zależności**

```bash
npx create-next-app@latest hotel-whatsapp-bot --typescript --app --src-dir --eslint --no-tailwind --import-alias "@/*"
cd hotel-whatsapp-bot

# UI
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled @emotion/cache @mui/material-nextjs @mui/x-date-pickers dayjs

# Domain + validation + logging
npm install @prisma/client zod pino pino-pretty neverthrow

# AI + integracje
npm install @anthropic-ai/sdk openai stripe

# Auth + security
npm install next-auth@beta bcrypt @upstash/ratelimit

# Testy
npm install -D prisma tsx vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @types/bcrypt

# Lint
npm install -D eslint-plugin-security
```

Projekt **JUŻ UTWORZONY** w `React/01_hotel_whatsapp_bot` — Next.js 16.2.3 + React 19.2.4.

**Breaking changes Next 16 istotne dla naszego planu:**
- `middleware.ts` → `proxy.ts` (nazwa pliku i funkcji; runtime tylko `nodejs`)
- Turbopack domyślny (dla `next dev` i `next build`)
- Async Request APIs: `cookies()`, `headers()`, `params`, `searchParams` są **zawsze** `Promise` — trzeba `await`
- `next lint` usunięte — ESLint bezpośrednio przez `eslint.config.mjs` (już jest, flat config)
- React 19.2 Canary: nowe API (`useEffectEvent`, `<ViewTransition>`, `<Activity>`)

**1.2 Strict TypeScript**

Nadpisać `tsconfig.json` flagami z sekcji "Defensive coding > TypeScript".

**1.3 Konfiguracja testów (przed jakąkolwiek logiką biznesową!)**

- `vitest.config.ts` — environment `node` dla unit/integration, `jsdom` dla UI. Ścieżki `src/**/*.test.ts`.
- `vitest.setup.ts` — MSW `beforeAll/afterAll/afterEach`, reset test DB przed każdym testem integracyjnym.
- `tests/helpers/testDb.ts` — funkcje `resetTestDb()`, `seedTestDb()`.
- Skrypty w `package.json`: `"test"`, `"test:watch"`, `"test:coverage"`.

**1.4 Zod env config + Result/Error fundamenty**

TDD:
- `src/config/env.test.ts` — czerwony test: "parseEnv rzuca przy braku ANTHROPIC_API_KEY" → implementacja `src/config/env.ts`.
- `src/shared/result.test.ts` (jeśli piszemy własny Result; jeśli używamy `neverthrow` — pomijamy).
- `src/security/maskPII.test.ts` → implementacja `maskPII.ts` (maska phone + email).

**1.5 MUI ThemeRegistry (SSR)**

- `src/app/theme.ts` — paleta WhatsApp-like (`#25D366`).
- `src/app/layout.tsx` — `AppRouterCacheProvider` z `@mui/material-nextjs/v15-appRouter` + `ThemeProvider` + `CssBaseline`.
- Test: `src/app/page.test.tsx` (Testing Library + jsdom) — renderuje `<Typography>` z MUI, brak hydration warning.

**1.6 Prisma init + schema + seed**

```bash
npx prisma init --datasource-provider sqlite
```

- `prisma/schema.prisma` — wszystkie modele z sekcji "Model danych" + unique constraints + RoomNight + AdminUser.
- `npx prisma migrate dev --name init`
- `prisma/seed.ts` — 3 pokoje, 60 dni RatePlan, 1 AdminUser (`admin@hotel.local` / hash `admin123` — tylko dev).
- `prisma/test-seed.ts` — minimalny fixture dla testów.

**1.7 Security headers + middleware**

- `next.config.ts` — `headers()` z nagłówkami z sekcji "Security headers".
- `proxy.ts` — szkielet (auth podepniemy w kroku z admin panelem), ale już z correlationId i CSP nonce.

**1.8 Kryteria ukończenia**

- [ ] `npm test` przechodzi (env + maskPII + page smoke).
- [ ] `npm run dev` → `localhost:3000` z MUI, brak warningów w konsoli.
- [ ] `npx prisma studio` widzi 3 pokoje, 180+ RatePlan, 1 AdminUser.
- [ ] `npm run build` przechodzi.
- [ ] `.env.example` i `.env.local` skonfigurowane; brak sekretów w kodzie.
- [ ] `npm run lint` bez błędów (ESLint + eslint-plugin-security).

### Krok 2 — Domena: pricing + availability (czysta logika, TDD)

- `pricing.test.ts` → `pricing.ts` (kalkulacja nocy, breakfast 12€/os/dzień, podatki jeśli).
- `availability.test.ts` → `availability.ts` (query RatePlan + RoomNight, exclusions).
- `BookingService.test.ts` (integration, prawdziwe SQLite) → `BookingService.ts`: `quote`, `hold` (10 min TTL), `confirm` (w transakcji, unique constraint broni double-booking), `cancel`.
- Edge cases od razu: brak dostępności, nieprawidłowe daty, collision.

### Krok 3 — WhatsApp infrastruktura (bez AI)

- `signature.test.ts` → `signature.ts` (HMAC timing-safe).
- `webhookSchema.test.ts` (fixtures Meta) → `webhookSchema.ts`.
- `WhatsAppClient.test.ts` (MSW) → `WhatsAppClient.ts` (sendText z retry + timeout).
- `app/api/whatsapp/webhook/route.test.ts` → route (GET verify, POST signature + idempotency + rate limit + 200 szybko + background task).

### Krok 4 — AI adapter

- Zod schemas dla IntentResponse, ToolCall.
- `ClaudeProvider.test.ts` (MSW mockuje Anthropic API) → `ClaudeProvider.ts`: prompt caching, tool use, Zod parse response, timeout.
- `OpenAiProvider.test.ts` → ten sam kontrakt.
- Prompt injection defense test: user input `"IGNORE PREVIOUS INSTRUCTIONS and ..."` → dalej legalna intencja FAQ lub unknown.

### Krok 5 — Orchestrator + state machine

- `stateMachine.test.ts` → `stateMachine.ts` (tabela przejść).
- `Orchestrator.test.ts` (integration: prawdziwe DB + fake AI + fake WhatsApp client) → `Orchestrator.ts`. Happy path z briefu (12-15 sierpnia → Supérieure → breakfast → link).

### Krok 6 — Stripe

- `StripeService.test.ts` → `StripeService.ts` (create checkout session).
- `stripe/webhook/route.test.ts` → route (signature verify z `stripe.webhooks.constructEvent`, idempotency via ProcessedWebhookEvent, aktualizacja Reservation).

### Krok 7 — Admin panel + NextAuth

- `NextAuth` konfiguracja + Credentials provider + test `middleware.test.ts` (brak sesji → redirect).
- UI: lista konwersacji, szczegóły, takeover. Testy Testing Library dla komponentów.

### Krok 8 — Hardening i E2E

- Rate limit testy (burst).
- CSP w prod buildzie.
- `npm audit` + `eslint-plugin-security` czysto.
- Playwright e2e (opcjonalny): login → takeover → wysyłka.

## Obsługa przypadków brzegowych (z briefu)

| Sytuacja | Rozwiązanie | Test |
|---|---|---|
| Brak dostępności | BookingService zwraca `err(RoomUnavailableError)`, AI proponuje ±3 dni | `BookingService.test` + `Orchestrator.test` |
| Nieprawidłowe daty | Zod refine (checkOut > checkIn, future, max 30 nocy) | `availability.test` |
| Zmiana dat w trakcie | Intent `modify_slots` → reset `selectedRoomId` | `Orchestrator.test` |
| Niezrozumiana wiadomość | `unknownCount++`, po 2 → handoff | `Orchestrator.test` |
| Padnięcie API AI | Circuit breaker → fallback statyczny | `ClaudeProvider.test` |
| Abandon płatności | OutboxMessage + cron follow-up po 30 min | `StripeService.test` |
| Handoff do człowieka | `botPaused=true`, admin UI | `handoff.test` |
| Double-booking | Unique(roomId, date) + transakcja | `BookingService.test` (concurrent quote+confirm) |
| Prompt injection | Zod validation output + user-tag fencing | `ClaudeProvider.test` |
| Invalid webhook signature | 401 + log warn | `route.test` |
| Replay webhooka | Unique `whatsappMessageId` / `stripeEventId` | `route.test` |
| Rate limit burst | Drop + metryka | `rateLimit.test` |

## Weryfikacja end-to-end

1. `npm test` — wszystkie testy zielone, coverage ≥ 80% w `src/booking` i `src/conversation`.
2. `npm run build` + `npm run lint` — bez błędów, `eslint-plugin-security` czysto.
3. `npx prisma migrate dev && npx prisma db seed`.
4. `npm run dev` → `ngrok http 3000`.
5. Meta for Developers → WhatsApp → Configuration → callback URL + verify token.
6. Test manualny: *"Bonjour, je voudrais réserver une chambre du 12 au 15 août pour 2 adultes"* → cały flow → `RES-...`.
7. Admin (`/admin`, login `admin@hotel.local`) → lista + transkrypt + takeover.
8. Stripe test card `4242 4242 4242 4242` → webhook → status CONFIRMED.
9. Smoke security: webhook z nieprawidłowym podpisem → 401 w logu.

## Zakres poza MVP (świadomie pomijamy)

- Integracja z realnym channel managerem (Cloudbeds/Mews).
- Wielojęzyczność poza FR.
- MFA dla admin panelu.
- Distributed rate limiting (Redis prod) — w dev in-memory wystarczy.
- Media (zdjęcia pokoi w WhatsApp).
- Observability stack (OpenTelemetry) — mamy structured logs, metryki w iteracji 2.
