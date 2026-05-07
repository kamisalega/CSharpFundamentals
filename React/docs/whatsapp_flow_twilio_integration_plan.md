# WhatsApp Flow + Twilio Integration Plan — `React/01_hotel_whatsapp_bot`

> **Deliverable location after approval**: `React/docs/whatsapp_flow_twilio_integration_plan.md`

---

## Context

`React/01_hotel_whatsapp_bot` is a Next.js 16 + React 19 + Prisma/Postgres bot that today routes WhatsApp traffic through the **Meta Cloud API** and uses an **AI orchestrator** (Claude/OpenAI) to drive a 13-state booking conversation. The bot already owns: a finite state machine (`src/conversation/`), a working `BookingService` (quote/hold/confirm/cancel with night-level double-booking prevention), a Stripe checkout integration with webhook idempotency, an admin dashboard, NextAuth, rate-limiting, structured logging with PII masking, and a TDD culture (Vitest + MSW + test DB helpers).

What it does **not** have yet, per `React/docs/whatsapp_booking_bot.md`:

- A **Twilio** channel (Twilio SDK is not installed; only Meta is wired).
- A **WhatsApp Flow** experience — the 3 templates from the brief (Welcome List Picker, Date Picker Flow, Guests Picker Flow) plus the room-list, room-detail card, guest-info Flow, breakfast toggle, recap, "Payer" CTA, and final confirmation.
- A **deterministic, no-AI** booking path. Today every inbound message goes through `Orchestrator.handle()` → AI intent classification.
- A **transactional email** sender for the final confirmation (step 27–28 of the brief).

The change introduces a **second, parallel channel (Twilio)** with a **deterministic Flow-driven engine** that bypasses the AI orchestrator. The existing Meta + AI path stays intact and continues to serve any phone whose `Conversation.channel = 'META'`. The architecture is hexagonal (ports & adapters) so messaging providers, PMS backends, payment providers, and email senders can be swapped without touching the Flow engine.

---

## Decisions already locked with the user

1. **Coexist as parallel channel** — keep the existing `/api/whatsapp/webhook` (Meta) untouched. Add new routes under `/api/twilio/*` and `/api/whatsapp-flows/*`. Discriminate via `Conversation.channel`.
2. **Full happy path, steps 1–29** of `whatsapp_booking_bot.md`, with email sender behind a `EmailPort` interface (no real provider yet — `NoopEmailAdapter` for now).
3. **Reuse existing `BookingService`** behind a new `PmsPort` interface so a real PMS adapter can be plugged in later.
4. **E2E via webhook-replay in Vitest** (no Playwright). Build on the existing `tests/helpers/setupTestDb.ts`, `resetTestDb()`, `seedTestRoom()` and MSW infrastructure.

---

## Critical findings that shape the design

These corrections came from a pressure-test pass on the design and **must** be respected:

1. **Flow `data_exchange` callbacks bypass Twilio.** Meta calls the Flow Endpoint URL configured in WhatsApp Manager directly. Therefore:
   - The signature header on the data-exchange route is `X-Hub-Signature-256` (HMAC-SHA256 with the Meta App Secret of the WABA), **not** `X-Twilio-Signature`.
   - Reuse `src/whatsapp/signature.ts` (`verifyMetaSignature`) for the Flow endpoint. Add a separate env var `WHATSAPP_FLOWS_APP_SECRET` (the Twilio-managed WABA's app secret is distinct from `META_WHATSAPP_APP_SECRET`).
   - Route lives under `/api/whatsapp-flows/` (channel-neutral), not `/api/twilio/`.
2. **Flow JSON is authored & hosted in Meta WhatsApp Manager.** Code references opaque **Flow IDs**. Keep JSON in the repo as source of truth; ship a sync script (`scripts/sync-flows.ts`) that uploads via Graph API and writes IDs into a generated `src/flows/flowIds.generated.ts`.
3. **Effects-as-data engine.** The transition function is pure — it returns `{ next, effects: Effect[] }`. An interpreter executes effects against ports. Crucially: **`data_exchange` handlers MUST be read-only** (no DB writes beyond `Conversation.flowState`). Persistent mutations (hold reservation, create payment link, send confirmation email) only fire on Flow `complete` (and on Stripe `checkout.session.completed`).
4. **Idempotency:** Twilio inbound = `MessageSid`. Flow data-exchange has no built-in key — protect by making handlers pure-read and scoping mutations on `complete` by `flow_token` (unique constraint). `ProcessedWebhookEvent.source` enum gains both `TWILIO` and `WHATSAPP_FLOWS`.
5. **Sandbox cannot author custom Content templates.** Real WABA + 24-48h template approval is needed before live E2E. v1 ships with in-process Vitest E2E (replay) and a connectivity smoke-test against sandbox.
6. **Stripe webhook needs to send a final WhatsApp message** routed by `Conversation.channel`. Today it only updates DB rows. This is a **modification to existing code** in `src/payments/stripeWebhookHandler.ts` and `src/app/api/stripe/webhook/route.ts`, not just a new file.
7. **24-hour session window:** the final confirmation message (post-Stripe) may fire >24h after last inbound and would be rejected as free text. Make it a Twilio Content template (`twilio/text` with a single `{{1}}` variable). Add `Conversation.lastInboundAt` now to enable future enforcement.
8. **Flow encryption gotchas:** RSA-OAEP-**SHA256** must be passed explicitly to `crypto.privateDecrypt` (defaults to SHA-1 and silently fails). AES-GCM uses a 16-byte IV (Meta's non-standard size). The response re-uses the same AES key with the IV bit-flipped (`byte XOR 0xFF`). Response body is base64 ciphertext as `text/plain`. Specific status codes: `421` = key mismatch, `427` = end flow.
9. **`ping` action** on the Flow endpoint must be handled (Meta health-checks; failure breaks Flow publication). Respond with `{"data": {"status": "active"}}` (encrypted).
10. **Twilio SDK pin `^5.x`** — used only in the Twilio messaging adapter and `/api/twilio/whatsapp/webhook`; the data-exchange route does not import Twilio.

---

## Architecture (hexagonal)

### Ports

| Port | File | Methods |
|---|---|---|
| `MessagingPort` | `src/channels/MessagingPort.ts` | `sendText`, `sendListPicker`, `sendCard`, `sendCtaButton`, `sendFlow`, `sendTextTemplate` |
| `PmsPort` | `src/pms/PmsPort.ts` | `searchAvailability(checkIn, checkOut, guests)`, `holdReservation(input)`, `getReservation(id)`, `cancelReservation(code)` |
| `PaymentPort` | `src/payments/PaymentPort.ts` | `createCheckoutLink(reservation, locale)` |
| `EmailPort` | `src/email/EmailPort.ts` | `sendBookingConfirmation(reservation, locale)` |

### Adapters

| Adapter | File | Wraps |
|---|---|---|
| `TwilioMessagingAdapter` | `src/channels/twilio/TwilioMessagingAdapter.ts` | Twilio Node SDK v5 (`client.messages.create` with `contentSid` + `contentVariables`) |
| `MetaMessagingAdapter` | `src/channels/meta/MetaMessagingAdapter.ts` | Existing `WhatsAppClient` — refactor to fit `MessagingPort` interface (additive, no behaviour change) |
| `BookingServicePmsAdapter` | `src/pms/BookingServicePmsAdapter.ts` | Existing `BookingService` — pure mapping layer |
| `StripePaymentAdapter` | `src/payments/StripePaymentAdapter.ts` | Existing `StripeService` |
| `NoopEmailAdapter` | `src/email/NoopEmailAdapter.ts` | Logs `event: "email.send.noop"` only |

### Deterministic Flow engine

`src/flows/FlowConversationEngine.ts` — pure transition function; effects-as-data interpreter is separate.

**States** (`src/flows/FlowState.ts`):
```
BOOT → MENU_SHOWN → AWAITING_DATES → AWAITING_GUESTS →
ROOM_LIST_SHOWN → ROOM_DETAIL_SHOWN → AWAITING_GUEST_INFO →
AWAITING_EXTRAS → RECAP_SHOWN → PAYMENT_PENDING →
PAID → CONFIRMED   (terminal)
            ↘ FAILED, HUMAN_HANDOFF (terminal)
```

**Events**:
```ts
type FlowEvent =
  | { kind: 'inboundText'; text: string }
  | { kind: 'menuSelection'; selectionId: string }
  | { kind: 'flowDataExchange'; screen: string; action: string; data: unknown; flowToken: string }
  | { kind: 'flowSubmitted'; flowToken: string; payload: unknown }
  | { kind: 'paymentSucceeded'; reservationCode: string }
  | { kind: 'paymentFailed'; reservationCode: string; reason: string }
  | { kind: 'reservationHeld'; reservationId: string; total: number }
  | { kind: 'reservationFailed'; reason: string }
  | { kind: 'timeout' };
```

**Effects** (`src/flows/Effect.ts`):
```ts
type Effect =
  | { kind: 'sendListPicker'; to: string; templateSid: string; variables: Record<string,string> }
  | { kind: 'sendFlow'; to: string; flowId: string; flowToken: string; cta: string; templateSid: string }
  | { kind: 'sendCard'; to: string; templateSid: string; variables: Record<string,string> }
  | { kind: 'sendCtaButton'; to: string; templateSid: string; url: string; variables: Record<string,string> }
  | { kind: 'sendTextTemplate'; to: string; templateSid: string; variables: Record<string,string> }
  | { kind: 'searchAvailability'; checkIn: Date; checkOut: Date; guests: { adults: number; children: number } }
  | { kind: 'holdReservation'; conversationId: string; roomId: string; checkIn: Date; checkOut: Date; guests: { adults: number; children: number }; breakfast: boolean; guest: { name: string; email: string; phone: string } }
  | { kind: 'createPaymentLink'; reservationId: string }
  | { kind: 'sendBookingConfirmEmail'; reservationId: string }
  | { kind: 'persistFlowState'; conversationId: string; nextState: FlowState; flowToken?: string; mergedSlots?: Partial<FlowSlots> };
```

The interpreter (`src/flows/EffectInterpreter.ts`) executes effects sequentially against the ports, feeds results back as new events to the engine until the queue drains, and persists at the end inside a Prisma transaction.

### Routes

| Route | File | Purpose | Signature |
|---|---|---|---|
| `POST /api/twilio/whatsapp/webhook` | `src/app/api/twilio/whatsapp/webhook/route.ts` | Inbound Twilio messages (text, button, list, Flow completion) | `X-Twilio-Signature` (HMAC-SHA1) via `twilio.validateRequest` |
| `POST /api/whatsapp-flows/data-exchange` | `src/app/api/whatsapp-flows/data-exchange/route.ts` | Meta-direct Flow data-exchange callbacks (encrypted) | `X-Hub-Signature-256` (reuse `verifyMetaSignature` with `WHATSAPP_FLOWS_APP_SECRET`) — **synchronous response** (no `after()`) |
| `POST /api/stripe/webhook` (modified) | `src/app/api/stripe/webhook/route.ts` | After updating reservation, dispatch final WhatsApp message via channel-aware adapter | unchanged signature, new behaviour |

### Schema changes (`prisma/schema.prisma`)

```prisma
model Conversation {
  // ... existing fields ...
  channel        String    @default("META")  // META | TWILIO
  flowState      String?                     // current FlowState enum value
  flowToken      String?   @unique           // active Flow token (unique for idempotent complete)
  locale         String    @default("fr")
  lastInboundAt  DateTime?                   // for future 24h-window enforcement
  // existing index @@index([phone]) stays
  @@index([flowToken])
}

model Reservation {
  // ... existing fields ...
  locale         String    @default("fr")
}

model ProcessedWebhookEvent {
  source         String    // META | STRIPE | TWILIO | WHATSAPP_FLOWS
}

// optional v1.5: FlowExchangeLog with TTL for admin debugging
```

Migration name: `add_twilio_channel_and_flow_fields`.

---

## Folder layout to add

```
src/
  channels/
    MessagingPort.ts
    twilio/
      TwilioMessagingAdapter.ts
      TwilioSignature.ts                # wraps twilio.validateRequest, pins URL from env
      TwilioWebhookSchema.ts            # Zod for parsed form-encoded payloads
      templates/                         # JSON specs for Content templates (committed)
        welcome-menu.fr.json
        date-picker-flow.fr.json
        guests-picker-flow.fr.json
        guest-info-flow.fr.json
        room-detail-card.fr.json
        pay-cta.fr.json
        booking-confirmed.fr.json        # twilio/text template for >24h delivery
    meta/
      MetaMessagingAdapter.ts            # additive wrapper around existing WhatsAppClient
  whatsapp-flows/
    FlowEndpointCrypto.ts                # RSA-OAEP-SHA256 + AES-128-GCM-with-flipped-IV
    FlowDataExchangeSchema.ts            # Zod for plaintext request/response
    FlowEndpointHandler.ts               # createFlowEndpointHandler({ ports, secret, privateKey })
  flows/
    FlowConversationEngine.ts            # pure
    FlowState.ts
    FlowEvent.ts
    Effect.ts
    transitions.ts                       # pure transition table
    EffectInterpreter.ts
    flowIds.generated.ts                 # generated by scripts/sync-flows.ts (gitignored or committed; recommend committed)
    definitions/                         # source of truth Flow JSON specs
      welcome-menu.json                  # NB: actually a list-picker template, not a Flow
      date-picker.flow.json
      guests-picker.flow.json
      guest-info.flow.json
    handlers/                            # screen-specific data-exchange logic (pure-read)
      DatePickerScreenHandler.ts
      GuestsPickerScreenHandler.ts
      RoomListScreenHandler.ts
      RoomDetailScreenHandler.ts
      GuestInfoScreenHandler.ts
      ExtrasScreenHandler.ts
      RecapScreenHandler.ts
  pms/
    PmsPort.ts
    BookingServicePmsAdapter.ts
  payments/
    PaymentPort.ts
    StripePaymentAdapter.ts              # NEW: thin wrapper around existing StripeService
  email/
    EmailPort.ts
    NoopEmailAdapter.ts
  app/api/
    twilio/whatsapp/webhook/route.ts
    whatsapp-flows/data-exchange/route.ts
scripts/
  sync-flows.ts                          # uploads Flow JSONs to Meta, writes flowIds.generated.ts
  upload-flows-public-key.ts             # one-time: POST public key to Meta
  seed-twilio-templates.ts               # idempotently creates Content templates via Twilio Content API
tests/
  fixtures/
    twilio-webhook.ts                    # builders: aTwilioInboundText, aTwilioButtonReply, aTwilioListReply, aTwilioFlowCompletion
    flow-data-exchange.ts                # encrypted/decrypted payload builders + test keypair
    test-keypair/                        # committed test RSA keypair (NEVER used in prod)
      private.pem
      public.pem
  integration/
    twilio-webhook.signature.test.ts
    twilio-webhook.idempotency.test.ts
    flow-data-exchange.crypto.test.ts
    flow-data-exchange.handlers.test.ts
    flow-engine.transitions.test.ts      # pure
    flow-engine.interpreter.test.ts      # ports stubbed
    stripe-webhook.dispatch.test.ts      # new: asserts channel-aware outbound message
  e2e/
    twilio-booking-happy-path.test.ts    # full 29-step replay
    twilio-no-availability.test.ts       # step 8-10 returns empty
    twilio-payment-failure.test.ts       # Stripe webhook: payment_failed
    twilio-flow-stale-token.test.ts      # data-exchange with expired flow_token → 427
```

---

## Twilio configuration (test account → production WABA)

### Env vars to add (`src/config/env.ts`, Zod-validated, fail-fast)

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM                    # e.g. "whatsapp:+14155238886" for sandbox
TWILIO_WEBHOOK_PUBLIC_URL               # full https URL Twilio Console is configured with — used in signature verification

# WhatsApp Flow direct-Meta endpoint (NOT Twilio):
WHATSAPP_FLOWS_APP_SECRET               # Meta App Secret of the WABA owning the Flows
WHATSAPP_FLOWS_PRIVATE_KEY              # PEM string (single-line with \n escapes)
WHATSAPP_FLOWS_PRIVATE_KEY_PASSPHRASE   # optional
WHATSAPP_FLOWS_PHONE_NUMBER_ID          # for public-key upload + Flow CRUD
WHATSAPP_FLOWS_GRAPH_ACCESS_TOKEN       # token with whatsapp_business_messaging + whatsapp_business_management

# Content template SIDs (filled after seed-twilio-templates.ts runs):
TWILIO_CONTENT_SID_WELCOME_MENU
TWILIO_CONTENT_SID_DATE_PICKER_FLOW
TWILIO_CONTENT_SID_GUESTS_PICKER_FLOW
TWILIO_CONTENT_SID_GUEST_INFO_FLOW
TWILIO_CONTENT_SID_ROOM_DETAIL_CARD
TWILIO_CONTENT_SID_PAY_CTA
TWILIO_CONTENT_SID_BOOKING_CONFIRMED    # twilio/text for >24h delivery
```

### Twilio Console + Meta WhatsApp Manager setup (one-time, ordered)

1. **Sandbox (immediate, for connectivity smoke tests):**
   - Console → Develop → Messaging → Try it out → Send a WhatsApp message → activate sandbox.
   - Note sandbox number (`+14155238886`) and join code.
   - Configure inbound webhook → `https://<ngrok>.ngrok-free.app/api/twilio/whatsapp/webhook` (POST).
   - Configure status webhook → same URL with a `?type=status` query (or a separate `/status` route — out of scope v1).
   - Personal device: send `join <code>` to opt-in.
   - **Sandbox limitation acknowledged**: cannot author custom Content templates; cannot test the full 29-step E2E live. Use it only to verify signature validation, idempotency, and inbound parsing end-to-end.

2. **Production WABA (lead time 24-72h; do early):**
   - Provision real WhatsApp sender via Twilio (`Senders → WhatsApp Senders`). Requires Facebook Business Manager linked.
   - Once active, point its inbound webhook to the same `/api/twilio/whatsapp/webhook` route.

3. **Flows authored in WhatsApp Manager (after WABA active):**
   - In Meta Business Suite → WhatsApp Manager → Flows → create 4 Flows from JSON definitions in `src/flows/definitions/`:
     - `date-picker.flow.json` (2 screens: dates → guests handoff)
     - `guests-picker.flow.json`
     - `guest-info.flow.json`
   - Each Flow's endpoint URL → `https://<public-host>/api/whatsapp-flows/data-exchange`.
   - Run `scripts/sync-flows.ts` to upload JSONs via Graph API and populate `src/flows/flowIds.generated.ts`.

4. **Public key upload (one-time):**
   - Generate RSA keypair (`openssl genrsa -aes256 -out private.pem 2048`; derive public).
   - Store private as `WHATSAPP_FLOWS_PRIVATE_KEY` (escape newlines).
   - Run `scripts/upload-flows-public-key.ts` → POSTs to `/{phone-number-id}/whatsapp_business_encryption`.
   - Re-run on key rotation.

5. **Content templates (Twilio Content API):**
   - Run `scripts/seed-twilio-templates.ts` → idempotently creates the 7 templates from `src/channels/twilio/templates/*.json`.
   - For each, request Meta approval via `client.content.v1.contents(sid).approvalRequests.create({ name, category })`. Categories: `UTILITY` for transactional templates; the welcome menu may be `UTILITY` or `MARKETING` depending on copy.
   - Approval is async (24-48h+). Re-run safe.
   - After approval, the script writes the SIDs back into a `.env.local.twilio` file or prints them; copy into `.env`.

6. **Webhook URL parity check:**
   - `TWILIO_WEBHOOK_PUBLIC_URL` must match exactly what the Console has (protocol, host, port, trailing slash). Mismatch → silent signature failures. Add a `/api/health/twilio-config` dev-only diagnostic endpoint that logs both `env` and `request.url` per call.

---

## Implementation plan (TDD-first, files to create/modify)

Each numbered item is a tight TDD slice: write the failing test first, then the production code, then refactor. Follow the existing project's vitest patterns (colocated `*.test.ts`, MSW for outbound HTTP, test DB helpers for integration).

### Phase 0 — Schema + env (DB foundation)
- Modify: `prisma/schema.prisma` (add `channel`, `flowState`, `flowToken`, `locale`, `lastInboundAt`, `Reservation.locale`; allow new `ProcessedWebhookEvent.source` values).
- Create migration `add_twilio_channel_and_flow_fields`.
- Modify: `src/config/env.ts` — add Twilio + WhatsApp Flow env keys with Zod.
- Update: `tests/helpers/setupTestDb.ts` if any seed needs `channel` defaulting.

### Phase 1 — Ports + Stripe/PMS/Email adapters (no behaviour change yet)
- New: `src/pms/PmsPort.ts`, `src/pms/BookingServicePmsAdapter.ts` + tests.
- New: `src/payments/PaymentPort.ts`, `src/payments/StripePaymentAdapter.ts` + tests.
- New: `src/email/EmailPort.ts`, `src/email/NoopEmailAdapter.ts` + tests.
- New: `src/channels/MessagingPort.ts`, `src/channels/meta/MetaMessagingAdapter.ts` (wraps existing `WhatsAppClient`) + tests.
- Tests: pure mapping unit tests; no DB needed except for `BookingServicePmsAdapter`.

### Phase 2 — Twilio messaging adapter
- New: `src/channels/twilio/TwilioMessagingAdapter.ts` — wraps `twilio` SDK v5 `client.messages.create({ from, to, contentSid, contentVariables })`. Mirrors retry/timeout style of `src/whatsapp/WhatsAppClient.ts`.
- New: `src/channels/twilio/TwilioSignature.ts` — wraps `twilio.validateRequest(authToken, signature, url, params)`; URL pinned from `TWILIO_WEBHOOK_PUBLIC_URL`.
- New: `src/channels/twilio/TwilioWebhookSchema.ts` — Zod for parsed form-encoded inbound (fields: `MessageSid`, `From`, `To`, `Body`, `NumMedia`, `ProfileName`, `WaId`, `ButtonText`, `ButtonPayload`, `OriginalRepliedMessageSid`, `MessageType`, `MessagingServiceSid?`).
- Tests: signature unit tests with sample Twilio request, schema parse tests, adapter calls mocked via MSW.

### Phase 3 — Pure Flow engine (no I/O)
- New: `src/flows/FlowState.ts`, `src/flows/FlowEvent.ts`, `src/flows/Effect.ts`.
- New: `src/flows/transitions.ts` — pure `transition(state, event, ctx) → { next, effects }` table.
- Tests: `tests/integration/flow-engine.transitions.test.ts` (actually pure unit, no DB) — table-driven coverage of every state×event combination, including invalid edges.

### Phase 4 — Effect interpreter
- New: `src/flows/EffectInterpreter.ts` — given an effect list and `{ messaging, pms, payments, email, prisma, logger, now }` ports, executes sequentially, feeds results back as new events, persists `Conversation.flowState` + `flowToken` + slot merges in a single Prisma transaction at the end.
- Tests: `tests/integration/flow-engine.interpreter.test.ts` — stubbed ports, asserts effect execution order and DB writes; uses test DB.

### Phase 5 — Twilio inbound webhook route
- New: `src/app/api/twilio/whatsapp/webhook/route.ts` — mirrors the factory pattern of `src/whatsapp/webhookHandler.ts`:
  ```ts
  createTwilioWebhookHandlers({
    authToken, publicUrl, rateLimiter, idempotency, schedule, logger, getCorrelationId,
    process: async (msg, ctx) => engine.dispatch({ phone: msg.from, event: toFlowEvent(msg), ... })
  })
  ```
- Idempotency: `MessageSid` → `ProcessedWebhookEvent { source: 'TWILIO', externalId: MessageSid }`.
- Rate limiter namespace: `"twilio-webhook"`.
- Tests: `tests/integration/twilio-webhook.signature.test.ts` (rejects bad signature), `twilio-webhook.idempotency.test.ts` (replays don't double-process). Uses test DB + MSW.

### Phase 6 — Flow data-exchange route + crypto
- New: `src/whatsapp-flows/FlowEndpointCrypto.ts` — `decryptRequest(encrypted, privateKey, passphrase)` and `encryptResponse(plaintext, aesKey, ivFlipped)`. Explicit `oaepHash: 'sha256'`. 16-byte IV. Bit-flipped response IV. Returns base64 strings.
- New: `src/whatsapp-flows/FlowDataExchangeSchema.ts` — Zod for `{ version, action, screen, data, flow_token }`.
- New: `src/whatsapp-flows/FlowEndpointHandler.ts` — handles `INIT`, `data_exchange`, `BACK`, `ping`. Calls into `FlowConversationEngine.handleDataExchange()` (read-only path). Returns synchronous encrypted response.
- New: `src/app/api/whatsapp-flows/data-exchange/route.ts` — verifies `X-Hub-Signature-256` via reused `verifyMetaSignature` (with `WHATSAPP_FLOWS_APP_SECRET`); decrypts; routes; encrypts response. **Top-of-file comment: must remain synchronous, no `after()`.**
- Status codes: `421` mismatched key, `427` end flow (stale `flow_token` or terminal state), `200` happy path.
- Tests: `tests/integration/flow-data-exchange.crypto.test.ts` (round-trip with test keypair), `flow-data-exchange.handlers.test.ts` (each screen's data-exchange returns expected next-screen payload from PMS data).

### Phase 7 — Stripe webhook channel-aware dispatch (modify existing)
- Modify: `src/payments/stripeWebhookHandler.ts` — after status update, look up `Reservation → Conversation.channel`. If `TWILIO`, dispatch `sendTextTemplate` via `TwilioMessagingAdapter` using `TWILIO_CONTENT_SID_BOOKING_CONFIRMED` with `{{1}} = reservationCode`. Also enqueue `EmailPort.sendBookingConfirmation`. If `META`, leave existing AI orchestrator path alone.
- Modify: `src/app/api/stripe/webhook/route.ts` — instantiate the channel-aware dispatcher (both `MetaMessagingAdapter` and `TwilioMessagingAdapter` injected).
- Tests: `tests/integration/stripe-webhook.dispatch.test.ts` — fixture with `Conversation.channel='TWILIO'` asserts Twilio outbound; existing META fixture asserts AI orchestrator path unchanged.

### Phase 8 — Setup scripts
- New: `scripts/sync-flows.ts` — reads `src/flows/definitions/*.json`, POSTs each to `/{waba-id}/flows`, writes `src/flows/flowIds.generated.ts` (TS object literal).
- New: `scripts/upload-flows-public-key.ts` — POST to `/{phone-number-id}/whatsapp_business_encryption`.
- New: `scripts/seed-twilio-templates.ts` — idempotently creates Content templates and submits approval requests.
- Add `npm run twilio:sync-templates`, `npm run flows:sync`, `npm run flows:upload-key` to `package.json`.

### Phase 9 — End-to-end webhook-replay tests
- New: `tests/fixtures/twilio-webhook.ts` — builders returning `{ url, params, signature }` triples ready to POST. Generate signatures with the test `TWILIO_AUTH_TOKEN`.
- New: `tests/fixtures/flow-data-exchange.ts` — encrypts plaintext with the committed test public key; decrypts responses with test private key. Includes `pingFixture()`, `initFixture()`, `dateExchangeFixture()`, etc.
- New: `tests/fixtures/test-keypair/{private,public}.pem` — committed; **never** used in production.
- New: `tests/e2e/twilio-booking-happy-path.test.ts` — drives the entire 29-step path:
  1. POST inbound text → asserts welcome list-picker effect dispatched.
  2. POST list selection → asserts date-picker Flow effect.
  3. POST data-exchange `INIT` for date screen → asserts encrypted response with prefilled defaults.
  4. POST data-exchange `data_exchange` with chosen dates → asserts navigation to guests screen.
  5. … (continue through all 29 steps)
  6. POST Stripe webhook `checkout.session.completed` → asserts `Reservation.status='CONFIRMED'` AND a Twilio template send was emitted via MSW assertion AND `EmailPort.sendBookingConfirmation` was called.
- New: `tests/e2e/twilio-no-availability.test.ts` — `PmsPort.searchAvailability` returns `[]`; engine transitions to `FAILED` with a polite text fallback.
- New: `tests/e2e/twilio-payment-failure.test.ts` — Stripe `checkout.session.expired` → engine retries CTA OR transitions to `HUMAN_HANDOFF` after N attempts.
- New: `tests/e2e/twilio-flow-stale-token.test.ts` — data-exchange with unknown `flow_token` → 427 + DB unchanged.
- Test ergonomics: lazy-import route modules per test to control `process.env`; pass `schedule: async fn => fn()` for deterministic `after()` substitute.

### Phase 10 — Admin UI minor extension (optional polish)
- Modify: `src/app/admin/conversations/page.tsx` — add `channel` column (badge META/TWILIO).
- Modify: `src/app/admin/conversations/[id]/page.tsx` — display `flowState` if `channel='TWILIO'`.
- No new auth or schema needed.

---

## Security & operational considerations

- **PII**: phone numbers must continue to flow through `maskPhone()` in logs (see `src/security/maskPII.ts`). Audit new logger calls in adapters.
- **CSP**: existing CSP allows `'self'` only — Twilio/Meta calls are server-side, no client-side leakage. No CSP changes.
- **Rate limiting**: separate namespaces — `"twilio-webhook"` (key by `From`) and `"flows-data-exchange"` (key by `flow_token` post-decryption + IP pre-decryption).
- **Secrets**: never log private key, auth token, or Meta app secret. Add explicit redactor entries in `src/logging/logger.ts` for `WHATSAPP_FLOWS_PRIVATE_KEY`, `TWILIO_AUTH_TOKEN`, `WHATSAPP_FLOWS_APP_SECRET`.
- **Cross-channel safety**: in `/api/whatsapp/webhook` (Meta), reject if `Conversation.channel === 'TWILIO'`. In `/api/twilio/whatsapp/webhook`, reject if `'META'`. Prevents cross-channel state corruption.
- **Compose-up**: `docker-compose.yml` already has Postgres + Redis. No new services for v1.

---

## Critical files to reference (reuse patterns; do not reinvent)

- `src/whatsapp/webhookHandler.ts` — factory pattern with rate limiter + idempotency + schedule injection. **Mirror this for Twilio.**
- `src/whatsapp/signature.ts` — `verifyMetaSignature` (HMAC-SHA256, timing-safe). **Reuse for `/api/whatsapp-flows/data-exchange`.**
- `src/booking/BookingService.ts` — quote/hold/confirm/cancel. **Wrap, do not modify.**
- `src/payments/stripeWebhookHandler.ts` — extend with channel-aware dispatch.
- `src/payments/StripeService.ts` — wrap behind `PaymentPort`.
- `src/conversation/orchestrator.ts` — DO NOT TOUCH; Meta-only.
- `src/config/env.ts` — Zod env validation; add new keys here.
- `tests/helpers/setupTestDb.ts`, `tests/helpers/testDb.ts` — reuse for integration + E2E.
- `tests/fixtures/meta-webhook.ts` — copy the builder pattern style for Twilio fixtures.

---

## Verification plan (end-to-end)

### Local development
1. `docker compose up -d postgres redis` (existing setup).
2. `npx prisma migrate dev` to apply the new schema.
3. Populate `.env` with Twilio sandbox credentials + a generated test RSA keypair.
4. `npm run twilio:seed-templates` (idempotent; safe to re-run).
5. `npm run flows:sync` (uploads Flow JSONs; populates `flowIds.generated.ts`).
6. `npm run flows:upload-key` (one-time per environment).
7. `npm run dev` — Next.js on :3000.
8. `ngrok http 3000` → configure both `https://<ngrok>/api/twilio/whatsapp/webhook` (Twilio Console) and `https://<ngrok>/api/whatsapp-flows/data-exchange` (Meta WhatsApp Manager Flow Endpoint).
9. From a phone joined to Twilio sandbox: send any text → expect welcome list-picker. Click "Réserver une chambre" → expect Date Picker Flow opens (requires production WABA — sandbox templates only). For sandbox, manually verify webhook arrival in logs.

### Automated test suite
- `npm run test` runs unit + integration + E2E (currently `maxWorkers: 1` — sequential).
- `npm run test:coverage` — target ≥80% on `src/flows/`, `src/channels/twilio/`, `src/whatsapp-flows/`, `src/pms/`.
- E2E happy path runs entirely in-process; no external Twilio/Meta calls (MSW intercepts all outbound HTTP).
- Expected runtime: 30-90 seconds for the full suite.

### Production-readiness gate (before going live with Twilio)
- All 4 Flows authored, approved, and published in WhatsApp Manager.
- All 7 Content templates approved by Meta (24-48h lead time per template).
- Public key uploaded; ping action returns `200` with valid encrypted payload from Meta's debugger.
- `TWILIO_WEBHOOK_PUBLIC_URL` matches Console exactly; `/api/health/twilio-config` confirms parity.
- Cross-channel rejection verified via integration test (Meta payload to Twilio route → 400, vice versa).
- Stripe webhook dispatch works for both channels (regression test for META path).

---

## Out of scope for v1 (deliberate)

- Real email provider (Resend/SendGrid). `EmailPort` + `NoopEmailAdapter` ship; real adapter is a follow-up.
- Multi-language support beyond hardcoded `fr`. Slot in `Conversation.locale` for v2.
- 24-hour session window enforcement (data captured via `lastInboundAt` for v2).
- `FlowExchangeLog` table for admin debugging (future).
- Playwright admin E2E (future).
- Migration of existing META conversations to Twilio.
- Outbox/scheduler for delayed retries beyond what `OutboxMessage` schema already supports.

---

## Why this design is open to change

- **Messaging provider**: swap Twilio ↔ Meta direct ↔ Vonage by writing a new `MessagingPort` adapter. Engine and routes don't change.
- **PMS**: swap internal `BookingService` for Apaleo/Mews/etc. by writing a new `PmsPort` adapter.
- **Payment provider**: `PaymentPort` allows swapping Stripe for Adyen/PayPal.
- **Email provider**: `EmailPort` swaps Noop for Resend/SendGrid/Postmark.
- **Flow definitions**: edited as JSON in repo, synced via script. Adding a screen does not require code changes (only handler additions if new data needs computing).
- **Effects-as-data engine**: new effects added by extending the discriminated union; transition tables stay declarative.
- **Channel addition (e.g. Telegram, Messenger)**: add `channel='TELEGRAM'`, write a new inbound route + `TelegramMessagingAdapter`. Engine reuses unchanged.
