# PostgreSQL - Kompletna sciagawka funkcji

> Wszystkie przyklady korzystaja z bazy AdventureWorks (Docker: chriseaton/adventureworks:postgres)
> Polaczenie: host=localhost, port=5432, user=postgres, password=admin123, db=adventureworks

---

## 1. FUNKCJE TEKSTOWE (STRING)

### Podstawowe

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `LENGTH(s)` | Dlugosc stringa | `SELECT LENGTH('Hello')` | `5` |
| `CHAR_LENGTH(s)` | Dlugosc w znakach | `SELECT CHAR_LENGTH('Cześć')` | `5` |
| `OCTET_LENGTH(s)` | Dlugosc w bajtach | `SELECT OCTET_LENGTH('Cześć')` | `7` (UTF-8) |
| `UPPER(s)` | Wielkie litery | `SELECT UPPER('hello')` | `HELLO` |
| `LOWER(s)` | Male litery | `SELECT LOWER('HELLO')` | `hello` |
| `INITCAP(s)` | Pierwsza litera wielka | `SELECT INITCAP('hello world')` | `Hello World` |

### Przycinanie i padding

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `TRIM(s)` | Usun spacje z obu stron | `SELECT TRIM('  hi  ')` | `'hi'` |
| `LTRIM(s)` | Usun spacje z lewej | `SELECT LTRIM('  hi')` | `'hi'` |
| `RTRIM(s)` | Usun spacje z prawej | `SELECT RTRIM('hi  ')` | `'hi'` |
| `TRIM(chars FROM s)` | Usun konkretne znaki | `SELECT TRIM('x' FROM 'xxhixx')` | `'hi'` |
| `LPAD(s, len, fill)` | Dopelnij z lewej | `SELECT LPAD('42', 5, '0')` | `'00042'` |
| `RPAD(s, len, fill)` | Dopelnij z prawej | `SELECT RPAD('hi', 5, '.')` | `'hi...'` |

### Wycinanie i laczenie

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `SUBSTRING(s FROM pos FOR len)` | Wytnij fragment | `SELECT SUBSTRING('Hello' FROM 2 FOR 3)` | `'ell'` |
| `LEFT(s, n)` | Pierwsze n znakow | `SELECT LEFT('Hello', 3)` | `'Hel'` |
| `RIGHT(s, n)` | Ostatnie n znakow | `SELECT RIGHT('Hello', 3)` | `'llo'` |
| `CONCAT(s1, s2, ...)` | Polacz stringi | `SELECT CONCAT('A', 'B', 'C')` | `'ABC'` |
| `CONCAT_WS(sep, s1, s2)` | Polacz z separatorem | `SELECT CONCAT_WS(', ', 'Jan', 'Kowalski')` | `'Jan, Kowalski'` |
| `\|\|` | Operator konkatenacji | `SELECT 'Hello' \|\| ' ' \|\| 'World'` | `'Hello World'` |

### Wyszukiwanie i zamiana

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `POSITION(sub IN s)` | Pozycja podstringa | `SELECT POSITION('ll' IN 'Hello')` | `3` |
| `STRPOS(s, sub)` | Pozycja (alternatywa) | `SELECT STRPOS('Hello', 'll')` | `3` |
| `REPLACE(s, from, to)` | Zamien tekst | `SELECT REPLACE('Hello', 'l', 'r')` | `'Herro'` |
| `TRANSLATE(s, from, to)` | Zamien znaki 1:1 | `SELECT TRANSLATE('abc', 'ab', 'XY')` | `'XYc'` |
| `OVERLAY(s PLACING r FROM p)` | Nadpisz fragment | `SELECT OVERLAY('Hello' PLACING 'XX' FROM 3)` | `'HeXXo'` |
| `REVERSE(s)` | Odwroc string | `SELECT REVERSE('Hello')` | `'olleH'` |
| `REPEAT(s, n)` | Powtorz n razy | `SELECT REPEAT('ha', 3)` | `'hahaha'` |

### Dzielenie stringow

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `SPLIT_PART(s, delim, n)` | N-ta czesc po split | `SELECT SPLIT_PART('a.b.c', '.', 2)` | `'b'` |
| `STRING_TO_ARRAY(s, delim)` | String na tablice | `SELECT STRING_TO_ARRAY('a,b,c', ',')` | `{a,b,c}` |
| `ARRAY_TO_STRING(arr, delim)` | Tablica na string | `SELECT ARRAY_TO_STRING(ARRAY['a','b'], ',')` | `'a,b'` |

### Regex

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `s ~ pattern` | Regex match (case-sensitive) | `SELECT 'Hello' ~ '^H'` | `true` |
| `s ~* pattern` | Regex match (case-insensitive) | `SELECT 'Hello' ~* '^h'` | `true` |
| `s !~ pattern` | Regex not match | `SELECT 'Hello' !~ '^X'` | `true` |
| `REGEXP_MATCH(s, pat)` | Pierwszy match (tablica) | `SELECT REGEXP_MATCH('abc123', '(\d+)')` | `{123}` |
| `REGEXP_MATCHES(s, pat, 'g')` | Wszystkie matche | `SELECT REGEXP_MATCHES('a1b2', '(\d)', 'g')` | `{1}, {2}` |
| `REGEXP_REPLACE(s, pat, rep)` | Zamiana regex | `SELECT REGEXP_REPLACE('abc123', '\d', 'X', 'g')` | `'abcXXX'` |
| `REGEXP_SPLIT_TO_TABLE(s, pat)` | Split regex na wiersze | `SELECT REGEXP_SPLIT_TO_TABLE('a1b2c', '\d')` | `a, b, c` |
| `REGEXP_SPLIT_TO_ARRAY(s, pat)` | Split regex na tablice | `SELECT REGEXP_SPLIT_TO_ARRAY('a1b2c', '\d')` | `{a,b,c}` |

### Pattern matching

| Operator | Opis | Przyklad |
|----------|------|----------|
| `LIKE` | Pattern matching (case-sensitive) | `WHERE name LIKE 'A%'` |
| `ILIKE` | Pattern matching (case-insensitive) | `WHERE name ILIKE 'a%'` |
| `SIMILAR TO` | SQL regex (miedzy LIKE a ~) | `WHERE name SIMILAR TO '(A\|B)%'` |

### Przyklad na AdventureWorks:
```sql
-- Polacz imie i nazwisko, zamien na wielkie litery
SELECT
    UPPER(LEFT(p.firstname, 1)) || '. ' || p.lastname AS short_name,
    LENGTH(p.lastname) AS name_length,
    INITCAP(LOWER(p.firstname || ' ' || p.lastname)) AS full_name
FROM person.person p
LIMIT 10;

-- Znajdz produkty z 'Mountain' w nazwie (case-insensitive)
SELECT name, productnumber
FROM production.product
WHERE name ILIKE '%mountain%';

-- Wyciagnij czesc numeru produktu
SELECT
    productnumber,
    SPLIT_PART(productnumber, '-', 1) AS prefix,
    SPLIT_PART(productnumber, '-', 2) AS middle
FROM production.product
LIMIT 10;
```

---

## 2. FUNKCJE NUMERYCZNE / MATEMATYCZNE

### Zaokraglanie

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `ROUND(n)` | Zaokraglij do calkowitej | `SELECT ROUND(4.6)` | `5` |
| `ROUND(n, d)` | Zaokraglij do d miejsc | `SELECT ROUND(4.567, 2)` | `4.57` |
| `CEIL(n)` / `CEILING(n)` | Zaokraglij w gore | `SELECT CEIL(4.1)` | `5` |
| `FLOOR(n)` | Zaokraglij w dol | `SELECT FLOOR(4.9)` | `4` |
| `TRUNC(n, d)` | Obetnij do d miejsc | `SELECT TRUNC(4.567, 2)` | `4.56` |

### Arytmetyka

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `ABS(n)` | Wartosc bezwzgledna | `SELECT ABS(-5)` | `5` |
| `MOD(a, b)` | Reszta z dzielenia | `SELECT MOD(10, 3)` | `1` |
| `POWER(a, b)` | Potega | `SELECT POWER(2, 10)` | `1024` |
| `SQRT(n)` | Pierwiastek kwadratowy | `SELECT SQRT(144)` | `12` |
| `CBRT(n)` | Pierwiastek szescienny | `SELECT CBRT(27)` | `3` |
| `SIGN(n)` | Znak (-1, 0, 1) | `SELECT SIGN(-5)` | `-1` |
| `DIV(a, b)` | Dzielenie calkowite | `SELECT DIV(10, 3)` | `3` |

### Logarytmy i trygonometria

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `LN(n)` | Logarytm naturalny | `SELECT LN(2.718)` | `~1` |
| `LOG(base, n)` | Logarytm o podst. base | `SELECT LOG(10, 100)` | `2` |
| `LOG10(n)` | Logarytm dziesietny | `SELECT LOG10(1000)` | `3` |
| `EXP(n)` | e^n | `SELECT EXP(1)` | `2.718...` |
| `PI()` | Liczba Pi | `SELECT PI()` | `3.14159...` |
| `SIN/COS/TAN(n)` | Trygonometria (radiany) | `SELECT SIN(PI()/2)` | `1` |
| `DEGREES(rad)` | Radiany na stopnie | `SELECT DEGREES(PI())` | `180` |
| `RADIANS(deg)` | Stopnie na radiany | `SELECT RADIANS(180)` | `3.14...` |

### Losowe i sekwencje

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `RANDOM()` | Losowa 0.0 - 1.0 | `SELECT RANDOM()` | `0.7342...` |
| `SETSEED(s)` | Ustaw seed dla RANDOM | `SELECT SETSEED(0.5)` | |
| `GENERATE_SERIES(start, stop)` | Generuj sekwencje | `SELECT GENERATE_SERIES(1, 5)` | `1,2,3,4,5` |
| `GENERATE_SERIES(s, e, step)` | Sekwencja z krokiem | `SELECT GENERATE_SERIES(0, 10, 2)` | `0,2,4,6,8,10` |

### Przyklad na AdventureWorks:
```sql
-- Ceny produktow z zaokragleniami
SELECT
    name,
    listprice,
    ROUND(listprice, 0) AS rounded,
    CEIL(listprice) AS ceiling,
    FLOOR(listprice) AS floor,
    ROUND(listprice * 1.23, 2) AS with_tax
FROM production.product
WHERE listprice > 0
LIMIT 10;

-- Statystyki cenowe
SELECT
    ROUND(AVG(listprice), 2) AS avg_price,
    ROUND(SQRT(VARIANCE(listprice)), 2) AS std_dev,
    ROUND(LOG(10, MAX(listprice)), 2) AS log10_max
FROM production.product
WHERE listprice > 0;

-- Losowa probka 5 produktow
SELECT name, listprice
FROM production.product
WHERE listprice > 0
ORDER BY RANDOM()
LIMIT 5;
```

---

## 3. FUNKCJE DATY I CZASU

### Aktualna data/czas

| Funkcja | Opis | Zwraca |
|---------|------|--------|
| `NOW()` | Aktualny timestamp z timezone | `2024-01-15 14:30:00+01` |
| `CURRENT_TIMESTAMP` | = NOW() (standard SQL) | `2024-01-15 14:30:00+01` |
| `CURRENT_DATE` | Dzisiejsza data | `2024-01-15` |
| `CURRENT_TIME` | Aktualny czas z timezone | `14:30:00+01` |
| `LOCALTIME` | Czas bez timezone | `14:30:00` |
| `LOCALTIMESTAMP` | Timestamp bez timezone | `2024-01-15 14:30:00` |
| `CLOCK_TIMESTAMP()` | Rzeczywisty czas (zmienia sie w query) | dynamiczny |
| `STATEMENT_TIMESTAMP()` | Czas poczatku zapytania | staly per statement |
| `TRANSACTION_TIMESTAMP()` | = NOW(), czas poczatku transakcji | staly per transaction |

### Wyciaganie czesci daty

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `EXTRACT(field FROM ts)` | Wyciagnij czesc | `EXTRACT(YEAR FROM NOW())` | `2024` |
| `DATE_PART('field', ts)` | = EXTRACT (alternatywa) | `DATE_PART('month', NOW())` | `1` |
| `DATE_TRUNC('field', ts)` | Obetnij do pola | `DATE_TRUNC('month', '2024-01-15'::date)` | `2024-01-01` |

**Dostepne pola EXTRACT / DATE_TRUNC:**
`year`, `quarter`, `month`, `week`, `day`, `hour`, `minute`, `second`,
`dow` (day of week, 0=Sun), `doy` (day of year), `epoch` (sekundy od 1970),
`isodow` (1=Mon..7=Sun), `isoyear`

### Tworzenie dat

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `MAKE_DATE(y, m, d)` | Stworz date | `MAKE_DATE(2024, 1, 15)` | `2024-01-15` |
| `MAKE_TIME(h, m, s)` | Stworz czas | `MAKE_TIME(14, 30, 0)` | `14:30:00` |
| `MAKE_TIMESTAMP(y,m,d,h,min,s)` | Stworz timestamp | `MAKE_TIMESTAMP(2024,1,15,14,30,0)` | `2024-01-15 14:30:00` |
| `MAKE_TIMESTAMPTZ(...)` | Timestamp z TZ | jak wyzej + timezone | |
| `TO_TIMESTAMP(epoch)` | Epoch na timestamp | `TO_TIMESTAMP(1705312200)` | `2024-01-15 ...` |
| `TO_TIMESTAMP(s, fmt)` | String na timestamp | `TO_TIMESTAMP('2024-01-15', 'YYYY-MM-DD')` | `2024-01-15` |
| `TO_DATE(s, fmt)` | String na date | `TO_DATE('15/01/2024', 'DD/MM/YYYY')` | `2024-01-15` |

### Arytmetyka dat (INTERVAL)

| Operacja | Przyklad | Wynik |
|----------|----------|-------|
| Dodaj interval | `NOW() + INTERVAL '7 days'` | za 7 dni |
| Odejmij interval | `NOW() - INTERVAL '1 month'` | miesiac temu |
| Roznica dat | `'2024-12-31'::date - '2024-01-01'::date` | `365` (integer days) |
| AGE() | `AGE('2024-06-15', '2024-01-01')` | `5 mons 14 days` |
| AGE(ts) | `AGE(TIMESTAMP '2000-01-01')` | wiek od daty |

**Skladnia INTERVAL:**
```sql
INTERVAL '1 year 2 months 3 days 4 hours 5 minutes 6 seconds'
INTERVAL '1-2'        -- 1 year 2 months (year-month format)
INTERVAL '3 4:05:06'  -- 3 days 4 hours 5 min 6 sec (day-time format)
```

### Formatowanie dat

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `TO_CHAR(ts, fmt)` | Data na string | `TO_CHAR(NOW(), 'YYYY-MM-DD')` | `'2024-01-15'` |
| `TO_CHAR(ts, fmt)` | Z dniem tygodnia | `TO_CHAR(NOW(), 'Day, DD Mon YYYY')` | `'Monday, 15 Jan 2024'` |
| `TO_CHAR(n, fmt)` | Liczba na string | `TO_CHAR(1234.5, 'FM9,999.00')` | `'1,234.50'` |

**Popularne kody formatowania:**
`YYYY` rok, `MM` miesiac, `DD` dzien, `HH24` godzina 24h, `MI` minuty, `SS` sekundy,
`Day` pelna nazwa dnia, `Mon` skrot miesiaca, `Q` kwartal, `WW` tydzien roku

### Generowanie sekwencji dat

```sql
-- Generuj kazdy dzien w styczniu 2024
SELECT d::date
FROM GENERATE_SERIES('2024-01-01'::date, '2024-01-31'::date, '1 day'::interval) d;

-- Generuj pierwszy dzien kazdego miesiaca
SELECT d::date
FROM GENERATE_SERIES('2024-01-01'::date, '2024-12-01'::date, '1 month'::interval) d;
```

### Przyklad na AdventureWorks:
```sql
-- Zamowienia pogrupowane miesiecznie
SELECT
    DATE_TRUNC('month', orderdate) AS month,
    TO_CHAR(orderdate, 'YYYY-MM') AS month_label,
    COUNT(*) AS order_count,
    ROUND(SUM(totaldue)::numeric, 2) AS total_sales
FROM sales.salesorderheader
GROUP BY DATE_TRUNC('month', orderdate), TO_CHAR(orderdate, 'YYYY-MM')
ORDER BY month;

-- Ile dni minelo od zamowienia
SELECT
    salesorderid,
    orderdate,
    AGE(NOW(), orderdate) AS age,
    EXTRACT(DAY FROM NOW() - orderdate) AS days_ago
FROM sales.salesorderheader
ORDER BY orderdate DESC
LIMIT 10;

-- Zamowienia z ostatnich 6 miesiecy (wzgledem najnowszego zamowienia)
SELECT *
FROM sales.salesorderheader
WHERE orderdate >= (SELECT MAX(orderdate) - INTERVAL '6 months' FROM sales.salesorderheader)
ORDER BY orderdate DESC;
```

---

## 4. FUNKCJE WARUNKOWE

| Funkcja | Opis | Przyklad |
|---------|------|----------|
| `CASE WHEN ... THEN ... ELSE ... END` | Warunek | `CASE WHEN x > 0 THEN 'pos' ELSE 'neg' END` |
| `COALESCE(a, b, c)` | Pierwszy non-NULL | `COALESCE(NULL, NULL, 'default')` → `'default'` |
| `NULLIF(a, b)` | NULL jesli a=b | `NULLIF(0, 0)` → `NULL` |
| `GREATEST(a, b, c)` | Najwieksza wartosc | `GREATEST(1, 5, 3)` → `5` |
| `LEAST(a, b, c)` | Najmniejsza wartosc | `LEAST(1, 5, 3)` → `1` |

### Przyklad na AdventureWorks:
```sql
-- Klasyfikacja cen produktow
SELECT
    name,
    listprice,
    CASE
        WHEN listprice = 0 THEN 'Free'
        WHEN listprice < 100 THEN 'Budget'
        WHEN listprice < 1000 THEN 'Mid-range'
        ELSE 'Premium'
    END AS price_tier,
    COALESCE(color, 'No color') AS color,
    GREATEST(listprice, standardcost) AS higher_value,
    NULLIF(color, 'Black') AS non_black_color  -- NULL jesli Black
FROM production.product
WHERE listprice > 0
LIMIT 20;
```

---

## 5. FUNKCJE KONWERSJI TYPOW

| Funkcja | Opis | Przyklad |
|---------|------|----------|
| `CAST(expr AS type)` | Konwersja typow (SQL standard) | `CAST('123' AS INTEGER)` |
| `expr::type` | Konwersja typow (PostgreSQL shortcut) | `'123'::INTEGER` |
| `TO_CHAR(n/d, fmt)` | Na tekst z formatem | `TO_CHAR(1234, 'FM9,999')` |
| `TO_NUMBER(s, fmt)` | Tekst na liczbe | `TO_NUMBER('1,234.50', '9,999.99')` |
| `TO_DATE(s, fmt)` | Tekst na date | `TO_DATE('2024-01-15', 'YYYY-MM-DD')` |
| `TO_TIMESTAMP(s, fmt)` | Tekst na timestamp | `TO_TIMESTAMP('2024-01-15 14:30', 'YYYY-MM-DD HH24:MI')` |

### Popularne konwersje:
```sql
-- Liczba na tekst
SELECT TO_CHAR(12345.67, 'FM$999,999.00');    -- '$12,345.67'
SELECT TO_CHAR(0.95, 'FM990%');               -- '95%' (nie, trzeba *100)
SELECT TO_CHAR(12345.67 * 100, 'FM999999%');  -- niezalecane, lepiej ROUND + ||

-- Tekst na liczbe
SELECT '42'::INTEGER;
SELECT '3.14'::NUMERIC;
SELECT '2024-01-15'::DATE;

-- Boolean
SELECT 'true'::BOOLEAN;
SELECT 1::BOOLEAN;     -- true
SELECT 0::BOOLEAN;     -- false

-- Sprawdz typ
SELECT pg_typeof(42);           -- integer
SELECT pg_typeof(3.14);         -- numeric
SELECT pg_typeof('hello');      -- unknown
SELECT pg_typeof('hello'::text); -- text
```

---

## 6. FUNKCJE AGREGUJACE

### Podstawowe

| Funkcja | Opis | Przyklad |
|---------|------|----------|
| `COUNT(*)` | Liczba wierszy | `SELECT COUNT(*) FROM sales.salesorderheader` |
| `COUNT(col)` | Liczba non-NULL | `SELECT COUNT(color) FROM production.product` |
| `COUNT(DISTINCT col)` | Liczba unikalnych | `SELECT COUNT(DISTINCT customerid) FROM sales.salesorderheader` |
| `SUM(col)` | Suma | `SELECT SUM(totaldue) FROM sales.salesorderheader` |
| `AVG(col)` | Srednia | `SELECT AVG(listprice) FROM production.product` |
| `MIN(col)` | Minimum | `SELECT MIN(orderdate) FROM sales.salesorderheader` |
| `MAX(col)` | Maximum | `SELECT MAX(totaldue) FROM sales.salesorderheader` |

### Zaawansowane agregacje

| Funkcja | Opis | Przyklad |
|---------|------|----------|
| `STRING_AGG(col, sep)` | Polacz stringi | `STRING_AGG(name, ', ' ORDER BY name)` |
| `ARRAY_AGG(col)` | Zbierz do tablicy | `ARRAY_AGG(productid ORDER BY productid)` |
| `BOOL_AND(col)` | Wszystkie true? | `BOOL_AND(makeflag)` |
| `BOOL_OR(col)` | Ktorykolwiek true? | `BOOL_OR(finishedgoodsflag)` |
| `VARIANCE(col)` / `VAR_POP` | Wariancja | `VARIANCE(listprice)` |
| `STDDEV(col)` / `STDDEV_POP` | Odchylenie standardowe | `STDDEV(listprice)` |
| `CORR(y, x)` | Korelacja | `CORR(totaldue, orderqty)` |
| `PERCENTILE_CONT(f) WITHIN GROUP (ORDER BY col)` | Percentyl (ciagle) | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY listprice)` |
| `PERCENTILE_DISC(f) WITHIN GROUP (ORDER BY col)` | Percentyl (dyskretne) | `PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY listprice)` |
| `MODE() WITHIN GROUP (ORDER BY col)` | Dominanta (najczestsza wartosc) | `MODE() WITHIN GROUP (ORDER BY color)` |

### FILTER clause (PostgreSQL-specyficzne!)

```sql
-- Warunkowe agregacje bez CASE WHEN
SELECT
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 5) AS completed_orders,
    COUNT(*) FILTER (WHERE status = 1) AS pending_orders,
    SUM(totaldue) FILTER (WHERE EXTRACT(YEAR FROM orderdate) = 2013) AS sales_2013,
    SUM(totaldue) FILTER (WHERE EXTRACT(YEAR FROM orderdate) = 2014) AS sales_2014
FROM sales.salesorderheader;
```

### Przyklad na AdventureWorks:
```sql
-- Pelna analiza sprzedazy
SELECT
    COUNT(*) AS total_orders,
    COUNT(DISTINCT customerid) AS unique_customers,
    ROUND(SUM(totaldue)::numeric, 2) AS total_revenue,
    ROUND(AVG(totaldue)::numeric, 2) AS avg_order_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY totaldue)::numeric, 2) AS median_order,
    MIN(orderdate) AS first_order,
    MAX(orderdate) AS last_order
FROM sales.salesorderheader;

-- Kolory produktow - STRING_AGG
SELECT
    pc.name AS category,
    STRING_AGG(DISTINCT p.color, ', ' ORDER BY p.color) AS available_colors,
    COUNT(*) AS product_count
FROM production.product p
JOIN production.productsubcategory ps ON p.productsubcategoryid = ps.productsubcategoryid
JOIN production.productcategory pc ON ps.productcategoryid = pc.productcategoryid
WHERE p.color IS NOT NULL
GROUP BY pc.name;
```

---

## 7. WINDOW FUNCTIONS (funkcje okienkowe)

### Ranking

| Funkcja | Opis |
|---------|------|
| `ROW_NUMBER() OVER (...)` | Numer wiersza (bez duplikatow) |
| `RANK() OVER (...)` | Ranking (z przeskokami: 1,2,2,4) |
| `DENSE_RANK() OVER (...)` | Ranking (bez przeskokow: 1,2,2,3) |
| `NTILE(n) OVER (...)` | Podziel na n grup rownych |
| `PERCENT_RANK() OVER (...)` | Pozycja procentowa (0-1) |
| `CUME_DIST() OVER (...)` | Skumulowana dystrybucja (0-1) |

### Wartosci z innych wierszy

| Funkcja | Opis |
|---------|------|
| `LAG(col, n, default) OVER (...)` | Wartosc n wierszy wczesniej |
| `LEAD(col, n, default) OVER (...)` | Wartosc n wierszy pozniej |
| `FIRST_VALUE(col) OVER (...)` | Pierwsza wartosc w oknie |
| `LAST_VALUE(col) OVER (...)` | Ostatnia wartosc w oknie (uwaga na frame!) |
| `NTH_VALUE(col, n) OVER (...)` | N-ta wartosc w oknie |

### Agregaty okienkowe

```sql
-- Running total
SUM(totaldue) OVER (ORDER BY orderdate)

-- Running total per klient
SUM(totaldue) OVER (PARTITION BY customerid ORDER BY orderdate)

-- 3-elementowa srednia kroczaca
AVG(totaldue) OVER (ORDER BY orderdate ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)

-- Suma od poczatku do biezacego
SUM(totaldue) OVER (ORDER BY orderdate ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
```

### Window Frames

```sql
-- ROWS - fizyczne wiersze
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW          -- 3 wiersze (2 przed + biezacy)
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- od poczatku do biezacego
ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING    -- od biezacego do konca
ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING           -- 3 wiersze (przed, biezacy, po)

-- RANGE - logiczny zakres (wedlug wartosci)
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  -- domyslne!
RANGE BETWEEN '7 days' PRECEDING AND CURRENT ROW   -- ostatnie 7 dni (PostgreSQL!)
```

### Przyklad na AdventureWorks:
```sql
-- Ranking produktow w kategorii + running total
SELECT
    pc.name AS category,
    p.name AS product,
    p.listprice,
    RANK() OVER (PARTITION BY pc.name ORDER BY p.listprice DESC) AS price_rank,
    SUM(p.listprice) OVER (PARTITION BY pc.name ORDER BY p.listprice DESC) AS running_total,
    ROUND(PERCENT_RANK() OVER (PARTITION BY pc.name ORDER BY p.listprice)::numeric, 2) AS percentile
FROM production.product p
JOIN production.productsubcategory ps ON p.productsubcategoryid = ps.productsubcategoryid
JOIN production.productcategory pc ON ps.productcategoryid = pc.productcategoryid
WHERE p.listprice > 0
ORDER BY pc.name, price_rank;

-- Porownanie sprzedazy miesiecznej (MoM)
WITH monthly AS (
    SELECT
        DATE_TRUNC('month', orderdate) AS month,
        SUM(totaldue) AS revenue
    FROM sales.salesorderheader
    GROUP BY DATE_TRUNC('month', orderdate)
)
SELECT
    month,
    ROUND(revenue::numeric, 2) AS revenue,
    ROUND(LAG(revenue) OVER (ORDER BY month)::numeric, 2) AS prev_month,
    ROUND(((revenue - LAG(revenue) OVER (ORDER BY month))
        / NULLIF(LAG(revenue) OVER (ORDER BY month), 0) * 100)::numeric, 1) AS growth_pct
FROM monthly
ORDER BY month;
```

---

## 8. FUNKCJE JSON / JSONB

### Tworzenie JSON

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `TO_JSON(val)` | Wartosc na JSON | `TO_JSON('hello'::text)` | `"hello"` |
| `TO_JSONB(val)` | Wartosc na JSONB | `TO_JSONB(42)` | `42` |
| `JSON_BUILD_OBJECT(k,v,...)` | Zbuduj obiekt | `JSON_BUILD_OBJECT('name','Jan','age',30)` | `{"name":"Jan","age":30}` |
| `JSON_BUILD_ARRAY(v,...)` | Zbuduj tablice | `JSON_BUILD_ARRAY(1,2,'a')` | `[1,2,"a"]` |
| `ROW_TO_JSON(record)` | Wiersz na JSON | `ROW_TO_JSON(ROW(1,'Jan'))` | `{"f1":1,"f2":"Jan"}` |
| `JSON_AGG(col)` | Agreguj do JSON array | `JSON_AGG(name)` | `["A","B","C"]` |
| `JSONB_AGG(col)` | Agreguj do JSONB array | `JSONB_AGG(name)` | `["A","B","C"]` |
| `JSON_OBJECT_AGG(k, v)` | Agreguj do JSON object | `JSON_OBJECT_AGG(id, name)` | `{"1":"A","2":"B"}` |

### Odczyt JSON

| Operator/Funkcja | Opis | Przyklad | Wynik |
|------------------|------|----------|-------|
| `->` | Klucz → JSON | `'{"a":1}'::json -> 'a'` | `1` (json) |
| `->>` | Klucz → TEXT | `'{"a":1}'::json ->> 'a'` | `'1'` (text) |
| `-> n` | Index tablicy → JSON | `'[1,2,3]'::json -> 1` | `2` (json) |
| `->> n` | Index tablicy → TEXT | `'[1,2,3]'::json ->> 1` | `'2'` (text) |
| `#>` | Sciezka → JSON | `'{"a":{"b":1}}'::json #> '{a,b}'` | `1` |
| `#>>` | Sciezka → TEXT | `'{"a":{"b":1}}'::json #>> '{a,b}'` | `'1'` |

### Operatory JSONB (tylko JSONB, nie JSON)

| Operator | Opis | Przyklad |
|----------|------|----------|
| `@>` | Zawiera? | `'{"a":1,"b":2}'::jsonb @> '{"a":1}'::jsonb` → `true` |
| `<@` | Zawarty w? | `'{"a":1}'::jsonb <@ '{"a":1,"b":2}'::jsonb` → `true` |
| `?` | Czy klucz istnieje? | `'{"a":1}'::jsonb ? 'a'` → `true` |
| `?\|` | Czy ktorykolwiek klucz? | `'{"a":1}'::jsonb ?\| array['a','b']` → `true` |
| `?&` | Czy wszystkie klucze? | `'{"a":1,"b":2}'::jsonb ?& array['a','b']` → `true` |
| `\|\|` | Polacz JSONB | `'{"a":1}'::jsonb \|\| '{"b":2}'::jsonb` → `{"a":1,"b":2}` |
| `-` | Usun klucz | `'{"a":1,"b":2}'::jsonb - 'a'` → `{"b":2}` |

### Przetwarzanie JSONB

| Funkcja | Opis |
|---------|------|
| `JSONB_EACH(j)` | Klucze i wartosci (jako jsonb) |
| `JSONB_EACH_TEXT(j)` | Klucze i wartosci (jako text) |
| `JSONB_ARRAY_ELEMENTS(j)` | Elementy tablicy (jako jsonb) |
| `JSONB_ARRAY_ELEMENTS_TEXT(j)` | Elementy tablicy (jako text) |
| `JSONB_OBJECT_KEYS(j)` | Lista kluczy |
| `JSONB_TYPEOF(j)` | Typ JSON (object, array, string, number, boolean, null) |
| `JSONB_SET(j, path, val)` | Ustaw wartosc pod sciezka |
| `JSONB_INSERT(j, path, val)` | Wstaw wartosc |
| `JSONB_STRIP_NULLS(j)` | Usun NULL-e |
| `JSONB_PRETTY(j)` | Sformatuj ladnie |
| `JSONB_PATH_QUERY(j, path)` | SQL/JSON path query (PG12+) |

### Przyklad na AdventureWorks:
```sql
-- Eksport produktow do JSON
SELECT JSON_BUILD_OBJECT(
    'id', p.productid,
    'name', p.name,
    'price', p.listprice,
    'color', COALESCE(p.color, 'N/A')
) AS product_json
FROM production.product p
WHERE p.listprice > 1000
LIMIT 5;

-- Agregacja zamowien klienta do JSON
SELECT
    c.customerid,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'order_id', soh.salesorderid,
            'date', soh.orderdate,
            'total', soh.totaldue
        ) ORDER BY soh.orderdate DESC
    ) AS orders
FROM sales.customer c
JOIN sales.salesorderheader soh ON c.customerid = soh.customerid
GROUP BY c.customerid
LIMIT 5;
```

---

## 9. FUNKCJE TABLICOWE (ARRAY)

### Tworzenie tablic

| Funkcja | Opis | Przyklad | Wynik |
|---------|------|----------|-------|
| `ARRAY[v1, v2, ...]` | Konstruktor | `ARRAY[1, 2, 3]` | `{1,2,3}` |
| `ARRAY_AGG(col)` | Agregacja do tablicy | `ARRAY_AGG(name ORDER BY name)` | `{A,B,C}` |
| `STRING_TO_ARRAY(s, d)` | String na tablice | `STRING_TO_ARRAY('a,b,c', ',')` | `{a,b,c}` |

### Operacje na tablicach

| Funkcja/Operator | Opis | Przyklad | Wynik |
|------------------|------|----------|-------|
| `ARRAY_LENGTH(arr, dim)` | Dlugosc | `ARRAY_LENGTH(ARRAY[1,2,3], 1)` | `3` |
| `CARDINALITY(arr)` | Calkowita liczba elementow | `CARDINALITY(ARRAY[1,2,3])` | `3` |
| `arr[n]` | Element po indeksie (od 1!) | `(ARRAY[10,20,30])[2]` | `20` |
| `arr[m:n]` | Slice | `(ARRAY[1,2,3,4])[2:3]` | `{2,3}` |
| `\|\|` | Polacz tablice | `ARRAY[1,2] \|\| ARRAY[3,4]` | `{1,2,3,4}` |
| `ARRAY_APPEND(arr, v)` | Dodaj na koniec | `ARRAY_APPEND(ARRAY[1,2], 3)` | `{1,2,3}` |
| `ARRAY_PREPEND(v, arr)` | Dodaj na poczatek | `ARRAY_PREPEND(0, ARRAY[1,2])` | `{0,1,2}` |
| `ARRAY_CAT(a, b)` | Polacz (= \|\|) | `ARRAY_CAT(ARRAY[1], ARRAY[2])` | `{1,2}` |
| `ARRAY_REMOVE(arr, v)` | Usun wartosc | `ARRAY_REMOVE(ARRAY[1,2,3,2], 2)` | `{1,3}` |
| `ARRAY_REPLACE(arr, f, t)` | Zamien wartosc | `ARRAY_REPLACE(ARRAY[1,2,3], 2, 9)` | `{1,9,3}` |
| `ARRAY_POSITION(arr, v)` | Pozycja wartosci | `ARRAY_POSITION(ARRAY['a','b','c'], 'b')` | `2` |
| `ARRAY_POSITIONS(arr, v)` | Wszystkie pozycje | `ARRAY_POSITIONS(ARRAY[1,2,1], 1)` | `{1,3}` |

### Operatory tablicowe

| Operator | Opis | Przyklad |
|----------|------|----------|
| `@>` | Zawiera? | `ARRAY[1,2,3] @> ARRAY[2,3]` → `true` |
| `<@` | Zawarty w? | `ARRAY[2,3] <@ ARRAY[1,2,3]` → `true` |
| `&&` | Wspolne elementy? (overlap) | `ARRAY[1,2] && ARRAY[2,3]` → `true` |
| `= ANY(arr)` | Wartosc w tablicy? | `2 = ANY(ARRAY[1,2,3])` → `true` |
| `= ALL(arr)` | Wartosc = wszystkie? | `2 = ALL(ARRAY[2,2,2])` → `true` |

### UNNEST - rozwiazanie tablicy na wiersze

```sql
-- Rozwin tablice na wiersze
SELECT UNNEST(ARRAY['a', 'b', 'c']) AS element;
-- Wynik: a, b, c (3 wiersze)

-- Z numeracja
SELECT
    ROW_NUMBER() OVER () AS idx,
    UNNEST(ARRAY['a', 'b', 'c']) AS element;
```

---

## 10. FUNKCJE SYSTEMOWE / INFORMACYJNE

### Informacje o sesji

| Funkcja | Opis |
|---------|------|
| `CURRENT_USER` | Biezacy uzytkownik |
| `SESSION_USER` | Uzytkownik sesji |
| `CURRENT_DATABASE()` | Nazwa bazy |
| `CURRENT_SCHEMA()` | Biezacy schemat |
| `CURRENT_SCHEMAS(true)` | Sciezka search_path |
| `INET_SERVER_ADDR()` | Adres IP serwera |
| `INET_SERVER_PORT()` | Port serwera |
| `INET_CLIENT_ADDR()` | Adres IP klienta |
| `PG_BACKEND_PID()` | PID biezacego procesu |
| `VERSION()` | Wersja PostgreSQL |

### Rozmiary obiektow

| Funkcja | Opis |
|---------|------|
| `PG_DATABASE_SIZE(db)` | Rozmiar bazy (bytes) |
| `PG_TOTAL_RELATION_SIZE(table)` | Rozmiar tabeli + indeksy |
| `PG_RELATION_SIZE(table)` | Rozmiar samej tabeli |
| `PG_INDEXES_SIZE(table)` | Rozmiar indeksow |
| `PG_TABLE_SIZE(table)` | Tabela + TOAST + free space |
| `PG_SIZE_PRETTY(bytes)` | Formatuj rozmiar |
| `PG_COLUMN_SIZE(val)` | Rozmiar wartosci |

```sql
-- Rozmiary tabel w AdventureWorks
SELECT
    schemaname || '.' || relname AS table_name,
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE(relid)) AS total_size,
    PG_SIZE_PRETTY(PG_RELATION_SIZE(relid)) AS data_size,
    PG_SIZE_PRETTY(PG_INDEXES_SIZE(relid)) AS index_size,
    n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY PG_TOTAL_RELATION_SIZE(relid) DESC
LIMIT 15;

-- Rozmiar calej bazy
SELECT PG_SIZE_PRETTY(PG_DATABASE_SIZE('adventureworks'));
```

### Inne przydatne

| Funkcja | Opis |
|---------|------|
| `PG_TYPEOF(expr)` | Typ wyrazenia |
| `GENERATE_SERIES(s, e, step)` | Generuj sekwencje (int/date) |
| `PG_SLEEP(seconds)` | Czekaj (do testow) |
| `PG_CANCEL_BACKEND(pid)` | Anuluj zapytanie |
| `PG_TERMINATE_BACKEND(pid)` | Zabij sesje |
| `PG_RELOAD_CONF()` | Przeladuj konfiguracje |
| `PG_IS_IN_RECOVERY()` | Czy standby/replica? |
| `TXID_CURRENT()` | ID biezacej transakcji |
| `PG_ADVISORY_LOCK(key)` | Advisory lock |
| `PG_TRY_ADVISORY_LOCK(key)` | Non-blocking advisory lock |

---

## 11. SUBQUERIES I OPERATORY ZBIOROW

### Subquery operators

| Operator | Opis | Przyklad |
|----------|------|----------|
| `EXISTS (subquery)` | Czy subquery zwraca wiersze? | `WHERE EXISTS (SELECT 1 FROM ...)` |
| `NOT EXISTS (subquery)` | Czy subquery jest puste? | `WHERE NOT EXISTS (SELECT 1 FROM ...)` |
| `IN (subquery)` | Wartosc w zbiorze? | `WHERE id IN (SELECT id FROM ...)` |
| `NOT IN (subquery)` | Wartosc nie w zbiorze? (uwaga na NULL!) | `WHERE id NOT IN (...)` |
| `ANY / SOME (subquery)` | Porownanie z ktorykolwiek | `WHERE price > ANY (SELECT ...)` |
| `ALL (subquery)` | Porownanie z wszystkimi | `WHERE price > ALL (SELECT ...)` |

### Operatory zbiorow

| Operator | Opis |
|----------|------|
| `UNION` | Suma (bez duplikatow) |
| `UNION ALL` | Suma (z duplikatami - szybsze!) |
| `INTERSECT` | Czesc wspolna |
| `EXCEPT` | Roznica (w A ale nie w B) |

### LATERAL join (odpowiednik CROSS APPLY)

```sql
-- Top 3 zamowienia per klient
SELECT c.customerid, top_orders.*
FROM sales.customer c
CROSS JOIN LATERAL (
    SELECT salesorderid, totaldue, orderdate
    FROM sales.salesorderheader soh
    WHERE soh.customerid = c.customerid
    ORDER BY totaldue DESC
    LIMIT 3
) top_orders;
```

---

## 12. INNE PRZYDATNE FUNKCJE

### Encoding / Hashing

| Funkcja | Opis |
|---------|------|
| `MD5(s)` | Hash MD5 |
| `ENCODE(data, format)` | Koduj (base64, hex, escape) |
| `DECODE(s, format)` | Dekoduj |
| `GEN_RANDOM_UUID()` | Losowy UUID (PG13+) |

### Network / IP

| Funkcja | Opis |
|---------|------|
| `HOST(inet)` | Adres IP jako tekst |
| `MASKLEN(inet)` | Dlugosc maski |
| `NETWORK(inet)` | Adres sieci |
| `BROADCAST(inet)` | Adres broadcast |

### Full Text Search

```sql
-- Wyszukiwanie pelnotekstowe
SELECT name
FROM production.product
WHERE TO_TSVECTOR('english', name) @@ TO_TSQUERY('english', 'mountain & bike');

-- Z rankingiem trafnosci
SELECT
    name,
    TS_RANK(TO_TSVECTOR('english', name), TO_TSQUERY('english', 'mountain')) AS rank
FROM production.product
WHERE TO_TSVECTOR('english', name) @@ TO_TSQUERY('english', 'mountain')
ORDER BY rank DESC;
```

---

## SZYBKI INDEKS - NAJCZESCIEJ UZYWANE

```
TEKST:      LENGTH, UPPER, LOWER, TRIM, SUBSTRING, REPLACE, CONCAT, SPLIT_PART, ||, ILIKE, ~
LICZBY:     ROUND, CEIL, FLOOR, ABS, MOD, RANDOM, GENERATE_SERIES
DATY:       NOW, EXTRACT, DATE_TRUNC, AGE, TO_CHAR, INTERVAL, GENERATE_SERIES
WARUNKI:    CASE, COALESCE, NULLIF, GREATEST, LEAST
KONWERSJA:  CAST, ::, TO_CHAR, TO_DATE, TO_NUMBER, TO_TIMESTAMP
AGREGATY:   COUNT, SUM, AVG, MIN, MAX, STRING_AGG, ARRAY_AGG, FILTER
WINDOW:     ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, SUM OVER, AVG OVER
JSON:       ->, ->>, JSON_BUILD_OBJECT, JSON_AGG, JSONB_SET, @>
ARRAY:      ARRAY[], UNNEST, ARRAY_AGG, ANY, ALL, &&, @>
SYSTEM:     PG_SIZE_PRETTY, PG_TOTAL_RELATION_SIZE, VERSION, CURRENT_USER
```
