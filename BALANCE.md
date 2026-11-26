# Balans i trudność Piotrobonka

Ten plik zapisuje drugą przebudowę trudności: dlaczego pierwsza nie zadziałała, co się zmieniło, jak to
mierzymy i co z tego wyszło. Zasada nadrzędna: gra ma być wymagająca, ale uczciwa. Śmierć wynika z błędu gracza
albo słabego buildu, nigdy z ataku, którego nie dało się przeczytać.

Liczby z poprzedniej wersji tego pliku są nieważne: mierzył je bot, który nie grał w tę samą grę co przeglądarka
(`POSTMORTEM.md`). Wyniki (tabela niżej) pochodzą z pomiaru końcowego na seedach, na których niczego nie stroiłem,
na commicie zapisanym przy pomiarze. Pozostałe liczby w opisie zmian to pomiary robocze (seedy strojenia) albo
ławki (manekiny, ławka bossa), i tak są podpisane. Symulacja to ta sama gra co do bitu tam, gdzie to sprawdzono
(niżej, „Jak mierzymy”: zakres testu zgodności jest ograniczony).

## Wyniki

Pomiar końcowy: kod gry z commitu `d77b086` (tożsamy z tym, co wysyłam), seedy dni 1300–1309 (na nich niczego nie
stroiłem), Normalnie, o ile nie napisano inaczej. Liczył się na runnerach GitHub Actions na Node 26 (run 45870504499,
gałąź `sim/s`, opis w „Bramka CI”): każdy job to jedna stacja jednego kroku, a seed runu zależy tylko od dnia i stacji.
Tabele liczy `node scripts/measure/tables.mjs s` z surowych runów (`.sim/s-*.json`, artefakty runu). Przy 8–20 runach
na stację jeden run to 5–12 punktów procentowych: liczby per stacja są orientacyjne, łączne pewniejsze.

| cel (specyfikacja §5–§7) | wynik | |
|---|---|---|
| Oracle z najlepszym buildem nie zabija bossa poniżej minimum (120 / 135 / 150 / 210 s) | twardy limit: walka trwa co najmniej 1,2 × minimum (144 / 162 / 180 / 252 s) przy każdym buildzie i na każdym kursie; najszybsze zmierzone 145–147 / 163–167 / 182–184 / 257–264 s (Red Team, rundy 9–10, najmocniejsze buildy z 3 kawami i dowolną bronią CS); bramka `boss` przechodzi na kodzie gry z `db3a3e9` (Audytor, lokalnie; Node 24 daje te same liczby co Node 26) | ✓ |
| walki Oracle w celu (120–150 / 150–180 / 165–210 / 240–300 s) | mediany 154–160 / 177–202 / 196–224 / 336 s | ✗ (2 z 9 stacji w celu; na stacjach 1–3 limit zostawia tylko 144–150 s, na pozostałych Oracle po prostu nie bije na limicie przez całą walkę) |
| walka Humana 1,3–1,6× dłuższa niż Oracle | ×1,06–1,43 (liczone tylko z wygranych) | ✗ (2 z 9 stacji w celu) |
| Oracle ≥ 90% na każdej stacji | 71/72 = 99%; Żakowice 7/8 | prawie (1 stacja 87,5% przy n = 8) |
| Oracle na szczycie drabinki (Normalnie, szczebel 19) ≥ 30% | 9/27 = 33% | ✓ |
| Human, 1. stacja ~50% | 9/20 = 45% | ✓ |
| Human, środek trasy ~35% | 15–40% (29/100 = 29% razem) | blisko |
| Human, dwie ostatnie i Bartek ~15–20% | Gałkówek 25%, Żakowice 10%, Koluszki 35% | ✗ (Koluszki za łatwe, Żakowice za trudne) |
| Human, Opóźnienie 120 min ~10% | 3/54 = 6% | blisko |
| Casual, Spokojny ~80% | 61/72 = 85% | ✓ |
| Casual, Normalnie: 1. stacja ~25%, finał < 3% | 0/72 (0% wszędzie) | ✗ (1. stacja) |
| exploity (bez reakcji) 0% ponad 3 min | bramka CI: 0; Red Team, runda 11: ślizg ze skokiem w miejscu 25 z 1656 runów ponad 3 min (najdłużej 243 s) | ✗ |
| żadna broń w ponad ~30% wygranych Humana | Telefon 48%, Iskra 40%, Kawa 38%, Bilet i Gnat 31% (18 losowych planów, 48 wygranych) | ✗ (Telefon wyraźnie; Iskra i Kawa w granicy losowania) |
| napięcie: ≥ 3 razy HP < 30% na run, boss przy 40–60% HP, wróg ≤ 5 m > 50% czasu | 1,07 na run (≥ 3 w 4% runów); mediana HP przy bossie 83% (40–60% w 16%); 26% czasu (> 50% w 1%) | ✗ |
| każda broń w ±15% budżetu, CS w ±15% domyślnej | tak (bramka CI od `db3a3e9`) | ✓ |
| broń sama ginie w minutę od 8. minuty (stojąc) | najdłużej 5 s (bramka CI), 9 s (`alone.ts`, 8 stacji) | ✓ |
| ≥ 6 ataków, ≥ 2 nowe w fazie, nic 3× z rzędu, bramki faz, bez stun-locka | tak, z zastrzeżeniami: przywołanie minionów liczy się jako atak, faza dodatkowa Opóźnienia ma dwa nowe ataki tylko jako kombosy starych | ✓ z zastrzeżeniem |

Human na Normalnie (plany A i K, po 10 seedów na stację):

| stacja | wygrane | A | K | śmierć przed bossem | śmierć u bossa |
|---|---:|---:|---:|---:|---:|
| Fabryczna | 9/20 | 3/10 | 6/10 | 6 | 5 |
| Niciarniana | 5/20 | 3/10 | 2/10 | 8 | 7 |
| Widzew | 8/20 | 5/10 | 3/10 | 7 | 5 |
| Andrzejów | 6/20 | 3/10 | 3/10 | 3 | 11 |
| Bedoń | 7/20 | 4/10 | 3/10 | 4 | 9 |
| Justynów | 3/20 | 0/10 | 3/10 | 10 | 7 |
| Gałkówek | 5/20 | 4/10 | 1/10 | 8 | 7 |
| Żakowice | 2/20 | 2/10 | 0/10 | 10 | 8 |
| Koluszki | 7/20 | 4/10 | 3/10 | 10 | 3 |
| **razem** | **52/180 (29%)** | | | | |

Oracle na Normalnie (plan A, 8 seedów na stację): 8/8 wszędzie poza Żakowicami (7/8). Casual na Spokojnym: 8/8 na
sześciu stacjach, Niciarniana 5/8, Żakowice 6/8, Bedoń 2/8. Human na Opóźnieniu: po 1/6 na Widzewie, w Justynowie i w
Koluszkach, reszta 0/6. Oracle na szczycie drabinki: 0–2 z 3 na stację.

Czasy walk z bossem (tylko wygrane; mediana przy parzystej liczbie to średnia dwóch środkowych):

| stacja | Oracle: najszybciej / mediana | Human: mediana | Human / Oracle | minimum | limit (1,2 × minimum) | cel Oracle |
|---|---:|---:|---:|---:|---:|---|
| Fabryczna | 147 / 154 s | 171 s | ×1,11 | 120 s | 144 s | 120–150 s |
| Niciarniana | 148 / 160 s | 230 s | ×1,43 | 120 s | 144 s | 120–150 s |
| Widzew | 148 / 156 s | 184 s | ×1,18 | 120 s | 144 s | 120–150 s |
| Andrzejów | 169 / 202 s | 234 s | ×1,16 | 135 s | 162 s | 150–180 s |
| Bedoń | 172 / 189 s | 218 s | ×1,16 | 135 s | 162 s | 150–180 s |
| Justynów | 165 / 177 s | 230 s | ×1,30 | 135 s | 162 s | 150–180 s |
| Gałkówek | 199 / 224 s | 241 s | ×1,08 | 150 s | 180 s | 165–210 s |
| Żakowice | 189 / 196 s | 207 s | ×1,06 | 150 s | 180 s | 165–210 s |
| Koluszki | 282 / 336 s | 375 s | ×1,12 | 210 s | 252 s | 240–300 s |

Udział broni w wygranych (18 losowych planów Humana, 2 dni × 9 stacji = 324 runy, 48 wygranych; każda wygrana ma
3 bronie obok Teczki z 10, więc równy podział to ok. 30%):

| broń | w wygranych | we wszystkich runach | win rate z bronią | bez niej |
|---|---:|---:|---:|---:|
| Telefon | 48% | 27% | 26% | 11% |
| Iskra | 40% | 42% | 14% | 15% |
| Kawa | 38% | 31% | 18% | 13% |
| Bilet | 31% | 38% | 12% | 16% |
| Gnat | 31% | 30% | 16% | 14% |
| Parasol | 29% | 23% | 19% | 14% |
| Gwizdek | 27% | 40% | 10% | 18% |
| Sos | 21% | 31% | 10% | 17% |
| Rozkład | 19% | 18% | 16% | 15% |
| Puszka | 17% | 16% | 16% | 15% |

Przed mnożnikami gry i skróceniem zasięgu (pomiar na dniach 600+) ta sama miara dawała Telefon 56%, Gwizdek 52%, Gnat
52%, a Sos 4%, Parasol i Puszka po 12%.

### Przed i po

„Przed” to gra ze strony przed przebudową, mierzona w `POSTMORTEM.md` starymi botami i ławkami. Nowe boty planujące
powstały w tej przebudowie i nie grały w starą grę, więc win rate porównuję tylko tam, gdzie jest ta sama miara.

| miara | przed | po |
|---|---|---|
| najszybsze zabicie bossa najlepszym buildem | 11–26 s (Teczka Prezesa + Parasol Burzowy + Kontrola + Gnat) | nigdy poniżej 1,2 × minimum (144–252 s); najmocniejsze znalezione buildy 145–264 s |
| walka z bossem przy zwykłym buildzie | 28–51 s (Telefon + Gnat + Bilet + Kawa, bez ewolucji, ławka) | 171–375 s (mediana wygranych Humana, plany A i K) |
| rozrzut mocy broni (maks. poziom, ta sama ławka) | 7× (Iskra 1860 / Teczka 256 DPS); ewolucje 8× | ×1,35 (85–115), ewolucje ×1,35 (127–173), każda w ±15% swojego budżetu |
| exploity ponad 3 min (36 runów każdy) | kółko 2, róg 1, bunny hop 2, tory 2 (najdłużej 240 s) | bramka CI: 0 (najdłużej 81 s); Red Team: ślizg ze skokiem w miejscu ok. 1,5% runów (najdłużej 243 s) |
| dobry bot na Normalnie | stary „dobry” bot 47% | Oracle 99%, Human 29%, Casual 0% |
| ogłuszenie bossa | bez limitu (stun-lock Gwizdkiem) | najwyżej 1,5 s, potem 2 s odporności |
| bramki faz | brak (nadwyżka przechodziła, faza przeskakiwała) | nadwyżka przepada, 2,5 s nietykalności |

## Dlaczego poprzednia przebudowa nie zadziałała

Pełna analiza jest w `POSTMORTEM.md`. W skrócie: symulacja liczyła inną grę niż przeglądarka (V8 w Node i w
Chromium różnią się w `sin`/`cos`/`atan2`/`exp`, ekrany kart i skrzyń szły zegarem ściany), stary bot był za słaby,
żeby odróżnić łatwą grę od trudnej, bronie i statystyki mnożyły się bez limitu (cooldown z poziomów broni ×
rzadkość karty × profil skina), a boss na stronie padał w 11–14 s od buildu Teczka Prezesa + Parasol Burzowy +
Kontrola + Gnat.

## Jak mierzymy

**Symulacja to gra.** `scripts/sim/worker.ts` buduje `src/` przez Vite (SSR) z cienką atrapą przeglądarki i gra
prawdziwą klasą `Game` na wątkach roboczych. Że to ten sam kod co do bitu, dowodzi `e2e/replay.spec.ts`: bot gra w
zbudowanej grze w Chromium, nagrywa wejście co klatkę, symulacja odtwarza nagranie i porównuje hash stanu co 60
kroków (Widzew 75 s; Żakowice z walką z bossem). Trzy rzeczy, które to psuły, opisuje `POSTMORTEM.md` §3 (własny
`libm` w `src/core/libm.ts`, zegar klatek dla ekranów kart i skrzyń, źródła obrażeń rejestrowane przy rysowaniu).
Test działa w CI przy każdym pushu. **Zakres jest ograniczony:** przeglądarkę i symulację porównano na dwóch
przypadkach, Widzew przez pierwsze 75 s i Żakowice od 45. sekundy z bossem w 1. fazie. Nie porównano faz 2. i dalszych
ani ich bramek, limitu obrażeń w nasyceniu, śmierci bossa, ewolucji, dyrektora kitingu, wydarzeń, Ostatniego
pociągu, finału z Bartkiem, Spokojnego, Opóźnienia, drabinki ani innych przeglądarek niż Chromium. To ten sam kod
TypeScript, a znane źródła rozjazdu (funkcje `Math`, zegar ekranów) są usunięte, ale dowodu na te części nie ma.

**Node 24 a Node 26.** Test zgodności działa w CI na Node 26 (`.nvmrc`), i to Node 26 jest punktem odniesienia: ta
sama gra co Chromium. Na tym PC symulacja chodziła na Node 24. Najpierw wziąłem za różnicę wersji to, że bramka
budżetu broni przeszła lokalnie, a w CI na `071c7dc` padła; Audytor pokazał, że to były dwie różne definicje budżetu
(`gate.ts` liczył budżet bez mnożnika gry, a `budget.ts` z nim), a na `d77b086` Node 24 i Node 26 drukują w każdej
bramce te same liczby. Budżet jest teraz zdefiniowany w jednym miejscu (`scripts/sim/curve.ts`, `db3a3e9`). Różnicy
Node 24 / Node 26 w innych miejscach nie wykluczam: `src/core/libm.ts` przypina 7 funkcji `Math`, a `Math.hypot` i
`**` z ułamkowym wykładnikiem nie są przypięte. Audytor przeliczył 36 runów pomiaru końcowego na Node 24: wszystkie
są identyczne bajt w bajt z tymi z Node 26, więc rundy Red Teamu, moje ławki i pomiary robocze z Node 24 dotyczą tej
samej gry.

**Migawki.** `snapshot`/`restore` (`src/game/replay.ts`) zapisują i odtwarzają cały stan gry w miejscu;
`node scripts/sim/replay.ts --snap` sprawdza, że run odtworzony z migawki idzie dalej identycznie jak oryginał
(bramka CI `snap`: 14 sprawdzeń, 1–2 na stację, żadne w walce z bossem). Na migawkach stoją boty planujące, a
Audytor sprawdził, że ich rollouty nie zostawiają śladu w grze: Oracle w Koluszkach przez 986 s i 75 158 rolloutów
odtworzony bez bota daje ten sam hash w każdym z 986 sprawdzeń.

**Seedy.** Każdy pomiar ma stałe seedy (dni Codziennego kursu od 2026-01-01, `--od=N` przesuwa start), a każdy
wariant gra te same seedy, więc porównania są parami. Strojenie zapadało na dniach 0–63, 100, 200, 300–323 (runy
Red Teamu, na których oparłem zmianę Fabrycznej), 400–402 (warianty Spokojnego), 500–504, 600–609, 700–709, 900–909 i
1000–1009 (kolejne pomiary, po każdym coś zmieniałem: mnożniki gry broni wziąłem z dni 600+, stacje z 700+ i 900+);
pomiary na dniach 800, 1100 i 1200 anulowałem przed końcem. Wynik końcowy jest z dni 1300–1309 (losowe plany także
1301), których nie użył żaden wcześniejszy plik w `.sim/` ani żadna specyfikacja Red Teamu.

### Boty (`src/game/bots/planner.ts`)

Wszystkie trzy planują tak samo: co chwilę robią migawkę gry, rozgrywają naprzód kilka kandydatów ruchu (kierunek
× bieg/ślizg/skok) w prawdziwej symulacji i wybierają najlepszy wynik (zdrowie, zagrożenie, XP, obrażenia bossa,
cel). Różnią się tym, co człowiek ma inne:

| bot | decyzja co | reakcja | horyzont | widzi | karty |
|---|---|---|---|---|---|
| Oracle | 0,2 s | 0 | 1,5 s | wszystko, także za plecami | plan buildu |
| Human | 0,12–0,18 s | 0,22–0,28 s | 0,5 s | stożek kamery + 3 s pamięci, strzałki krawędzi ekranu | plan buildu, 5% pomyłek |
| Casual | 0,2–0,28 s | 0,33–0,42 s | 0,4 s | jak Human, tylko ślizg (bez bunny hopu), 10% pomyłek ruchu | losowe |

Reakcja to kolejka: decyzja podjęta teraz wchodzi w życie po czasie reakcji, jak u człowieka. Human widzi
wszystko w promieniu 5 m niezależnie od kamery, pamięta to 3 s i zna wszystko, na co wskazują strzałki na krawędzi
ekranu. Jest przy tym **silniejszy od człowieka** w jednym: jego rollouty grają prawdziwą przyszłość z migawki,
razem z losowaniem następnego ataku bossa i miejsc stref, więc „widzi” atak trochę przed telegrafem. Wyniki
Humana zawyżają więc szanse prawdziwego gracza.

Botów nie osłabiałem, żeby trafić w cel. Zmiany botów w tej gałęzi (`git log main..balans-v2 -- src/game/bots`):

| commit | zmiana | kierunek |
|---|---|---|
| `f44e2dd` | Human decyduje co 0,12–0,18 s (było 0,2–0,3), Casual co 0,2–0,28 s (było 0,3–0,45) | mocniej |
| `2d5b634` | Human zna to, na co wskazują strzałki krawędzi ekranu | mocniej |
| `7df8604` | obrażenia bossa w ocenie ruchu, łapanie lemurów | mocniej |
| `a7fdf35` | Casual = Human z +½ reakcji, 2× rozrzutem i pomyłkami (horyzont 0,35→0,4 s, 8→12 kierunków, ślizg, pomyłki 15→10%) | mocniej |
| `1b26507` | Oracle „spokojny”: bez nikogo w 7 m i bossa sprawdza połowę kierunków | słabiej poza walką, w walce bez zmian |
| `d5f2c5c` | cel „podejdź do bossa poza zasięgiem broni” (10 m) | mocniej |
| `ef7359e` | podejście do bossa na zasięg najdłuższej broni (bazowy zasięg − 1,5 m, w granicach 3–10 m) | mocniej, tylko dla buildów z samych krótkich broni |

`a7fdf35` zrobiłem zaraz po serii pomiarów, w których Casual na Normalnie wygrywał 0%: to przesunięcie przyrządu w
stronę celu Casuala, choć z regułą (Casual to Human z wolniejszą reakcją i większymi błędami) i w granicach
definicji ze specyfikacji. Cel z `d5f2c5c`: bez niego rollouty 1,5 s nie widziały bossa 20 m dalej i bot krążył,
aż przyjechały Nocne Kanary (Oracle spędzał ponad 40% walki z Bartkiem dalej niż 19 m od niego).

**Buildy.** Human i Oracle grają planem buildu (cztery bronie, cztery pasywki). Plany A, B, C to najlepsze plany
z optymalizatora (`scripts/sim/optimize.ts`, `scripts/sim/data/loadouts.json`), K to plan, który znalazł Red Team
(runda 2) jako najłatwiejszy na 1. stacji. Udział broni w wygranych mierzy 18 losowych planów (`scripts/measure/randplans.mjs`:
cztery losowe bronie, pasywki głównie pod ich ewolucje). Plan to lista preferencji, nie gwarancja: Teczka zajmuje
jeden z czterech slotów od startu, więc z planu z czterema innymi broniami bot weźmie trzy, a pasywkę do ewolucji
posiadanej broni stawia wyżej niż pasywki z planu. Udział broni w wygranych liczy to, co bot naprawdę miał na końcu.

**Exploity** (`src/game/bots/exploits.ts`): stanie, kółko, dach, róg, bunny hop po linii, obóz przy automacie z
kawą, tory. Każdy na Normalnie i Opóźnieniu musi zginąć przed 3. minutą (bramka `exploits`). Specyfikacja definiuje
boty exploitów jako boty bez reakcji. Boty, które reagują na wrogów (Red Team napisał dwa: „ucieczka” od najbliższych
ciał i „pustka” w stronę najpustszego kierunku), to dla mnie minimalna gra, nie exploit: ich wyniki są niżej,
w „Czego nie osiągnąłem”.

### Narzędzia

```bash
node scripts/sim/bots.ts --boty=oracle,human,casual --runs=8 [--kurs=] [--od=] [--drabinka=] [--warianty=v.json]
node scripts/sim/optimize.ts --start=24 --pokolenia=1 --dzieci=8 --final=6   # najlepsze buildy Humana
node scripts/sim/bossfight.ts [--zestawy=a.json,b.json] [--bot=human]          # czasy zabicia bossów
node scripts/sim/budget.ts [--sprawdz] [--cs]                                   # budżety broni
node scripts/sim/alone.ts                                                       # broń sama przeciw falom
node scripts/sim/gate.ts                                                        # bramka CI
git push origin HEAD:sim/<nazwa>                                               # pełny pomiar na CI (~50 min, „Bramka CI”)
```

Plik wariantów: `{ "nazwa": ["human", {zmiany profilu bota}, {"ścieżka.w.TUNING": wartość}, "bronie/pasywki"] }`.
Ścieżki mogą też zaczynać się od `enemy.<id>`, `food`, `fallback`, `passive.<id>`. Zmiany w wariancie działają tylko
na te runy (strojenie bez przebudowy), ale wynik końcowy zawsze pochodzi z gry z wartościami wpisanymi w kod.

Narzędzia Red Teamu (`scripts/redteam/`) zostały w repo: ławka bossa z logiem ataków, ogłuszeń i przesunięć w puli,
boty ucieczki, `amount.ts` (bronie z pasywkami).

## Zasady projektowe

1. **Mechanika przed cyferkami.** Najpierw zachowania (wrogowie szybsi, rzucający, szarżujący, skaczący z góry,
   tarcze, dyrektor fal, wydarzenia, dyrektor kitingu i kempingu), dopiero potem mnożniki.
2. **Krzywa runu.** Napięty początek, w środku fantazja mocy z rosnącą presją, na końcu boss, który przechodzi
   tylko dobry build z dobrym ruchem, a „Ostatni pociąg” rozlicza DPS buildu.
3. **Zero rubber-bandingu od Normalnie w górę.** Dyrektor fal na Normalnie i wyżej zależy wyłącznie od seeda i
   zegara. Tylko na Spokojnym czyta zdrowie gracza i tłum.
4. **Trudniej znaczy trudniej.** Żaden modyfikator drabinki nie daje więcej nagrody niż zagrożenia.
5. **Uczciwość.** Każdy atak ma telegraf, który da się przeczytać i przed którym da się uciec:
   - uderzenie i strefa bossa w miejscu gracza ostrzegają co najmniej tak długo, ile trwa wybiegnięcie z nich przy
     85% prędkości biegu (`TUNING.boss.escapeSpeed`), nigdy krócej niż 0,3 s;
   - nic nie pojawia się graczowi pod nogami: zwykły spawn najbliżej 13 m, przywołani stoją chwilę oszołomieni;
   - fale uderzeniowe bossów da się przeskoczyć, szarże ominąć, promienie obiec;
   - zagrożenia spoza kadru mają strzałki na krawędzi ekranu;
   - po trafieniu 0,45 s nietykalności, pierwsze 0,3 s ślizgu przechodzi przez ciała wrogów;
   - efekty broni nie zasłaniają telegrafów: znaczniki ataków na ziemi rysują się nad kałużami, aurami i śladami
     broni (`renderOrder` 2 i mocniejszy `polygonOffset` niż efekty broni, `src/game/hazards.ts`);
   - po śmierci ekran „Co cię zajebało”: ostatnie 5 trafień, kto, czym, ile i kiedy.

## Co się zmieniło

### Fale i presja (`src/content/tuning.ts`, `src/content/enemies.ts`)

- **Dotyk na start: 4–5 trafień** od przeciętnego wroga zabija Piotrka z pełnego zdrowia (`touchesToDie`, test
  `src/balance/model.test.ts`). Z czasem dotyk rośnie wolno (+2% na minutę zamiast +7,5%): wcześniej pod koniec
  fal pojedynczy kontakt zabierał 40% paska i runy kończyły się nagłą śmiercią zamiast stałej presji.
- **Wrogowie szybsi** o 15–35% (gołąb 5,0 m/s, szczur 4,6, Janusz 4,6, kurier 4,5, dachowiec 6,0, kanar 4,0,
  ochroniarz 3,6, robotnik i złomiarz 3,4, brygadzista 3,3). Gracz biega 7,2 m/s: nadal da się uciec, ale nie da
  się już uciekać bez końca w jedną stronę.
- **Spawn przed graczem:** 60% zwykłych grup pojawia się 13–18 m przed kierunkiem biegu, reszta 14–22 m od Piotrka.
- **Dyrektor kitingu** (`TUNING.kiting`): bieg ≥ 80% prędkości przez 20 s od 110. sekundy ściąga co 12 s dwóch
  szybkich. **Kemping** (`TUNING.camping`): 10 s w promieniu 5 m ściąga co 4 s pierścień i 1–4 stada, o jedno więcej
  co drugą falę, dopóki Piotrek nie odejdą. Uderzenie przy lądowaniu po ślizgu odpycha wrogów najwyżej raz na 2,5 s.
- **Wysokość:** piechurzy stojący ponad 4 m nad Piotrkiem wracają na ziemię jak maruderzy, gołębie przy zadaszonym
  Piotrku lecą pod dachem, tłum nie rozpycha się między poziomami, a pod Piotrkiem stojącym albo podskakującym na
  podwyższeniu (dach, wiata, parapet) piechurzy w promieniu 3,5 m wspinają się do niego (Red Team, rundy 9–11).
- **Mało leczenia:** pączek z elity 12 HP (był 25), kosze dają pączka w 15% (było 35%), Zapiekanka (karta, gdy nie
  ma czego ulepszyć) 6 HP (było 20), Kanapka od Mamy 0,1 HP/s na poziom (było 0,2), regeneracja rusza 5 s po
  trafieniu (było 3 s), Kebab XXL najwyżej 2 HP/s.
- **Elity** w 120., 200., 270. i 330. sekundzie; **ewolucje** dopiero od 270. sekundy na Normalnie (skrzynia
  wcześniej daje ulepszenia); **jedno losowanie kart** na run; **nietykalność po trafieniu** 0,45 s.
- **Rampa trasy** (`TUNING.route`): zdrowie, obrażenia i tempo fal na każdej stacji: Fabryczna ×0,82,
  Niciarniana ×0,93, Widzew ×0,89, Andrzejów ×0,86, Bedoń ×0,97, Justynów ×1, Gałkówek ×1, Żakowice ×1,
  Koluszki ×1,02. Nie rośnie równo, bo stroiłem ją po tym, gdzie Human ginął przed bossem.

### Siła gracza: kumulacja statystyk (`src/game/progress.ts`, `TUNING.limits`)

Wszystkie premie tej samej kategorii **dodają się**, a dopiero suma przechodzi przez limit: szybkość ataku z
poziomów broni, rzadkości kart, Energetyka i broni CS razem nigdy nie skraca odnowienia poniżej 60% bazowego
(wcześniej mnożniki z poziomów broni omijały globalny limit). Pancerz: `0,6 × a / (a + 0,45)`. Szansa na krytyk
najwyżej 25%, mnożnik krytyka ×1,75. Rzadkość karty mnoży przyrost poziomu (×1 / 1,15 / 1,3 / 1,5), nie całą broń.
Twarde limity broni: najwyżej 8 pocisków w salwie, aura do 6 m, wybuch do 4 m, nic częściej niż co 0,15 s.

### Bronie (`src/content/items.ts`, `src/content/budget.ts`, `scripts/sim/budget.ts`)

**Budżet mocy.** Każda broń na każdym poziomie jest mierzona na ławce (`dps` w `scripts/sim/worker.ts`): tłum
40 manekinów w dysku 9 m wokół stojącego Piotrka i jeden cel 3,5 m przed nim, 20 s czasu gry po rozgrzewce,
obrażenia na sekundę czasu gry (hitstop nie zawyża). Moc = średnia geometryczna obu (broń na tłum i broń na bossa
ważą tyle samo). Krzywa: 100 na najwyższym poziomie, −12,5% za każdy poziom niżej (+12,5% na poziom), ewolucja 150
(+50%). `--zapisz` dopasowuje mnożnik obrażeń każdego poziomu do krzywej (`src/content/budget.ts`), `--sprawdz`
(bramka CI) pada, gdy cokolwiek odbiega o ponad 15%. Bronie CS na Gnacie mają ten sam budżet co domyślny pistolet
±15% (AWP i Desert Eagle biją pojedynczo mocno, ale rzadko).

| broń | tłum (DPS) | jeden cel (DPS) | moc | budżet | | ewolucja | tłum | jeden cel | moc | budżet |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| Teczka 8 | 312 | 32 | 100 | 100 | | Teczka Prezesa | 663 | 34 | 150 | 150 |
| Bilet 8 | 345 | 35 | 110 | 110 | | Bilet Sieciowy | 479 | 57 | 165 | 165 |
| Kawa 8 | 240 | 55 | 115 | 115 | | Espresso | 476 | 63 | 173 | 173 |
| Sos 8 | 436 | 30 | 115 | 115 | | Kebab XXL | 634 | 47 | 172 | 173 |
| Telefon 8 | 318 | 23 | 85 | 85 | | Powerbank | 456 | 36 | 128 | 128 |
| Parasol 8 | 464 | 29 | 115 | 115 | | Parasol Burzowy | 731 | 41 | 173 | 173 |
| Gwizdek 8 | 351 | 21 | 85 | 85 | | Kontrola Biletów | 709 | 23 | 127 | 128 |
| Puszka 8 | 217 | 61 | 115 | 115 | | Zgrzewka | 341 | 87 | 173 | 173 |
| Gnat 8 | 82 | 88 | 85 | 85 | | – | | | | |
| Iskra 8 | 122 | 59 | 85 | 85 | | Sieć Trakcyjna | 185 | 88 | 127 | 128 |
| Rozkład 8 | 211 | 47 | 100 | 100 | | Rozkład 2027 | 456 | 49 | 150 | 150 |

Budżet = krzywa × 0,8 dla broni ogłuszających i spowalniających × **mnożnik gry** (`PLAY` w `scripts/sim/curve.ts`,
najwyżej ±15%). Mnożnik gry przyszedł z pomiaru, nie z ławki: w 162 runach Humana z 18 losowymi planami (dni 600+,
przed tą zmianą) z Telefonem wygrywało się 30% runów, bez niego 10%, z Gnatem 28% wobec 10%, a z Sosem 3% wobec 19%.
Telefon, Gnat, Gwizdek i Iskra ×0,85, Bilet ×1,1, Kawa, Sos, Parasol i Puszka ×1,15 (po kolejnych pomiarach:
Telefon dalej był w 63%, potem 54% i 68% wygranych, więc dostał też krótszy zasięg, 11 → 9 → 7,5 m); Sos (4,8 m) i Parasol (4,6 m)
sięgają też dalej, a boty podchodzą do bossa na zasięg swojej najdłuższej broni (z samymi krótkimi broniami bliżej
niż 10 m). Ewolucja dzieli mnożnik ze swoją bronią.

Każdy poziom 1–8 każdej broni i każda ewolucja mieszczą się w ±15% swojego budżetu (`budget.ts --sprawdz` i bramka
CI `budget`, od `db3a3e9` z tą samą definicją w `scripts/sim/curve.ts`; wcześniej bramka liczyła budżet bez
mnożnika gry i na `071c7dc` oraz `d77b086` była czerwona). Moc na maksymalnym poziomie leży więc między 85 a 115
(×1,35), ewolucje między 127 a 173 (×1,35). Przed przebudową ta sama broń na maksymalnym poziomie w ruchu dawała rozrzut 7× między
najmocniejszą (Iskra, 1860 DPS) a najsłabszą (Teczka, 256 DPS), a ewolucje od 3492 (Bilet Sieciowy) do 418
(Powerbank) (stara ławka, `.sim/weapons-real.md`: plik lokalny, `.sim/` jest poza repo).

**Zasięg poza ławką.** Ławka nie widzi zasięgu (wszystkie manekiny są bliżej niż 9 m), a pomiar Humana w walkach z
bossem pokazał, że to zasięg je rozstrzyga: Human trzyma bossa w odległości 5–19 m (mediana 11 m, 32% czasu ponad
19 m, w zasięgu teczki czy aury tylko 1,5% czasu). Bronie dystansowe mają teraz 10–13 m (Kawa 10, Bilet, Puszka i Iskra 11, Gnat i Rozkład 13), Telefon 7,5 m (z 11 m
sam niósł runy, niżej);
bronie krótkie (teczka, sos, parasol, gwizdek) są bronią na tłum.

**Pasywki poza budżetem.** Budżet mierzy broń samą. Pasywki mnożą bronie nierówno (Red Team, runda 2,
`scripts/redteam/amount.ts`): Bilet Ulgowy 2 daje Puszce ×2,07 i Iskrze ×1,71, a Gnatowi nic; Okulary 5 dają
Sieci Trakcyjnej ×1,65. To zamierzone synergie (pasywka-partner ewolucji wzmacnia swoją broń), a granicę dla
całego buildu trzymają limit obrażeń bossa, limity statystyk i udział broni w wygranych.

### Bossowie (`src/game/boss.ts`, `src/content/bosses.ts`, `TUNING.boss`)

**Limit obrażeń.** Pierwsza runda Red Teamu złożyła build, który boty naprawdę składają do 6. minuty (Teczka,
Kontrola Biletów, Gnat 8, Sieć Trakcyjna z Biletem Ulgowym i Zdrapką), i zabiła nim 8 z 9 bossów poniżej minimum
(Niciarniana w 63 s przy minimum 120 s). Ławka budżetu tego nie widzi: Gnat na 8. poziomie bije pojedynczy cel
3–4 razy mocniej niż Kontrola czy Telefon, a średnia geometryczna tłum × cel trzyma go w budżecie. Zamiast
przestawiać budżet każdej broni na nowo boss ma teraz limit obrażeń (`Boss.limit`): trafienia wchodzą w pełni,
dopóki starcza puli, która napełnia się w tempie `zdrowie / (1,2 × minimum walki)` na sekundę i mieści 2 s tego
tempa; ponad pulę nie wchodzi nic (`limitOverflow` 0). Pierwsza wersja przepuszczała ponad pulę 10% trafienia i
Red Team (runda 8) zszedł nią poniżej minimum karabinem AUG z pasywkami (Żakowice 142,5 s przy 150). Z twardym
limitem walka trwa co najmniej 1,2 × minimum minus 2 s puli, cokolwiek gracz złoży. Pasek zdrowia bossa przygasa, gdy
boss jest na limicie, więc gracz widzi, że mocniejszy build nic tu już nie przyspieszy. Limit liczy się po tarczy z
kawy Bartka, przed bramkami faz (bramka liczy to, co naprawdę weszło), a łyk kawy Bartka (leczy 0,6% zdrowia, wcześniej 1%) otwiera pulę o tyle samo: bez tego limit
przepuszczał 0,4% zdrowia na sekundę, łyki oddawały 0,25%, a Oracle bił Bartka po 700 s, aż przyjechały Kanary.

**Bramki faz** bez zmian: trafienie nie przebija progu następnej fazy (reszta przepada), zmiana fazy to 2,5 s
nietykalności bez ataków.

**Powtórki ataków.** Zasada „nigdy trzeci raz z rzędu” liczyła obiekty ataków i zerowała się przy zmianie fazy,
a fazy przenoszą ataki jako nowe obiekty o tej samej nazwie; dobicia kombinacji (`then`) nie liczyły się wcale.
Red Team złapał 4 × „Reszta w drobnych” z rzędu przez granicę faz. Teraz licznik idzie po nazwie ataku (albo
rodzaju, gdy nazwy nie ma), liczy dobicia i nie zeruje się przy zmianie fazy, a losowanie nie alokuje.

**Ogłuszanie bossa.** Pojedyncze ogłuszenie trzyma bossa najwyżej 1,5 s, a ogłuszonego bossa nie da się ogłuszyć
ponownie ani przez 2 s po ogłuszeniu, a potem tylko na ćwierć czasu, dopóki nie minie 12 s bez ogłuszeń
(wcześniej nakładające się ogłuszenia z Kontroli i Gwizdka trzymały go do 9 s). Red Team (runda 2) znalazł przy tym
błąd: pamięć odporności (`stunDr`) nie przechodziła z bossem, gdy pula wrogów przesuwała go na inne miejsce po
śmierci innego wroga, więc boss w nowym miejscu znowu dawał się ogłuszyć w pełni. Poprawione.

**Megafon** dostał szósty rodzaj ataku („Spadający głośnik”, uderzenie w ziemię w 2. fazie): miał 5 rodzajów, a jego
2. faza wnosiła tylko jeden nowy (Komunikat odwrotny to ta sama fala z odwróceniem sterowania). Dodatkowa faza
Opóźnienia (od 15% zdrowia) bierze ataki ostatniej fazy i najmocniejszy **nowy** atak każdej wcześniejszej; wcześniej
porównywała obiekty, więc „Reszta w drobnych” trafiała do niej trzy razy.

| stacja | boss | zdrowie (Normalnie) | fazy | ataki (nazwy / rodzaje) | nowe w fazie | minimum walki | cel Oracle | ostatni pociąg | siła ataków |
|---|---|---:|---:|---|---|---:|---:|---:|---:|
| Fabryczna | Biletomat | 34 950 | 3 | 7 / 6 | 2, 3, 2 | 120 s | 120–150 s | 375 s | ×0,85 |
| Niciarniana | Przędzalniana Pajęczyca | 33 450 | 3 | 6 / 6 | 2, 2, 2 | 120 s | 120–150 s | 375 s | ×1,35 |
| Widzew | Kanar Prime | 29 400 | 3 | 6 / 6 | 2, 2, 2 | 120 s | 120–150 s | 375 s | ×1,8 |
| Andrzejów | Król Skupu Złomu | 40 800 | 3 | 6 / 6 | 2, 2, 2 | 135 s | 150–180 s | 450 s | ×0,6 |
| Bedoń | ZKA Ostatni Kurs | 36 000 | 3 | 7 / 6 | 2, 2, 3 | 135 s | 150–180 s | 450 s | ×1 |
| Justynów | Gołąb Matka | 45 300 | 3 | 6 / 6 | 2, 2, 2 | 135 s | 150–180 s | 450 s | ×0,85 |
| Gałkówek | Kierownik Robót PLK | 52 500 | 3 | 6 / 6 | 2, 2, 2 | 150 s | 165–210 s | 525 s | ×0,45 |
| Żakowice | Megafon Komunikatów | 36 000 | 3 | 7 / 6 | 2, 3, 2 | 150 s | 165–210 s | 525 s | ×0,55 |
| Koluszki | Bartek D. | 45 600 | 4 | 8 / 8 | 2, 2, 2, 2 | 210 s | 240–300 s | 750 s | ×0,65 |

Zdrowie to `bosses.ts` × 3 (Normalnie). „Siła ataków” (`TUNING.boss.hurt`) mnoży ataki i dotyk bossa danej stacji:
stroiłem ją po win rate Humana, bo zdrowie bossa wyznaczają czasy walk Oracle. Każdy boss ma atak, przed którym
ratuje skok, ślizg albo zmiana pozycji: 8 z 9 ma fale do przeskoczenia, szarże albo toczące się szpule, Gołąb Matka
tylko uderzenia i strefy do opuszczenia. Wściekłość po 120 s walki (każda walka do niej dochodzi, bo minimum to co
najmniej 120 s: zamierzona ostrzejsza końcówka), miniony co 16 s. Liczba ataków i „nowe w fazie” liczą przywołanie
minionów (`summon`) jako atak; bez tego w 7 z 9 bossów któraś faza ma tylko 1 nowy atak, a 5 bossów ma po 5
ataków.

### Kursy (`TUNING.difficulty`)

| | zdrowie wrogów | ich obrażenia | gęstość | szybkość | boss po | zdrowie bossa | ataki bossa | tempo bossa | telegraf | afiksy elit | dodatkowa faza | ostatni pociąg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Spokojny | ×0,55 | ×0,17 | ×0,65 | ×0,7 | 5:00 | ×0,35 | ×0,2 | ×1,4 | ×1,25 | 1 | nie | ×2 |
| Normalnie | ×1 | ×1,5 | ×1 | ×1 | 6:00 | ×3 | ×1 | ×1 | ×1 | 1 | nie | ×1 |
| Opóźnienie 120 min | ×1,15 | ×1,9 | ×1,1 | ×1 | 7:00 | ×3,3 | ×1,4 | ×0,8 | ×0,85 | 2 | tak | ×0,85 |

Ostatni pociąg odjeżdża po 2,5 × górnej granicy walki ze stacji (`TUNING.boss.fight`), razy mnożnik kursu.
Spokojny to kurs do fabuły i jest łagodny celowo: przy wcześniejszych mnożnikach (×0,45 obrażeń, ×0,85 gęstości)
Casual wygrywał tam 22–33% zamiast ~80%, ginąc głównie od gołębi przed 5. minutą.

**Drabinka opóźnień** (19 szczebli po 15 minut, każdy to Normalnie plus jeden modyfikator, wcześniejsze dalej
obowiązują) i **Codzienny kurs** (Normalnie + modyfikator dnia) działają jak wcześniej; zmieniły się tylko liczby
pod nimi.

## Bramka CI (`scripts/sim/gate.ts`, job `balance` w `.github/workflows/checks.yml`)

Przy każdym pushu, poza testami i e2e (w tym `e2e/replay.spec.ts`):

- `snap`: migawki odtwarzają run co do bitu (14 sprawdzeń na 9 stacjach);
- `budget`: każdy poziom każdej broni i ewolucji w ±15% swojego budżetu (krzywa × 0,8 dla użytkowych × mnożnik gry), a każdy mnożnik gry w ±15% krzywej;
- `cs`: każda broń CS w ±15% domyślnego pistoletu;
- `alone`: każda broń na maksa sama od 8. minuty ginie w ciągu minuty;
- `exploits`: każdy exploit ginie przed 3. minutą na Normalnie i Opóźnieniu;
- test `src/balance/model.test.ts`: 4–5 dotyków zabija na starcie; limit obrażeń nie ma przepustu, a jego zapas
  jest ≥ 1 (to test stałych, nie kodu gry: kod limitu sprawdza bramka `boss` niżej).

Osobny job `balance-bots` (godzina i więcej, bo każdy run bota planującego to minuty): `boss` (Oracle z
najmocniejszym zapisanym zestawem, dwie walki na bossa, plus najszybszy build Red Teamu z trzema kawami i USP,
nieśmiertelny Oracle; żaden boss poniżej minimum) i `bots` (Human 10–60% na Normalnie łącznie, Casual 50–100% na
Spokojnym i 0–40% na Normalnie, 4 seedy na stację: widełki szerokie i zbiorcze, cele są per stacja). Czerwony
którykolwiek job blokuje deploy. Oracle ≥ 90%, szczyt drabinki i wskaźniki napięcia nie są w CI.

**Pomiar końcowy** to `.github/workflows/sim.yml` z `scripts/measure/ci-step.sh`: push commitu na gałąź `sim/<nazwa>`
uruchamia 72 joby (8 kroków × 9 stacji) na runnerach GitHub Actions; artefakty pobiera
`gh run download <run> -D .sim/<nazwa>-shards`, scala `node scripts/measure/merge-shards.mjs <nazwa>`, a tabele z
„Wyników” liczy `node scripts/measure/tables.mjs <nazwa>`. Wynik z tego pliku to run 45870504499 (gałąź `sim/s`,
commit `19e4a96` = kod gry z `d77b086` plus pliki pomiaru).

## Red Team

Po każdej rundzie poprawek świeży subagent, który nie pisał kodu i nie widział wcześniejszych raportów (tylko
narzędzia poprzednich rund w `scripts/redteam/`), próbował złamać trudność: exploity, bossowie poniżej minimum,
przegięte bronie, monotonne walki, łatwe buildy. Raporty niżej są wklejone bez zmian, a pod każdym jest, co z nim
zrobiłem. **Warunek specyfikacji (dwie czyste rundy z rzędu) nie został spełniony:** czysta była tylko runda 4,
każda następna coś znalazła.

### Runda 1 (na `0d2e0b8`)

<details>
<summary>Runda 1: raport bez zmian (po angielsku)</summary>

## Red team report: PIOTROBONK difficulty (branch balans-v2, Normalnie)

I changed nothing in `src/`, committed nothing, and never touched `.sim/worker.mjs` or any `f-*` file. Every sim command ran with `SIM_WORKER=redteam` and at most 6 threads; `git status` shows only `scripts/redteam/` as new. Total wall time was about 70 minutes.

My tools are in `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\`:
- `worker.ts` is my own worker on the real Game. It does boss benches that log every attack wind-up, the stun share, the longest unbroken stun and damage taken while the boss is shielded. It also has new exploit bots, and an "alone" mode with movement.
- `rt.ts` runs a spec file and prints a summary. `mk.mjs` builds boss-bench specs.
- `dps.ts` measures single-target vs crowd DPS. `levels.ts` lists budget deviations. `attacks.ts` counts boss attacks from the data.
- Specs are in `specs\`, results in `out\`, and Human runs went to `.sim\redteam-human-k.json`, `-k2.json` and `-bs.json`.

I checked the harness against the official bench first: the 3 stored Fabryczna loadouts on the official seeds (`specs/b3.json`) gave a fastest kill of 127 s. Your `.sim/bossfight-o2.log` says 128 s, so my bench reproduces yours.

### Finding 1 (requirement 2, severe): a build bots really assemble kills every boss under its minimum
- **What I ran:** `node scripts/redteam/mk.mjs ... "C4=teczka,kontrola,gnat,siec-trakcyjna|zdrapka,bilet-ulgowy,energetyk,okulary"`, then `SIM_WORKER=redteam node scripts/redteam/rt.ts scripts/redteam/specs/b2.json b2 --watki=6`. Fabryczna is in `specs/b1.json`. The oracle is mortal, 3 seeds per boss, every card common, passive totals 0.70 / 2 / 0.48 / 0.45.
- **Result:** the oracle won all 27 fights. Fastest / median kill against the minimum:

| Boss | Fastest | Median | Minimum |
|---|---:|---:|---:|
| Fabryczna | 85 s | 88 s | 120 s |
| Niciarniana | 63 s | 64 s | 120 s |
| Widzew | 68 s | 71 s | 120 s |
| Andrzejów | 94 s | 94 s | 135 s |
| Bedoń | 104 s | 107 s | 135 s |
| Justynów | 94 s | 95 s | 135 s |
| Gałkówek | 136 s | 144 s | 150 s |
| Żakowice | 119 s | 120 s | 150 s |
| Koluszki | 160 s | 230 s | 210 s |

- **It is assemblable by 360 s, in a natural run:** `SIM_WORKER=redteam node scripts/sim/bots.ts --warianty=scripts/redteam/specs/human-k.json --stacje=fabryczna,widzew,zakowice,koluszki --runs=6 --od=300 --watki=6 --plik=redteam-human-k`.
  - The plan was "gwizdek+gnat+iskra+teczka / zdrapka+bilet-ulgowy+energetyk+okulary".
  - On Widzew, seed day 305, the **Human bot** arrived with Teczka Prezesa, Sieć Trakcyjna, Gnat 8 and Kontrola, and killed Kanar Prime in **92.6 s** (minimum 120).
  - I gave that exact loadout to the mortal oracle on the official seeds. It killed 8 of 9 bosses under their minimum: 84, 65, 71, 84, 102, 90, 157 (Gałkówek passes), 106 and 150 s.
- **The Human bot with C4 in the boss bench** (`specs/b4.json`) killed Fabryczna in 117 s in 1 of 3 fights. Widzew, Żakowice and Koluszki stayed above their minimum.
- **Ablation at Fabryczna** (oracle, 3 seeds each):

| Build | Kill times |
|---|---|
| C2: Teczka Prezesa + Gnat + Sieć + Zgrzewka, no Kontrola | 100–107 s |
| C3: Teczka Prezesa + Gnat + Sieć + Bilet Sieciowy, no Kontrola | 112–131 s |
| C5: Teczka 8 + Gnat + Sieć + Zgrzewka | 127–150 s |
| C1: like C4 but Teczka Prezesa instead of Teczka 8 | 91–108 s |

- **Why it breaks:**
  - `bossfight.ts` ranks loadouts by budget power, where any evolution counts as 150. It never ranks by single-target damage, so it never meets Gnat + Sieć + Kontrola + Bilet Ulgowy kits.
  - Kontrola's vulnerable mark multiplies every weapon's damage by 1.5. It is set outside the stun diminishing returns (`weapons.ts:539`), so it stays on the boss almost all the time, and no weapon's budget accounts for it.

### Finding 2 (requirement 3): the budget gate fails right now
- **What I ran:** `SIM_WORKER=redteam node scripts/sim/gate.ts --watki=6 --tylko=budget,cs`.
- **Result:** `ŹLE budżet broni: największe odchylenie 88.5% (bilet 1), limit 15%`. The CS gun check passes (5.7%).
- **Per level** (`node scripts/redteam/levels.ts`):
  - Bilet is +89%, +88%, +77% at levels 1–3 and +19%, +18% at levels 7–8.
  - Bilet Sieciowy measures 220 against a target of 150 (+47%).
  - Kawa is −16% and −19% at levels 1–2, and +20%, +24%, +19% at levels 4, 6 and 8.
- `src/content/budget.ts` was last regenerated before commit 4f73839 ("Faster crowds…").
- Bilet Sieciowy did not turn into an easy build, though. The Human with "bilet+gnat+iskra+teczka / nerka+bilet-ulgowy+energetyk+zdrapka" won 2 of 6 at Fabryczna and 0 of 6 at Żakowice.

### Finding 3 (requirement 3, method): ±15% of budget still allows 4× differences against a boss
- `node scripts/redteam/dps.ts` measures single-target DPS on the same dummy bench as the budget (geometric mean of crowd and single target).
- Gnat at level 8, a weapon that never evolves, does 105 single-target. That equals Sieć Trakcyjna (104, an evolution) and is about 3 to 4 times Kontrola (28), Gwizdek (25), Telefon (27), Teczka Prezesa (34) and Parasol Burzowy (37).
- No CS gun beats the default one on single target (the best is +3%). Shotguns are 47–52% weaker, LMGs about 35% weaker.
- Gnat was in 100% of my plan-K wins, but that only reflects the plan. Your f-random run is the real test of the 30% share rule; I did not repeat it.

### Finding 4 (requirement 1): "flee from the nearest bodies" passes 3 minutes in about 9% of runs
- **The bot** (`worker.ts`, kind `ucieczka`) has one rule: steer away from the enemies within 10 or 16 m, weighted by 1/d², and keep in from the fence. It reads no hazards, telegraphs, projectiles or bosses. Cards are random or from a fixed list.
- **Specs:** `exploits.json`, `exploits2.json`, `ex3.json`, all 9 stations.
- **Result:** 53 of 585 runs lasted past 180 s, the longest 269 s; none reached the boss.

| Variant | Runs past 3 min |
|---|---:|
| Plain | 6/72 |
| 16 m radius | 4/72 |
| No hop | 4/72 |
| Slide | 7/72 |
| DPS card list | 9/72 |
| Stun card list | 12/72 |
| 16 m radius + slide | 6/72 |

- The existing exploits peak at 82 s on the gate.
- On Opóźnienie it holds: 1 of 72 runs went past 3 minutes (189 s).
- Whether "run away" counts as skill is your call. It is the simplest reactive rule there is, and `exploits.ts` does not have it.

### Finding 5 (requirement 3, weak): stun weapons hold the waves when Piotrek move
- The official alone gate passes: the longest is 5 s, but Piotrek stand still there.
- With the flee movement (`specs/alone.json`, `ex3.json`), from minute 8:
  - Powerbank alone lasted over 60 s in 4 of 20 runs (85, 63, 93, 64 s).
  - Kontrola alone lasted over 60 s in 2 of 20 runs (69, 94 s).
  - Every other weapon died within 60 s.

### Finding 6 (requirement 4): the same attack lands 3–4 times in a row
- **Cause:** the "never a third time" counter (`boss.ts:382`) is reset at every phase change, and carried-over attacks are separate objects with the same name. Combo follow-ups (`then`) do not count towards it either.
- **Result:** 19 runs of more than 2 identical attacks in 18 of 123 logged fights (15%), longest 4. Examples:
  - Biletomat: "Reszta w drobnych" 4× in a row (27, 32, 36, 40 s, across phase 1→2).
  - Biletomat phase 3: "Odmowa transakcji" 3× (a combo follow-up plus the standalone slam twice).
  - ZKA phase 3: 4 charges in a row ("Przejazd" > "Kurs powrotny" > "Przejazd" > "Kurs powrotny").
- **Static count** (`node scripts/redteam/attacks.ts`): Megafon has only **5 attack kinds**. Its phase 2 has 3 attacks and only 1 new kind, because "Komunikat odwrotny" is the same wave plus an invert effect. By name it reaches 6 attacks and 2 new per phase. Every other boss has at least 6 attacks and 2 new per phase.

### Finding 7 (requirement 4, borderline): long boss stuns with Kontrola
- With Kontrola builds the boss was stunned for 13–34% of the fight.
- The longest unbroken stun was 6.0–8.9 s (`specs/b5.json`, C4 and a stun build).
- During a stun the boss neither attacks nor moves. The diminishing returns cap it, so it is not permanent, but about 9 s frozen is worth a look.

### Things I tried that did not break anything
- **Exploits on Normalnie,** 27–72 runs each, none past 3 minutes:
  - bunny-hop circle (longest 171 s)
  - big circle (96 s)
  - slide circle (95 s)
  - pendulum hop (85 s)
  - drunk walk (121 s)
  - standing still with tank or DPS cards (90 s)
- **Phase gates:** no damage got through the 2.5 s shield in about 123 fights.
- **Easy builds (requirement 5):** not shown.
  - Plan K: Fabryczna 7 of 12 (58%), Widzew 2/6, Żakowice 1/6, Koluszki 0/6.
  - Bilet Sieciowy plan: Fabryczna 2/6, Żakowice 0/6.

### Harness note
- `Game.start` never resets `god`. A worker thread that ran an immortal job (an immortal `bossBench`, `bench`, `dps`, or `alone` before minute 8) runs its next job immortal.
- This made 72 of my Opóźnienie runs falsely survive to 900 s. I reset `god` per job and re-ran them; the numbers above are from after the fix.
- Your scripts look safe because each `runPool` starts fresh workers and none mixes job types, but anything that does will be wrong.

Ignore variant "C7" in `out/b2.json`: a parsing bug in `mk.mjs` (since fixed) dropped its coffee buffs, so it is identical to C4.

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. build Gnat + Sieć + Kontrola zabija 8 z 9 bossów poniżej minimum | limit obrażeń bossa (`Boss.limit`, `1872338`), build trafił do bramki CI |
| 2. bramka budżetu pada (Bilet +89%) | budżet przeliczony po zmianie zasięgów (`ca5de05`) |
| 3. ±15% budżetu pozwala na 4× różnicę w jeden cel | na bossie trzyma to limit obrażeń; ławka zostaje (tłum i cel ważą tyle samo) |
| 4. bot „uciekaj od najbliższych” przeżywa 3 min w 9% | nie zmienione: to bot reagujący na grę (niżej, „Czego nie osiągnąłem”) |
| 5. bronie ogłuszające same z ruchem do 94 s | nie zmienione: marginalne, bramka `alone` (stojąc) przechodzi |
| 6. ten sam atak 3–4 razy z rzędu | licznik po nazwie, przez zmianę fazy i z dobiciami; Megafon ma szósty atak (`1872338`) |
| 7. ogłuszenie bossa do 9 s | jedno ogłuszenie najwyżej 1,5 s, bez nakładania (`1872338`), potem 2 s odporności (`4b9e6b8`) |
| uwaga: nieśmiertelność przecieka między zadaniami workera | `game.god = false` przed każdym startem (`d5f2c5c`) |


### Runda 2 (na `d5f2c5c`)

<details>
<summary>Runda 2: raport bez zmian (po angielsku)</summary>

Red Team round 2 on balans-v2 at d5f2c5c, Normalnie, about 60 minutes of wall time. I changed no balance files and committed nothing. Every run used SIM_WORKER=redteam2 and the bundles .sim/redteam2*.mjs, never more than 6 threads. All raw results are in scripts/redteam/out/r2-*.{log,json} and specs are in scripts/redteam/specs/r2-*.json. Runner: `RT_BUNDLE=redteam2-rt.mjs SIM_WORKER=redteam2 node scripts/redteam/rt.ts <spec> <name> --watki=N`.

Four findings break a requirement: 1 (stun cap leaks), 2 (an easy build at station 1), 3 (no-skill flee bots past 3 min) and 4 (weapons far off budget once passives are added). Findings 5–9 are marginal or Opóźnienie-only. The boss-minimum check (#9) was only broken by a near-impossible all-legendary build.

## 1. Boss stun cap leaks when the boss changes pool slot (req 4, a real code bug)
- **Cause, from reading the code:** in src/game/enemies.ts, `stunDr` (lines 128/250) is missing from `this.floats` (line 283). `copy()` (1124-1138) never moves it and `spawn()` (380) never resets it.
  - `sweep()` swap-removes dead enemies. When the boss is the last entry and something before it dies, the boss moves to a new slot and leaves its stun-immunity state behind.
  - In the new slot it can take a fresh full stun at once. The "1.5 s max, nothing new for 2 s after" rule then fails.
- **What I ran:** scripts/redteam/specs/r2-stun2.json (build C1L, oracle, immortal). I added tracking to scripts/redteam/worker.ts: `slotMoves`, and `earlyStuns` (a stun that starts before the previous stun + 2 s has passed).
- **Results:**

| Station | Boss slot moves | Stuns inside immunity | Longest unbroken stun (game time) |
|---|---:|---:|---:|
| Niciarniana | 5 | 3 | 2.7 s |
| Fabryczna | 3 | 2 | 3.9 s |
| Widzew | 6 | 3 | 2.7 s |

- **Also seen:** the r2-epic run (4 fights) had 1 early stun per fight, and 3 of the 4 hit 2.7 s. The STUN build in r2-stun (2 fights) stayed at the 1.5 s cap.
- **Not a full lock:** stun share stays at 12-18% of the fight.

## 2. Easy build at station 1 (req 5)
Human bot, Fabryczna, Normalnie, plan K = `gwizdek+gnat+iskra+teczka/zdrapka+bilet-ulgowy+energetyk+okulary`, played through scripts/sim/bots.ts.

| Seed days (`--od`) | Wins |
|---|---:|
| 300–305 | 4/6 |
| 306–311 | 4/6 |
| 312–323 | 11/12 |
| **Total** | **19/24 (79%)** |

- **Last stations, same plan, `--od=300`:** Żakowice 1/6 (17%), Koluszki 2/6 (33%). Koluszki is above the 15-20% target, but n=6.
- **For comparison:** plan Z = `iskra+puszka+gwizdek+teczka/bilet-ulgowy+okulary+zdrapka+kanapka` won 6/12 (50%) at Fabryczna.
- **Logs:** scripts/redteam/out/r2-human{,2,3,4}.log. Variants files: specs/r2-human.json and specs/r2-human-k.json (the tweak slot is empty).

## 3. No-skill flee bots outlive 3 minutes (req 1)
Spec scripts/redteam/specs/r2-ex.json, 9 stations × 8 seeds = 72 runs per bot, ran in about 1m47 at 2 threads.

| Bot | Cards | Runs over 180 s | Longest | Median |
|---|---|---:|---:|---:|
| `ucieczka` (existing: flee from nearest bodies, hopping) | gwizdek, telefon, zdrapka, energetyk, termos, bilet-ulgowy, gnat, iskra | 9/72 | 283 s (Koluszki) | 127 s |
| `pustka` (new, in worker.ts: steer to the emptiest of 16 headings 4 m ahead, hop + slide) | same stun cards | 10/72 | 267 s (Żakowice) | 121 s |
| `pustka` r6 | tank cards | 3/72 | 202 s | — |
| `pustka` | random cards | 1/72 | 230 s | — |

- None of these runs won, and all died before the boss.
- gate.ts only tests stoi, kolko, dach, rog, hop, kawa and tory, so it cannot see this family. Whether "flee from bodies" counts as no-skill is your call: it never reads a telegraph or a projectile.

## 4. Power budgets hold bare, but passives push weapons far off them (req 3)
- **What I ran:** new script scripts/redteam/amount.ts. It is the budget.ts bench (top level, crowd and single dummy, geometric mean), each weapon bare and with one passive. Table: scripts/redteam/out/amount.md.
- **Every weapon is about 100 bare, or 150 for evolutions.** Multipliers per passive:

| Passive | Weapons it boosts | Weapons it leaves flat |
|---|---|---|
| Bilet Ulgowy 2 | puszka ×2.07 (single ×1.92), iskra ×1.71, kawa ×1.52, zgrzewka ×1.50, powerbank ×1.44, sieć trakcyjna ×1.41 | gnat ×1.01; teczka, sos, gwizdek, kebab, kontrola, teczka-prezesa ×1.00 |
| Energetyk 5 | kawa ×1.80, espresso ×1.62, parasol-burzowy ×1.60 | gnat ×0.86 and bilet-sieciowy ×0.92 (power goes down) |
| Okulary 5 | sieć trakcyjna ×1.65, iskra ×1.58, teczka ×1.56 | gnat, kebab, kontrola, powerbank ×1.00 |

- In any real run that takes these common passives, several weapons sit 40-107% over the ±15% band. `budget.ts --sprawdz` cannot see this.
- I can't explain the Energetyk drop on gnat (−14%). It makes the game harder, not easier, but is worth a look.

## 5. Only 5 distinct attacks seen in some short fights (req 4, mild)
- I checked the attack logs of 30 bench fights. 2 of 24 showed only 5 distinct attacks, with 1 new one in the last phase: C1cg at Widzew and C1cg at Justynów.
- Cause: the last phase lasts about 37-54 s and attacks are drawn uniformly from 4, so a new attack can fail to show up.
- The data itself passes (scripts/redteam/attacks.ts: every boss has 6-8 attack names and at least 2 new per phase). In all 30 fights the longest same-name run was 2, and no damage got through a phase shield.

## 6. Opóźnienie's extra phase repeats itself (req 4, static only, not run in the sim)
- What I ran: scripts/redteam/lastphase.ts, which copies the logic of `lastPhase()` in src/game/boss.ts.
- The extra phase has no new attacks by construction. It also duplicates names, because `includes` compares objects and phases carry attacks over as new objects:
  - Biletomat: "Reszta w drobnych" 3 of 6 entries (50% pick weight)
  - Pajęczyca: "Czółenka" 3 of 6
  - Król Złomu: "Rzut szyną" 3 of 7
  - Bartek: "Fusy" 3 of 7, "Wyzwiska" 2 of 7
  - Megafon, Kanar, Zka, Gołąb, Kierownik: 1 duplicate each

## 7. Kontrola alone lasts past the minute when moving (req 3, marginal)
- Spec r2-alone.json: each of the 21 weapons maxed and alone, `pustka` + slide movement instead of standing, 2 stations × 2 seeds.
- Kontrola lasted 75.8 s after minute 8 at Fabryczna (1 of 4 runs; limit 60 s). Every other weapon died within 56.5 s.

## 8. Harness bugs in the previous round's tools (fixed in scripts/redteam/worker.ts)
- **Stun share and "longest stun" counted frames, not game time.** Hitstop and menu frames were included, which is how a frame count reached 8.0 s. Now measured in game time.
- **Spec C7 in specs/b2.json carried a coffee buff of `{might: null}`.** mk.mjs got no value and wrote null, so C7 just replayed C4. Its numbers are a duplicate, not a coffee build.
- **rt.ts now takes a `RT_BUNDLE` name**, so parallel rounds don't overwrite each other's bundle.
- **Guess, not measured:** `stunDr` is never reset, and a sim worker reuses one `Enemies` across same-station jobs. That could leave a stale boss-stun state behind and make results depend on job order.

## 9. Boss minimum: only broken by an all-legendary build (req 2)
- **The cap is soft by design:** 10% of damage past the cap still lands. A fight goes under its minimum once the build's raw single-target DPS passes 2.5× the cap's refill rate.
- **Build C1L** (seed tags rtboss/rtstun, oracle, immortal):
  - teczka-prezesa, kontrola, gnat 8 with all 7 level cards legendary, sieć trakcyjna
  - okulary 0.6, zdrapka 0.9, bilet-ulgowy 2, energetyk 0.6
  - latte and czarna coffees, usp_silencer on Gnat
- **C1L kill times:** Niciarniana 119 and 117 s, Widzew 119 and 117 s, against a minimum of 120. Fabryczna 128-130 s, Justynów 140, Żakowice 158, Koluszki 246 all hold.
- **More realistic versions hold:**
  - All-epic cards (r2-epic): 122-124 s at Niciarniana and Widzew.
  - Common cards with both coffees and the gun (r2-boss, C1cg): 123/124/130/148/163/263 s.
  - Evolution build Z: 129-146 s at stations 1-3.
- This is a theoretical break only: seven legendary gnat cards is vanishingly unlikely. But the margin over the 120 s minimum is just 2-4 s for realistic builds.

## Files
All new or changed files are untracked, under C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\:
- worker.ts: `pustka` bot, game-time stun metric, slot-move and early-stun tracking
- rt.ts: `RT_BUNDLE` env var
- amount.ts, lastphase.ts (new)
- specs\r2-*.json and out\r2-*.{log,json}, out\amount.md

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. odporność na ogłuszenie (`stunDr`) gubiona przy przesunięciu bossa w puli | `stunDr` w kopiowanych tablicach i zerowany przy spawnie (`4b9e6b8`) |
| 2. plan K wygrywa 79% na Fabrycznej | Fabryczna trudniejsza (rampa ×0,85, ataki bossa ×1), plan K w pomiarze końcowym (`4b9e6b8`) |
| 3. boty ucieczki przeżywają 3 min | jak w rundzie 1 |
| 4. pasywki wypychają bronie z budżetu | zamierzone synergie, opisane wyżej („Pasywki poza budżetem”) |
| 5. w krótkich walkach widać tylko 5 ataków | worek ataków w każdej fazie (`c715975`) |
| 6. faza dodatkowa Opóźnienia dubluje ataki | porównanie po nazwie, tylko nowe ataki z wcześniejszych faz (`4b9e6b8`) |
| 7. Kontrola sama z ruchem 75,8 s raz na 4 | nie zmienione: marginalne |
| 8. błędy w narzędziach rundy 1 | poprawione przez Red Team |
| 9. build „wszystko legendarne” 117–119 s | zapas limitu 1,15 → 1,2 (`4b9e6b8`), ten build jest w bramce CI (`c715975`) |


### Runda 3 (na `4b9e6b8`)

<details>
<summary>Runda 3: raport bez zmian (po angielsku)</summary>

## Red Team round 3: findings (HEAD 4b9e6b8, Normalnie unless stated)

Nothing tracked was edited and nothing was committed (`git status` shows only the user's own `BALANCE.md` change and the untracked `scripts/redteam/`). All new tools and outputs are under `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\`. Bundles: `.sim/redteam3*.mjs`. Human outputs: `.sim/r3-hum*.json`. Total wall time was about 52 minutes.

**Tool changes in `scripts/redteam/worker.ts`:**
- The boss bench now logs damage going into `Boss.limit` against what lands, which gives the raw/landed ratio.
- It logs how long the health bar shows the limit, which I call "braced" below (bar dimmed).
- It logs how long the boss is marked vulnerable.
- It logs the boss's health at each phase change.
- The bench can now pick the kurs (`boss.kurs`).

**New scripts:** `variety.ts`, `extra.ts`, `telegraphs.ts`, `gates.mjs`, `hum.mjs`.

### 1. Requirement 1 is broken: flee bots outlive 3 minutes
- **What I ran:** `SIM_WORKER=redteam3 RT_BUNDLE=redteam3-rt.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r3-ex.json r3-ex --watki=6`, then the same for `r3-ex2.json`.
- **The bots:** exploit kinds `pustka` and `ucieczka` from `worker.ts`. They steer away from bodies or toward the emptiest ground, hop and slide. They never look at telegraphs, projectiles, hazards or pickups. Cards come from a fixed preference list.
- **Result:** 720 runs (8 variants × 9 stations × 10 seeds, fresh seed tags `r3ex` and `r3ex2`). 72 runs (10%) lived past 180 s, none won, longest 255 s.
  - `pustka-r3-stun`: 19/90 (21%)
  - `pustka-slajd-stun`: 14/90 and 17/90 on the two seed sets
  - `ucieczka-stun`: 9/90
  - `pustka-r6-tank`: 6/90
  - `ucieczka-slajd-tank`: 4/90
  - `pustka-bezskoku-stun`: 3/90
  - `pustka-r8-speed`: 0/90
- **Every station is affected:**

| Station | Runs over 180 s | Longest |
|---|---:|---:|
| Fabryczna | 15/80 | 242 s |
| Bedoń | 15/80 | 230 s |
| Andrzejów | 11/80 | 239 s |
| Widzew | 8/80 | 255 s |
| Justynów | 7/80 | 238 s |
| Gałkówek | 6/80 | 230 s |
| Żakowice | 6/80 | 230 s |
| Koluszki | 3/80 | 211 s |
| Niciarniana | 1/80 | 186 s |

- **The CI gate cannot see this:** its exploit check in `scripts/sim/gate.ts` runs only the 7 bots from `exploits.ts`. Round 2 already showed the same rates, so nothing has changed since.
- **Guess, not measured:** runs that held Telefon or Gnat at death lived past 180 s about 3–4 times as often (21% / 28% vs 6%). That is correlation only, since longer runs collect more weapons. Survivors die at 180–255 s, which fits the kiting rule's fast passengers kicking in only after second 150 + 20 s (not checked).

### 2. Requirement 2 holds on Normalnie, with about 3% margin
- **What I ran:** `rt.ts specs/r3-boss.json r3-boss` and `specs/r3-vuln.json r3-vuln`. Oracle, immortal, coffee buffs might +0.15 and haste +0.12, 2 seeds, Niciarniana / Widzew / Andrzejów.
- **Builds:**
  - **C1L:** Teczka Prezesa, Kontrola, Gnat 8 with all-legendary cards (USP gun), Sieć Trakcyjna; passives Okulary, Zdrapka, Bilet Ulgowy, Energetyk.
  - **C1c:** the same with all-common cards.
  - **GZL / GZc:** Teczka Prezesa, Sieć Trakcyjna, Zgrzewka, Gnat 8 (HKP2000 gun), legendary / common.
- **Kill times (minimum is 120 s at Niciarniana and Widzew, 135 s at Andrzejów):**

| Build | Niciarniana / Widzew | Andrzejów | Raw / landed |
|---|---:|---:|---:|
| C1L | 124–131 s | 146–147 s | 2.0–2.2 |
| C1c | 128–131 s | – | 2.0 |
| GZL | 131–134 s | 152–158 s | 1.8–2.0 |
| GZc | 136–140 s | 156–157 s | 1.7–1.85 |

- The limit binds for 74–93% of every fight (bar braced), and 41–55% of damage is thrown away. All-legendary is only about 5–10% faster than all-common, so build quality barely matters at the boss.
- From the limit formula, going under 120 s needs about 3.4× the limit rate in raw damage. C1L has about 2.5×, so it would need roughly +34% raw boss damage. I could not build that.
- The gate's `scripts/sim/data/strongest.json` is weaker than C1L: unevolved Teczka, all-common cards, no CS gun, no coffee.

### 3. Bug: Kontrola keeps the boss vulnerable through its stun immunity
- `src/game/weapons.ts:539` sets `vulnerable = max(vulnerable, stun)` with the full requested stun time. It does this even when `Enemies.stunFor` refuses or shortens the stun on the boss.
- **Measured** (`node scripts/redteam/gates.mjs scripts/redteam/out/r3-vuln.json`): the boss takes ×1.5 damage (`TUNING.combat.vulnerable`) for 97–99% of the fight, but is stunned only 15–16%. On Spokojny the figures are 95–97% against 16–17%.
- The item text promises the extra damage only on stunned enemies.
- This is why Kontrola builds are the fastest boss killers: C1c takes 128–131 s against 136–140 s for GZc with the same Gnat. It uses up most of the limit's margin.

### 4. Every fight is guaranteed to enrage, including the best possible play
- `TUNING.boss.enrageAt` is 120, which is at or below every minimum (120 / 135 / 150 / 210 s), and the damage limit forbids finishing earlier.
- **Measured in the bench logs:** 18 of 18 fights enraged, for 4–38 s each. Attacks went from 0.17–0.23 per second before 120 s to 0.25–0.44 per second after.
- **Bartek (from the code):** `bossPressure` runs the enrage before its coffee check, so with a 210 s minimum he is always enraged for at least 90 s.
- "A fight that drags on gets worse" now hits every fight.

### 5. Requirement 4: variety holds in the data but not always in play
- **The data passes:** `node scripts/redteam/variety.ts` shows 6–8 distinct attacks per boss and at least 2 new ones per phase. No attack ran 3 times in a row in any of 22 measured fights (longest run is 2).
- **What players actually see:** attacks are picked uniformly at random, with no guarantee the new ones appear. In 3 of 22 measured fights only 5 distinct attacks showed up, and 4 of 66 phases showed only one new attack (C1L at Niciarniana and Widzew in phase 3, GZL at Widzew in phase 2).
- **Opóźnienie's extra phase adds no new attacks** (from the code, `node scripts/redteam/extra.ts`): `boss.ts` `lastPhase` is the last phase plus 1–3 earlier attacks. It brings 0 never-seen attacks for every boss. Pajęczyca, Król Złomu, ZKA and Gołąb Matka get only 1 extra attack.

### 6. The damage limit is soft, and on Spokojny it does not hold
- **What I ran:** `rt.ts specs/r3-spok.json r3-spok`, the C1c build, Spokojny, one seed per station.
- **Result:** Niciarniana boss killed in 47 s (minimum 120), Żakowice in 68 s (minimum 150), raw/landed 6.5–6.9. The 10% overflow lets kill time keep falling as raw damage rises.
- The minimums are defined for Normalnie, so this may be intended. But the changelog line "żaden build nie skróci walki poniżej jej minimum" is false on Spokojny.

### 7. Minor bug: a phase gate fires on damage the limit then cuts
- `Boss.absorb` sets `gate = true` from the raw hit. `Game.hitEnemy` then applies `boss.limit`, which can cut what lands to 10%, yet `advancePhase` still changes phase.
- **Measured:** on Spokojny, phases began 0.99–1.12 points of health above their thresholds (for example at 63.03% when the threshold was 62%); that health is skipped. On Normalnie the skip was 0.00 points in 8 gates. Low impact today.

### 8. Requirement 5: not broken by what I measured
- **Human A** (the user's plan "telefon+iskra+gnat+rozklad/kanapka+termos+bilet-ulgowy+zdrapka", `--od=300` and `--od=400`): 4 wins in 18 runs at the last stations (22%).
  - Gałkówek 2/4, then 0/3
  - Żakowice 0/4
  - Koluszki 2/4, then 0/3
- **Human B** (`--od=300`): 2/4 at Fabryczna (50%).
- **My GZ build plan:** 0/6 at Żakowice and Koluszki.
- Example command: `SIM_WORKER=redteam3a node scripts/sim/bots.ts --warianty=scripts/redteam/specs/r3-vA.json --runs=4 --stacje=galkowek,zakowice,koluszki --od=300 --watki=3 --plik=r3-humA`.
- **Harness caveat:** plans A and B name 4 weapons besides Teczka, which can never all be held, because Teczka takes a slot. The planner also rates an owned weapon's evolution passive above the plan's passives. So A's wins were really Teczka Prezesa + Powerbank (Energetyk is not in the plan) + Sieć Trakcyjna + something, and B's two wins were two different builds. Per-variant results and weapon shares describe what the bot happened to finish, not the named plan.

### Checked with no problem found
- Boss stun-lock: the longest single stun is 1.5 s, stun share 15–17%, and no stun lands inside the immunity window even when the boss changes slot (1–6 moves per fight).
- Phase shields: 0 hits leaked through.
- Every hit on a boss goes through `hitEnemy`, so nothing bypasses the limit. The pool sweep runs after the weapons, so the boss index is never stale.
- Knife and gloves are cosmetic only.
- Coffee buffs only repeat once all 8 have been taken.
- Boss telegraphs are at least 0.34 s on Opóźnienie. Slams and zones are lengthened to the time needed to run out of them, but that time is computed from full running speed (`warn()` in `boss.ts`); I did not check it under the slow or invert effects.
- The QTE in the finale cannot be failed, so counting the knockout as a win is correct.
- I did not re-run "alone" or the budget check: round 2 showed every lone weapon dying by about 537 s, and the CI gate covers the budgets.

Tool note: `scripts/redteam/dps.ts` still writes the shared bundle name `redteam-rt.mjs` (it ignores `RT_BUNDLE`).

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. boty ucieczki przeżywają 3 min | jak w rundzie 1 |
| 2. minimum trzyma z zapasem ~3% | bez zmian; najszybszy build rundy (C1L) w bramce CI (`c715975`) |
| 3. Kontrola trzyma bossa podatnym 97% walki | znacznik trwa tyle, ile ogłuszenie naprawdę trwało (`c715975`) |
| 4. każda walka wchodzi we wściekłość (120 s) | nie zmienione, zamierzone: każda walka ma ostrzejszą końcówkę, a Ostatni pociąg rozlicza dopiero walki przeciągnięte |
| 5. nowe ataki fazy nie zawsze się pokazują | worek ataków (`c715975`); faza dodatkowa Opóźnienia z założenia nie ma nowych ataków (specyfikacja tego nie wymaga) |
| 6. na Spokojnym limit nie trzyma minimum | wtedy: minimum obowiązuje od Normalnie wzwyż. Od `d1e7fb8` limit jest twardy na każdym kursie, więc także na Spokojnym walka trwa co najmniej 1,2 × minimum |
| 7. bramka fazy otwiera się od obrażeń, które limit potem obciął | limit przed bramką (`c715975`) |
| 8. plany z czterema broniami obok Teczki | opisane w „Jak mierzymy” (Teczka zajmuje slot, plan to preferencje) |


### Runda 4 (na `c715975`)

<details>
<summary>Runda 4: raport bez zmian (po angielsku)</summary>

## Red Team round 4 (balans-v2 @ c715975, Normalnie): nothing I measured breaks a requirement

**Setup.** I changed no balance file and committed nothing. `git status` shows only the user's `BALANCE.md` change and the untracked `scripts/redteam/`. Every run used `SIM_WORKER=redteam4*` and `RT_BUNDLE=redteam4-*.mjs`, at most 6 threads. Wall time was about 57 minutes.

The machine was also running two 15-thread measurements (`h-human`, `h-human-opo`), so my runs were very slow. I stopped my own Human plan-A batch after 17 minutes with 0 of 6 runs finished, so I have **no new Human win rates** this round.

**New or changed tools:**
- `scripts/redteam/worker.ts`: 5 new no-reaction exploit kinds: `osemka` (figure eight with hops and slides), `hopslajd` (lap with hops and slides), `spirala` (a lap whose radius grows and shrinks), `zygzak` (zigzag line with hops and slides), and `wieza` (go for the highest surface anywhere, jumping).
- `scripts/redteam/r4.mjs`: per boss fight it prints phase lengths, distinct and new attacks seen per phase, the longest same-attack run, and stun and vulnerable share.
- Specs: `scripts/redteam/specs/r4-boss.json` and `r4-ex.json`. Outputs: `scripts/redteam/out/r4-boss.{json,log}` and `r4-ex.{json,log}`.

### 1. Req. 1 (exploits): holds for every new strategy
- **What I ran:** `SIM_WORKER=redteam4 RT_BUNDLE=redteam4-ex.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r4-ex.json r4-ex --watki=3`. That is 6 variants × 9 stations × 4 seeds = 216 runs, cap 400 s game time.
- **Result:** 0 of 216 runs lived past 180 s.

| Variant | Longest run | Median per station |
|---|---:|---:|
| `hopslajd` (random cards) | 161 s (Justynów) | 80–130 s |
| `hopslajd` with tank cards | 136 s | 80–117 s |
| `osemka` | 107 s | 13–88 s |
| `spirala` | 134 s | 31–83 s |
| `zygzak` | 120 s | 13–72 s |
| `wieza` (stuck at walls) | 42 s | 9–28 s |

### 2. Req. 2 (boss minimum): holds, now with about 10% margin (was about 3%)
- **What I ran:** `SIM_WORKER=redteam4 RT_BUNDLE=redteam4-rt.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r4-boss.json r4-boss --watki=3`. Oracle, immortal (a lower bound on kill time), 2 seeds each.
- **C1L3c** is round 3's fastest build plus Flat white:
  - Weapons: Teczka Prezesa, Kontrola, Sieć Trakcyjna, Gnat 8 with all-legendary (×1.5) cards and the USP gun.
  - Passives: Okulary, Zdrapka, Bilet Ulgowy, Energetyk.
  - Coffees: might +0.15, haste +0.12, area +0.1. Each station has only 3 coffee machines, so 3 coffees is the most a run can drink.
- **SB3c** swaps Kontrola for Bilet Sieciowy and Zdrapka for Nerka, with the same coffees and gun.

| Build | Station | Kill times | Minimum |
|---|---|---:|---:|
| C1L3c | Widzew (the boss with the least health per minimum second) | 131.7 / 133.9 s | 120 s |
| C1L3c | Koluszki (not benched since the limit landed) | 255.4 / 263.5 s | 210 s |
| SB3c | Widzew | 134.3 / 137.7 s | 120 s |

- The `c715975` Kontrola fix shows up clearly: the boss is vulnerable 15–16% of the fight (round 3 measured 97–99%). C1L went from 124–129 s (round 3, with only might and haste) to 132–134 s even with a third coffee.

### 3. Req. 4 (variety, repeats, stun-lock, gates): holds in play with the new attack bag
- **What I ran:** `node scripts/redteam/r4.mjs scripts/redteam/out/r4-boss.json` (6 fights) and `node scripts/redteam/variety.ts` (static data check).
- **Every phase of every fight showed all its attacks.** Phase 2 now shows 4 distinct attacks; round 3 often showed 3.
- Fights saw 6 distinct attacks at Widzew and 8 at Koluszki, with 2 new per phase every time.
- The longest run of the same attack was 2. The longest boss stun was 1.5 s, with stun share 15–16%. No damage leaked through a phase shield.
- The static data has 6–8 attacks per boss, at least 2 new per phase, and no self-combos.
- **Mild observation:** phase 1 of every boss has only 2 attacks. With the bag, a 46–79 s phase 1 is an alternation of 2 attacks: 7 attacks in 46 s at Widzew, 17 in 78 s at Koluszki. This is within the spec.

### 4. Harness gap (req. 6): the CI boss gate cannot test the strongest real build
- In `scripts/sim/types.ts:36`, `bossBench` takes only weapons, passives and levels. There is no coffee buff or CS gun, and `scripts/sim/worker.ts:273` leaves the default gun.
- So `scripts/sim/data/strongest.json` in `gate.ts` checks C1L without coffee might and haste and without the USP. It is a weaker build than one a player can assemble.
- Today this does no harm: the full build holds at 132 s (finding 2). But the gate would not catch a future change that lets the boosted build under the minimum. The gap is in the code; I did not measure what the weaker gate build scores.

### 5. Bug in the red-team tools: the raw/landed counters in `scripts/redteam/worker.ts` are inflated about 100×
- **Measured** in `out/r4-boss.json`: about 3.3 M "landed" at Widzew, whose boss has 32 550 HP. Koluszki shows 6.5 M against 60 750 HP. Round 3's numbers are the same.
- **Likely cause (from reading the code, not measured):** `wrapLimit` sets the counter on the boss object itself. The Oracle's rollouts restore a snapshot into the same game object, so every rollout hit is counted too.
- Kill times are unaffected. But the "raw/landed ratio" and the "needs about +34% raw damage" estimate in round 3's report rest on these counters.

### Not measured (guesses only)
- **Escape time under effects:** `boss.ts` `warn()` sizes slam and zone warnings for full running speed. It ignores the 0.55 slow from Pajęczyna zones and the barriers from Objazd and Teren budowy zones. Kierownik's "Teren budowy" (blocking zones) then "Wbijanie pala" (a 6.5 m slam on Piotrek) might be unescapable while hemmed in by barriers. I did not test it.
- **Requirement 5:** no new Human data. The last measurements are round 3's: plan A 4/18 at the last stations, and plan K 19/24 at Fabryczna in round 2. Plan K has not been re-measured by a Red Team since Fabryczna was made harder.
- **Requirement 3:** I did not re-run `budget.ts`, `alone.ts` or the weapon share in Human wins.

</details>

Pierwsza czysta runda: nic nie łamie wymagań. Uwagi:

| uwaga | co zrobiłem |
|---|---|
| bramka bossa w CI nie umie dać kaw i broni CS | ławka bossa dostała kawy i broń CS, w bramce jest pełny build C1L z trzema kawami i USP (`af2c470`) |
| liczniki limitu w narzędziach Red Teamu liczą też rollouty | błąd narzędzia, czasy zabicia są dobre; raport rundy 3 o „+34% obrażeń” stoi na tych licznikach |
| ostrzeżenia ataków liczone dla pełnej prędkości (spowolnienie, bariery) | sprawdzane w rundzie 5 |

### Runda 5 (na `af2c470`)

<details>
<summary>Runda 5: raport bez zmian (po angielsku)</summary>

## Red Team round 5 on balans-v2 (HEAD af2c470)

None of requirements 1–5 broke in what I measured. I found three problems that make fights unfair or easier than intended, and one tool bug that makes a round-4 exploit result invalid. No balance file was touched and nothing was committed. Runs used at most 3 threads, `SIM_WORKER=redteam5`, and bundle `.sim/redteam5-rt.mjs`. The work took about 37 minutes of wall time.

### Findings that break something

**F1. Kanar's "Legitymowanie" never stuns (req 6: easier than intended). Found by reading the code, not benched.**
- `src/content/bosses.ts:269` gives the Widzew phase-3 wave `effect: 'stun'`.
- `src/game/hazards.ts:296` applies only `'invert'` from waves. Stun is applied only to marks, at `hazards.ts:276`.
- So the attack is plain damage, even though its own data and shout say it stuns.

**F2. A barrier pocket can trap Piotrek under a slam (req 6: unescapable hit). Measured with `scripts/redteam/escape.mjs`, which places zones exactly as `Boss.telegraph` and `warn()` do.**
- The combo is Kierownik (Gałkówek) phase 3: 5 "Teren budowy" block zones (r 7) land, and then "Wbijanie pala" (r 6.5, warning 1.127 s) is centred on Piotrek.
- Run: `ONLY3=1 node scripts/redteam/escape.mjs 2000` (1000 casts). Share of casts where the slam cannot be escaped:

| What Piotrek does during the zones' warning | Unescapable |
|---|---:|
| Stands still | 0.2% |
| Runs out of their zone by the shortest way | 1.1% |
| Picks the best of ~25 reachable spots | 0.1% |

- An earlier run of 120 different casts gave 2.5%, 1.7% and 0.8%.
- One dumped case checked by hand: three barriers overlap pairwise (centre distances 14.19, 9.23 and 14.61 m, all under 2 × 7.38 m). They enclose Piotrek in a pocket about 1 m across, inside the 6.88 m slam. Barriers ignore jumps (height tolerance 3 m), so there is no way out.
- Cost on Normalnie: 32 × 0.45 = 14.4 per slam.
- In 2.3% of casts, pushing out of overlapping barriers did not settle after 2000 steps. I counted those as escapes. What the game does there is a guess.
- Gałkówek phases 1–2 and Bedoń phase 3 (barriers, then the next slam, no movement in between): 0 of 120 unescapable.

**F3. A slowed Piotrek cannot escape (req 6, conditional). Same script, 240 casts each.**
- Every multi-zone attack, overlapping unions included, can always be escaped at full speed (0% unescapable). `warn()` holds for a Piotrek who is not slowed.
- If Piotrek is standing in an active slow zone (×0.55) when new zones land on them, they cannot get out of the casts that catch them:

| Attack | Unescapable when caught |
|---|---:|
| Pajęczyca phase 1 | 19.5% |
| Pajęczyca phase 2 | 30.5% |
| Pajęczyca phase 3 | 45.4% |
| Gołąb-matka phase 3 "Prosto z góry" | 37.8% |

- Gołąb-matka phase 3 "Lądowanie" (r 6, warning 1.046 s): walking out fails if Piotrek is more than 1.41 m deep in a slow zone (out of 4.88 m). With an ideal slide, it fails beyond 3.26 m.
- From reading `boss.ts start()`: old webs last 6 s, while back-to-back webs at a bag boundary come 4.2 s apart (2.9 s enraged). So this situation can happen.

**F4. Round 4's "hopslajd" never lapped (tool bug that invalidates its req 1 numbers).**
- `circle()` in `scripts/redteam/worker.ts` gives a zero steering vector at (0,0), where Piotrek start. The ground slam knocks every enemy back, so nothing ever pushes Piotrek off the centre.
- I added a per-run `maxR` to `worker.ts`. Measured `maxR` = 0.0 m, and radius 0.3, 0.55 and 0.95 gave the identical run (death at 94.7 s).
- So "hopslajd" really measured "hop and ground slam in place". The CI `kolko` bot (`src/game/bots/exploits.ts:62`) has the same zero vector at the start, but it gets knocked off within seconds (standing still reached 0.9 m), so it probably just starts its lap late (guess).

### Requirements that held

**Req 1 (exploits).** No exploit survived past 3 minutes. Specs are `scripts/redteam/specs/r5-ex*.json`, 36 runs each unless noted:

| Bot | Median | Max |
|---|---:|---:|
| Standing still (1 run) | 14 s | 14 s |
| Slam in place, tank cards | 103 s | 146 s |
| Slam in place, DPS cards | 106 s | 168 s |
| Real lap with slams (new bot `slamlap`, tank / DPS cards) | 26 s / 23 s | 169 s / 117 s |
| Slam while drifting to dodge the camping rule (new bot `slamdrift`, 27 runs) | 51–77 s | 141 s |

**Req 3 (no weapon alone).** I ran each of the 21 weapons alone from minute 8 with the slam-in-place movement, at Fabryczna, Gałkówek and Koluszki (`specs/r5-alone.json`). Every one died 1–22 s after minute 8; the limit is 60 s.
- I did not run `budget.ts --sprawdz`, because it writes `.sim/budget.json`.
- `h-random.json` did not appear while I worked, so I could not test the 30% rule. In `h-human.json` the shares (iskra 88% of wins, teczka 100%) are an artefact: every plan contains iskra and teczka is the starting weapon.

**Req 2 (boss minimums).** The fresh `.sim/h-human.json` (written 22:41:40, current code) has 40 boss kills and none under the minimum; the fastest was 1.20× its minimum. I ran no new boss benches. Using the limit model (rate plus 10% of the excess), the best round-4 build (132 s against a 120 s minimum at Widzew) would need about 55% more raw single-target damage to break it. That is computed and approximate. Attack speed is already at its cap and coffees cannot repeat, so I found no source for that extra damage.
- For information only (Spokojny is exempt): the casual bot on Spokojny killed 11 of 29 bosses under the minimum, the fastest Widzew in 87 s.

**Req 4 (boss variety).** `node scripts/redteam/variety.ts`: every boss has at least 6 distinct attacks and at least 2 new ones per phase. The bag and the repeat rule in `boss.ts` allow at most 2 of the same attack in a row (read from code). F1 is the only flaw.

**Req 5 (easy builds), from the fresh `h-human.json`, Human wins pooled over variants A/B/C/K (20 runs per station, Wilson 95% interval):**

| Station | Wins | Rate [95% interval] |
|---|---:|---|
| Fabryczna | 5/20 | 25% [11–47] |
| Niciarniana | 14/20 | 70% [48–85] |
| Widzew | 4/20 | 20% [8–42] |
| Andrzejów | 3/20 | 15% [5–36] |
| Bedoń | 0/20 | 0% |
| Justynów | 13/20 | 65% [43–82] (variant A won 5/5) |
| Gałkówek | 0/20 | 0% |
| Żakowice | 0/20 | 0% |
| Koluszki | 1/20 | 5% [1–24] |

- Not broken against the stated limits: station 1 is far from >50%, and the last stations are at or under 5%.
- The 2nd and 6th stops are much easier than the 1st, which goes against the route ramp's intent. Gałkówek, Żakowice and Bedoń at 0/20 are below the 15–20% band, i.e. too hard.
- Caveat: `h-human-opo.json` was deleted while I was working; I had read it at 22:10 and it showed 1/36 wins.

### Files
Everything is untracked and nothing was committed. `sed -i` may have changed the line endings of `worker.ts`.
- `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\escape.mjs` (geometry check)
- `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\r5-runs.mjs` (recomputes win rates, kill times and weapon shares from raw runs)
- `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\worker.ts` (added `maxR`/`meanR`, the `slamlap` and `slamdrift` bots, and the `mag` option)
- Specs `scripts\redteam\specs\r5-*.json`; outputs `scripts\redteam\out\r5-escape.md`, `r5-escape-p3.md`, `r5-ex*.json/log`, `r5-alone.*`, `r5-probe*.json`

</details>

| znalezisko | co zrobiłem |
|---|---|
| F1. „Legitymowanie” Kanara Prime nie ogłusza | fale z efektem `stun` ogłuszają (`24c7698`) |
| F2. bariery Kierownika zamykają w kieszeni pod uderzeniem (0,1–1,1% rzutów) | bariery jednego ataku trzymają 2,5 m odstępu, więc nie tworzą zamkniętej kieszeni (`24c7698`) |
| F3. spowolniony Piotrek nie ucieknie przed uderzeniem i strefą | ostrzeżenie liczone z bieżącej prędkości, w pajęczynie i kawie dłuższe (`24c7698`) |
| F4. bot `hopslajd` z rundy 4 nigdy nie zrobił okrążenia | błąd narzędzia Red Teamu; wynik rundy 4 dla niego to „skok i uderzenie w miejscu”, nowe boty `slamlap`/`slamdrift` z okrążeniem też giną przed 3. minutą |
| wymagania 1–5 | trzymają; Human 0% na Bedoniu, Gałkówku i Żakowicach (za trudno), 70% na Niciarnianej: dalsze strojenie stacji (`8675228`) |

### Runda 6 (na `8675228`)

Przerwana bez raportu: sesja, w której działała, skończyła się w trakcie. Jej pliki (`scripts/redteam/out/r6-*`) są w
repo; runda 7 je przejrzała (wall-wedge exploit był już w nich widoczny).

### Runda 7 (na `ef7359e`)

<details>
<summary>Runda 7: raport bez zmian (po angielsku)</summary>

## Red Team round 7: PIOTROBONK at ef7359e (balans-v2)

I ran this in `C:\Users\jakub\Nowy folder\piotrobonk` at ef7359e, because the round 1-6 tools are untracked there. The pb-sim worktree is on another branch (sim/m) and does not have them. Every run used `SIM_WORKER=redteam6` and an `RT_BUNDLE` of `redteam6-boss.mjs` or `redteam6-ex.mjs`, with at most 10 threads in total. I changed no balance files and committed nothing. A partial round 6 at 8675228 had already left files named `r6-*` in `scripts/redteam/out`, so my outputs are named `r7-*`.

One requirement broke: requirement 1, exploits. I measured no break of requirements 2, 3 or 4.

### Finding 1 (requirement 1 broken): bots that do not react still survive past 3 minutes, mostly while wedged on a wall
- **Commands:**
  - `node scripts/redteam/r7-specs.mjs`, then `node scripts/redteam/rt.ts scripts/redteam/specs/r7-ex.json r7-ex --watki=5`. That is 756 runs: 7 bots × 9 stations × 12 seeds, cap 400 s, Normalnie.
  - `rt.ts specs/r7-ex2.json r7-ex2 --watki=5`. That is 792 runs: 60 more seeds for slamlap and slamdrift, plus a new bot called `sciana`.
  - `sciana` is a new exploit kind in `scripts/redteam/worker.ts`. It keeps one heading for the whole run (taken from the seed) and pushes into whatever wall or fence it meets, hopping and sliding whenever it can.
- **Runs over 180 s:** 10 of 1548. All died; none won.

| Bot | Station | Runs over 180 s | Longest | Moved in 10 s (min) | Metres walked |
|---|---|---:|---:|---:|---:|
| slamlap | fabryczna | 1/12 | 220.2 s | 0 | 305 |
| slamlap | niciarniana | 1/60 | 223.7 s | 32.3 m (kept lapping) | 1898 |
| slamlap | galkowek | 1/60 | 202.4 s | 0 | 137 |
| slamdrift-m40-T | koluszki | 1/12 and 1/60 | 187.7 s and 195.5 s | 0 | 166 and 83 |
| slamdrift-m40-K | koluszki | 1/12 | 187.7 s | 0 | 166 |
| sciana | niciarniana | 2/24 | 190.2 s and 188.8 s | 0 | 165 and 73 |
| sciana | justynow | 1/24 | 185.8 s | 0 | 62 |
| sciana-T | koluszki | 1/24 | 182.3 s | 0 | 46 |

- **Why it matters:** nine of the ten stood still for 10 s or more (`minSpan10 = 0`) and walked only 46-305 m in 180+ s, at character level 6-26. A wedged Piotrek who spams jump and slide gets past the camping punishment for over 3 minutes. The requirement allows no exploit run past 3 minutes.
- **Not new:** round 6 at 8675228 already had slamlap galkowek at 218 s and niciarniana at 184 s (`out/r6-ex4.log`, `out/r6-trace.log`), so it was not fixed.
- **Not caught by CI:** the CI gate's own exploit bots never hit this; in round 6 their longest run was 89 s (`out/r6-gate-ex.log`).
- **Details:** `scripts/redteam/out/r7-ex.json` and `r7-ex2.json` have the job ids and end positions. Examples are slamlap fabryczna job 1 (ends at 12.1, 0.1, 2) and sciana niciarniana job 387.

### Finding 2 (requirement 6, easier than intended): one barrier that cannot be placed wipes out the rest of that cast
- **The bug:** in `src/game/boss.ts` (the `zone` case of `fire`), a barrier with no room is stored as `zoneX[k] = NaN`. Every later barrier in the same cast runs `free = Math.hypot(x - zoneX[j], z - zoneZ[j]) >= apart`. Against NaN that is always false, so all later barriers are dropped as well.
- **What I computed:** `node scripts/redteam/r7-zones.mjs 20000` replays the shipped placement against the intended one (skip only the missing barrier), with the same random draws.

| Cast | Barriers placed (shipped) | Intended | Casts that lose at least one barrier |
|---|---:|---:|---:|
| Gałkówek P3 Teren budowy | 3.03 | 3.61 | 42.6% |
| Gałkówek P2 Teren budowy | 4.57 | 4.68 | 9.7% |
| Gałkówek P1 Teren budowy | 3.92 | 3.93 | 1.3% |
| Bedoń P3 Objazd | 2.91 | 2.92 | 0.8% |

- **Side effect:** round 6's `r6-escape.mjs` keeps only the barriers that were placed, so its "zones placed" column overstates what the game does.
- **Status:** this comes from a geometry model, not a sim run.

### Finding 3 (requirement 6 risk, worked out from the code, not simulated): Legitymowanie's new stun can leave no time to dodge the next charge
- **The timing at Widzew P3:**
  - The wave fires at telegraph × kurs telegraph and reaches Piotrek d/12 s later.
  - The stun lasts 0.9 s (`STUN_TIME` in game.ts).
  - The next wind-up starts (2.6 + 0.8) × pace after the wave's wind-up began.
  - `Boss.warn` takes slow zones into account but not stun, and charges are not covered by the escape rule.
- **Normalnie:** most fights pass `enrageAt` 120 s, and enraged pace is 0.7. Piotrek is still stunned when the next wind-up starts if they are more than 10.6 m away. At 15 m only 0.33 s of the charge's 0.7 s telegraph is left, while getting out of a 5 m lane from its centre takes about 0.4 s.
- **Opóźnienie, enraged:** pace is 0.8 × 0.7. At the bots' 10 m, Piotrek is stunned 0.34 s into the next wind-up, which leaves 0.26 s of the 0.6 s charge telegraph. That is not enough to leave the lane.
- **How to dodge it:** jumping over the wave avoids it, because waves do not hit Piotrek in the air.

### Finding 4 (information for requirement 3): the PLAY factor sits on top of the ±15% tolerance
- **Commands:** `node scripts/sim/budget.ts --sprawdz --watki=4` passed (`out/r7-budget.log`). It rewrote `.sim/budget.json`, which you allowed.
- **Against the reference curve without PLAY:** espresso 173, parasol-burzowy 173 and kebab 172 against 150 (+15.3%, +15.3%, +14.7%); kawa, sos and parasol L8 at 115 against 100.
- **What that means:** the check now accepts these weapons at up to 1.15 × 1.15 = 1.32 times the reference curve. Two evolutions are already just over +15% of the base curve. Whether that counts as a break depends on whether "power budget" means the curve with PLAY or without it.
- **Not re-run:** `node scripts/sim/alone.ts --watki=4` passed (every weapon alone dies within a minute; `out/r7-alone.log`). I did not re-run the alone test with movement for the re-budgeted weapons because of time.

### Requirement 2 (boss minimums): no break, but Widzew is within 1.6-3 s of its minimum
All runs below use the oracle in god mode, with three coffees (might, haste, area or luck) and the USP on Gnat. Kill times are in seconds.

| Build | Fabryczna (120) | Widzew (120) | Bedoń (135) | Gałkówek (150) | Żakowice (150) | Koluszki (210) |
|---|---:|---:|---:|---:|---:|---:|
| C1L3c (round 4) | 135 | 133 | 150 | 176 | 175 | 242 |
| ZK: zgrzewka, kontrola, gnat L8 with legendary cards, siec; legendary passives | 132-137 (5 seeds) | 126-129 (6 seeds) | 146 | 170 | 156-168 (6 seeds) | 236 |
| ZE: zgrzewka, espresso, gnat, siec | 130 | 127 | 144 | – | – | – |
| ZKE: zgrzewka, kontrola, espresso, siec | 149 | 142 | 166 | – | – | – |
| ZK, forced to stay within 6 or 8 m of the boss | 126 | 123.3 | – | – | 151.3 | – |
| ZE, forced to stay within 6 or 8 m of the boss | – | 121.6 | – | – | – | – |

- **Logs:** `out/r7-boss.log`, `r7-boss2.log` and `r7-close.log`.
- **The close-in option:** I added a `close` option to `worker.ts` that wraps the planner and keeps it within that distance of the boss.
- **Why no build gets under:** the damage limit binds for about 115 of 122 s. Kontrola's ×1.5 vulnerability is up only 11-16% of the time, because it is held to the boss's stun immunity (it matches the stun share), not limited by distance.
- **Bottom line:** the floor holds, but the best measured build is 1.6 s above it at Widzew.

### Requirement 4 (fight variety): holds in these benches
- Across 47 fights: 6-8 different attacks per boss, at least 2 new per phase that appear, never more than 2 of the same attack in a row.
- The longest boss stun was 1.5 s, and there were no shield leaks.
- Phase gates are exact; for example Widzew changes phase at exactly 0.65 and 0.30 health.

### Harness notes
- **Latent bug:** in `scripts/redteam/worker.ts`, a `dps` job calls the sim worker's `dps()`, which switches off `game.spawn`, `campStep` and `kiteStep`. The redteam message handler never deletes those overrides (scripts/sim/worker.ts does since 55aee6a). A pool that mixed dps and run jobs would play the later benches with no waves. None of my runs or earlier rounds mixed them, so no published number is affected.
- **Known bug still there:** the raw/landed counters still include planner rollout hits. I used kill times only.

### Not done
- Human win rates for requirement 5: I found no concrete easy-build suspicion.
- The alone test with movement.
- A Spokojny or Opóźnienie boss bench.

### Files (all under `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\`)
- **New scripts:** `r7-specs.mjs`, `r7-zones.mjs`
- **Changed:** `worker.ts` (new `sciana` exploit kind, new `boss.close` option)
- **Specs:** `specs\r7-boss.json`, `r7-boss2.json`, `r7-close.json`, `r7-ex.json`, `r7-ex2.json`
- **Outputs:** `out\r7-*.json`, `out\r7-*.log` (boss, boss2, close, ex, ex2, budget, alone)

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. exploity wciśnięte w ścianę ze skokami i ślizgami przeżywają ponad 3 min (10 z 1548 runów) | fale kempingu rosną: każda ma pierścień i 1–4 stada, o jedno więcej co drugą falę, dopóki Piotrek nie odejdzie (`5706673`) |
| 2. bariera bez miejsca kasuje wszystkie następne bariery tego ataku | poprawione: nieudana bariera nie zapisuje się w liście (`5706673`) |
| 3. ogłuszenie z Legitymowania, a zaraz po nim szarża bez czasu na unik | ostrzeżenie każdego ataku dostaje resztę ogłuszenia Piotrka (`5706673`) |
| 4. mnożnik gry leży na ±15% tolerancji | zgodnie z założeniem: budżet broni to krzywa × klasa (użytkowa ×0,8) × mnożnik gry, a tolerancja ±15% liczy się od budżetu; opisane w „Bronie” |
| minimum bossów | trzyma; najbliżej Widzew: 121,6 s przy minimum 120 s (build ZE trzymany 6–8 m od bossa) |

### Runda 8 (na `5706673`)

<details>
<summary>Runda 8: raport bez zmian (po angielsku)</summary>

## Red Team round 8 (HEAD 5706673): what broke

I changed no balance file and committed nothing. All runs used `SIM_WORKER=redteam8` and `RT_BUNDLE=redteam8-*.mjs`, at most 12 threads. Exploit and boss jobs ran in separate pools from the dps jobs, so the worker.ts reset bug could not affect them. Requirements 1 and 2 break.

### Finding 1: requirement 2, boss minimums. Widzew, Żakowice and Koluszki die too fast, and Niciarniana once
- **Build ("ZE"):** Zgrzewka, Espresso, Gnat 8 (every card legendary), Sieć Trakcyjna; Kanapka, Termos, Bilet Ulgowy, Energetyk (legendary totals); coffees might, haste, area.
- **The gun is the lever.** With an **AUG** (or SG 553) skin on Gnat instead of round 7's USP, played by the immortal oracle with `close: 6`.
- **Commands:**
  - `node scripts/redteam/r8-boss.mjs`, then `SIM_WORKER=redteam8 RT_BUNDLE=redteam8-boss.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r8-boss.json r8-boss --watki=6`
  - The same with `r8-boss.mjs r8-boss2` and `specs/r8-boss2.json r8-boss2`.
  - Results are in `scripts/redteam/out/r8-boss.json` and `r8-boss2.json`.

| Station | Minimum | Measured kill times |
|---|---:|---|
| Widzew, ZE-aug | 120 s | 118.1, 118.4, 118.6, 119.3, 121.1 (4 of 5 under) |
| Widzew, other builds | 120 s | SG 553 118.1; AUG with `close: 4` 118.9; ZK (Kontrola instead of Espresso) with AUG 119.2 |
| Żakowice, ZE-aug | 150 s | 142.5, 143.9, 144.0, 160.9 |
| Żakowice, ZE-usp | 150 s | 149.3, 149.0 (under even with round 7's gun; round 7 never benched ZE here) |
| Koluszki (Bartek), ZE-aug | 210 s | 206.8 (1 seed) |
| Niciarniana, ZE-aug | 120 s | 119.9, 120.9, 121.6, 121.8 |

Holding but close, ZE-aug: Fabryczna 120.5–121.9, Andrzejów 137.1 and Bedoń 136.9–138.1 (minimum 135), Gałkówek 158.9.

CI's `scripts/sim/data/strongest.json` still uses `usp_silencer`, so the gate cannot see this.

**Why the AUG wins** (`node scripts/redteam/r8-gun.ts`): Gnat 8 single-target damage per second with Energetyk 5 and Bilet Ulgowy 2, by gun:

| Gun | Single | Crowd |
|---|---:|---:|
| AUG / SG 553 | 146 | 159 |
| M4A4 / Galil | 113 | 166 |
| USP | 95 | 95 |
| Glock | 82 | 83 |

Round 6 picked USP on the bench without passives, where USP measured 107 and AUG 96.

### Finding 2: requirement 3 (or 6), CS guns only balanced without passives
That is my reading of a gap, not a failure of `gate.ts --tylko=cs`, which only benches guns without passives. With haste and extra shots the guns spread far apart:
- Power (geometric mean): AUG 152, USP 95, Glock 83.
- Single target ranges from 52 (sawed-off) to 146 (AUG).
- The ±15% CS budget does not hold in any build that carries Energetyk and Bilet Ulgowy.

### Finding 3: requirement 1, exploit bots still live past 3 minutes
- **Commands:** `node scripts/redteam/r8-specs.mjs`, then `SIM_WORKER=redteam8 RT_BUNDLE=redteam8-ex.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r8-ex.json r8-ex --watki=6`, and the same for `r8-ex2`.
- **Fresh seeds:**
  - r8-ex (round 7's specs on 3× the seeds): 19 of 2268 runs past 180 s, longest 227.2 s (slamdrift-m40-K, Żakowice).
  - r8-ex2 (2× the seeds): 28 of 1584 past 180 s, longest **286.1 s** (sciana-T, Justynów); sciana and sciana-T alone had 16 of 864.
- **The camping change did not help.** Round 7's exact seeds at HEAD (`r8-ab7ex`, `r8-ab7ex2`): 15 of 1548 past 180 s, longest 232.8 s. Before 5706673 it was 10 of 1548, longest 223.7 s. sciana went from 3 to 6 runs past 180 s.
- **Waves arrive at full size and do nothing.** I added `campMax`, `campSent` and `hurt30` to worker.ts and re-ran the long ones (`r8-again`):
  - Long survivors had 47 to 69 camping waves in a row, mostly at the full ring plus 4 flocks.
  - The 286 s run took **0 damage in its first 150 s**.
- **They stick on the same spots across seeds:**
  - Gałkówek (19.5, 2.1)
  - Koluszki (4.3, 12)
  - Niciarniana (4.1, 12.5) and (−12.3, −3.9)
  - Justynów (5.4, −12.1)
  - Widzew (−13.6, −7.1)
- **Hopping in place also works.**
  - hopslajd-B never left (0, 0) (path 0 m), only jumping and slamming, and lived 195.6 s (Andrzejów) and 199.7 s (Żakowice), with no damage for the first 120 s.
  - My new pure "slam in place" bot (`specs/r8-slam.json`) passed 180 s in 1 of 432 runs (206 s, Andrzejów).
  - Guess, not measured: the air-slide slam knocks back everything within 3.5 m on every hop (`Game.landed`), so the crowd can't reach the wedge.

### Checked, no break
- **Camping-reset bots** (wall-wedge or standing, leaving 5 m on a clock so camping never fires; `specs/r8-reset.json`): 0 of 1728 past 180 s, longest 158 s.
- **Barrier fix** (`node scripts/redteam/r8-zones.mjs 1500`, mirrors the new placement code):
  - No pockets, with only the new cast standing or with the previous cast still up.
  - Running out of a barrier with standing ones in the way never took longer than the warning allows (worst 7.5 m against 8.7 m allowed).
  - For information: Gałkówek phase 3 places on average 3.56 of its 5 barriers, and 99.9% of its casts come up short.
- **Weapon ranking for boss slots** (`r8-dps.ts`, single target with the boss passives): Zgrzewka 224, Sieć 187, Espresso 109, Gnat with USP 95, next best Parasol Burzowy 77. So ZE is already the top four on that bench.

### Not done
- `budget.ts --sprawdz` and `alone.ts`: not re-run. Weapons haven't changed since round 7, and growing camping waves only make standing still harder.
- Stun-then-charge timing at Widzew phase 3: not measured. Unverified idea: a stun that lands while a warning is already running does not lengthen that warning.
- Requirement 5 (Human-bot sample): not run.

### Files
All tools are in `C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\`, outputs in its `out\r8-*`:
- New: `r8-specs.mjs`, `r8-boss.mjs`, `r8-gun.ts`, `r8-dps.ts`, `r8-zones.mjs`.
- `worker.ts` changes: sciana takes `period`/`back`; new `tam` bot kind; result fields `campMax`, `campSent`, `alive`, `hurt30`.

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. AUG / SG 553 z pasywkami zabija Widzew, Żakowice, Koluszki poniżej minimum | limit obrażeń jest twardy: ponad niego nic nie wchodzi, więc minimum trzyma niezależnie od siły buildu (`d1e7fb8`) |
| 2. bronie CS zbalansowane tylko bez pasywek | przyczyna: pistolety gubiły resztę serii, gdy następne pociągnięcie spustu przyszło wcześniej, więc dodatkowe strzały i szybkość ataku nic im nie dawały; teraz seria leci do końca, budżet CS przeliczony (`d1e7fb8`) |
| 3. skok i ślizg w miejscu przy ścianie przeżywa 3 min | uderzenie przy lądowaniu po ślizgu odpycha wrogów najwyżej raz na 2,5 s (`d1e7fb8`) |

### Runda 9 (na `d1e7fb8`)

<details>
<summary>Runda 9: raport bez zmian (po angielsku)</summary>

## Red Team round 9 (HEAD d1e7fb8, balans-v2): findings

I worked in C:\Users\jakub\Nowy folder\piotrobonk with SIM_WORKER=redteam9, RT_BUNDLE=redteam9-*.mjs and at most 12 threads. I changed no balance files and committed nothing.

Three requirements broke: 1 (exploits past 3 minutes, including a real arena hole at Widzew), 3 in its movement half (Parasol Burzowy alone), and 4 if Opóźnienie's extra phase counts as a phase. Boss minimums (2) held with every build, and I found no easy build (5).

### Finding 1 (requirement 1, the worst one): at Widzew, standing in one spot under the viaduct deck makes Piotrek untouchable
- **Where:** Piotrek stand at (-38.3, 0, -17.1), under the elevated deck, against the wall box `[-40,0,-18.6]` at the top of the south ramp (src/content/stations/widzew.ts).
- **Trace:** `scripts/redteam/specs/r9-trace.json`, `out/r9-trace.json`; the trace field was added to worker.ts. It replays two runs from r9-slam2:
  - hs-T #382: Piotrek stay on that spot from t=10 s to t=360 s. HP stays at 99 the whole time, through 87 camping waves (campMax 87). 400–421 enemies sit within 2.5 m horizontally, at a mean height of **+8 m** (on the deck). The enemy pool is full at 480. Piotrek die only to the boss at 375 s.
  - hs-P #862: the same spot. 0 damage from 20 s to 180 s, and 391 s survived in total.
- **Mechanism (read from the code, not tested separately):**
  - Walkers climb the ramp and pile on the deck straight above Piotrek.
  - Crowd separation in src/game/enemies.ts (around line 640) is 2D and ignores height, so the pile above pushes ground-level walkers away.
  - Fliers aim at `max(py+1.3, roof+1.1)`, with roof = `groundAt(...,100)`. That is the deck, so pigeons fly at about 8 m over a Piotrek who is under it.
- **A no-reaction bot reaches it:** I added a `trasa` bot to worker.ts that walks fixed waypoints (-10,10) → (-30,10) → (-38.3,10) → (-38.3,-17.1) and stands. Spec: `specs/r9-trasa.json`.
  - With the T card plan: 21/24 reached the spot, and **2/24 lived past 180 s (263.7 s and 380 s)**. The 380 s run took 0 damage from 30 s to 210 s and reached the boss.
  - With random cards: 0/24 past 180 s (max 178.1 s).
  - It is seed-dependent: Piotrek must get there before the pile forms.

### Finding 2 (requirement 1): the slide-hop with no stick still outlives 3 minutes
This is round 8's `slam-w-miejscu`: `tam` with period 1e9 and back 0, hold jump, press slide whenever it is ready, stick never touched.
- **Command:** `node scripts/redteam/rt.ts scripts/redteam/specs/<spec>.json <out> --watki=12`
- **r9-slam** (round 8's spec on fresh seeds): plain 1/216 past 180 s (max 207.7); with T cards 5/216 (max 223.5).
- **r9-slam2** (new, `specs/r9-slam2.json`, 1224 runs), runs past 180 s:

| Variant | Past 180 s | Max |
|---|---:|---:|
| hs (no card plan) | 6/288 | 221.6 s |
| hs-T | 8/288 | **374.7 s** |
| hs-K | 3/216 | 210.8 s |
| hs-P | 6/216 | **391.2 s** |
| hop only (h-T) | 1/108 | 182.8 s |
| slide only (s-T) | 0/108 | 85.5 s |

- Median survival is about 60 s, so these are rare. The two longest runs (374.7 s and 391.2 s) are the Widzew spot from Finding 1.
- The others are mostly sliding along the fence: path about 2700 m and 10-second span about 90 m.
- This got worse, not better, after SLAM_EVERY. Round 8 had 1/432 past 180 s on this spec; round 9 has 6/432.

### Finding 3 (requirement 3, with movement): Parasol Burzowy alone outlasts the one-minute limit
- **Command:** `node scripts/redteam/rt.ts scripts/redteam/specs/r9-alone-move.json r9-alone-move --watki=12`. Each weapon is maxed and alone, immortal to minute 8, using the `alone` option with movement.
- With the no-stick slide-hop at Fabryczna it lasted **71 s** after minute 8.
- Replication (`specs/r9-alone2.json`): at Fabryczna **92 s and 77 s** (29 s and 2 s on the other two seeds). That makes 3 of 5 Fabryczna runs over 60 s. Other stations reached at most 42 s.
- Control: every other weapon with the same movement and seed at Fabryczna died in 2–19 s.
- The other 251 weapon/movement runs (hopslajd, slamlap, duzekolko) were all at or under 27 s.
- Plain `scripts/sim/alone.ts` passes: worst is 11 s (espresso and parasol-burzowy).

### Finding 4 (requirement 4, depends on interpretation): Opóźnienie's extra phase brings no new attacks
- **Bench:** `specs/r9-boss.json` with `ZE-aug-c6-opoz`; analysis by `node scripts/redteam/r9-variety.mjs r9-boss`.
- At Widzew and Żakowice, P4 shows 6 attacks, **0 new**.
- `lastPhase()` in src/game/boss.ts only re-adds the strongest attack of each earlier phase.
- If the extra phase counts as a phase for "≥2 new per phase", it fails.

### What held
- **Requirement 2, boss minimums:** `specs/r9-boss.json` (29 benches: ZE-aug at every station ×2, elite, famas with Latte ×3, ZK-aug, a puszka build with Latte ×3, Opóźnienie). Fastest kills: 145–147 s for stations 1–3 (minimum 120), 163–164 for 4–6 (135), 182–184 for 7–8 (150), 260–261 for Bartek (210).
  - That matches what the code allows: no kill can come faster than about 1.2 × minimum, less the 2 s burst, plus the phase-change shields.
  - `limitOverflow 0` holds. Every damage path to the boss goes through `hitEnemy` → `limit`/`absorb`, and `restore` matches only real heals.
  - The last train always leaves after the fastest kill, even on Opóźnienie with the "ostatni" modifier (about 214 s vs 147 s).
- **Exploit re-runs, all 0 past 180 s:**

| Spec | Runs | Longest |
|---|---:|---:|
| r9-ex | 2268 | 153.6 s |
| r9-ex2 | 1584 | 177.8 s |
| r9-again | 1080 | 126.9 s |
| r9-reset | 1728 | 162.6 s |

  So wall-wedge, slamlap, slamdrift, hopslajd and the camping-reset bots are all fixed.
- **Budgets:** `node scripts/sim/budget.ts --sprawdz --watki=12` and `--cs --sprawdz` both exit 0. Every weapon level is within ±15% (zgrzewka is the furthest at +2%), and every CS gun is within ±15% of the default.
- **Variety on Normalnie (r9-variety):** every boss has 6–8 distinct attacks, and each phase showed ≥2 new attacks in every fight. No attack came more than 2× in a row, gates fire exactly at their thresholds, and stuns are at most 11% of the fight with the longest at 1.5 s.
- **Requirement 5:** my suspicion was a Parasol → Parasol Burzowy build. With the Human bot and `specs/r9-human.json` it won 0/16 at Fabryczna, 0/8 at Żakowice and 0/8 at Koluszki. No easy build found.

### CS guns with Energetyk 5 + Bilet Ulgowy 2 (information only)
`RT_BUNDLE=redteam9-gun.mjs node scripts/redteam/r9-gun.ts --watki=12`

| | Bare power | With E+B | Gain |
|---|---:|---:|---:|
| AUG / SG 553 | 85 | 161 (195% of glock) | 1.90× |
| M4A1 / Galil | 85 | 135 | 1.59× |
| AK-47 | 85 | 127 | 1.50× |
| Glock (default gun) | 85 | 83 | 0.97× |

- Bare, every gun lands at 85 except the USP (83).
- With E+B the guns spread **1.95×** max/min. The automatics stay at about 85 (gain 1.00), because they are already at the attack-speed cap.
- From `r9-dps.ts`: Gnat on AUG with E+B (161) is still well below puszka (326), kawa (318) and zgrzewka (368) with the same passives. The default Gnat is the only weapon that gains nothing from E+B.

### Files
All in C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam\:
- **Changed:** `worker.ts` gained the `punkt` and `trasa` bots and the `trace` option.
- **New scripts:** `r9-specs.mjs`, `r9-sum.mjs`, `r9-slam2.mjs`, `r9-punkt.mjs`, `r9-boss.mjs`, `r9-variety.mjs`, `r9-gun.ts`, `r9-dps.ts`.
- **Specs and outputs:** `specs\r9-*.json` and `out\r9-*.json` / `out\r9-*.log`.
- The `punkt` spec (`r9-punkt.json`) proved nothing: the straight-line walk gets stuck on the kiosk at (-13.6, -7.1).

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. pod wiaduktem na Widzewie Piotrek jest nietykalny (bot bez reakcji przeżył 380 s) | piechurzy ponad 4 m nad Piotrkiem wracają jak maruderzy, gołębie przy zadaszonym Piotrku lecą pod dachem, rozpychanie tłumu działa tylko w obrębie jednego poziomu (`071c7dc`) |
| 2. ślizg ze skokiem wzdłuż płotu przeżywa 3 min (do 223 s poza wiaduktem) | dyrektor kitingu rusza od 110. sekundy zamiast 150. (`071c7dc`) |
| 3. Parasol Burzowy sam, w ruchu, 71–92 s po 8. minucie | nie zmienione: specyfikacja mówi o stojącym bocie, a stojący ginie po 11 s; wariant z ruchem opisuję w „Czego nie osiągnąłem” |
| 4. faza dodatkowa Opóźnienia bez nowych ataków | dwa nowe kombosy w fazie dodatkowej (atak z 1. fazy łańcuchem w atak ostatniej, pod nową nazwą) (`071c7dc`) |
| minimum bossów, budżety, różnorodność na Normalnie | trzymają; najszybciej 145 s na stacjach 1–3, 163 s na 4–6, 182 s na 7–8, 260 s z Bartkiem |

### Runda 10 (na `071c7dc`)

<details>
<summary>Runda 10: raport bez zmian (po angielsku)</summary>

## Red Team round 10 (HEAD 071c7dc): findings

I changed no balance files and committed nothing. All runs used SIM_WORKER=redteam10 and RT_BUNDLE=redteam10-*.mjs, with at most 12 threads at a time. Run from `C:\Users\jakub\Nowy folder\piotrobonk`; the outputs are in `scripts\redteam\out\`.

### F1 — Requirement 1 broken (new): roofs and canopies on posts are the viaduct hole turned upside down
Piotrek stands on a roof that has open ground under it. The crowd gathers directly below and never reaches them.
- **Why, from the code:**
  - `enemies.ts` only lets a walker climb when it is `blocked && !low && py - cy > 0.7`. Under a roof on posts nothing blocks the walkers, so they just stand under Piotrek.
  - Contact damage in `game.ts` skips any enemy with `dy < -heightOf`.
  - The new leash in `game.ts` only moves walkers that are *above* Piotrek (`y - p.y > 4`). Walkers below are never moved.
- **Commands:**
  - `SIM_WORKER=redteam10 node scripts/redteam/r10-geo.ts` dumps each station's boxes and ramps.
  - `node scripts/redteam/r10-cover.mjs` scans for reachable floors (walk, step 0.42 m, jump up to 1.77 m) and lists perches over open room.
  - `node scripts/redteam/r10-wspin.mjs` writes the specs.
  - `SIM_WORKER=redteam10 RT_BUNDLE=redteam10-rt.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r10-wspin.json r10-wspin --watki=11`, then the same with `specs/r10-wspin2.json` and the output name `r10-wspin2`.
  - The bot is the new `wspin` kind: it follows the dense path cell by cell, jumps only when the next floor is higher, then stands still. No reaction to the game.
- **Without any god mode (climbs from t=0, then stands), r10-wspin W0 with 8 seeds per spot:**

| Spot | Height | Runs past 180 s | Longest run |
|---|---:|---:|---:|
| Gałkówek canopy (-0.5, 28.5) | 4.02 m | 3/8 | 348 s |
| Fabryczna roof (-17, 5) | 3.3 m | 3/8 | 261 s |
| Widzew viaduct deck (-44.5, 6) | 8 m | 1/8 | 230 s |

- **r10-wspin2, 16 seeds per spot with planned cards and 16 with random cards:**

| Spot | Planned cards | Random cards | Longest run |
|---|---:|---:|---:|
| Widzew viaduct deck | 3/16 | 2/16 | 392 s |
| Gałkówek canopy | 3/16 | 1/16 | 315 s |
| Fabryczna roof | 1/16 | 0/16 | 303 s |
| Żakowice canopy (5.5, 27) | 0/16 | 0/16 | 176 s |

  - Without god mode, 17 of 168 runs lived past 180 s.
  - Many of these runs die around 15 s in, so the result splits into early deaths and long holds.
- **God mode only for the first 60 s of the trip (W60):**
  - Gałkówek: 11/16 runs lived more than 180 s after god mode ended.
  - Run #28 reached the 400 s cap (timeout). It took zero damage from 0 s to 360 s, the enemy pool was full (480 alive), about 190 enemies stood within 2.5 m, all 3 m below.
- **Teleport hold test** (`specs/r10-tp.json`, `tp` option, 16 seeds per spot, no god mode):
  - Andrzejów (12, -2) at 4.9 m: 3/16 past 180 s, longest 383 s. Run #559 had more than 350 enemies within 2.5 m, 4.7 m below, and took no damage from about 90 s to 360 s.
  - Żakowice (-28, 5) at 6.2 m: 5/16, longest 260 s.
  - Justynów canopy (3.5, 28.5): 2/16, longest 258 s.
  - My climb bot never reached these three spots. That a player can get up there is only shown by the flood fill (a guess).

### F2 — Requirement 1 still broken: slide-hop in place (r9-slam / r9-slam2) on fresh seeds
- **Commands:**
  - `node scripts/redteam/r10-specs.mjs` merges all seven round 9 suites into `specs/r10-ex.json` (8364 jobs) with the `-r10` seed tags.
  - `SIM_WORKER=redteam10 RT_BUNDLE=redteam10-rt.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r10-ex.json r10-ex --watki=12`
  - `node scripts/redteam/r9-sum.mjs r10-ex`
- **Result:** 21 of 1656 slam runs lived past 180 s; the longest was 237.1 s (Justynów, hs-T #906). Runs past 180 s by spec:
  - slam-w-miejscu 1/216, slam-w-miejscu-T 2/216
  - hs 2/288, hs-T 5/288, hs-K 4/216, hs-P 4/216
  - h-T (hop only) 3/108, longest 198.6 s
  - s-T 0/108
- Round 9 had 29 runs past 180 s with a longest of 391 s, so it is better but still breaks "in any run".
- Every other suite had 0 runs past 180 s:
  - trasa (Widzew viaduct route): longest 108 s
  - ex: longest 173.3 s (slamlap)
  - ex2, again, reset: longest 162.8 s

### F3 — Requirement 4, small: the extra phase sometimes shows only one new attack
- **Command:** `SIM_WORKER=redteam10 RT_BUNDLE=redteam10-boss.mjs node scripts/redteam/rt.ts scripts/redteam/specs/r10-boss.json r10-boss --watki=12` (31 jobs, 1642 s wall, specs from `r10-boss.mjs`), then `node scripts/redteam/r9-variety.mjs r10-boss`.
- In 2 of 18 Opóźnienie fights the extra phase showed only 1 new attack: Fabryczna #10 and Widzew #14 (P4: 7/1new and 6/1new).
  - At the damage limit the extra phase lasts only about 19–20 s (546.9 s to 567 s) and holds 8 attacks, so one of the two combos may never come.
- **From the code** (`node scripts/redteam/r10-extra.ts`, which copies the logic of `lastPhase`): two combos chain an attack into itself under a new name.
  - Pajęczyca: "Czółenka i Czółenka"
  - ZKA: "Objazd i Objazd"
  - The cause is `first[k % n]` with `ends[(k*2) % ends.length]`. Whether these count as new attacks is your call.
- Everything else in requirement 4 passed in every fight:
  - 6–10 distinct attacks per boss.
  - At least 2 new attacks in every normal phase.
  - Never more than 2 of the same attack in a row.
  - Phase gates on their thresholds.
  - Stun share 0%, no early stuns.

### Checked and not broken
- **Requirement 2:** kill times are at least 1.2× the minimum on Normalnie and Opóźnienie.
  - Measured: stations 1–3 145–146 s (min 120), 4–6 163–167 s (min 135), 7–8 182–184 s (min 150), Bartek 257–264 s (min 210).
  - Kits tested: ZE+AUG, G3SG1 and MAG-7 each with three might coffees.
  - This holds by design: `Boss.limit` refills at maxHp/(min×1.2), starts empty, and `limitOverflow` is 0.
- **Requirement 3:**
  - `SIM_WORKER=redteam10 node scripts/sim/budget.ts --sprawdz` exits 0; every weapon is within ±15%, including Telefon at 7.5 m and Iskra at ×0.85.
  - `--cs --sprawdz` exits 0.
  - `scripts/sim/alone.ts` exits 0; the longest is Powerbank at 23 s.
- **Under-deck spots that the leash misses** (2.4–4 m above Piotrek): the teleport test shows them not holding.
  - The round 9 viaduct spot (-38.3, -17.1) lasted at most 126 s, 0/16 past 180 s.
  - The best other spot lasted 176 s.
  - The viaduct fix works there.

### Observation, not a stated requirement (requirement 6?)
- In one of two Opóźnienie seeds, Bartek took 922 s to kill with the ZE+AUG kit; the other seed took 264 s.
- The extra phase alone ran 71 s with 35 attacks (Koluszki #26, run time 1342 s).
- I did not look into why. My guess is the cup refills and sips against the damage limit.
- I did not test requirement 5 (no concrete suspicion) or whether the leash pulls enemies onto Piotrek unfairly.

### Tool notes
- **worker.ts changes:**
  - `trasa` gained `climb` (hop only on the way), `godTrip` (god mode for that many seconds) and `tp` (start on the spot).
  - New kind `wspin`.
  - `r10-cover.mjs` gained `--path=x,z,f [--dense]` and `--spots`.
- **Do not use** `out/r10-spots.json` or `out/r10-spots2.json`. My first `godTrip` kept god mode on for bots that never arrived. `r10-spots3`, `r10-tp`, `r10-wspin` and `r10-wspin2` are valid.
- **New files in `scripts/redteam/`:**
  - r10-specs.mjs, r10-geo.ts, r10-cover.mjs, r10-spotsum.mjs, r10-wspin.mjs, r10-boss.mjs, r10-extra.ts
  - specs/r10-ex.json, r10-spots3.json, r10-tp.json, r10-wspin.json, r10-wspin2.json, r10-boss.json
  - Logs: out/r10-budget.log, r10-budget-cs.log, r10-alone.log, r10-cover.log, r10-boss.log

</details>

| znalezisko | co zrobiłem |
|---|---|
| F1. dach albo wiata na słupkach: tłum stoi pod Piotrkiem i nie wchodzi (do 392 s) | piechurzy w promieniu 3,5 m pod Piotrkiem, który stoi na czymś, wspinają się do niego (`54df758`); te same specyfikacje Red Teamu po poprawce: 0 ze 128 (wspinanie) i 0 z 1328 (teleport na dach) runów ponad 3 min, najdłużej 90 s |
| F2. ślizg ze skokiem w miejscu: 21 z 1656 runów ponad 3 min (najdłużej 237 s) | nie zmienione, na liście braków |
| F3. faza dodatkowa: kombos łączy atak sam ze sobą; w krótkiej fazie widać 1 nowy atak | kombos nigdy nie łączy ataku z nim samym (`54df758`); krótka faza przy limicie zostaje |
| minimum bossów, budżety, „broń sama” | trzymają |
| Bartek na Opóźnieniu: jedna walka 922 s | nie badane dalej (Opóźnienie nie ma celu czasu walki) |

### Runda 11 (na `54df758`)

<details>
<summary>Runda 11: raport bez zmian (po angielsku)</summary>

Red Team round 11 at HEAD 54df758 (balans-v2). The difficulty still breaks in two places: requirement 1 fails twice, requirement 4 fails once by computation (not seen in game), and requirement 6 has one small measured case. I changed no balance file and committed nothing. Every run used SIM_WORKER=redteam11 with RT_BUNDLE=redteam11-rt.mjs or redteam11-b.mjs, at most 12 threads.

Common command: `SIM_WORKER=redteam11 RT_BUNDLE=redteam11-rt.mjs node scripts/redteam/rt.ts scripts/redteam/specs/<spec>.json <out> --watki=12`, then `node scripts/redteam/r9-sum.mjs <out>`.

**Finding 1 — requirement 1 broken, unchanged since round 10: hop and slide in place.**
- Spec r11-ex = all of round 10's suites on fresh `-r11` seed tags, 8364 runs, from `node scripts/redteam/r11-specs.mjs`.
- 25 runs lived past 180 s, all in the slam and slam2 suites (`tam` with hop+slide). That is 25 of 1656 runs, about 1.5%. Max 242.9 s (fabryczna #742, slam2/hs-T); others 237.7, 239.5, 221.4 s and so on.
- About 22 are distinct: hs-T and hs-K share seeds, and #727/#1015, #951/#1183, #967/#1199 are identical runs.
- Every survivor ends at the fence (maxR = arena limit, meanR about limit − 2, path 2.3–3.1 km) and dies before the boss arrives.
- Round 10 at 071c7dc had 21 such runs, max 237.1 s. No change.

**Finding 2 — requirement 1 broken: an airborne Piotrek defeats the new climb rule.**
- The spot is Widzew's viaduct parapet at (−36, 6), floor 8 m. It is box 32, 0.4 m wide (x −35.9..−35.5), on the deck at 7 m.
- None of these bots react to the game state:

| Run (spec, seeds) | God mode | Runs past 180 s | Times |
|---|---|---|---|
| W0, climb then stand (`r11-wspinh`, 48) | none | 1/48 | 185 s, #336, level 31 |
| R-W0H, climb then hop in place (`r11-rail`, 160) | none | 2/160 | 209.1 s and 214.0 s (#187, #233) |
| W0H at Fabryczna (−17, 5, 3.3 m) (`r11-wspinh`) | none | 1/48 | 181.3 s |
| W60 (`r11-wspin`, 16) | first 60 s | 2/16 | 197.7 s and 328.8 s |
| W60H (16) | first 60 s | 4/16 | max 225.3 s |

- I traced the 328.8 s run (`specs/r11-trace.json`, trace 5 s; the trail field shows 7.5 m below for the whole span):
  - From 65 s to about 300 s, HP stayed at 74.
  - 323–356 enemies stood within 2.5 m horizontally, on average 7.5 m below Piotrek, with the pool full at 480.
  - Piotrek's height moved between 7.1 and 8.3: they keep falling off the parapet onto the deck and jumping back up, so they are in the air most of the time.
- Why this beats the fix: `perched` (enemies.ts:545) is true only while Piotrek stand. Climbers rise at 3.2 m/s on the standing frames and fall at 12 m/s on all the others, so they never get up.
- Standing still on the parapet's middle (R-W0c, path ending at x −35.7) dies every time: 160 runs, max 84.7 s.
- Hopping in place after a teleport (`r11-hop`, 432 runs, max 86.4 s) is not a clean test. In god-mode checks (`r11-gh`), the hop threw Piotrek off the perch at 3 of 4 spots.

**Finding 3 — requirement 4 broken (computed, not measured in game): an attack can land three times in a row.**
- A combo "X i Y" is a copy of attack X under a new name. The repeat rule only blocks a third X by name, so X, X, "X i Y" is allowed, and X then lands a third time.
- `node scripts/redteam/r11-extra.ts` copies `lastPhase` and `Boss.start`/`draw`/`count` and makes 200 000 draws per boss. A third landing in a row happens in:
  - 0.31–0.32% of draws for kanar, krol-zlomu, kierownik and megafon;
  - 0.21% for bartek;
  - 0.03–0.09% for the others.
- What passes: every boss's extra phase has 2 new, distinct combos, and none chains an attack into itself any more.
- I did not run it in game: Opóźnienie boss benches took 1642 s in round 10, too long for this round.

**Finding 4 — requirement 6, small, measured: walkers climb up through the Widzew deck at a box seam.**
- Spec `r11-seam` teleports Piotrek onto the deck in god mode, 150 s, trace every 3 s. Trail fields [8] and [9] are new: enemies inside solid geometry, and those of them within touching height.
- On the seam between boxes 22 and 23 (z = 6), at (−37.5, 6) and (−43.5, 6): in 2 of 4 seeds each, walkers sat inside the deck within touching height, in 7 and 3 (resp. 4 and 6) of 50 samples, up to 3 at once.
- Away from the seam, at (−37.5, 0): 0 in 4 seeds.
- Likely cause, from reading the code: `World.collide`'s two passes push a body centred on the seam out of one box into the other and back.

**Finding 5 — requirement 6, code reading only, not measured.**
- The new rule `perched && d < 3.5` uses `d`, the distance to the walker's own target.
- For couriers (the finale's lemurs, target Bartek's chair, delivery at 2.2 m) and collectors (a bottle, picked up at 0.89 m), that target is not Piotrek.
- So while Piotrek stand at least 0.7 m above them anywhere, lemurs 2.2–3.5 m from the chair and collectors 0.9–3.5 m from a bottle should float up into the air.
- The rule also lifts any walker within 3.5 m into open air, with no wall needed.

**What held:**
- `r11-tp` (1328 runs, every round-10 under-deck, flier-ceiling and perch spot, standing): max 134.2 s.
- `r11-wspin` (round 10's climbs on fresh seeds, 320 runs): only Widzew (−36, 6) lived past 180 s.
- All round-10 perches except Widzew (−36, 6) and Fabryczna (−17, 5) are now closed. For example, W0los/W0T at Widzew (−44.5, 6) dropped from 366/392 s to 40/48 s.
- Budgets pass:
  - `node scripts/sim/budget.ts --sprawdz --watki=6`: every weapon level within ±15%, exit 0.
  - `--cs --sprawdz`: every CS gun within ±15%, exit 0.
  - `node scripts/sim/alone.ts --watki=6`: every weapon alone dies within a minute, exit 0.

**Not checked:** requirement 2 (boss minimum kill times). I ran no new boss bench this round; 54df758 changes only which combos the extra phase picks.

**Tools changed** (only under scripts/redteam/):
- `worker.ts`: wspin bot has a new `hop` option; trail entries gained fields [8] and [9].
- New scripts: `r11-specs.mjs`, `r11-hop.mjs`, `r11-wspin-hop.mjs`, `r11-extra.ts`.
- New specs in `specs/`: r11-ex, r11-wspin, r11-tp, r11-hop, r11-wspinh, r11-rail, r11-trace, r11-seam, r11-gh.
- Results in `out/r11-*.json` and `.log`.

BALANCE.md shows as modified in git, but it was already modified before I started.

Everything is in C:\Users\jakub\Nowy folder\piotrobonk\scripts\redteam.

</details>

| znalezisko | co zrobiłem |
|---|---|
| 1. ślizg ze skokiem w miejscu: 25 z 1656 runów ponad 3 min (najdłużej 243 s) | nie zmienione, na liście braków |
| 2. podskakujący Piotrek na parapecie Widzewa omija regułę wspinania (do 329 s) | wspinanie rusza także wtedy, gdy Piotrek podskakują nad podwyższeniem, a liczy się wysokość podwyższenia, nie skoku (`f1cefaf`); specyfikacje `r11-rail`, `r11-wspinh`, `r11-wspin` po poprawce: 0 runów ponad 3 min (najdłużej 180, 172, 142 s) |
| 3. kombos „X i Y” pozwala trafić X trzeci raz z rzędu (0,03–0,32% losowań) | kombos liczy się w zasadzie powtórek jak swój pierwszy atak (`f1cefaf`) |
| 4. wrogowie przechodzą przez pomost Widzewa na styku dwóch bloków | nie zmienione: rzadkie (do 3 wrogów naraz w 2 z 4 seedów), na liście braków |
| 5. reguła wspinania mierzyła odległość do celu wroga, nie do Piotrka (lemury, zbieracze) | poprawione: odległość do Piotrka (`f1cefaf`) |

Na tym kończę pętlę na prośbę użytkownika („domknij z brakami”): jedenaście rund, żadne dwie czyste z rzędu.
Ostatnie poprawki (`f1cefaf`) sprawdziłem tylko specyfikacjami Red Teamu z rundy 11, nie świeżą rundą.

## Audytor

Audytor to osobny subagent, który nie pisał tego kodu. Przeszedłem trzy razy:
- 25.11 na `af2c470`;
- 26.11 na `d77b086`;
- 26.11 na `db3a3e9`, z pomiarem końcowym `s`.

Nie zmieniłem nic poza `scripts/audit/` i niczego nie commitowałem. Symulacje szły tylko przez `SIM_WORKER=audit` albo własne pakiety `.sim/audit-*`, na najwyżej 6 wątkach. Lokalnie liczyłem na Node 24. Każdy punkt ma werdykt: OK, NIE OK albo NIE DA SIĘ SPRAWDZIĆ. Uwagi poprawione po moich wcześniejszych przejściach podaję jako OK, z informacją, co się zmieniło.

#### Werdykt ogólny

Przebudowa jest **uczciwie zmierzona i uczciwie opisana, ale nie spełnia specyfikacji**.

- **Spełnione:**
  - przyrząd pomiarowy: symulacja = gra na sprawdzonym zakresie, boty planujące, bramki CI, pomiar końcowy w repo i na świeżych seedach;
  - minimum walk z bossem (wynika z konstrukcji limitu obrażeń);
  - Oracle wygrywa (99%);
  - Human na 1. stacji;
  - Casual na Spokojnym;
  - budżety broni (na samej granicy ±15%);
  - „broń sama”;
  - reguły ataków bossów (z zastrzeżeniami co do liczenia).
- **Niespełnione:**
  - czasy walk Oracle (2 z 9 stacji w celu);
  - stosunek czasów Human / Oracle (2 z 9);
  - win rate Humana na końcu trasy i na Opóźnieniu;
  - Casual na Normalnie (0%);
  - exploity (ok. 1,5% runów ponad 3 minuty);
  - udział broni (Telefon 48%);
  - wszystkie trzy miary napięcia;
  - dwie czyste rundy Red Teamu z rzędu.
- **Zgodnie z regułą użytkownika nic nie poszło na `main` i tak powinno zostać.**
- Każda liczba w „Wynikach” zgadza się z moim przeliczeniem z surowych runów. „Czego nie osiągnąłem” jest prawie kompletne; braki wypisuję w punkcie H.
- Dwa zastrzeżenia do samego przyrządu:
  - bot Human jest silniejszy niż człowiek, więc prawdziwi gracze wygrywaliby rzadziej niż w tabelach;
  - zgodność przeglądarki z symulacją dowiedziono tylko na wąskim wycinku gry.

#### A. Pomiar końcowy `s`

- **OK: pochodzenie.**
  - Run Actions 45870504499 na `sim/s`, commit `19e4a96`, zakończony sukcesem.
  - 72 artefakty, wszystkie dostępne.
  - Scalone pliki `.sim/s-*.json` są identyczne z sumą shardów w `.sim/s-shards/`: 8 kroków po 9 shardów; sprawdziłem każdy rekord poza polami `id` i `ms`.
  - Kod gry z `19e4a96` = `d77b086` = `db3a3e9`. Od `d77b086` w `src/` zmieniła się tylko jedna linia changeloga.
- **OK: seedy.**
  - Dni 1300–1309; plany losowe 1300 i 1301.
  - Poza `s-*` dni ≥ 1300 nie występują w żadnym pliku `.sim/` (`scripts/audit/seeds.ts`). Wyjątek to moje dwie kopie do porównania Node, zrobione już po zdefiniowaniu pomiaru.
  - Seedy Red Teamu to etykiety tekstowe, nie dni.
- **OK: definicja pomiaru.**
  - Warianty `ak`, `oa`, `a` i `random` nie zmieniają ani profilu bota, ani TUNING (puste `{}`).
  - `oracle-top` gra Normalnie ze szczeblem drabinki 19 (moje pierwsze przejście wykazało, że dawniej grało zwykłe Opóźnienie).
  - Brak timeoutów.
  - Definicja jest w repo (`.github/workflows/sim.yml`, `scripts/measure/`, od `db3a3e9`).
- **OK: wyniki przeliczone niezależnie** (`scripts/audit/results.ts s` oraz `scripts/measure/tables.mjs s`). Zgadzają się wszystkie wiersze tabeli celów, tabela Humana, tabela czasów walk i tabela udziału broni.
  - Human: 52/180 = 29%; A 28/90, K 24/90; na stacjach 9, 5, 8, 6, 7, 3, 5, 2 i 7 na 20.
  - Oracle: 71/72; Oracle na szczycie drabinki: 9/27.
  - Casual: na Spokojnym 61/72, na Normalnie 0/72.
  - Human na Opóźnieniu: 3/54.
  - Mediany walk Oracle: 154–160 / 177–202 / 196–224 / 336 s.
  - Human / Oracle: od ×1,06 do ×1,43. Justynów dokładnie ×1,3004, czyli w celu, ale o włos.
  - Napięcie Humana: 1,07 epizodu HP < 30% na run, ≥ 3 w 8 ze 180 runów; HP przy bossie mediana 83%, w 40–60% w 18 ze 114; wróg ≤ 5 m przez 26% czasu, ponad 50% w 2 ze 180.
  - Udział broni w wygranych planów losowych: Telefon 48%, Iskra 40%, Kawa 38%.
  - Liczby „przed” z dni 600 (Telefon 56%, Gwizdek 52%, Gnat 52%, Sos 4%) też się zgadzają.
- **OK, z uwagami: werdykty w tabeli celów nie są zaokrąglane na korzyść autora.**
  - „Blisko” przy Humanie na Opóźnieniu (5,6% wobec ~10%) i przy środku trasy (29% wobec ~35%) to łagodne słowa, ale oba braki stoją w „Czego nie osiągnąłem”.
  - „✓” przy szczycie drabinki (9/27 = 33%, cel ≥ 30%) przy n = 27 nie odróżnia wyniku od 25%.
- **NIE OK (drobne): przyczyna w nawiasie wiersza „walki Oracle w celu”.** Nawias i punkt „Czas walk” w brakach przypisują mediany ponad celem twardemu limitowi. Limit wyjaśnia to tylko na stacjach 1–3, gdzie między podłogą 144 s a celem 150 s zostaje 6 s. Na pozostałych podłoga leży głęboko w celu:

  | stacje | podłoga limitu | cel | mediana Oracle |
  |---|---:|---|---:|
  | 4–6 | 162 s | 150–180 s | do 202 s |
  | 7–8 | 180 s | 165–210 s | do 224 s |
  | Koluszki | 252 s | 240–300 s | 336 s |

  Tam Oracle po prostu nie bije na limicie przez całą walkę: unika, zmienia fazy, ma przerwy.
- **OK: liczebność ujawniona.** Uwaga „jeden run to 5–12 punktów procentowych” jest w tekście.
- **OK: „Human / Oracle” liczony tylko z wygranych.** Jest to napisane; przegrane, wolne walki Humana wypadają z porównania.

#### B. Czy symulacja to gra

- **OK: test zgodności z przeglądarką.**
  - `e2e/replay.spec.ts` przeszedł w CI na kodzie gry z `d77b086` (run 45870506114, job `check`).
  - Czerwony test blokuje deploy (`deploy: needs: checks`).
- **NIE OK, ale ujawnione: zakres tego dowodu jest wąski.**
  - Porównano tylko Widzew przez 0–75 s oraz Żakowice od 45. sekundy, z bossem w 1. fazie. W symulacji ten sam przypadek kończy się śmiercią w 115–142 s, przy bossie na 91–98% zdrowia.
  - Nie porównano: faz 2. i dalszych, śmierci bossa, ewolucji, kitingu, wydarzeń, Ostatniego pociągu, finału, Spokojnego, Opóźnienia, drabinki ani innych przeglądarek niż Chromium.
  - BALANCE.md pisze o tym wprost.
- **OK: Node 24 i Node 26 dają te same wyniki.**
  - 36 runów pomiaru `s` przeliczyłem lokalnie na Node 24, te same zadania co w shardach z Node 26:
    - Casual na Normalnie: Fabryczna i Widzew, 16 runów;
    - Human, plany A i K: Fabryczna, 20 runów, każdy po ok. 60 tys. rolloutów.
  - Wszystkie 36 rekordów jest identycznych bajt w bajt poza czasem wykonania: wynik, czasy, obrażenia, ślady, próbki tłumu, liczba rolloutów (`scripts/audit/nodecmp.mjs`).
  - Wszystkie bramki CI drukują na obu wersjach te same liczby.
  - Dawny „rozjazd Node” był rozjazdem dwóch definicji budżetu.
  - `Math.hypot` i ułamkowe `**` nie są przypięte w `libm`; w Node 24 `Math.hypot` nie jest poprawnie zaokrąglony (`scripts/audit/hypot.mjs`). Na tych danych nie dał jednak żadnej różnicy.
  - Liczby z Node 24 (rundy Red Teamu, ławki) odnoszą się więc do tej samej gry.
- **OK: rollouty nie zostawiają śladu.**
  - Run Oracle w Koluszkach nagrałem z samych żywych klatek i odtworzyłem bez bota w świeżym workerze:
    - na `af2c470`: 986 s, 75 158 rolloutów; hash całego stanu ten sam we wszystkich 986 sprawdzeniach;
    - na `d77b086`: 748,9 s, wygrana nokautem, 54 994 rollouty; ten sam hash we wszystkich 748 sprawdzeniach.
  - Human na Widzewie (`af2c470`) zgodny w 507 z 508 sprawdzeń. Jedyna różnica to pole `freeCase` w zapisie po wygranej, którego gra w trakcie runu nie czyta.
  - Kolejne zadania w tym samym workerze nie zmieniają rozgrywki.
- **NIE OK (drobne): bramka `snap` jest płytka.** W CI wykonuje 14 sprawdzeń, po 1–2 na stację, żadnego w walce z bossem. Opisane w tekście, ale brak go w „Czego nie osiągnąłem”.

#### C. Boty

- **OK: profile** zgadzają się ze specyfikacją i z tabelą w pliku.
  - Oracle: widzi wszystko, reakcja 0 s.
  - Human: reakcja 0,22–0,28 s, horyzont 0,5 s, 5% pomyłek.
  - Casual: wolniejszy, z większymi błędami, losowe karty.
- **OK: nie znalazłem osłabienia bota pod cel.** Jedyne osłabienie to `1b26507`: Oracle planuje lżej, gdy nic nie ma w pobliżu. W walce z bossem to nie działa.
- **OK: zmiany wzmacniające boty są ujawnione.** Sześć zmian wzmocniło boty, w tym:
  - `a7fdf35`: Casual wzmocniony zaraz po pomiarach z 0%, czyli przesunięcie przyrządu w stronę celu;
  - `ef7359e`: bot podchodzi do bossa na zasięg najdłuższej broni; weszło razem z mnożnikami gry broni, a obie zmiany pomagają krótkim broniom.
  - Wszystkie stoją w tabeli i w brakach.
- **OK, ujawnione: Human jest silniejszy od człowieka.** Jego rollouty grają prawdziwą przyszłość z generatorem losowym, więc widzi atak bossa przed telegrafem. Widzi też wszystko w promieniu 5 m i pamięta to 3 s.
- **NIE OK, ujawnione: „najlepszy build” jest z 24.11.**
  - Optymalizator działał na starym kodzie i z małym przeszukaniem.
  - Plan A dobrze wypada na tle 18 planów losowych: 28/90 = 31% wobec najlepszego losowego 6/18 = 33%. Nie jest to jednak dowód, że A to dziś najlepszy build.

#### D. Bossowie

- **OK: twardy limit obrażeń.**
  - `limitOverflow` 0, więc ponad pulę nie wchodzi nic.
  - Pula startuje od 0 i rośnie najwyżej o `rate` na sekundę. Walka trwa więc co najmniej 1,2 × minimum na każdym kursie, także na Spokojnym.
  - Wszystkie obrażenia bossa idą przez `Game.hitEnemy`. Bezpośrednio `hp` zapisują tylko `Enemies.hit`, leczenie wampirów i łyki Bartka (z `boss.restore`).
  - Test modelu sprawdza `limitOverflow === 0` i `limitMargin ≥ 1`: to wystarczy jako dowód arytmetyczny, choć kodu gry nie wywołuje.
- **OK: bramka `boss`.**
  - Na kodzie gry z `db3a3e9` przeliczyłem ją lokalnie; Node 24 daje to samo co CI.
  - Najszybsze walki: 154 / 150 / 147 / 165 / 169 / 169 / 183 / 186 / 274 s.
  - Podłogi limitu: 144 / 144 / 144 / 162 / 162 / 162 / 180 / 180 / 252 s.
  - Wszystkie OK. Najmocniejszy zestaw gra nieśmiertelny Oracle.
  - Job `balance-bots` w CI na `db3a3e9` jeszcze liczył (run 45873770085). Na `d77b086` anulowany; ostatni zielony był na `071c7dc`.
- **OK, ujawnione: skutki twardego limitu.**
  - Bramka `boss` nie może już paść bez błędu w kodzie.
  - Dobry build Humana i Oracle dobijają do tego samego sufitu, więc cel ×1,3–1,6 jest dla nich strukturalnie poza zasięgiem.
  - Obniżone zdrowie sześciu bossów działa tylko na buildy słabsze od limitu.
- **OK: reguły ataków.**
  - Worek ataków w fazie; zasada „nigdy trzeci raz z rzędu” po nazwie, z dobiciami i przez zmiany faz. Kombos fazy dodatkowej liczy się jak swój pierwszy atak.
  - Ogłuszenie bossa: najwyżej 1,5 s, potem 2 s odporności i krótsze ogłuszenia. Odporność przechodzi z bossem, gdy przesuwa się w puli.
  - Znacznik Kontroli trwa tyle, ile ogłuszenie naprawdę trwało.
  - Bramki faz: nadwyżka przepada, 2,5 s nietykalności.
  - Bariery Kierownika trzymają 2,5 m odstępu.
  - Fale z efektem `stun` naprawdę ogłuszają.
- **OK, ujawnione: zastrzeżenia do liczenia ataków.**
  - Wymogi „≥ 6 ataków” i „≥ 2 nowe w fazie” są spełnione tylko wtedy, gdy przywołanie minionów liczy się jako atak. Bez tego 7 z 9 bossów ma fazę z jednym nowym atakiem, a 5 bossów ma po 5 ataków.
  - Dwa „nowe” ataki fazy dodatkowej Opóźnienia to kombosy starych ataków.
  - Gołąb Matka nie ma ataku do przeskoczenia, tylko uderzenia i strefy do opuszczenia.
  - Ostrzeżenie liczy się raz, na starcie telegrafu: spowolnienie albo ogłuszenie, które przyjdzie później, go nie wydłuża; odwrócenie sterowania nie wydłuża go wcale.

#### E. Bronie

- **OK: budżet.**
  - Lokalnie i w CI każdy poziom mieści się w ±0,1% swojego budżetu (krzywa × mnożnik gry). Bramka CI na `db3a3e9` jest zielona: odchylenie 0,1%.
  - Na maksymalnym poziomie moc wynosi 85–115 (×1,35), ewolucje 127–173 (×1,35). Wymóg ±15% jest więc spełniony na samej granicy.
  - Krzywa daje +12,5% na poziom, ewolucja +50%.
  - CS mieści się w ±6% domyślnego pistoletu (AWP +2%, Desert Eagle −1%).
- **NIE OK: bramka CI przestała pilnować wspólnego pasma ±15%.**
  - Od `db3a3e9` bramka mierzy ±15% wokół budżetu z mnożnikiem gry.
  - Nic nie ogranicza samych mnożników (`PLAY` w `scripts/sim/curve.ts`) ani nie sprawdza mocy względem krzywej bez nich.
  - Broń mogłaby więc odpłynąć do 0,72–1,32 krzywej przy zielonym CI. Dziś stoi na 0,85–1,15, bo budżety dopasowano dokładnie.
  - Zielone CI osiągnięto zmianą tego, co bramka mierzy. Zmiana jest uczciwie opisana w „Bronie”, ale brakuje jej w „Czego nie osiągnąłem”.
  - Naprawa: test `|PLAY − 1| ≤ 0,15` albo drugie sprawdzenie względem krzywej.
- **OK: twarde limity są w kodzie.**
  - Szybkość ataku: jeden limit 0,6 na wszystkie źródła.
  - Krytyk: najwyżej 25%, ×1,75.
  - Najwyżej 8 pocisków w salwie, aura do 6 m, wybuch do 4 m, nic częściej niż co 0,15 s.
  - Zasięg zamachu Teczki i stożka Gwizdka oraz Kontroli nie ma twardego limitu; ogranicza go tylko maksimum Okularów i kawy.
- **OK: „broń sama”.**
  - Bramka CI: najdłużej 5 s. `scripts/sim/alone.ts` na 8 stacjach: najdłużej 9 s.
  - Bez dyrektora kempingu też 1–4 s, więc zabija tłum, nie fale za stanie.
  - W ruchu Parasol Burzowy wytrzymał 71–92 s (Red Team, runda 9; ujawnione).

#### F. CI

- **OK: obowiązkowe sprawdzenia są w CI.** CI zawiera wszystkie sprawdzenia ze specyfikacji §9: zgodność, exploity, minimum bossów, budżet, „broń sama”, widełki botów. Czerwony job blokuje deploy.
- **OK, ujawnione: widełki botów są szerokie i zbiorcze.** Human 10–60% łącznie, Casual na Normalnie 0–40%, 4 seedy na stację. Oracle ≥ 90%, szczyt drabinki, napięcie i udział broni nie są w CI.
- **NIE OK (drobne): CI nie rusza „przy każdym pushu”.** Rusza przy pushu do `main` i przy pull requeście, a nowszy push anuluje starszy run. `d77b086` nie dostał pełnego wyniku `balance-bots`.

#### G. Red Team

- **NIE OK, ujawnione: warunek „dwie czyste rundy z rzędu” nie został spełniony.**
  - Było 11 rund; czysta była tylko czwarta.
  - Ostatnie poprawki (`f1cefaf`, a po nich tylko przeliczenie budżetów w `d77b086`) sprawdzono specyfikacjami rundy 11, bez świeżej rundy.
- **OK: odpowiedzi pod raportami zgadzają się z kodem.** Raporty są wklejone bez zmian.

#### H. BALANCE.md: co jeszcze jest nieścisłe

Żadna z tych nieścisłości nie zmienia werdyktów i żadna nie działa na korzyść autora; to drobne poprawki.

1. **Wiersz „broń sama”** (i punkt w brakach) podaje „najdłużej 23 s” z rundy 10 na `071c7dc`. Dziś: 5 s w bramce CI, 9 s w `alone.ts`.
2. **„Przed i po”: exploity „najdłużej 89 s”** to liczba z rundy 6. Dziś bramka CI daje najdłużej 81 s.
3. **Wiersz minimum bossa „bramka CI `boss` OK”:** na kodzie z `d77b086` / `db3a3e9` job w CI jeszcze nie skończył. Przeszła moja lokalna, równoważna bramka (punkt D).
4. **Ścieżki:**
   - `.sim/randplans.mjs` → `scripts/measure/randplans.mjs`;
   - `PLAY` „w `scripts/sim/budget.ts`” → `scripts/sim/curve.ts`;
   - `.sim/sweep.sh` i `.sim/weapons-real.md` są poza repo (`.sim/` jest w `.gitignore`).
5. **„Bramka CI”:** `budget` sprawdza „±15% budżetu (krzywa × mnożnik gry)”, nie „±15% krzywej mocy”.
6. **Nawias o limicie w wierszu „walki Oracle w celu”** i punkt (1) w „Czas walk” przypisują limitowi więcej, niż wynika z liczb (punkt A).
7. **Akapit „Node 24 a Node 26”** można zamknąć: 36 z 36 runów pomiaru jest identycznych na obu wersjach (punkt B).

**Do „Czego nie osiągnąłem” brakuje dwóch rzeczy:**
- bramka CI nie pilnuje już wspólnego pasma ±15% budżetu (punkt E);
- bramka migawek nie sprawdza żadnej walki z bossem (punkt B).

Reszta braków jest wpisana wprost: udział broni, napięcie, Casual, czasy walk, stacje Humana, Oracle na Żakowicach, exploity, Red Team, ataki bossów, broń sama w ruchu, najlepszy build, zgodność z przeglądarką, boty mocniejsze niż na starcie, CI.

#### Werdykt końcowy

- **Przyrząd:** OK. Symulacja gra tę samą grę co Chromium na sprawdzonym zakresie i tę samą na Node 24 i 26. Boty nie zostały osłabione pod cel. Seedy wyniku są świeże. Wyniki da się odtworzyć z repo, a każda liczba w „Wynikach” zgadza się z surowymi runami.
- **Dokument:** OK, z drobnymi poprawkami z punktu H. Braki są nazwane wprost. Zastrzeżenia, które działają na korzyść autora, są ujawnione: przywołanie liczone jako atak, kombosy jako nowe ataki, Casual wzmocniony po 0%, nowa definicja bramki budżetu.
- **Gra wobec specyfikacji:** NIE OK.
  - Ok. 8 z 16 celów z §5–§7 jest spełnionych, kilka na granicy.
  - Pozostałe chybiają, a części (Human / Oracle, czasy walk Oracle) nie da się trafić przy obecnym projekcie limitu bez zmiany samego projektu.
  - Bot Human zawyża szanse prawdziwego gracza, więc rzeczywiste win rate będą raczej niższe niż w tabelach.
- **Wniosek:** praca jest rzetelnie zamknięta jako „z brakami”. Nie jest gotowa do wysłania jako spełniająca specyfikację.

**Po audycie** (poprawki z punktu H i E, bez zmian w kodzie gry):

- do bramki CI `budget` doszło sprawdzenie, że każdy mnożnik gry (`PLAY`) leży w ±15% krzywej, więc broń nie może już
  odpłynąć poza wspólne pasmo przy zielonym CI;
- poprawione liczby i ścieżki z punktu H (broń sama, exploity w bramce, ścieżki `scripts/measure/` i
  `scripts/sim/curve.ts`, opis bramki budżetu, przyczyna median Oracle ponad celem, zamknięty akapit o Node);
- bramka migawek bez walki z bossem dopisana do „Czego nie osiągnąłem”.

## Czego nie osiągnąłem

Wprost, bez zaokrągleń na swoją korzyść; liczby z pomiaru końcowego („Wyniki”), chyba że napisano inaczej.
Użytkownik zdecydował zamknąć pracę z tymi brakami zamiast dalej stroić („domknij z brakami”). Zgodnie z jego
zasadą („deploy na main dopiero, gdy wszystkie cele trafione”) nic z tej gałęzi nie poszło na `main`.

- **Udział broni.** Telefon jest w 48% wygranych (z nim wygrywa się 26% runów, bez niego 11%), Iskra w 40% i Kawa w
  38% (te dwie głównie dlatego, że są w wielu planach: ich win rate z bronią i bez jest podobny). Cel: żadna ponad
  ~30%. Mnożniki gry w budżecie (najwyżej ±15%) i trzy skrócenia zasięgu Telefonu zbiły go z 68%, ale nie do 30%.
  Dalsze osłabienie wymagałoby wyjścia poza ±15% budżetu albo zmiany mechaniki pioruna.
- **Napięcie (Human, Normalnie).** Cel: co najmniej 3 chwile z HP < 30% na run, wejście do bossa z 40–60% HP, ponad
  połowa czasu z wrogiem w promieniu 5 m. Jest: 1,07 chwili na run, mediana 83% HP przy bossie, wróg blisko przez 26%
  czasu. Runy Humana nie mają dołków, z których się wychodzi: albo pasek jest pełny (regeneracja po 5 s bez trafienia
  go dobija), albo tłum go zjada w kilka sekund i run się kończy. Trafienie w te trzy liczby naraz wymaga innego rytmu
  gry (dłuższe, słabsze kontakty, leczenie w trakcie walki), a nie mnożników.
- **Casual na Normalnie.** Cel: ok. 25% na 1. stacji. Jest: 0 z 72 runów, wszyscy giną przed bossem, w większości od
  gołębi i szczurów w pierwszych dwóch minutach. Żeby wygrywał co czwarty run, początek musiałby być tak łagodny, że
  exploity przeżyłyby 3 minuty, a Human wygrywałby za często.
- **Czas walk.** Twardy limit obrażeń trzyma każde minimum, ale ma swoją cenę: (1) najkrótsza możliwa walka to
  1,2 × minimum, co na stacjach 1–3 zostawia Oracle'owi tylko 144–150 s celu; na pozostałych mediany Oracle leżą ponad
  celem, bo nie bije on na limicie przez całą walkę (unika, zmienia fazy), np. Bartek 336 s przy celu 240–300 s; (2) dobry build
  Humana i Oracle dobijają do tego samego sufitu, więc walka Humana trwa tylko ×1,06–1,43 dłużej (cel ×1,3–1,6);
  (3) obniżone zdrowie sześciu bossów działa już tylko na buildy słabsze od limitu.
- **Stacje Humana.** Koluszki 35% (cel 15–20%) i Gałkówek 25% za łatwe, Żakowice 10% i Justynów 15% za trudne; środek
  trasy razem 29% (cel ~35%), Opóźnienie 6% (cel ~10%). Przy 20 runach na stację to w granicach szumu dla części stacji,
  ale nie dla Koluszek.
- **Oracle ≥ 90% na każdej stacji:** Żakowice 7/8 (87,5%).
- **Exploity.** Ślizg ze skokiem w miejscu, bez kierowania, przeżywa 3 minuty w ok. 1,5% runów (runda 11: 25 z 1656,
  najdłużej 243 s); kończy przy płocie i ginie przed bossem. Boty ucieczki (reagują na wrogów, więc według
  specyfikacji to nie exploity) przeżywały 3 minuty w ok. 10% runów w rundach 1–3. Na pomoście Widzewa wrogowie
  przechodzą przez styk dwóch bloków (runda 11). Bramka CI zna tylko 7 dawnych exploitów, a nie boty Red Teamu.
- **Red Team.** Specyfikacja chciała dwóch czystych rund z rzędu; czysta była tylko runda 4. Ostatnie poprawki
  (`f1cefaf`) sprawdziłem specyfikacjami rundy 11, bez świeżej rundy.
- **Ataki bossów.** „≥ 6 ataków” i „≥ 2 nowe w fazie” są spełnione tylko wtedy, gdy przywołanie minionów liczy się jako
  atak; dwa nowe ataki fazy dodatkowej Opóźnienia to kombosy starych ataków pod nowymi nazwami. Gołąb Matka nie ma
  ataku do przeskoczenia, tylko uderzenia i strefy do opuszczenia. Ostrzeżenie ataku liczy się raz, na starcie
  telegrafu: spowolnienie albo ogłuszenie, które przyjdzie później, go nie wydłuża; odwrócenie sterowania nie wydłuża
  go wcale.
- **Broń sama w ruchu.** Specyfikacja mówi o stojącym bocie (najdłużej 5 s w bramce CI, 9 s w `alone.ts`); z ruchem Red Teamu Parasol Burzowy
  przeżył 71–92 s w 3 z 5 runów na Fabrycznej (runda 9).
- **Najlepszy build.** Plany A i K to plan optymalizatora z 24.11 (przed mnożnikami gry, skróceniem Telefonu, nowym
  zdrowiem bossów i twardym limitem; małe przeszukanie) i plan Red Teamu. Nie wiem, czy to dziś najlepsze buildy, a cele
  Humana i Oracle są zdefiniowane dla najlepszego.
- **Zgodność symulacji z przeglądarką** jest dowiedziona tylko na dwóch przypadkach (Widzew 75 s, Żakowice z bossem
  w 1. fazie); reszta gry stoi na tym samym kodzie, ale bez testu. `Math.hypot` i `**` nie są przypięte w `libm`.
- **Boty mocniejsze niż na starcie.** Sześć zmian botów w tej gałęzi je wzmocniło (tabela w „Boty”), w tym Casual zaraz
  po pomiarach z 0% i podejście do bossa razem z mnożnikami gry broni; Human widzi w rolloutach przyszłe losowanie
  ataków bossa. Wyniki botów zawyżają więc szanse prawdziwego gracza.
- **CI.** Widełki botów są szerokie i zbiorcze (4 seedy na stację); Oracle ≥ 90%, szczyt drabinki, napięcie i udział
  broni nie są w CI. Bramka migawek (`snap`) robi 14 sprawdzeń, po 1–2 na stację, i żadnego w walce z bossem. CI rusza
  przy pull requeście i pushu do `main`, a nowszy push anuluje starszy run (część commitów nie dostała pełnego wyniku).
- **Budżet broni na granicy.** Mnożniki gry stawiają bronie na 0,85–1,15 krzywej, więc wspólne pasmo ±15% jest
  wykorzystane do końca; od audytu bramka CI pilnuje, żeby żaden mnożnik nie wyszedł poza nie.
