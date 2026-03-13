# Evently WPF Client — Plan budowy (MVU Architecture)

## Informacje ogólne

| | |
|---|---|
| **Technologia** | WPF (.NET 8), C# |
| **Architektura** | MVU (Model-View-Update) |
| **Backend** | Evently Modular Monolith REST API |
| **Czas** | 4h/dzień × 6 dni (pt 13.03 — śr 18.03) = **~24h** |
| **Cel** | Prezentacja działającego klienta WPF z kluczowymi funkcjami systemu |
| **Metodologia** | TDD (Red → Green → Refactor) |

---

## Czym jest MVU w WPF?

MVU (Model-View-Update), znany też jako **Elm Architecture**, to wzorzec w którym:

```
┌─────────┐    ┌──────────┐    ┌──────────┐
│  Model   │───▶│   View   │───▶│ Message  │
│ (state)  │◀───│  (XAML)  │    │ (intent) │
│          │    └──────────┘    └────┬─────┘
│          │                        │
│          │◀───────────────────────┘
│          │       Update(model, msg) → newModel
└──────────┘
```

- **Model** — immutable record opisujący stan ekranu
- **View** — XAML bindowany do modelu (read-only)
- **Message** — enum/record reprezentujący akcję użytkownika
- **Update** — czysta funkcja `(Model, Message) → Model` (jedyne miejsce zmiany stanu)

W C# WPF implementujemy to przez bazową klasę `MvuViewModel<TModel, TMsg>` która:
- Przechowuje aktualny `Model`
- Eksponuje `Dispatch(TMsg)` dla View
- Wywołuje `Update()` i powiadamia XAML przez `INotifyPropertyChanged`

---

## Scope prezentacji — wybrane funkcjonalności

> Nie budujemy pełnego klienta. Wybieramy **flow demonstracyjny** który najlepiej pokaże:
> architekturę MVU, komunikację z API, i kluczowe domeny systemu.

### Wybrany flow: **Przeglądanie wydarzeń → Szczegóły → Koszyk → Zamówienie → Statystyki**

| # | Ekran | Moduł API | Wow-factor na prezentacji |
|---|-------|-----------|--------------------------|
| 1 | Lista wydarzeń z wyszukiwaniem | Events | Filtrowanie, paginacja, responsywna lista |
| 2 | Szczegóły wydarzenia z typami biletów | Events | Master-detail, binding kolekcji |
| 3 | Koszyk | Ticketing | Dodawanie/usuwanie, przeliczanie sum |
| 4 | Składanie zamówienia + lista zamówień | Ticketing | Workflow zakupowy end-to-end |
| 5 | Dashboard statystyk wydarzenia | Attendance | Wizualizacja danych, materialized view |

---

## Harmonogram dzienny

### Dzień 1 — piątek 13.03 (4h) — Fundament MVU + Projekt + Setup TDD

**Cel: działający szkielet aplikacji z nawigacją, projekt testowy gotowy**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 0.5h | Setup projektu WPF | Nowy projekt `Evently.Client.Wpf` (.NET 8), dodanie do solution. NuGety: `CommunityToolkit.Mvvm`, `Microsoft.Extensions.DependencyInjection`, `Microsoft.Extensions.Http`. |
| 0.5h | Setup projektu testowego | `Evently.Client.Wpf.Tests` (xUnit). Dodanie do solution. NuGety: `FluentAssertions`. Referencja do projektu głównego. |
| 1h | Bazowa infrastruktura MVU | Klasa `MvuViewModel<TModel, TMsg>` — serce architektury. `INotifyPropertyChanged`, metoda `Dispatch()`, abstrakcyjny `Update()`. Obsługa efektów (`IEffect<TMsg>`). |
| 1h | API Client + DTOs + Config | Klasa `EventlyApiClient` — typed HTTP client z `CancellationToken` w każdej metodzie. DTO rekordy. `appsettings.json` z `ApiBaseUrl`. Sprawdź czy backend API odpowiada (auth/no-auth). |
| 1h | Shell + Nawigacja | `MainWindow` z nawigacją między ekranami. Prosty `NavigationService`. Podstawowy styling (kolory, fonty). |

**Deliverable:** Aplikacja uruchamia się, wyświetla shell z nawigacją. Projekt testowy buduje się i uruchamia (`dotnet test` — 0 testów, 0 błędów).

#### Szczegóły implementacyjne

**Struktura folderów:**
```
Evently.Client.Wpf/
├── Core/                      # Infrastruktura MVU
│   ├── MvuViewModel.cs        # Bazowa klasa MVU
│   ├── IEffect.cs             # Side effects (HTTP, nawigacja)
│   └── NavigationService.cs
├── ApiClient/
│   ├── EventlyApiClient.cs    # HTTP client
│   └── Dtos/                  # Rekordy DTO
├── Features/
│   ├── Events/                # Ekrany wydarzeń
│   ├── Cart/                  # Ekran koszyka
│   ├── Orders/                # Ekran zamówień
│   └── Statistics/            # Dashboard
├── Shared/
│   ├── Styles/                # Resource Dictionaries
│   └── Controls/              # Reusable components
├── MainWindow.xaml
└── App.xaml
```

**Kluczowy kod — `MvuViewModel<TModel, TMsg>`:**
```csharp
public abstract class MvuViewModel<TModel, TMsg> : ObservableObject
    where TModel : notnull
{
    private TModel _model;
    private CancellationTokenSource _effectCts = new();
    private readonly Dispatcher _dispatcher = Application.Current.Dispatcher;

    protected MvuViewModel(TModel initialModel) => _model = initialModel;

    public TModel Model
    {
        get => _model;
        private set => SetProperty(ref _model, value);
    }

    // Czysta funkcja — jedyne miejsce zmiany stanu
    protected abstract (TModel NewModel, IEffect<TMsg>? Effect) Update(TModel model, TMsg message);

    // View wywołuje Dispatch z XAML (RelayCommand)
    public void Dispatch(TMsg message)
    {
        // Wymuszenie UI thread — effect callback może wrócić na background thread
        if (!_dispatcher.CheckAccess())
        {
            _dispatcher.Invoke(() => Dispatch(message));
            return;
        }

        var (newModel, effect) = Update(Model, message);
        Model = newModel;

        if (effect is not null)
        {
            _ = ExecuteEffectAsync(effect);
        }
    }

    private async Task ExecuteEffectAsync(IEffect<TMsg> effect)
    {
        try
        {
            var resultMsg = await effect.ExecuteAsync(_effectCts.Token);
            if (resultMsg is not null)
                Dispatch(resultMsg);
        }
        catch (OperationCanceledException) { /* nawigacja anulowała effect */ }
        catch (Exception ex)
        {
            // Subklasa powinna dostarczyć ErrorMsg
            var errorMsg = CreateErrorMessage(ex);
            if (errorMsg is not null)
                Dispatch(errorMsg);
        }
    }

    /// <summary>Fabryka wiadomości błędu — nadpisz w subklasie</summary>
    protected virtual TMsg? CreateErrorMessage(Exception ex) => default;

    /// <summary>Anuluj bieżące effecty (np. przy nawigacji)</summary>
    public void CancelEffects()
    {
        _effectCts.Cancel();
        _effectCts.Dispose();
        _effectCts = new CancellationTokenSource();
    }
}
```

**Zmiany vs. naiwna implementacja:**
1. **Brak `async void`** — `async void Dispatch` połykał wyjątki i crashował aplikację. Teraz `Dispatch` jest synchroniczny, a efekty lecą przez `ExecuteEffectAsync` z try-catch.
2. **Thread safety** — `Dispatcher.Invoke()` gwarantuje, że zmiana `Model` zawsze następuje na UI thread (efekt HTTP wraca na thread pool).
3. **CancellationToken** — efekty są anulowalne. Przy nawigacji wywołaj `CancelEffects()` żeby nie dispatchować wyników do starego ekranu.
4. **Konstruktor z `initialModel`** — wymuszamy przekazanie stanu początkowego, zamiast zostawiać `_model` niezainicjalizowany.

**`IEffect<TMsg>` — poprawiona sygnatura:**
```csharp
public interface IEffect<TMsg>
{
    Task<TMsg?> ExecuteAsync(CancellationToken ct);
}

// Kompozytowy efekt — gdy Update musi odpalić kilka side effects naraz
public class BatchEffect<TMsg> : IEffect<TMsg>
{
    private readonly IReadOnlyList<IEffect<TMsg>> _effects;
    public BatchEffect(params IEffect<TMsg>[] effects) => _effects = effects;

    public async Task<TMsg?> ExecuteAsync(CancellationToken ct)
    {
        TMsg? lastResult = default;
        foreach (var effect in _effects)
        {
            ct.ThrowIfCancellationRequested();
            lastResult = await effect.ExecuteAsync(ct);
        }
        return lastResult;
    }
}
```

---

### Dzień 2 — sobota 14.03 (4h) — Lista wydarzeń (TDD)

**Cel: w pełni działający ekran listy wydarzeń z wyszukiwaniem, pokryty testami**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 0.5h | 🔴 RED — testy dla `EventListUpdate` | Napisz `EventListUpdateTests` zanim napiszesz implementację. Przypadki: Search ustawia loading, EventsLoaded wypełnia listę, LoadFailed ustawia Error, PageChanged zmienia stronę. |
| 1h | 🟢 GREEN — `EventListModel` + `EventListMsg` + `EventListUpdate` | Implementuj minimalny kod żeby testy przechodziły. Czysta funkcja `Update`. |
| 0.5h | 🔵 REFACTOR — popraw kod | Testy nadal zielone. Wyczyść nazewnictwo, usuń duplikacje w Update. |
| 1h | View (XAML) | `EventListView.xaml` — pole wyszukiwania, lista z `ItemTemplate`, paginacja, loading indicator. Data binding do `Model`. |
| 0.5h | Effect — HTTP call | `SearchEventsEffect` wywołuje `EventlyApiClient.SearchEventsAsync()` i zwraca `EventsLoaded` msg. |
| 0.5h | Styling + polish | Karty wydarzeń w liście (border, padding, kolory statusu Published/Draft/Cancelled). |

**Deliverable:** Można wyszukiwać i przeglądać wydarzenia z API. `EventListUpdateTests` — wszystkie zielone.

#### Wskazówki

- **Model jest rekordem** (immutable!) — Update tworzy nowy przez `with {}`:
  ```csharp
  public record EventListModel(
      IReadOnlyList<EventDto> Events,
      string SearchTerm,
      int Page,
      int PageSize,
      int TotalCount,
      bool IsLoading,
      string? Error);
  ```

- **Messages — discriminated union via abstract sealed record:**
  ```csharp
  // abstract + brak publicznego konstruktora = zamknięta hierarchia (C# "poor man's DU")
  // pattern matching w Update gwarantuje obsługę wszystkich przypadków
  public abstract record EventListMsg
  {
      private EventListMsg() { } // zapobiega dziedziczeniu spoza tego pliku

      public sealed record Search(string Term) : EventListMsg;
      public sealed record PageChanged(int Page) : EventListMsg;
      public sealed record EventsLoaded(SearchEventsResponse Response) : EventListMsg;
      public sealed record LoadFailed(string Error) : EventListMsg;
  }
  ```

  **Update korzysta z pattern matching (exhaustive check):**
  ```csharp
  public static class EventListUpdate
  {
      public static (EventListModel, IEffect<EventListMsg>?) Update(
          EventListModel model, EventListMsg msg) => msg switch
      {
          EventListMsg.Search m => /* ... */,
          EventListMsg.PageChanged m => /* ... */,
          EventListMsg.EventsLoaded m => /* ... */,
          EventListMsg.LoadFailed m => /* ... */,
          _ => throw new InvalidOperationException($"Unhandled message: {msg}")
      };
  }
  ```

- **W XAML binduj do Model.Events, Model.IsLoading itd.** Użyj `BooleanToVisibilityConverter` dla loading state.

---

### Dzień 3 — niedziela 15.03 (4h) — Szczegóły + Koszyk (TDD)

**Cel: ekran szczegółów z typami biletów, dodawanie do koszyka, pokryte testami**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 0.5h | 🔴 RED — testy `EventDetailUpdateTests` + `CartUpdateTests` | **EventDetail:** `EventLoaded` ustawia dane, `LoadFailed` ustawia error. **Cart:** AddItem zwiększa ilość, AddItem istniejącego produktu akumuluje, RemoveItem usuwa pozycję, ClearCart czyści listę, TotalPrice jest przeliczany poprawnie, AddItem z quantity=0 jest ignorowany. |
| 1h | 🟢 GREEN — `CartModel` + `CartMsg` + `CartUpdate` + `EventDetailUpdate` | Implementuj oba Update'y. Szczególna uwaga na obliczanie `TotalPrice`. |
| 0.5h | 🔵 REFACTOR | Testy zielone. Przenieś obliczenia do metod w `CartModel` (np. `CartModel.CalculateTotal()`). |
| 1h | Event Detail + Cart — Views | `EventDetailView.xaml` z nawigacją z listy. XAML: tytuł, opis, lokalizacja, daty, lista ticket types z cenami. `CartView.xaml` — panel boczny. |
| 0.5h | Integracja Detail → Cart | Przycisk "Dodaj do koszyka". Effects do API `/carts/add`. Podłączenie `CancellationToken` w effectach. |
| 0.5h | Smoke test + `dotnet test` | Sprawdzenie flow lista → szczegóły → koszyk. Wszystkie testy zielone. |

**Deliverable:** Pełny flow lista → szczegóły → dodaj do koszyka. `CartUpdateTests` — wszystkie zielone.

#### Wskazówki

- W szczegółach wydarzenia użyj `Grid` z dwoma kolumnami: info po lewej, ticket types po prawej.
- Koszyk jako **panel boczny** (flyout/drawer) lub osobny ekran — zależy od preferencji. Panel boczny jest bardziej efektowny na prezentacji.
- Cart badge (licznik) w nawigacji — aktualizowany przez `CartModel.Items.Count`.

---

### Dzień 4 — poniedziałek 16.03 (4h) — Zamówienia + Statystyki (TDD)

**Cel: złożenie zamówienia z koszyka, dashboard statystyk, pokryte testami**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 0.5h | 🔴 RED — testy `StatisticsUpdateTests` | Przypadki: `StatisticsLoaded` ustawia dane, obliczenia procentowe (checked-in / sold), obsługa zerowych wartości (divide by zero!). |
| 0.5h | 🟢 GREEN — `StatisticsModel` + `StatisticsUpdate` | Implementuj z uwagą na edge case dzielenia przez zero. |
| 1h | Dashboard View | `StatisticsView.xaml` — kolorowe kafelki tiles (tickets sold, checked-in), `ProgressBar` % attendance, lista duplikatów. To highlight prezentacji — zadbaj o wygląd. |
| 0.5h | Create Order — `OrderUpdate` + testy | Test: `PlaceOrder` ustawia loading, `OrderCreated` czyści koszyk i przechodzi do potwierdzenia. Effect: `POST /orders`. |
| 1h | Lista zamówień + View | `OrderListModel`, `OrderListView.xaml` — lista zamówień z pozycjami. |
| 0.5h | Nawigacja end-to-end | Sprawdzenie pełnego flow, fix bugów nawigacji. |

**Deliverable:** Pełny flow zakupowy + dashboard. Wszystkie testy zielone.

#### Wskazówki — Dashboard

- Użyj `ProgressBar` lub custom control do pokazania % checked-in vs sold.
- Kolorowe kafelki (tiles) ze statystykami — prosty `Border` + `StackPanel` z dużą cyfrą i opisem.
- To będzie highlight prezentacji — włóż tu trochę wysiłku w wygląd.

---

### Dzień 5 — wtorek 17.03 (4h) — Polish + Error handling + Pokrycie testami

**Cel: profesjonalny wygląd, obsługa błędów, kompletne testy**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 1h | 🔴🟢 Brakujące testy edge cases | Dopisz testy dla scenariuszy błędów we wszystkich Update'ach: timeout, HTTP 404, HTTP 500. Wzorzec: `LoadFailed(error)` → `model.Error` ustawiony, `model.IsLoading` false. |
| 0.5h | Global error handling | Każdy Model ma `string? Error`. Shared `ErrorBanner` control. Obsługa timeout/offline. |
| 0.5h | Loading states | Spinners na każdym ekranie. Disable przycisków gdy `IsLoading = true`. |
| 1h | Styling końcowy | Resource Dictionary ze spójnymi kolorami i fontami. Responsywne layouty. |
| 1h | Smoke testing + `dotnet test` | Przejście przez cały flow ręcznie. Uruchom `dotnet test` — zero czerwonych. Fix last-minute bugów. |

**Deliverable:** Aplikacja obsługuje błędy gracefully. `dotnet test` — wszystkie testy zielone.

---

### Dzień 6 — środa 18.03 (4h) — Prezentacja

**Cel: przygotowanie demo i prezentacja**

| Czas | Zadanie | Szczegóły |
|------|---------|-----------|
| 1h | Przygotowanie danych demo | Seed bazy danych: kilka kategorii, 5-10 wydarzeń, ticket types z różnymi cenami. Pre-fill koszyk i zamówienia żeby mieć dane do pokazania. |
| 1h | Scenariusz demo | Spisanie kroków demo. Przejście: Wyszukiwanie → Szczegóły → Koszyk → Zamówienie → Statystyki. Przygotowanie fallbacku (co jeśli API nie odpowiada). |
| 1h | Slajdy / notatki o architekturze | 3-5 slajdów: diagram MVU, porównanie z MVVM, dlaczego MVU w WPF, lessons learned. |
| 1h | Próba generalna | Pełne przejście demo 2-3 razy. Timing. Przygotowanie na pytania. |

**Deliverable:** Gotowość do prezentacji.

---

## TDD w MVU — Dlaczego to idealne połączenie

MVU i TDD naturalnie do siebie pasują. `Update()` to **czysta funkcja** — nie potrzebuje UI, nie potrzebuje mocków, nie potrzebuje bazy danych. Test wygląda tak:

```csharp
// ARRANGE
var initialModel = new EventListModel(Events: [], SearchTerm: "", Page: 1, ...);
var message = new EventListMsg.Search("Konferencja");

// ACT
var (newModel, effect) = EventListUpdate.Update(initialModel, message);

// ASSERT
newModel.SearchTerm.Should().Be("Konferencja");
newModel.IsLoading.Should().BeTrue();
effect.Should().BeOfType<SearchEventsEffect>();
```

### Cykl Red → Green → Refactor dla każdego ekranu

```
1. RED    — napisz test który opisuje zachowanie (test nie przechodzi, a nawet się nie kompiluje)
2. GREEN  — napisz MINIMALNY kod który sprawia że test przechodzi
3. REFACTOR — popraw kod bez zmiany zachowania (testy nadal zielone)
```

### Konwencja nazewnictwa testów

```csharp
// Wzorzec: Update_GdyWiadomość_PowinienZmienićStan
[Fact]
public void Update_WhenSearchMessage_ShouldSetIsLoadingAndSearchTerm()

[Fact]
public void Update_WhenEventsLoaded_ShouldPopulateListAndClearLoading()

[Fact]
public void Update_WhenLoadFailed_ShouldSetErrorAndClearLoading()

// Edge cases
[Fact]
public void Update_WhenSearchWithEmptyTerm_ShouldLoadAllEvents()

[Fact]
public void Update_WhenEventsLoadedWithEmptyList_ShouldShowEmptyState()
```

### Helper do testów — Factory Method dla modelu

```csharp
// W każdej klasie testowej — fabryka modelu startowego
private static EventListModel EmptyModel() => new(
    Events: [],
    SearchTerm: "",
    Page: 1,
    PageSize: 10,
    TotalCount: 0,
    IsLoading: false,
    Error: null);

private static EventListModel LoadingModel() => EmptyModel() with { IsLoading = true };
```

> **Zasada:** każdy test powinien być niezależny — nie polegaj na kolejności uruchamiania.

### Co testujemy (i czego nie)

| Co testujemy ✅ | Czego NIE testujemy ❌ |
|----------------|----------------------|
| Funkcja `Update()` — logika przejść stanu | XAML / View (za dużo ceremony) |
| Walidacja wiadomości (poprawne modele po akcjach) | Effects z HTTP (to byłyby testy integracyjne) |
| Edge cases: pusta lista, błąd, loading state | `MvuViewModel` base class (infrastruktura) |
| Obliczenia: suma koszyka, % checked-in | Nawigacja |

### Projekt testowy

```
Evently.Client.Wpf.Tests/
├── Features/
│   ├── Events/
│   │   ├── EventListUpdateTests.cs
│   │   └── EventDetailUpdateTests.cs
│   ├── Cart/
│   │   └── CartUpdateTests.cs
│   ├── Orders/
│   │   └── OrderUpdateTests.cs
│   └── Statistics/
│       └── StatisticsUpdateTests.cs
└── Evently.Client.Wpf.Tests.csproj
```

### Setup projektu testowego

```bash
dotnet new xunit -n Evently.Client.Wpf.Tests -o Evently.Client.Wpf.Tests
dotnet sln Evently/Evently.sln add Evently.Client.Wpf.Tests/Evently.Client.Wpf.Tests.csproj
cd Evently.Client.Wpf.Tests
dotnet add reference ../Evently.Client.Wpf/Evently.Client.Wpf.csproj
dotnet add package FluentAssertions
```

---

## Architektura MVU — Reguły dla każdego ekranu

Każdy ekran (feature) składa się z **dokładnie 4 elementów**:

```
Features/Events/
├── EventListModel.cs      # immutable record — stan ekranu
├── EventListMsg.cs        # sealed record hierarchy — możliwe akcje
├── EventListUpdate.cs     # czysta funkcja (model, msg) → (model, effect?)
└── EventListView.xaml     # XAML + code-behind z Dispatch
```

### Zasady:
1. **Model jest ZAWSZE immutable** — używaj `record` i `with {}`
2. **Update jest CZYSTĄ FUNKCJĄ** — zero side effects, zero async, zero HTTP
3. **Side effects idą przez `IEffect<TMsg>`** — HTTP, nawigacja, timer
4. **View NIGDY nie modyfikuje stanu** — tylko wywołuje `Dispatch(msg)`
5. **Jednokierunkowy przepływ danych** — View → Message → Update → Model → View
6. **Update to statyczna metoda w osobnej klasie** — nie w ViewModel, żeby testy nie wymagały tworzenia VM

### WPF Binding — jak to działa z immutable Model

Binding `{Binding Model.Events}` działa poprawnie, ponieważ:
- `SetProperty` na `Model` odpala `PropertyChanged("Model")`
- WPF binding engine re-ewaluuje cały path `Model.Events` gdy `Model` się zmieni
- Nie potrzebujemy `INotifyCollectionChanged` na kolekcjach w modelu, bo NIGDY nie mutujemy kolekcji — zawsze zastępujemy cały `Model`

**Uwaga na performance:** Przy dużych listach (100+ elementów) WPF przebudowuje cały `ItemsControl`. Jeśli to będzie problem — użyj `VirtualizingStackPanel.IsVirtualizing="True"` (domyślnie włączone w `ListBox`).

### Composition Root — DI w `App.xaml.cs`

```csharp
public partial class App : Application
{
    private readonly ServiceProvider _serviceProvider;

    public App()
    {
        var services = new ServiceCollection();

        // HTTP Client
        services.AddHttpClient<EventlyApiClient>(client =>
        {
            client.BaseAddress = new Uri("https://localhost:5001");
        });

        // Nawigacja
        services.AddSingleton<NavigationService>();

        // ViewModels
        services.AddTransient<EventListViewModel>();
        services.AddTransient<EventDetailViewModel>();
        services.AddTransient<CartViewModel>();
        services.AddTransient<OrderListViewModel>();
        services.AddTransient<StatisticsViewModel>();

        // Main Window
        services.AddSingleton<MainWindow>();

        _serviceProvider = services.BuildServiceProvider();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        var mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
        mainWindow.Show();
    }
}
```

> **Base URL API** — wyciągnij do `appsettings.json` lub przynajmniej do stałej. Nie hardcoduj w kilku miejscach.

---

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| UI Framework | WPF (.NET 8) |
| Base class | `CommunityToolkit.Mvvm` (ObservableObject) |
| HTTP | `HttpClient` + `System.Net.Http.Json` |
| Serialization | `System.Text.Json` |
| DI | `Microsoft.Extensions.DependencyInjection` |
| Styling | Custom ResourceDictionary (bez zewnętrznych UI libs) |
| Testy | `xUnit` + `FluentAssertions` |

> **Celowo nie używamy biblioteki UI** (MaterialDesign, MahApps) — pokazujemy czystą implementację MVU bez magii frameworka.

---

## Endpointy API używane przez klienta

| Ekran | Metoda | Endpoint | Opis |
|-------|--------|----------|------|
| Lista wydarzeń | PUT | `/events/search` | Wyszukiwanie z filtrami |
| Szczegóły | GET | `/events/{id}` | Wydarzenie + ticket types |
| Kategorie (filtr) | GET | `/categories` | Lista kategorii do filtra |
| Koszyk | GET | `/carts` | Pobranie koszyka |
| Koszyk | PUT | `/carts/add` | Dodanie pozycji |
| Koszyk | PUT | `/carts/remove` | Usunięcie pozycji |
| Zamówienie | POST | `/orders` | Złożenie zamówienia |
| Zamówienia | GET | `/orders` | Lista zamówień |
| Zamówienie | GET | `/orders/{id}` | Szczegóły zamówienia |
| Statystyki | GET | `/event-statistics/{id}` | Dashboard attendance |

---

## Ryzyka i mitygacja

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|--------|---------------------|-----------|
| Autentykacja Keycloak | Wysokie | Dzień 1: sprawdź czy API działa bez auth w dev mode. Jeśli nie — dodaj prosty login screen z token flow. Alternatywnie: wyłącz auth w `appsettings.Development.json` backendu. |
| Brak danych w bazie | Średnie | Przygotuj skrypt seed LUB napisz prosty `DataSeeder` w Dniu 1 który tworzy dane przez API. Nie czekaj do Dnia 6. |
| WPF binding do immutable record | Niskie | `PropertyChanged("Model")` re-ewaluuje cały path. Testuj binding wcześnie (Dzień 2 — pierwszy ekran). |
| Za mało czasu na styling | Średnie | Priorytet: działający flow > wygląd. Prosty, czysty design > fancy ale niedokończony. |
| TDD spowalnia development | Niskie | MVU Update testy są trywialne (3-5 linii). Narzut ~15min/ekran. Zysk: mniej bugów w Dniu 5. |
| Effect callback na background thread | Wysokie | Rozwiązane w `MvuViewModel.Dispatch()` — `Dispatcher.Invoke()` wymusza UI thread. Testuj wcześnie. |
| Stale effects po nawigacji | Średnie | `CancelEffects()` w `NavigationService` przy zmianie ekranu. Bez tego — dispatch do starego ViewModel. |

---

## Czego NIE robimy (out of scope)

- ❌ Rejestracja / logowanie użytkownika (hardcoded customer ID)
- ❌ CRUD na wydarzeniach (admin panel) — tylko odczyt
- ❌ Płatności i refundy
- ❌ Check-in (to operacja organizatora)
- ❌ Testy integracyjne z API (tylko testy jednostkowe warstwy Update)
- ❌ Reactive Extensions / System.Reactive (overkill dla scope)

---

## Dobre praktyki — checklist

### Kod
- [ ] **Żadnych `async void`** — jedyne wyjątki: event handlers w WPF code-behind (`async void Button_Click` jest OK, ale lepiej użyj `RelayCommand`)
- [ ] **`CancellationToken` w każdym efekcie** — propaguj z `MvuViewModel` do `HttpClient`
- [ ] **`ConfigureAwait(false)` w effectach** — nie blokuj UI thread w efektach (dispatch i tak wraca przez `Dispatcher.Invoke`)
- [ ] **`sealed` na konkretnych klasach** — ViewModels, Effects, Models — zapobiega niezamierzonemu dziedziczeniu
- [ ] **Kolekcje w modelach: `ImmutableList<T>` lub `IReadOnlyList<T>`** — nigdy `List<T>`, bo ktoś mógłby zmutować
- [ ] **`decimal` dla kwot pieniężnych** — nigdy `double` (zaokrąglenia!)
- [ ] **RelayCommand zamiast event handlers w code-behind** — mniej code-behind, łatwiejszy binding

### Testy
- [ ] **Jedna asercja logiczna per test** — `FluentAssertions` pozwala na `SatisfyRespectively` jeśli trzeba sprawdzić kilka rzeczy naraz
- [ ] **Arrange-Act-Assert** — wyraźne separatory (pusta linia między sekcjami)
- [ ] **Factory methods dla modeli** — `EmptyModel()`, `LoadingModel()`, `ModelWithEvents(...)` — DRY, czytelne testy
- [ ] **Nazwa testu = specyfikacja** — `Update_WhenSearchMessage_ShouldSetIsLoadingAndSearchTerm`
- [ ] **Uruchamiaj `dotnet test` po każdym kroku GREEN** — nie kumuluj
- [ ] **Brak logiki w testach** — zero if/else, zero pętli, zero try-catch w testach

### Architektura
- [ ] **Update nigdy nie zwraca `Task`** — to czysta funkcja, synchroniczna, deterministic
- [ ] **Effect nigdy nie zmienia modelu** — tylko zwraca `TMsg` dla `Dispatch`
- [ ] **Jeden ViewModel per ekran** — nie dziel ekranu na kilka ViewModeli (to nie MVVM)
- [ ] **NavigationService anuluje effecty** przy zmianie ekranu

---

## Punkty do podkreślenia na prezentacji

1. **MVU vs MVVM** — porównanie: MVU ma przewidywalny, liniowy przepływ stanu vs MVVM z dwukierunkowym bindingiem i rozproszonym stanem
2. **TDD + MVU = naturalne połączenie** — `Update()` to czysta funkcja, test to jednolinijkowe `(model, msg) → newModel`. Zero mocków, zero DI, zero setupu
3. **Testy jako specyfikacja** — testy napisane PRZED kodem opisują zachowanie systemu, nie implementację
4. **Time-travel debugging** — możliwość logowania każdego `(Model, Msg)` → odtworzenie stanu, replayowalność
5. **Separation of concerns** — View nie wie nic o logice, Update nie wie nic o UI, testy nie wiedzą nic o WPF
6. **Modular Monolith + WPF** — jak gruby klient konsumuje API modularnego monolitu
