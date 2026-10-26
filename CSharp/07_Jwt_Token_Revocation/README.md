# 07 – Odwoływanie JWT przed wygaśnięciem (token_version)

Implementacja artykułu Milana Jovanovicia
[Revoke a JWT Before It Expires](https://milanjovanovic.tech/blog/revoke-jwt-before-it-expires-token-version)
w .NET 10 (Minimal API + EF Core + PostgreSQL) z testami integracyjnymi (xUnit v3, Testcontainers, Shouldly).

## Problem

`AddJwtBearer` sprawdza tylko podpis, issuer, audience i `exp`. **Nie pyta bazy danych.**
Po zmianie hasła albo kradzieży tokenu stary access token działa dalej, dopóki nie wygaśnie.

## Rozwiązanie w dwóch krokach

### Krok 1 – krótkie access tokeny + rotowane refresh tokeny

| Element | Gdzie w kodzie |
|---|---|
| Access token ważny 5 min, `ClockSkew` 30 s | `appsettings.json`, `Program.cs` |
| Refresh token losowy, w bazie tylko hash SHA-256 | `Auth/TokenService.cs` |
| **Rodzina** (`FamilyId`) = jedno logowanie = jedno urządzenie | `Database/RefreshToken.cs` |
| Absolutne wygaśnięcie rodziny (14 dni), rotacja go nie przedłuża | `TokenService.Rotate` |
| Atomowe „zajęcie” tokenu: `UPDATE ... WHERE UsedAt IS NULL` | `AuthEndpoints.RefreshAsync` |
| 0 zmienionych wierszy = ponowne użycie = kradzież: usuń rodzinę i podbij wersję | `SessionRevocation.RevokeStolenFamilyAsync` |

### Krok 2 – `token_version` sprawdzany przy każdym żądaniu

```
User.TokenVersion (baza)  ──kopiowany przy wydaniu──►  claim "token_version" (JWT)

Żądanie z JWT
  └─ JwtBearer: podpis / issuer / audience / exp  (bez bazy)
      └─ OnTokenValidated (TokenVersionCheck.cs) – jedno zapytanie:
           user istnieje i IsActive?            nie → 401
           TokenVersion == claim?               nie → 401
           rodzina "sid" nadal istnieje?        nie → 401
```

| Akcja | Co robi | Skutek |
|---|---|---|
| `POST /auth/logout` | usuwa rodzinę z `sid` | **tylko to urządzenie** traci dostęp natychmiast |
| `POST /auth/logout-all` | usuwa wszystkie refresh tokeny + `TokenVersion++` | **wszystkie** urządzenia tracą dostęp natychmiast |
| `POST /auth/change-password` | nowe hasło + to samo co wyżej | jw. |
| `IsActive = false` | – | wszystkie tokeny odrzucane |
| ponowne użycie refresh tokena | usuwa rodzinę + `TokenVersion++` | wszystkie urządzenia wylogowane |

## Na co zwrócić uwagę w kodzie

- `options.MapInboundClaims = false` – bez tego `sub` zostałby zamieniony na długi URI `ClaimTypes.NameIdentifier`.
- W `RefreshAsync` zajęcie starego tokenu i zapis nowego są **w jednej transakcji**. Bez niej równoległe
  wykrycie kradzieży mogłoby usunąć rodzinę, a spóźniony `INSERT` przywróciłby ją do życia.
- Koszt: każde uwierzytelnione żądanie robi zapytanie do bazy (w artykule ok. +0,65 ms i kilkukrotnie
  mniejsza przepustowość). Artykuł proponuje Redis jako cache, ale baza pozostaje źródłem prawdy.
  Tu celowo bez cache.
- Ograniczenie z artykułu: dwie karty odświeżające równocześnie wyglądają jak kradzież
  (test `ConcurrentRefresh_WithSameToken_OnlyOneRequestCanClaimIt`). Klient powinien odświeżać z jednego miejsca.
- Schemat tworzony przez `EnsureCreated` (tylko demo, w prawdziwej aplikacji migracje).

## Testy

Wymagany działający Docker (Testcontainers uruchamia `postgres:17-alpine`).

```bash
dotnet test
```

| Klasa | Co pokazuje |
|---|---|
| `LoginTests` | claimy `token_version` / `sid`, osobna sesja na każde logowanie |
| `TokenVersionTests` | logout-all, zmiana hasła, dezaktywacja, ręczne podbicie wersji w bazie → stary, **niewygasły** token dostaje 401 |
| `SessionTests` | wylogowanie jednego urządzenia nie rusza pozostałych |
| `RefreshTokenRotationTests` | rotacja, wykrycie kradzieży, równoległe odświeżanie, absolutne wygaśnięcie (FakeTimeProvider) |

Eksperyment: w `Program.cs` zamień `OnTokenValidated = TokenVersionCheck.OnTokenValidated`
na `OnTokenValidated = _ => Task.CompletedTask` i uruchom testy. Padnie 7 testów,
czyli dokładnie te, które sprawdzają natychmiastowe odwołanie tokenu.

## Uruchomienie ręczne

```bash
docker compose up -d
dotnet run --project src/JwtRevocation.Api
```

Potem przejdź scenariusz z `src/JwtRevocation.Api/JwtRevocation.Api.http`.
