# 08 – Strangler Fig: migracja z legacy do modularnego monolitu

Implementacja artykułu Milana Jovanovicia
[Strangler Fig: Legacy to Modular Monolith Migration](https://milanjovanovic.tech/blog/strangler-fig-modular-monolith-migration),
z modułem zbudowanym według wzorców z projektu **Evently** (`Modular_Monolith/Evently`).

- **Legacy:** .NET Framework 2.0 (2005), C# 2.0, Mono 6.12 w Dockerze, HttpListener + XML + ODBC.
- **Nowy system:** .NET 10, modularny monolit jak Evently: CQRS na MediatR 12, Result/Error, FluentValidation,
  MassTransit 8 (in-memory), Outbox i Inbox na Quartz, Dapper do zapytań, EF Core do zapisów, `IEndpoint`.
- **Testy:** integracyjne (xUnit v3, Testcontainers, Shouldly) i architektury (NetArchTest).
- **Jakość:** `Directory.Build.props` i `.editorconfig` z Evently (`AnalysisMode=All`, `TreatWarningsAsErrors`, SonarAnalyzer).

## Idea

Nie przepisujemy systemu od zera. Wymieniamy go **po jednym bounded contexcie**, a system przez cały czas działa:

1. wybierz kontekst (tu: **Orders**),
2. zbuduj nowy moduł o tej samej funkcjonalności,
3. przekieruj ruch flagą,
4. uruchom obie implementacje równolegle i porównuj wyniki,
5. przełącz na stałe, usuń kod legacy, powtórz z kolejnym modułem.

## Struktura

Układ z artykułu (`Modules/Orders` + `LegacyCode/OrdersLegacy`), a w środku modułu warstwy z Evently:

```
src/
  LegacyCode/OrdersLegacy/                     .NET Framework 2.0 – poza solucją, budowany w Dockerze
  Common/                                      jak Evently.Common.*
    StranglerFig.Common.Domain                   Entity, DomainEvent, Result, Error
    StranglerFig.Common.Application              ICommand/IQuery (MediatR), IEventBus, IntegrationEventHandler, walidacja
    StranglerFig.Common.Infrastructure           MassTransit, Quartz, Outbox/Inbox, Dapper (IDbConnectionFactory)
    StranglerFig.Common.Presentation             IEndpoint, ApiResults
  Modules/Orders/                              NOWY moduł
    StranglerFig.Modules.Orders.Domain           Order (Entity), OrderImportedDomainEvent, IOrderRepository
    StranglerFig.Modules.Orders.Application      ImportOrderCommand, GetOrderQuery (Dapper), OrderImportedDomainEventHandler
    StranglerFig.Modules.Orders.Presentation     LegacyOrderPlacedIntegrationEventHandler  ← handler zdarzenia z zewnątrz
    StranglerFig.Modules.Orders.Infrastructure   OrdersDbContext (schemat orders), Outbox/Inbox jobs, OrdersApi
    StranglerFig.Modules.Orders.IntegrationEvents  OrderImportedIntegrationEvent (dla przyszłych modułów)
    StranglerFig.Modules.Orders.PublicApi        IOrdersApi – jedyne synchroniczne wejście do modułu
  Migration/                                   TYMCZASOWE rusztowanie strangler fig
    StranglerFig.Migration                       router, parallel run, fasada zapisów, job synchronizacji, /orders
    StranglerFig.Migration.IntegrationEvents     LegacyOrderPlacedIntegrationEvent
  StranglerFig.Api/                            host: AddApplication, AddInfrastructure, AddOrdersModule, AddOrdersMigration
tests/
  StranglerFig.IntegrationTests
  StranglerFig.ArchitectureTests
```

### Gdzie jest handler zdarzenia i dlaczego

Jak w Evently (`UserRegisteredIntegrationEventHandler` w `Ticketing.Presentation`):

- **Presentation** jest wejściem do modułu: dla HTTP i dla zdarzeń z zewnątrz.
  `LegacyOrderPlacedIntegrationEventHandler` tylko tłumaczy zdarzenie na komendę i robi `ISender.Send(...)`.
- **Application** zawiera logikę: `ImportOrderCommandHandler` (idempotentny upsert przez metody domenowe).
- Tej samej komendy używa job synchronizacji, przez `IOrdersApi.ImportOrderAsync`.

## Granice (artykuł: „communicate through events or APIs”)

```
                 ┌──────────────────────── StranglerFig.Api (.NET 10) ───────────────────────────┐
                 │  StranglerFig.Migration (tymczasowe)          Modules/Orders                   │
 GET /orders/{id}│  IOrderService ─► Router ─┬─► NewOrdersModuleService ─► IOrdersApi ─► GetOrderQuery
                 │   (flaga NewOrdersModule) └─► LegacyOrdersClient ──┐                           │
 POST /orders    │  OrderWriteFacade ─► LegacyOrdersClient ───────────┤ HTTP + XML                │
                 │        └─► IEventBus: LegacyOrderPlacedIntegrationEvent ─► Inbox ─► Presentation handler
                 │  OrderDataMigrationJob (Quartz) ─► LegacyOrdersReader ─┐    ─► ImportOrderCommand  │
                 │        └─► IOrdersApi.ImportOrderAsync ─► ImportOrderCommand ─► Outbox ─► IntegrationEvent
                 └────────────────────────────────────────────────────────┼──────────────────────────┘
                 ┌── OrdersLegacy (.NET Framework 2.0 / Mono, Docker) ──┐  │ czyta public.orders (Dapper)
                 │ HttpListener ─► OrderRepository (ODBC) ──────────────┼──┘
                 └──────────────────────────────────────────────────────┘
```

Pilnują tego testy architektury (`StranglerFigBoundaryTests`):

| Reguła | Po co |
|---|---|
| moduł Orders nie zależy od `StranglerFig.Migration` (poza jej zdarzeniami integracyjnymi) | po cutoverze usuwasz migrację bez ruszania modułu |
| Domain i Application modułu nie wiedzą o migracji w ogóle | zdarzenia z zewnątrz obsługuje tylko Presentation |
| migracja wchodzi do Orders **tylko** przez `PublicApi` | żadnego `OrdersDbContext` ani repozytoriów z zewnątrz |
| `Common.*` nie zależy od modułów ani migracji | wspólne klocki są naprawdę wspólne |

Do tego reguły warstw i konwencje z Evently (`LayerTests`, `ApplicationTests`).

**Świadome odstępstwo od artykułu:** jego `OrderDataMigrationJob` pisze prosto do `OrderDbContext`.
Tutaj job przechodzi przez `IOrdersApi`, więc import ma jedną ścieżkę: walidacja, metody domenowe, outbox.

## Konfiguracja (`appsettings.json`)

```json
"Legacy": { "BaseUrl": "http://localhost:5080" },
"FeatureManagement": { "NewOrdersModule": false },   // czytane przy KAŻDYM żądaniu
"OrdersMigration": {
  "Phase": "Routing",              // Routing | ParallelRun          – czytane przy starcie
  "SyncStrategy": "BackgroundJob", // None | BackgroundJob | Events  – czytane przy starcie
  "SyncInterval": "00:00:30"
},
"Orders": { "Outbox": { "IntervalInSeconds": 5, "BatchSize": 20 }, "Inbox": { ... } }
```

| Faza | Co jest pod `IOrderService` | Co dostaje użytkownik |
|---|---|---|
| `Routing`, flaga `false` | `OrderServiceRouter` | legacy (HTTP) |
| `Routing`, flaga `true` | `OrderServiceRouter` | nowy moduł (rollback = flaga na `false`, bez redeployu) |
| `ParallelRun` | `ParallelVerificationService` | **zawsze legacy**; różnice idą do logów jako `Warning` |

## Synchronizacja danych – dwie opcje z artykułu

**A. Job z watermarkiem** (`SyncStrategy: BackgroundJob`)
- `OrderDataMigrationJob` to job Quartz, jak wszystkie zadania w tle w Evently.
  Watermark trzyma w `JobDataMap` (w pamięci, jak `_lastSync` w artykule),
- `LegacyOrdersReader` czyta `public.orders` (Dapper) od `modified_at >= watermark`.
  Watermark pochodzi z **zegara bazy**, bo zegary kontenera legacy i procesu .NET nie są zgodne,
- każdy wiersz trafia do `IOrdersApi.ImportOrderAsync` → `ImportOrderCommand` (idempotentny upsert),
- widzi **każdą** zmianę w tabeli, także te zrobione z pominięciem nowego systemu.

**B. Zdarzenia** (`SyncStrategy: Events`), w pełni po Evently:
```
OrderWriteFacade ─► IEventBus (MassTransit) ─► IntegrationEventConsumer ─► orders.inbox_messages
   ─► ProcessInboxJob (Quartz) ─► IdempotentIntegrationEventHandler ─► LegacyOrderPlacedIntegrationEventHandler
   ─► ImportOrderCommand
```
- legacy z 2005 roku nie opublikuje zdarzenia, więc publikuje je fasada po udanym zapisie w legacy.
  Po stronie migracji nie ma outboxa: jeśli proces padnie między zapisem w legacy a publikacją, zdarzenie przepadnie,
- inbox chroni przed duplikatami dwa razy: `ON CONFLICT DO NOTHING` przy zapisie (tego nie ma w Evently)
  i `inbox_message_consumers` przy obsłudze,
- widzi tylko zapisy przechodzące przez fasadę i tylko publikowane zdarzenia (wysyłka nie publikuje nic).

**Po imporcie, w module:** `Order.Import` podnosi `OrderImportedDomainEvent`. Zdarzenie trafia do
`orders.outbox_messages` **w tej samej transakcji** co zamówienie. `ProcessOutboxJob` je obsługuje, a
`OrderImportedDomainEventHandler` publikuje `OrderImportedIntegrationEvent` dla przyszłych modułów.

## Cutover (krok 5)

1. Przenieś endpointy `/orders` z `StranglerFig.Migration/Endpoints` do `Orders.Presentation` (zapisy jako nowe komendy).
2. Usuń `StranglerFig.Migration`, `StranglerFig.Migration.IntegrationEvents`, `LegacyOrderPlacedIntegrationEventHandler`
   i rejestrację jego konsumenta w `OrdersModule.ConfigureConsumers`.
3. Wyłącz aplikację legacy, usuń `src/LegacyCode/OrdersLegacy`, a po okresie na rollback usuń `public.orders`.

## Testy

Wymagany Docker. Testcontainers stawia sieć, Postgresa 17 i buduje obraz legacy z `Dockerfile`.

```bash
dotnet test
```

| Klasa | Krok z artykułu | Co pokazuje |
|---|---|---|
| `LegacyAppTests` | – | legacy jest naprawdę skompilowane dla .NET Framework 2.0 (`v2.0.50727`) |
| `RoutingTests` | 1 | flaga przełącza implementację w locie, wyłączenie flagi = rollback |
| `BackgroundSyncTests` | 3A | kopiowanie, watermark, idempotencja, **outbox** po imporcie |
| `HostedSyncJobTests` | 3A | prawdziwy job Quartz z interwałem 200 ms |
| `EventSyncTests` | 3B | zdarzenie → **inbox** → handler w Presentation → komenda; luki zdarzeń; duplikat |
| `ParallelRunTests` | 4 | zawsze wynik legacy, a rozbieżności w logach |
| `ArchitectureTests` | granice | warstwy, konwencje Evently i granice strangler fig |

Każdy test integracyjny ma własny host. Statyczny logger Quartz 3 trzeba wtedy przestawiać przed każdym hostem
(komentarz w `StranglerFigApp`). Evently tego nie potrzebuje, bo w testach ma jeden host.

Eksperymenty do zrobienia samemu (każdy wywraca konkretne testy):
- zamień gałęzie w `OrderServiceRouter`,
- w `ImportOrderCommandHandler` przestań wołać `MarkAsShipped()`,
- w `ParallelVerificationService` usuń `LogWarning`,
- w `IntegrationEventConsumer` usuń `ON CONFLICT (id) DO NOTHING`,
- zmień `ImportOrderCommandHandler` na `public` (test architektury).

## Uruchomienie ręczne

```bash
docker compose up -d --build          # Postgres + legacy (.NET Framework 2.0) na :5080
dotnet run --project src/StranglerFig.Api --launch-profile http    # http://localhost:5272
```

Scenariusze są w `src/StranglerFig.Api/StranglerFig.Api.http`. Fazę i strategię zmieniasz zmiennymi środowiskowymi, np.
`OrdersMigration__SyncStrategy=Events FeatureManagement__NewOrdersModule=true dotnet run ...`.

Co się dzieje pod spodem, zobaczysz w bazie:
```bash
docker exec -it strangler-fig-postgres psql -U postgres -d strangler_fig
select * from public.orders;                -- legacy: status 0/1, modified_at bez strefy
select * from orders.orders;                -- moduł: status 'Pending'/'Shipped'
select type, processed_on_utc, error from orders.outbox_messages;   -- OrderImportedDomainEvent
select type, processed_on_utc, error from orders.inbox_messages;    -- LegacyOrderPlacedIntegrationEvent (strategia Events)
```

Schemat `orders` tworzy host przy starcie (`GenerateCreateScript()`; Evently używa migracji EF, tu nie ma
zainstalowanego `dotnet-ef`). Schemat `public.orders` tworzy aplikacja legacy.
