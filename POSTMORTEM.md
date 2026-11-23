# Postmortem: dlaczego poprzednia przebudowa trudności nie zadziałała

Stan na 23.11.2026. Pomiary: `node scripts/sim/postmortem.ts exploits --runs=4` (9 stacji × 4 seedy, każdy bot na
tych samych seedach) i `node scripts/sim/postmortem.ts bench --runs=2 --builds=…` (ławka bossów). Każdą liczbę
zmierzyłem na dwóch wersjach gry: **tej z żywej strony** (commit `14d0f6c`, w nią grał gracz) i **ostatniej z
`main`** (`a13950c`). Liczby z `BALANCE.md` traktuję jako niezweryfikowane; tu są tylko te, które zmierzyłem sam.

## Wnioski w skrócie

1. **Ostatnie utwardzenie trudności nigdy nie trafiło na stronę.** CI przekraczało limit 30 minut i deploy był
   pomijany po cichu. Gracz grał w wersję o połowę łatwiejszą od tej, którą opisuje `BALANCE.md`.
2. **Bot był dużo słabszy od człowieka.** Strojenie „żeby dobry bot wygrywał ok. 60%” dało grę za łatwą dla
   gracza, który biega lepiej od bota i świadomie składa build.
3. **Bossowie padają w kilkanaście sekund, bo dobry build ma za dużo DPS, a bossowie nie mają żadnej ochrony**
   (bez bramek faz, bez odporności na ogłuszenie). Mnożnik zdrowia ×1,9 czy ×3 tego nie zmienia.
4. **Limit szybkości ataku dało się obejść:** mnożniki cooldownu z poziomów broni mnożą się przez rzadkość karty i
   omijają globalny limit 28%.
5. Strategie bez umiejętności (kółko, dach, róg, stanie, bunny hop, kawa, tory) **nie** były problemem: wszystkie
   giną w ciągu kilku minut. Za łatwo jest dla gracza, który umie grać, a nie dla takiego, który oszukuje.

## 1. Czy wybrana trudność trafia do gry na Pages

**Kurs trafia do gry poprawnie**, ale **trzy z czterech ostatnich zmian balansu nie trafiły na stronę w ogóle.**

- Ścieżka gracza: wybór kursu na trasie zapisuje się w `save.difficulty` (`src/ui/route.ts:175-177`), start stacji
  przekazuje go do gry (`src/main.ts:523`, `src/main.ts:817`), gra bierze liczby kursu w `start()`
  (`src/game/game.ts:1243`) i używa ich przy każdym spawnie (`hpMul`/`dmgMul`, `src/game/game.ts:1960-1967`), u
  bossa (`src/game/game.ts:674-700`) i w dyrektorze fal (`src/game/game.ts:1308-1311`).
- Nowy test `e2e/difficulty.spec.ts` przechodzi tę ścieżkę jak gracz (zapis z wyborem → hub → trasa → stacja),
  odczytuje ze stanu gry efektywne mnożniki, modyfikatory i nastawy dyrektora i pada, jeśli dwa kursy (albo
  Normalnie ze szczeblem drabinki) dają ten sam stan. Na **żywej stronie** dał:

  | kurs | zdrowie wrogów | ich obrażenia | boss po | modyfikatorów |
  |---|---:|---:|---:|---:|
  | Spokojny | ×0,75 | ×0,45 | 300 s | 0 |
  | Normalnie | ×1 | **×1** | 360 s | 0 |
  | Opóźnienie 120 min | ×1,15 | ×1,25 | 420 s | 0 |
  | Normalnie, szczebel +2 h 30 | ×1 | ×1,25 | 360 s | 10 |

  W kodzie na `main` Normalnie ma obrażenia ×1,5 i bossów ×3 (`src/content/tuning.ts:151`), na stronie ×1 i ×1,9.
- **Przyczyna:** zadanie `check` w CI (`.github/workflows/checks.yml:18`, `timeout-minutes: 30`) przekraczało
  limit, bo testy e2e na pięciu przeglądarkach trwały coraz dłużej (trudniejsza gra = dłuższe przebiegi botów w
  testach). Przebiegi CI dla `7fe434d`, `7e3f8ae` i `a13950c` są „cancelled” po 30 min 18 s, a za nimi „skipped”
  deploy i sprawdzenie żywej strony. Na stronę trafił tylko `14d0f6c`. Nikt tego nie zauważył, bo jedynym
  sygnałem było szare „cancelled” zamiast czerwonego.
- **Naprawione od razu** (`8610e58` na `main`): limit `check` 55 min, `live` 45 min, test różnicy kursów w
  zestawie, który CI puszcza też na żywym adresie.

## 2. Domyślna trudność i migracja zapisu

- Domyślnie **Normalnie** (`src/core/save.ts:143`).
- Migracja v4 → v5 zachowuje wcześniejszy wybór (`src/core/save.ts:297`): kto kiedyś wybrał Spokojny, zostaje na
  nim, ale nie po cichu, bo trasa pokazuje kurs i jego opis przy każdym wyjeździe (`src/ui/route.ts:162-170`).
  Nikt nie jest przenoszony na łatwiejszy kurs bez swojego wyboru.
- Szczebel drabinki działa tylko na Normalnie: wybór szczebla przełącza kurs na Normalnie (`src/ui/route.ts:190-191`),
  a gra zeruje szczebel na innych kursach (`src/game/game.ts:1244`). Test powyżej to sprawdza.

## 3. Czy symulacja headless to dokładnie ten sam kod

- `scripts/sim/worker.ts` buduje `src/` przez Vite (SSR) i gra prawdziwą klasą `Game` z tymi samymi danymi,
  spawnerem, dyrektorem i limitem encji (`TUNING.waves.maxEnemies = 480`, `src/content/tuning.ts:98`).
- Jedyna gałąź „headless” w grze pomija rysowanie (`src/game/game.ts:1532`). Kamera zmienia kąt tylko w `look()`
  (`src/game/camera.ts:49-57`), które działa w części symulacyjnej klatki, więc kierunek ruchu i strona spawnu
  (`src/game/game.ts:2060`) są te same.
- `Math.random` jest wyłącznie w efektach wizualnych i tekście okrzyku (`src/game/game.ts:775, 1585, 1849…`),
  rozgrywka losuje z ziarnistych strumieni (`src/game/game.ts:1260`).
- **Ale nie była to ta sama gra co do bitu.** Test zgodności (bot gra w prawdziwym buildzie i nagrywa replay,
  symulacja go odtwarza i porównuje hash stanu co sekundę gry, `e2e/replay.spec.ts`) najpierw padał na
  pierwszej kontroli. Przyczyny, wszystkie już naprawione:
  1. **Inna matematyka w innym silniku.** V8 w Node 24 i w Chromium 158 liczą `sin`, `cos`, `atan2`, `exp`
     inaczej w 3–18% przypadków (pomiar na 20 000 losowych argumentów na funkcję). Różnica jednego ulp w
     kierunku Piotrka po kilku sekundach rozjeżdża cały run. Gra ma teraz własne `sin/cos/atan/atan2/exp/asin/acos`
     (port musl/fdlibm na czystej arytmetyce IEEE, `src/core/libm.ts`), wpięte w `Math` przed czymkolwiek innym;
     w Node i w Chromium dają identyczne bity (0 różnic na 350 000 argumentów), od natywnych różnią się najwyżej
     o 1 ulp.
  2. **Ekrany kart i skrzyń liczyły czas zegarem ściennym** (`performance.now()` i `setTimeout`,
     `src/ui/levelup.ts`, `src/ui/chest.ts`), a symulacja czasem gry. Teraz oba idą zegarem klatek
     (`src/core/clock.ts`).
  3. **Rysowanie zmieniało numerację źródeł obrażeń:** znaczniki zagrożeń (`updateMarkers` w `render`) przy
     pierwszym wyszukaniu rejestrowały „kontrolę biletów” w tabeli źródeł, więc w przeglądarce każde kolejne
     źródło miało inny numer niż w symulacji, a tabela rosła przez wszystkie runy na tym samym obiekcie gry.
     Teraz tabela jest zerowana i wypełniana na starcie runu (`src/game/game.ts`, `start`).
  Po tych poprawkach dwa nagrania przy prawdziwym, zmiennym kroku przeglądarki (Widzew 75 s, Żakowice 86 s z
  walką z bossem) zgadzają się w każdej z 161 kontroli. Każda liczba z wcześniejszych symulacji pochodziła
  więc z gry, która była podobna, ale nie ta sama.

## 4. Czy limit encji spłaszcza presję

**Nie.** Limitu 480 nie osiąga żaden przebieg: najwięcej żywych wrogów to 365–391 (bot skaczący w linii prostej,
który zbiera tłum z całej areny), dobry bot najwyżej 225–262, w żadnej z ok. 5000 próbek co 5 s tłum nie był
przy suficie. Presja jest za to **płaska w drugiej połowie runu**: mediana żywych wrogów przy dobrym bocie
(strona) to 23 → 32 → 36 → 41 → 47 w minutach 0–5, a potem spada do 22–31, bo spawn i podłoga fal wyłączają się,
gdy przychodzi boss (`!this.bossSpawned`, `src/game/game.ts:2013`). Zdrowie wrogów rośnie liniowo
(`src/game/game.ts:1961`), więc rozkręcony build nadąża z zapasem.

## 5. Czy bot był za słaby

**Tak, i to główny błąd metody.** Na wersji ze strony:

| bot (Normalnie, 36 runów) | wygrane | czas życia (mediana) |
|---|---:|---:|
| dobry | 17/36 (47%) | 421 s |
| średni | 5/36 (14%) | 354 s |

Gracz mówi, że ta wersja jest za łatwa, a najlepszy bot wygrywa ją w mniej niż połowie runów. Dobry bot
(`src/game/bot.ts:54-60`) reaguje w 0,06 s, ale patrzy tylko 0,5 s naprzód heurystyką na 24 kierunkach (bez
symulowania przyszłości), nie robi bunny hopa, a karty wybiera regułami, a nie pod znane mocne buildy. Ginie
głównie od kontaktu z tłumem. Człowiek, który biega, skacze i świadomie składa build, jest od niego wyraźnie
lepszy. Strojenie pod „dobry bot ok. 60%” musiało więc dać grę za łatwą dla gracza. Na `main` (po ostatnim
utwardzeniu) ten sam bot wygrywa 2/36 (6%), czyli zmiana zrobiła grę „trudną dla bota”, a nie zmierzoną
trudność dla człowieka.

## 6. Co się mnoży zamiast dodawać

| źródło | jak się łączy | limit | problem |
|---|---|---|---|
| szybkość ataku z pasywek (Energetyk, kawy) | addytywnie, `1 / (1 + haste)` | ≥ 0,72 (`src/game/progress.ts:260`) | – |
| cooldown z poziomów broni (`mul`) | **multiplikatywnie przez poziomy, ×rzadkość karty** (`src/game/progress.ts:98`) | **brak** | z kartą legendarną (×2,4) telefon schodzi do ×0,34 czasu bazowego, Gnat do ×0,36, gwizdek do ×0,37, reszta do ×0,44–0,48 (z limitem pasywek); „limit 28%” z `BALANCE.md` nie istnieje dla broni |
| obrażenia z poziomów broni | addytywnie, ×rzadkość karty (legendarna ×2,4) | brak | duże skoki przy szczęściu w kartach |
| Gnat z CS | cooldown broni × profil skina (`src/game/weapons.ts:140`) | brak | trzeci mnożnik szybkości |
| pancerz | malejący, `0,6·a/(a+0,45)` (`src/game/progress.ts:272-276`) | 60% | – |
| leczenie z zabójstw (Kebab XXL) | za zabójstwo | 2 HP/s | – |
| szczęście, zasięg zbierania | miękkie limity | – | – |
| liczba pocisków | addytywnie | Bilet ulgowy max +2 | – |
| ogłuszenie z broni na bossie | bez odporności (`src/game/weapons.ts:504, 538, 727`) | brak | ogłuszony boss nie liczy czasu do ataku (`src/game/boss.ts:299`), więc szybki gwizdek go blokuje |

## 7. Które bronie i buildy zabijają bossów w kilka sekund

Ławka: build na maksymalnych poziomach tuż przed bossem, Piotrek nieśmiertelny, dobry bot gra, Normalnie,
najkrótszy czas zabicia z dwóch seedów, sekundy:

| build | wersja | Fabryczna | Niciarniana | Widzew | Andrzejów | Bedoń | Justynów | Gałkówek | Żakowice |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Teczka prezesa + Parasol burzowy + Kontrola + Gnat | strona | **13** | **13** | **11** | **14** | **11** | 23 | 19 | 26 |
| Teczka prezesa + Parasol burzowy + Kontrola + Gnat | `main` | 17 | 22 | 20 | 27 | 20 | 25 | 28 | 36 |
| Telefon + Gnat + Bilet + Kawa (bez ewolucji) | strona | 31 | 28 | 33 | 37 | 38 | 43 | 51 | 49 |
| sam Parasol burzowy | strona | 28 | 32 | 30 | 39 | 40 | 43 | 47 | 49 |
| sam Kebab XXL | `main` | 52 | 58 | 45 | 72 | 66 | 84 | 73 | 100 |

Dlaczego tak szybko:

- **Za dużo DPS z kart:** legendarne ulepszenia mnożą przyrosty ×2,4, a cooldowny broni schodzą poniżej limitu
  (punkt 6). Cztery ewolucje działają naraz, każda bez budżetu mocy.
- **Bossowie nie mają obrony przed burstem:** faza zmienia się dopiero po spadku zdrowia (`src/game/boss.ts:316-325`),
  nadmiar obrażeń nie przepada, nie ma przerwy między fazami, więc mocny build przeskakuje fazy.
- **Ogłuszenie blokuje bossa** (punkt 6): w czasie ogłuszenia boss nie atakuje, a gracz bije bez przeszkód.
- **Ataki w stałym cyklu** (`attackIndex % attacks.length`, `src/game/boss.ts:331`): po pierwszym obejściu wiadomo,
  co będzie dalej.
- Mnożnik zdrowia bossa (×1,9 na stronie, ×3 na `main`) tylko przesuwa wynik: z 13 s robi się 17–20 s.

## 8. Które strategie pozwalają przeżyć bez umiejętności

Boty, które nie patrzą na zagrożenia i grają jedną strategią do końca, losowe karty, Normalnie, 36 runów:

| strategia | strona: czas życia (mediana / najdłużej) | strona: > 3 min | `main`: mediana / najdłużej |
|---|---:|---:|---:|
| stanie w miejscu | 82 s / 133 s | 0/36 | 55 s / 116 s |
| kółko wokół środka | 101 s / 208 s | 2/36 | 77 s / 150 s |
| dach (najwyższe miejsce na jeden skok) | 92 s / 162 s | 0/36 | 58 s / 140 s |
| róg areny | 86 s / 186 s | 1/36 | 61 s / 175 s |
| bunny hop w linii prostej | 94 s / 226 s | 2/36 | 69 s / 240 s |
| kampienie przy automacie z kawą | 93 s / 158 s | 0/36 | 64 s / 151 s |
| bieganie po torach | 92 s / 240 s | 2/36 | 58 s / 227 s |

Żadna strategia nie wygrywa, ale na stronie 1–2 z 36 runów przeżywa ponad 3 minuty, a cel to zero. Dachy, róg i
kawa nie dają schronienia (dachowce, spawny przed graczem, kibice z racami robią swoje). Problemem gry nie
jest exploit, tylko siła dobrze prowadzonego buildu.

## Co z tego wynika dla nowej przebudowy

- Każda liczba z symulacji ma się liczyć dopiero po zielonym teście zgodności replayów.
- Trudność stroję pod bota, który gra **lepiej** od człowieka (Wyrocznia z przewidywaniem na kopii stanu gry) i
  bota z ludzkimi ograniczeniami, a nie pod heurystykę słabszą od gracza.
- Szybkość ataku z każdego źródła w jednej kategorii, z twardym limitem na broń; budżet mocy broni.
- Bossowie: bramki faz z przepadającym nadmiarem i przejściem, malejąca podatność na ogłuszenie, zdrowie liczone z
  DPS najlepszego buildu, a nie mnożnikiem na oko.
- Presja nie może spadać w drugiej połowie runu ani u bossa.
- CI nie może po cichu pomijać deployu: każdy przebieg dłuższy niż limit to czerwony alarm, a test kursów i
  wersji chodzi na żywym adresie.
