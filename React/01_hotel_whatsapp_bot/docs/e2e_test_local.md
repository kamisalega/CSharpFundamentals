# Manualny test E2E — lokalne środowisko (ngrok + npm run dev)

## Cel

Przejście pełnego scenariusza: wiadomość WhatsApp → webhook → konwersacja z botem → link Stripe → potwierdzona rezerwacja.
Debugger VS Code pozwala zatrzymać się w kodzie i sprawdzić co dokładnie przychodzi z Meta WhatsApp Business API.

---

## 1. Wymagania wstępne

- Node.js 20.x (`node --version` → `v20.x.x`)
- Docker Desktop uruchomiony
- ngrok zainstalowany: https://ngrok.com/download — po instalacji `ngrok version`
- Konto Meta Developers z aplikacją WhatsApp (typ Business)
- Konto Stripe (tryb Test) + Stripe CLI
- Klucze API wpisane w `.env.local` (patrz sekcja 2)

---

## 2. Konfiguracja `.env.local`

Skopiuj `.env.example` jako `.env.local` i uzupełnij pola:

```bash
cp .env.example .env.local
```

```env
NODE_ENV=development

# PostgreSQL z docker compose
DATABASE_URL=postgresql://hotel:hotel@localhost:5432/hotel_bot

# Rate limiting — memory wystarczy na lokalny test
RATE_LIMIT_BACKEND=memory
REDIS_URL=

# Claude API (console.anthropic.com → API Keys)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=placeholder

# Meta WhatsApp (developers.facebook.com → Twoja aplikacja → WhatsApp → API Setup)
META_WHATSAPP_PHONE_NUMBER_ID=<Phone number ID z panelu>
META_WHATSAPP_ACCESS_TOKEN=<Access token z panelu>
META_WHATSAPP_APP_SECRET=<App Secret z Settings → Basic>
META_WHATSAPP_VERIFY_TOKEN=<wymyślony losowy ciąg, np. wynik: openssl rand -hex 20>

# Stripe (dashboard.stripe.com → Developers → API Keys, Test mode)
STRIPE_SECRET_KEY=sk_test_...
# Stripe CLI poda lokalny whsec_ po uruchomieniu, patrz sekcja 5
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# NextAuth
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# APP_BASE_URL — uzupełnisz po uruchomieniu ngrok (sekcja 4)
APP_BASE_URL=https://REPLACE_WITH_NGROK_URL
```

> **Ważne:** `APP_BASE_URL` musisz zmienić za każdym razem gdy ngrok dostanie nowy URL (bezpłatna wersja losuje URL przy każdym starcie). Płatny plan ngrok pozwala ustawić stałą domenę.

---

## 3. Uruchomienie infrastruktury (PostgreSQL)

```bash
# Tylko postgres — redis nie jest potrzebny przy RATE_LIMIT_BACKEND=memory
docker compose up postgres -d

# Poczekaj aż zdrowy
docker compose ps
# postgres   running (healthy)
```

Migracja i seed (jednorazowo przy pierwszym uruchomieniu):

```bash
npx prisma migrate deploy
npx prisma db seed
```

Weryfikacja seed:

```bash
# Otwórz psql lub dowolny klient DB
# DATABASE_URL: postgresql://hotel:hotel@localhost:5432/hotel_bot

# 3 pokoje powinny być widoczne
SELECT id, name, "basePrice" FROM "Room";

# AdminUser do panelu admina
SELECT email FROM "AdminUser";
# → admin@hotel.local (hasło: Admin1234! lub zgodne z prisma/seed.ts)
```

---

## 4. Uruchomienie ngrok

```bash
ngrok http 3000
```

Ngrok wydrukuje coś w stylu:
```
Forwarding  https://a1b2-12-34-56-78.ngrok-free.app -> http://localhost:3000
```

**Skopiuj URL HTTPS** i zaktualizuj `.env.local`:
```env
APP_BASE_URL=https://a1b2-12-34-56-78.ngrok-free.app
```

Zostaw okno ngrok otwarte przez cały test.

---

## 5. Konfiguracja Stripe Webhook (dashboard + ngrok)

Stripe będzie wysyłał zdarzenia bezpośrednio przez ngrok — bez Stripe CLI.

### Krok 5.1 — Dodaj endpoint w Stripe Dashboard

1. Otwórz **dashboard.stripe.com → Developers → Webhooks** (upewnij się że jesteś w trybie **Test**)
2. Kliknij **"+ Add endpoint"**
3. **Endpoint URL:** `https://a1b2-12-34-56-78.ngrok-free.app/api/stripe/webhook`
   *(zastąp fragmentem z ngrok — ten sam URL co w `APP_BASE_URL`)*
4. **Listen to:** wybierz **"Events on your account"**
5. **Select events** — dodaj wszystkie cztery:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
6. Kliknij **"Add endpoint"**

### Krok 5.2 — Skopiuj Signing Secret

Po zapisaniu endpoint pojawi się na liście. Kliknij w niego, następnie:
- Sekcja **"Signing secret"** → kliknij **"Reveal"**
- Skopiuj wartość `whsec_...`

Wpisz w `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Zrestartuj serwer jeśli już działał (`Ctrl+C` → F5).

> **Uwaga przy zmianie URL ngrok:** gdy ngrok dostanie nowy URL (każdy restart bezpłatnej wersji),
> musisz zaktualizować endpoint w Stripe Dashboard — wejdź w endpoint → **"Update details"** → zmień URL.
> Signing secret pozostaje ten sam (nie trzeba go zmieniać).

---

## 6. Konfiguracja Meta Webhook

1. Przejdź do **developers.facebook.com → Twoja aplikacja → WhatsApp → Configuration → Webhook**
2. Kliknij **Edit** obok Webhook
3. **Callback URL:** `https://a1b2-12-34-56-78.ngrok-free.app/api/whatsapp/webhook`
4. **Verify token:** wartość `META_WHATSAPP_VERIFY_TOKEN` z `.env.local`
5. Kliknij **Verify and Save**
   - Meta wyśle GET z parametrem `hub.challenge`
   - Next.js musi już działać żeby weryfikacja przeszła (uruchom debugger PRZED kliknięciem Verify)
6. Po weryfikacji zaznacz webhook fields: **messages** (obowiązkowo), **message_status** (opcjonalnie)

---

## 7. Uruchomienie debuggera VS Code

### Krok 7.1 — Otwórz folder projektu w VS Code

```
File → Open Folder → wybierz: React/01_hotel_whatsapp_bot
```

> Ważne: otwórz **dokładnie ten folder** jako root workspace, nie folder nadrzędny.
> `${workspaceFolder}` w `launch.json` musi wskazywać na `01_hotel_whatsapp_bot/`.

### Krok 7.2 — Ustaw breakpointy

Ustaw breakpointy w następujących miejscach (kliknij na numer linii w VS Code):

**Plik: `src/app/api/whatsapp/webhook/route.ts`**
- Linia `export const POST = handlers.POST` → nie tu, przejdź niżej

**Plik: `src/whatsapp/webhookHandler.ts`**

| Linia | Co tu zobaczysz |
|-------|-----------------|
| 65 | Wejście do POST — `rawBody` = surowy JSON z Meta, `signature` = header HMAC |
| 71 | Po `verifyMetaSignature` — jeśli dojdziesz tu, podpis jest poprawny |
| 95 | Po `metaWebhookSchema.safeParse` — `parsedJson` zdekodowany payload |
| 109 | Po rate limit — `decision.allowed` powinno być `true` |
| 119 | Po idempotency — `isNew: true` dla pierwszego razu, `false` dla duplikatu |
| 129 | `deps.schedule(...)` — wiadomość trafia do kolejki `after()` |

### Krok 7.3 — Uruchom w trybie debug

1. Otwórz panel **Run and Debug** (Ctrl+Shift+D)
2. Wybierz konfigurację **"Next.js: debug webhook (server-side)"**
3. Kliknij **Start Debugging** (F5) lub zielony trójkąt

VS Code otworzy terminal i uruchomi `npm run dev`. Poczekaj na:
```
▲ Next.js 16.2.3
- Local:        http://localhost:3000
- Network:      http://0.0.0.0:3000
✓ Ready in ...ms
```

### Krok 7.4 — Weryfikacja połączenia debuggera

Gdy pojawi się "Ready", VS Code powinien połączyć się z procesem Node.js automatycznie.
Sprawdź w pasku statusu na dole — powinno pojawić się coś jak "Debugger attached".

Jeśli breakpointy są puste (nie wypełnione) a nie czerwone kółka — debugger nie jest podłączony.
W takim razie użyj drugiej konfiguracji: uruchom `npm run dev` w terminalu ręcznie, potem wybierz
"Next.js: attach to running dev server" i F5.

---

## 8. Scenariusz E2E krok po kroku

> **UWAGA — stan aktualnej implementacji**
>
> Callback `process` w `src/app/api/whatsapp/webhook/route.ts` (linia 42) **tylko loguje** wiadomość —
> orchestrator (`src/conversation/orchestrator.ts`) nie jest tam jeszcze podpięty.
> Oznacza to, że:
> - Kroki 1–3 (weryfikacja wejścia requestu do webhooka w debuggerze) działają w pełni.
> - Bot **nie odpowie** na wiadomość w WhatsApp (brak wywołania orchestratora → brak odpowiedzi przez WhatsAppClient).
> - Pełna rozmowa (kroki 2–6 poniżej) wymaga podpięcia orchestratora — instrukcja w sekcji 12.
>
> Dla celu "czy request z WhatsApp Business API wchodzi do webhooka?" — wszystko jest gotowe.

Masz teraz otwarty WhatsApp na swoim numerze (dodanym jako tester w Meta API Setup).
Piszesz wiadomości do numeru testowego Meta.

### Krok 1 — Przywitanie i zapytanie o pokój

**Wyślij:** `Bonjour, je voudrais réserver une chambre du 12 au 15 août pour 2 adultes`

**Debugger zatrzyma się na linii 65 `webhookHandler.ts`.**

Sprawdź w panelu Variables (VS Code):
```
rawBody  → {"object":"whatsapp","entry":[{"changes":[{"value":{"messages":[{"from":"48...","text":{"body":"Bonjour..."}}]}}]}]}
signature → "sha256=abc123..."
```

Naciśnij **F10 (Step Over)** do linii 71 — sprawdź że warunek `!verifyMetaSignature` jest false (podpis OK).

Naciśnij **F5 (Continue)** — kod przejdzie przez resztę i odpowie 200.

**Bot powinien odpowiedzieć** (~2-3s): lista 3 pokoi z cenami w języku francuskim.

---

### Krok 2 — Wybór pokoju

**Wyślij:** `La supérieure`

Debugger zatrzyma się ponownie. Sprawdź w Variables:
```
message.text → "La supérieure"
message.from → "48XXXXXXXXX"  ← numer twojego telefonu
```

Naciśnij F5. Bot odpowie ceną za 3 noce i pytaniem o potwierdzenie.

---

### Krok 3 — Potwierdzenie

**Wyślij:** `Oui`

Bot poprosi o imię, email i numer telefonu.

---

### Krok 4 — Dane gościa

**Wyślij:** `Marie Dupont, marie.dupont@email.com, 0612345678`

Claude wyciągnie 3 sloty z jednej wiadomości. Bot zapyta o śniadanie.

---

### Krok 5 — Opcja śniadanie

**Wyślij:** `Oui`

**Co obserwować w debuggerze na linii 129 (`deps.schedule`):**
```
message.from  → "48XXXXXXXXX"
message.text  → "Oui"
correlationId → "abc-123-..."
```

Bot odeśle sumę całkowitą + link Stripe: `https://checkout.stripe.com/...`

---

### Krok 6 — Płatność

1. Kliknij link Stripe na telefonie (lub otwórz na komputerze)
2. Wpisz dane karty testowej: **4242 4242 4242 4242**, dowolna data przyszła, dowolny CVC
3. Kliknij "Zapłać"

Stripe CLI (terminal z `stripe listen`) powinien wypisać:
```
2026-05-03 12:34:56   --> checkout.session.completed [evt_...]
2026-05-03 12:34:56  <-- [200] POST http://localhost:3000/api/stripe/webhook [evt_...]
```

Bot odeśle potwierdzenie z numerem rezerwacji: `RES-2026-0812-XXXX, merci !`

---

## 9. Co weryfikować po pełnym scenariuszu

### Baza danych (psql lub Prisma Studio)

```bash
npx prisma studio
# Otwiera GUI na http://localhost:5555
```

| Tabela | Co sprawdzić |
|--------|-------------|
| `Conversation` | `state = "CONFIRMED"`, `guestName`, `guestEmail` uzupełnione |
| `Message` | wszystkie wiadomości in/out zapisane, `whatsappMessageId` unikalne |
| `Reservation` | `status = "CONFIRMED"`, `code = "RES-..."` wygenerowany |
| `PaymentLink` | `status = "PAID"` |
| `ProcessedWebhookEvent` | wpisy dla Meta (`source = "META"`) i Stripe (`source = "STRIPE"`) |

### Logi w terminalu Next.js

Sprawdź że:
- Każdy log ma pole `correlationId`
- Numer telefonu jest zamaskowany: `+48 6** ** ** 78` (nie surowy numer)
- Brak `stack` w logach błędów (o ile `NODE_ENV=development` wyświetla stack, to OK; w `production` nie powinno)

### Panel admina

1. Otwórz `http://localhost:3000/login`
2. Zaloguj się: `admin@hotel.local` (hasło z `prisma/seed.ts`)
3. Przejdź do `/admin/conversations`
4. Kliknij konwersację — transkrypt powinien być zgodny z wiadomościami

---

## 10. Smoke testy negatywne (bezpieczeństwo)

Uruchom w osobnym terminalu, serwer musi działać:

### Test 1 — Webhook bez podpisu → 401

```powershell
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:3000/api/whatsapp/webhook" `
  -ContentType "application/json" `
  -Body '{"object":"whatsapp"}' `
  -SkipHttpErrorCheck
# Oczekiwane: StatusCode 401
```

Debugger zatrzyma się na linii 77 (`logger.warn whatsapp.webhook.signature.invalid`).

### Test 2 — Duplikat wiadomości → 200 bez duplikatu w DB

Wyślij tę samą wiadomość z WhatsApp dwa razy szybko.
Sprawdź w bazie — powinna być tylko jedna pozycja w `Message` z danym `whatsappMessageId`.

Debugger na linii 121 (`whatsapp.webhook.duplicate`) → `isNew: false`.

### Test 3 — Rate limit

Wyślij 11+ wiadomości z tego samego numeru w ciągu 60 sekund.
11. wiadomość: debugger na linii 112 (`whatsapp.webhook.rate_limited`), response 200 ale bez przetwarzania.

### Test 4 — Admin bez sesji → 401/redirect

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/handoff" -SkipHttpErrorCheck
# Oczekiwane: 401 lub redirect do /login
```

---

## 11. Najczęstsze problemy

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| Meta webhook verify fails | Serwer nie działa albo ngrok URL nie zaktualizowany | Uruchom debugger PRZED kliknięciem Verify w Meta; sprawdź APP_BASE_URL w .env.local |
| Breakpointy nie są trafiane | VS Code nie podłączył debuggera | Użyj konfiguracji "attach" zamiast "launch" |
| Stripe webhook 500 | `STRIPE_WEBHOOK_SECRET` to placeholder a nie `whsec_` z Dashboard | Stripe Dashboard → Developers → Webhooks → kliknij endpoint → Reveal signing secret → wklej do `.env.local` → restart |
| Stripe nie wysyła eventu po płatności | Endpoint URL w Dashboard wskazuje stary URL ngrok | Dashboard → Webhooks → Update details → zaktualizuj URL na aktualny ngrok |
| `Invalid environment configuration` przy starcie | Brakujące lub błędne zmienne w `.env.local` | Sprawdź output — Zod poda dokładnie które pole jest błędne |
| `Cannot connect to database` | PostgreSQL nie działa | `docker compose up postgres -d`, sprawdź `docker compose ps` |
| Bot nie odpowiada po wiadomości | orchestrator nie jest podpięty w route.ts | Patrz sekcja 12 — podpięcie orchestratora |

---

---

## 12. Podpięcie orchestratora do webhooka (wymagane dla pełnego E2E)

Aktualnie `route.ts` ma zaślepkę w `process` callback. Żeby bot odpowiadał,
zamień zawartość `src/app/api/whatsapp/webhook/route.ts` na poniższy kod:

```ts
import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { maskPhone } from "@/security/maskPII";
import { createRateLimiter } from "@/security/rateLimit";
import { createWebhookHandlers } from "@/whatsapp/webhookHandler";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { Orchestrator } from "@/conversation/orchestrator";
import { getAiProvider } from "@/ai";
import { createWhatsAppClient } from "@/whatsapp/WhatsAppClient";
import { BookingService } from "@/booking/BookingService";
import { createStripeService } from "@/payments/StripeService";
import Stripe from "stripe";

const env = getEnv();

const orchestrator = new Orchestrator({
  prisma,
  ai: getAiProvider(env),
  whatsapp: createWhatsAppClient({
    baseUrl: "https://graph.facebook.com/v20.0",
    phoneNumberId: env.META_WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.META_WHATSAPP_ACCESS_TOKEN,
  }),
  booking: new BookingService(prisma),
  stripe: createStripeService({
    stripe: new Stripe(env.STRIPE_SECRET_KEY),
    prisma,
    baseUrl: env.APP_BASE_URL,
    sessionTtlMs: 30 * 60 * 1000,
  }),
  logger,
  now: () => new Date(),
});

const rateLimiter = createRateLimiter({
  capacity: 10,
  refillTokens: 10,
  refillIntervalMs: 60_000,
  namespace: "wa-webhook",
});

const handlers = createWebhookHandlers({
  appSecret: env.META_WHATSAPP_APP_SECRET,
  verifyToken: env.META_WHATSAPP_VERIFY_TOKEN,
  rateLimiter,
  idempotency: {
    async recordIfNew(externalId) {
      try {
        await prisma.processedWebhookEvent.create({
          data: { source: "META", externalId },
        });
        return { isNew: true };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return { isNew: false };
        }
        throw err;
      }
    },
  },
  process: async (message, ctx) => {
    logger.info({
      event: "whatsapp.message.received",
      from: maskPhone(message.from),
      messageId: message.messageId,
      correlationId: ctx.correlationId,
    });
    await orchestrator.handle({
      phone: message.from,
      text: message.text,
      whatsappMessageId: message.messageId,
      correlationId: ctx.correlationId,
    });
  },
  schedule: (fn) => after(fn),
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
```

Po tej zmianie zrestartuj serwer (`Ctrl+C` + F5) — bot zacznie odpowiadać.

Dodatkowe breakpointy do ustawienia dla pełnego E2E:

| Plik | Linia (przybliżona) | Co zobaczysz |
|------|---------------------|-------------|
| `src/conversation/orchestrator.ts:112` | Wejście do `handle()` — `phone`, `text`, `conv.state` |
| `src/conversation/stateMachine.ts` | Przejście stanów: `GREETING → COLLECT_DATES → SHOW_OFFERS → ...` |
| `src/booking/BookingService.ts:50` | `quote()` — sprawdź `input.checkIn`, `input.checkOut`, dostępne pokoje |
| `src/payments/StripeService.ts:37` | `createCheckoutSession()` — `reservation.total`, URL linku |

---

## Szybki start (checklist)

```
[ ] docker compose up postgres -d
[ ] npx prisma migrate deploy && npx prisma db seed
[ ] ngrok http 3000  → skopiuj URL do APP_BASE_URL w .env.local
[ ] Stripe Dashboard → Webhooks → Add endpoint → https://<ngrok>/api/stripe/webhook → 4 eventy → Reveal signing secret → wklej whsec_ do .env.local
[ ] VS Code: Run and Debug → "Next.js: debug webhook" → F5
[ ] Poczekaj na "Ready in ...ms"
[ ] Meta dashboard: ustaw webhook URL na https://<ngrok>/api/whatsapp/webhook → Verify and Save
[ ] Ustaw breakpointy w webhookHandler.ts (linie 65, 71, 109, 119, 129)
[ ] Wyślij wiadomość z WhatsApp → debugger zatrzymuje się → inspektuj Variables
```
