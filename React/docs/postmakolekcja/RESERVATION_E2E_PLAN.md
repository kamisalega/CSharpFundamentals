# Plan: Postman collection — scenariusz rezerwacji elloha (sandbox)

## Context

Cel: nauczyć Cię budowania kolekcji Postman z testami, czerpiąc z OpenAPI 3.0 elloha (`document.json`, 70k linii). Backend elloha to system do rezerwacji noclegów/aktywności. Zbudujemy **end-to-end happy path + odwołanie** na środowisku **sandbox** (`https://backend-sandbox.elloha.com/`), z autoryzacją Bearer JWT pozyskaną przez `/Token/Login`.

Forma pracy: **Ty piszesz kolekcję i testy, ja prowadzę krok po kroku.** Każdy krok = jeden request + jego asercje. Dopiero gdy zielone — idziemy dalej. Nie podaję gotowego kodu do wklejenia — opisuję co i dlaczego, podpowiadam strukturę, weryfikuję wynik.

Pełen flow:

```
Login → Availability → Booking/Create → AddBookingItems → AddBookingPayments → Confirm → Cancel
```

---

## Plik źródłowy

- **OpenAPI:** `C:\Users\kamil\Documents\Programowanie\CSharpFundamentals\React\docs\postmakolekcja\document.json`
- Servery: sandbox / prod / local (używamy **sandbox**)
- Security: `bearerAuth` (HTTP, scheme=bearer, format=JWT) — globalnie na wszystkich endpointach poza `/Token/*`

---

## Setup (krok 0) — struktura kolekcji i environment

Zanim ruszymy z requestami, ustawiamy szkielet:

1. **Nowa Collection** w Postmanie: `elloha — Reservation E2E`
2. **Environment** `elloha-sandbox` ze zmiennymi:
   - `baseUrl` = `https://backend-sandbox.elloha.com`
   - `userName` (testowe konto sandbox)
   - `password` (testowe konto sandbox)
   - `accessToken` (puste — zapisze się po loginie)
   - `idEct` (UUID kanału dystrybucji — z konta sandbox)
   - `idClient` (UUID testowego klienta — z konta sandbox)
   - `idBooking` (puste — zapisze się po Create)
   - `idPrestation` (UUID produktu do testowania availability)
3. **Authorization na poziomie kolekcji**: `Bearer Token` → `{{accessToken}}`. Wszystkie requesty po loginie dziedziczą.
4. **Foldery** wewnątrz kolekcji (porządek = porządek wykonania):
   - `00 Auth`
   - `01 Search`
   - `02 Booking lifecycle`
   - `03 Cancellation`

Uwaga dydaktyczna: zmienne kolekcji vs environment — tu używamy environment (są edytowalne i wymienne między sandboxem a innymi środowiskami).

---

## Krok 1 — `POST /Token/Login`

**Folder:** `00 Auth`

**Cel:** uzyskać JWT i zapisać do `accessToken`.

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/Token/Login`
- Body (raw JSON), schema `SignInModel`:
  ```json
  {
    "userName": "{{userName}}",
    "password": "{{password}}",
    "rememberMe": true
  }
  ```
- **Auth: No Auth** (override dziedziczenia z kolekcji — login nie wymaga tokenu)

**Response schema `LoginResponse`:**
```
status: "Success" | "RequiresTwoFactor" | "Error"
twoFactorProvider: "None" | "GoogleAuthenticator" | "Email" | "Phone"
validationSentTo: string | null
tokens: { ... }   // tu jest accessToken
```

**Testy (Tests tab):**
- `pm.response.to.have.status(200)`
- `pm.test("login Success")` — `json.status === "Success"` (jeżeli MFA — przerywamy i konfigurujemy)
- `pm.test("token present")` — `json.tokens.accessToken` jest stringiem niepustym
- `pm.environment.set("accessToken", json.tokens.accessToken)`

Po przejściu: w prawym górnym rogu environment `elloha-sandbox` powinno mieć wypełnione `accessToken`.

---

## Krok 2 — `POST /Availability`

**Folder:** `01 Search`

**Cel:** sprawdzić dostępność produktu w danym przedziale dat i wyciągnąć identyfikatory potrzebne do budowy `BookingItem`.

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/Availability`
- Body (raw JSON), schema `AvailabilityRequest`:
  ```json
  {
    "idPrestation": "{{idPrestation}}",
    "startDate": "2026-06-01",
    "endDate": "2026-06-03",
    "nbRooms": 1,
    "globalPax": { "adults": 2, "children": 0 }
  }
  ```
- Auth: dziedziczy `Bearer {{accessToken}}` z kolekcji

**Testy:**
- status 200
- `pm.test("response has accommodations")` — `json.accommodations` jest tablicą
- `pm.test("at least one available")` — co najmniej jeden element z dostępnością
- Pre-request lub Tests: w `pm.environment.set` zapisać:
  - `idType` (UUID typu produktu z pierwszej dostępnej pozycji — potrzebny w BookingItem)
  - `unitAmount` (cena z dostępnej pozycji)

Uwaga: w odpowiedzi szukamy tablic `accommodations`/`ratePlans`/`formulas` — strukturę poznamy dopiero realnym wywołaniem na sandboxie. Zaczniemy od asercji „tablica nie pusta" i dopowiemy szczegóły, gdy zobaczymy payload.

---

## Krok 3 — `POST /Booking/Create`

**Folder:** `02 Booking lifecycle`

**Cel:** stworzyć szkielet rezerwacji. To jest „koszyk" — zapiszemy `idBooking` do zmiennej.

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/Booking/Create`
- Body (raw JSON), schema `EllohaBooking` — minimalna wersja:
  ```json
  {
    "idEct": "{{idEct}}",
    "idClient": "{{idClient}}",
    "remarks": "Postman E2E test"
  }
  ```

**Testy:**
- status 200/201
- `pm.test("idBooking returned")` — `json.idBooking` jest niepustym UUID
- `pm.test("state initial")` — `json.idState` w stanie quotation/null (zwery­fikujemy enum z odpowiedzi)
- `pm.environment.set("idBooking", json.idBooking)`

Uwaga: pełny `EllohaBooking` ma sporo pól. Idziemy od minimum i rozszerzymy, jeśli API zwróci 400 — wtedy nauczymy się czytać błąd walidacji.

---

## Krok 4 — `POST /Booking/{idBooking}/AddBookingItems`

**Folder:** `02 Booking lifecycle`

**Cel:** dodać pozycje (produkty) do rezerwacji.

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/Booking/{{idBooking}}/AddBookingItems`
- Body (raw JSON), array of `BookingItem`:
  ```json
  [
    {
      "idType": "{{idType}}",
      "quantity": 1,
      "unitAmountIncludingVat": {{unitAmount}},
      "description": "Postman E2E item"
    }
  ]
  ```

**Testy:**
- status 200
- `pm.test("items persisted")` — odpowiedź to tablica z ≥1 elementem
- `pm.test("each item has idBookingItem")` — każdy element ma UUID
- W `Tests`: zapisz `idBookingItem` z pierwszego elementu (przyda się przy ewentualnym `Cancel single item`).

---

## Krok 5 — `POST /Booking/{idBooking}/AddBookingPayments`

**Folder:** `02 Booking lifecycle`

**Cel:** dopiąć płatność do rezerwacji (np. typ `MONEY` — manualny, bez gateway'a).

**Request:**
- Method: `POST`
- URL: `{{baseUrl}}/Booking/{{idBooking}}/AddBookingPayments`
- Body (raw JSON), array of `BookingPayment`:
  ```json
  [
    {
      "idType": "MONEY",
      "amountInclTax": {{unitAmount}},
      "description": "Manual payment, Postman test"
    }
  ]
  ```

`idType` przyjmuje wartości z enum `MeanOfPayment.idType` (`CB`, `CHECK`, `MONEY`, `TRANSFER`, ...). `MONEY` najprostszy — brak integracji.

**Testy:**
- status 200
- `pm.test("payments persisted")` — tablica z ≥1 wpisem
- `pm.test("amount matches")` — sum(amountInclTax) ≥ unitAmount

---

## Krok 6 — `PUT /Booking/{idBooking}/Confirm`

**Folder:** `02 Booking lifecycle`

**Cel:** przejść z quotation → SOLD. To jest moment, w którym rezerwacja staje się wiążąca.

**Request:**
- Method: `PUT`
- URL: `{{baseUrl}}/Booking/{{idBooking}}/Confirm`
- Body: brak

**Testy:**
- status 200
- `pm.test("state SOLD")` — `json.idState === "BOOKING_STATE_SOLD"` (lub równoważne; potwierdzimy enumem z odpowiedzi)
- `pm.test("idBooking unchanged")` — `json.idBooking === pm.environment.get("idBooking")`

Alternatywa: `POST /Booking/{idBooking}/ConfirmWithPayments` — łączy krok 5 i 6. Nie używamy, bo dydaktycznie chcemy mieć każdy krok osobno.

---

## Krok 7 — `PUT /Booking/{idBooking}/Cancel`

**Folder:** `03 Cancellation`

**Cel:** odwołać rezerwację. Sprawdzamy, że stan zmienia się na cancelled i że ponowny Cancel zwraca błąd (idempotencja).

**Request:**
- Method: `PUT`
- URL: `{{baseUrl}}/Booking/{{idBooking}}/Cancel`
- Body: brak (lub `BookingCancellation` jeśli wymagane — ustalimy realnym wywołaniem)

**Testy:**
- status 200
- `pm.test("state cancelled")` — `json.idState` zawiera `CANCEL` (lub stosowny enum)

**Bonus dydaktyczny:** dodać drugi request `Cancel — already cancelled` (kopia poprzedniego) z asercją `status === 400 || 409` — pokazuje, jak testować scenariusz negatywny po stronie tej samej kolekcji.

---

## Pliki do modyfikacji

Brak plików w repo do zmiany — kolekcja powstaje w Postmanie. Po zakończeniu można wyeksportować JSON i zapisać np. do `React/docs/postmakolekcja/elloha-reservation-e2e.postman_collection.json`, ale to opcjonalne.

---

## Verification (jak sprawdzić, że scenariusz działa end-to-end)

1. **Runner Postmana:** `Collection Runner` → wybierz kolekcję `elloha — Reservation E2E` → environment `elloha-sandbox` → `Run`. Wszystkie requesty powinny przejść po kolei, każdy z zielonymi testami.
2. **Sprawdzenie w sandboxie:** zaloguj się do panelu elloha sandbox i potwierdź, że `idBooking` z environment widnieje na liście jako `Cancelled`.
3. **Idempotencja:** drugi run kolekcji powinien przejść tak samo (każdy run tworzy nowe `idBooking` w kroku 3).
4. **Negatywny test:** ręcznie zepsuj `accessToken` (np. obetnij ostatni znak) i odpal krok 2 — oczekiwany `401`.

---

## Co dalej (po ukończeniu happy path)

Naturalne rozszerzenia, gdy podstawa działa:
- `POST /Payment/Stripe/Capture` — realna płatność kartą sandbox-ową
- `GET /Booking/{idBooking}/participants` — uczestnicy rezerwacji
- `POST /Booking/CancelItem` — anulowanie pojedynczej pozycji zamiast całej rezerwacji
- `POST /Booking/Export` — eksport CSV (asynchroniczny — uczy testowania `202 Accepted`)
