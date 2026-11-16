# Balans i trudność Piotrobonka

Ten plik zapisuje decyzje i liczby przebudowy trudności: dlaczego gra była za łatwa, co się zmieniło i jak to
mierzymy. Zasada nadrzędna: gra ma być wymagająca, ale uczciwa. Śmierć wynika z błędu gracza albo słabego
buildu, nigdy z ataku, którego nie dało się przeczytać.

## Stan prac (przerwane 2026-11-16)

Mechaniki z planu są w kodzie, strojenie liczb **nie jest skończone**. Pełny pomiar „przed” (10 800 runów)
został przerwany w połowie, a ostatnia runda strojenia (4) nie została zmierzona. Brakuje jeszcze: dokończenia
strojenia do celów, pomiaru drabinki szczebel po szczeblu, uruchomienia e2e, recenzji subagenta i deployu.
Bramka CI (`scripts/sim-ci.ts`) ma już widełki celów, więc do końca strojenia będzie czerwona.

### Ostatnie pomiary

Przed zmianami (stara gra, dobry bot, 12 seedów × 9 stacji): Normalnie **72%** wygranych, HP przy bossie 95%,
0,4 sytuacji z HP < 30% na run. Pancerz i regeneracja same w sobie podnosiły win rate o 6–15 pp (wariant bota
z buildem „pancerz + leczenie” wygrywał najczęściej), wszyscy wrogowie byli wolniejsi od gracza (najszybszy
gołąb 4,4 m/s przy 7,2 m/s gracza), więc ruch w kółko był bezpieczny.

Po zmianach, runda 3 (6 seedów × 9 stacji; po niej weszła runda 4: gęstszy początek, petarda 12, skok kota 11,
mnożnik obrażeń Normalnie 0,7, Spokojny 0,35):

| | AFK (czas) | słaby | średni | dobry |
|---|---:|---:|---:|---:|
| Normalnie | 119 s | 0% | 13% | 35% |
| Spokojny | 187 s | 17% | 70% | 61% |
| cel | < 90 s / < 180 s | < 10% | 30–35% / ~85% | 60–65% |

Na Normalnie najwięcej obrażeń dają gołębie (18–21%), race kibiców (7–12%), szczury, skoki dachowców i
petardy Janusza (po 6–11%). Boty giną głównie w 3.–8. minucie, czyli strojenie ma iść w środek runu.

## Jak mierzymy

Symulacja jest prawdziwym kodem gry, nie modelem: `scripts/sim.ts` buduje `src/` (Vite, tryb SSR) razem z cienką
atrapą przeglądarki (`scripts/sim/shim.ts`: DOM, canvas i WebGL to zaślepki, zegar ekranów i `setTimeout` idą
czasem gry) i gra runy na wątkach roboczych, bez rysowania, około 100 razy szybciej niż w czasie rzeczywistym.
Seedy to seedy Codziennego kursu z kolejnych dni od 2026-01-01; każda kombinacja (stacja × kurs × bot) dostaje te
same seedy, więc porównania są parami. Ten sam seed i te same wejścia dają zawsze ten sam run
(`node scripts/sim/determinism.ts`), także na tym samym wątku po innych runach.

```bash
node scripts/sim.ts --runs=100                    # pełny pomiar: 9 stacji × 3 kursy × 4 boty × 100 seedów
node scripts/sim.ts --runs=12 --kurs=normalnie --bot=good --drabinka=0,5,10,20
node scripts/sim.ts --runs=12 --bot=none --warianty=plik.json   # warianty bota na tych samych seedach
node scripts/sim/trace.ts widzew normalnie good 656369120 0.25  # jeden run z zapisem decyzji bota
node scripts/sim-ci.ts                            # szybka bramka CI (stałe seedy, widełki niżej)
```

Raport (`.sim/<nazwa>.md`) daje dla każdej kombinacji: win rate stacji, czas przeżycia (u AFK), HP przy wejściu
bossa, sytuacje z HP < 30% na run (nowa liczy się dopiero po powrocie powyżej 45%), obrażenia otrzymane i leczenie
na minutę, DPS gracza, czas walki z bossem, minutę pierwszej ewolucji, krzywe DPS gracza i HP wrogów co minutę,
udział broni i par broni w wygranych, źródła obrażeń i ostatnie ciosy.

### Boty

Cztery poziomy w `src/game/bot.ts`, wszystkie na tym samym kodzie, różnią się profilem:

| bot | reakcja | patrzy naprzód | widzi | karty | uniki |
|---|---|---|---|---|---|
| AFK | – | – | – | losowe | stoi w miejscu |
| słaby | 0,42 s | 0,35 s | ostrzeżenia na ziemi dopiero w ¾ czasu, nie widzi pocisków ani fal | losowe | brak, ±30° błędu kierunku |
| średni | 0,2 s | 0,6 s | ostrzeżenia, fale, promienie, pasy szarż, pociski z 4 m | nowe bronie, potem ulepszenia | bez ślizgu, skacze nad falą w 45% |
| dobry | 0,06 s | 1 s | wszystko, pociski z 14 m | plan pod ewolucję, nie zaniedbuje pancerza i leczenia | ślizg jako opcja ucieczki, skok nad falą w 90% |

Dobry bot ma też losowy (z seeda) gust do broni, żeby buildy się różniły: dzięki temu udział broni w wygranych
mówi o balansie broni, a nie o upodobaniach bota. Profil dobrego bota wybrałem z 10 wariantów na tych samych
seedach (`--warianty`): najwięcej dały ślizg jako opcja ucieczki (+7 pp), mniej zachowawcze przewidywanie
przechwyceń (+8 pp) i build z pancerzem i leczeniem (+6 pp).

Po drodze symulacja znalazła dwa prawdziwe błędy gry: nowy run dziedziczył po poprzednim ogłuszenie, magnes,
odwrócone sterowanie i malowany pas szarży bossa, a zapytania o wrogów w pierwszej klatce runu trafiały w hash
przestrzenny poprzedniego runu. Oba poprawione (`Game.start`, `Enemies.clear`).

## Zasady projektowe

1. **Mechanika przed cyferkami.** Najpierw nowe zachowania (wrogowie szybsi od gracza, rzucający, szarżujący,
   skaczący z góry, tarcze, dyrektor fal, wydarzenia), dopiero na końcu mnożniki HP i obrażeń.
2. **Krzywa runu.** Napięty początek (pierwsze fale są gęstsze, stanie w miejscu zabija w półtorej minuty),
   w środku fantazja mocy (bronie i ewolucje nie są osłabione w odczuciu, rośnie presja wrogów), na końcu fala
   i boss, które przechodzi tylko dobry build z dobrym ruchem, a „Ostatni pociąg” rozlicza DPS buildu.
3. **Zero rubber-bandingu od Normalnie w górę.** Dyrektor fal na Normalnie i wyżej zależy wyłącznie od seeda i
   zegara (długości faz losowane z seeda), nie od zdrowia gracza ani tłumu. Ten sam seed to ta sama gra, także w
   Codziennym kursie. Tylko na Spokojnym kursie dyrektor czyta zdrowie gracza i tłum: przy wysokiej intensywności
   kończy szczyt wcześniej i wydłuża przerwę (maksymalnie dwukrotnie), bo ten kurs ma wybaczać.
4. **Uczciwość.** Każdy atak ma telegraf, który da się przeczytać i przed którym da się uciec:
   - uderzenie bossa w miejsce gracza ostrzega co najmniej tak długo, ile trwa wybiegnięcie z niego przy 85%
     prędkości biegu (wcześniej Gołąb Matka trafiała kręgiem 6 m po 0,5 s ostrzeżenia, czyli nie do uniknięcia
     bez ślizgu), telegraf nigdy nie jest krótszy niż 0,3 s;
   - fale uderzeniowe bossów da się przeskoczyć (stopy wyżej niż 0,45 m nad ziemią, gdy fala przechodzi);
   - kibic świeci racą przez 1 s i świeci przy tym na pomarańczowo, kurier maluje pas i pulsuje na czerwono,
     kot przykuca, a miejsce lądowania jest zaznaczone przez cały skok;
   - zagrożenia spoza kadru mają strzałki na krawędzi ekranu (szarża, rzut, skok, elita, Nocne Kanary);
   - pociski wrogów mają ciemną obwódkę i świecą jaśniej niż ich kolor, czytelne na jasnym placu i nocą;
   - po trafieniu 0,6 s nietykalności (bez zmian), a pierwsze 0,3 s ślizgu przechodzi przez ciała wrogów
     (nie przez ataki), więc ścianę wrogów da się prześlizgnąć, a niską (szczury, paczki) przeskoczyć;
   - kontrola biletów otacza gracza czterema strefami z przerwami 2,7 m i wolnym środkiem 4 m. Pierwsza wersja
     z symulacji zamykała gracza bez wyjścia: poprawione, zanim trafiła do gry;
   - po śmierci ekran „Co cię zajebało”: ostatnie 5 trafień, kto, czym, ile i ile sekund przed końcem.

## Co się zmieniło

### Siła gracza (`src/game/progress.ts`, `TUNING.limits`)

- **Pancerz z malejącym efektem:** blok = 0,6 × a / (a + 0,45). Kurtka na 1. poziomie blokuje 8%, na 5. (35%
  pancerza) 26%, legendarna kurtka na maksa (84%) 39%, nieskończoność 60%. Wcześniej liniowo do limitu 60%,
  czyli dwie legendarne karty kurtki dawały prawie maksimum.
- **Limit skrócenia cooldownu:** ataki najwyżej o 38% częściej niż bazowo (mnożnik ≥ 0,62), niezależnie od
  Energetyka, kawy i rzadkości.
- **Miękkie limity szczęścia i zasięgu zbierania:** x / (1 + 0,7x) dla szczęścia, 1 + m / (1 + 0,6m) dla
  zasięgu. Pierwsze punkty działają w pełni, dziesiąty prawie wcale.
- **Rzadsze leczenie:** Kanapka od Mamy 0,2 HP/s na poziom (było 0,35) i bez mnożnika rzadkości (legendarna
  dawała 0,84 HP/s na poziom); kawa Inka 0,25 HP/s (było 0,5); Pączek z kosza z szansą 15% i za 20 HP (było 30%
  i 25); Zapiekanka za 20 HP (było 30); Kebab XXL 1 HP za zabójstwo i najwyżej 2 HP na sekundę (było 2 HP za
  każde zabójstwo bez limitu, czyli przy tłumie dziesiątki HP na sekundę).
- **Ewolucje najwcześniej od 3:30 / 4:30 / 5:00** (Spokojny / Normalnie / Opóźnienie): skrzynka przed tą minutą
  daje ulepszenia, a gracz dostaje komunikat, od kiedy ewolucja będzie gotowa.
- **Bilet bez ulgi** (karta ryzyka w stylu klątwy z Vampire Survivors, czerwona ikona): każdy z trzech poziomów
  to +15% wrogów i ich zdrowia, a w zamian +21% butelek i doświadczenia. Zajmuje miejsce na pasywkę, więc to
  świadomy wybór.

### Wrogowie i fale (`src/game/director.ts`, `src/game/enemies.ts`, `src/content/enemies.ts`)

- **Dyrektor fal** (jak AI Director z Left 4 Dead): cykl budowanie → szczyt → wygaszenie → oddech, długości faz z
  seeda. Na szczycie spawn ×1,5 (Normalnie), na oddechu ×0,4. Każdy szczyt otwiera wzór, którego zwykły
  strumień nie robi: pierścień zamykający się wokół gracza (jak w Vampire Survivors), ściana wrogów w poprzek
  drogi (szczury do przeskoczenia albo ciała do prześlizgnięcia), grupa prosto przed graczem, stado z boku.
- **Spawny przed kierunkiem biegu:** 30% grup pojawia się 17–23 m przed graczem, gdy biegnie. Bieganie w kółko
  po arenie przestało być bezpieczną pętlą.
- **Nowe archetypy**, każdy z telegrafem i w klimacie linii 17:
  - *Spóźniony pasażer* (sprinter): biegnie 7,8 m/s, szybciej niż gracz (7,2 m/s), przez 2,4 s, potem przez
    1,3 s łapie oddech. Ruch, ślizg i bunny hop naprawdę mają znaczenie.
  - *Kibic z racą* (strzelec): zatrzymuje się 9 m od gracza, podnosi racę na 1 s (świeci), rzuca tam, gdzie gracz
    stał. Krok w bok to unik.
  - *Kurier na hulajnodze* (szarża z telegrafem): z 11 m staje, maluje czerwony pas na 0,9 s, rusza 15 m/s.
  - *Paczkomat na nóżkach* (dzieli się): rozbity rozsypuje się na trzy szybkie paczki.
  - *Ochroniarz z tarczą*: tarcza od frontu bierze 80% trafienia (niebieskie iskry i brzęk), z boku, od tyłu i z
    góry (pioruny, kałuże, iskry z trakcji) nie chroni.
  - *Brygadzista z megafonem* (buff): trzyma się za tłumem, wrogowie w promieniu 7 m (żółty krąg) biegną 1,3×
    szybciej i dostają 30% mniej.
  - *Janusz z petardą*: po śmierci zostawia petardę, która po 0,9 s wybucha w zaznaczonym kręgu 2,6 m.
  - *Dachowiec* (skoczek z góry): przykuca i skacze łukiem tam, gdzie gracz stał, także na dach i peron.
    Dach i skok przestały być bezpieczną strefą; miejsce lądowania widać przez cały lot.
- **Elity z afiksami** (jak w Diablo): Szybki (1,5× prędkości), Pancerny (połowa obrażeń, odporny na odrzut),
  Wampir (leczy się 20% zdrowia za każde trafienie gracza i regeneruje 1,5% na sekundę), Wybuchowy (po śmierci
  krąg 3,4 m), Teleportujący (co 4,5 s pojawia się obok gracza, 0,6 s fioletowego ostrzeżenia), Przywoływacz
  (co 6 s woła trzech pomocników). Elita to już nie zawsze najtwardszy typ, tylko losowy z wytrzymalszych.
  Na Spokojnym i Normalnie jeden afiks, na Opóźnieniu 120 min dwa, na drabince dwa albo trzy. Każdy afiks pulsuje
  pod elitą swoim kolorem, a jej nazwa z afiksami jest w komunikacie i na ekranie śmierci.
- **Wydarzenia o stałych minutach** (zapowiedziane 3 s wcześniej): 2:15 nalot gołębi (18 gołębi naraz ze
  wszystkich stron, 1,2× szybszych), 3:35 kontrola biletów (cztery strefy kontroli z przerwami i czterech
  kanarów), 4:50 horda złomiarzy (dwunastu z jednej strony i 18 butelek do wyścigu).
- **„Ostatni pociąg”**: jeśli boss nie padnie w 240 / 150 / 135 s walki (Spokojny / Normalnie / Opóźnienie),
  co 5 s przychodzi coraz większa fala Nocnych Kanarów. Są nieśmiertelne i przyspieszają z 6,2 do 9,6 m/s, więc
  w końcu zabijają. HUD odlicza czas do odjazdu, a po nim miga „Nocne Kanary!”. To test DPS buildu, jak
  finałowy rój w Megabonku.
- **Początek gęstszy** (0,9 grupy/s na starcie zamiast 0,6, 1,35 w 45. sekundzie zamiast 1,05), środek łagodniejszy
  (obrażenia wrogów rosną o 7,5% na minutę zamiast 9%), gołębie trochę rzadsze (waga 4 zamiast 5).

### Bossowie (`src/game/boss.ts`, `TUNING.boss`)

- Telegrafy skalowane kursem: Spokojny 1,25×, Normalnie 1×, Opóźnienie 0,85×, drabinka od „Bartek pije podwójne
  espresso” jeszcze 0,85×, ale zawsze z regułą ucieczki i minimum 0,3 s.
- **Dodatkowa faza** od Opóźnienia 120 min (i na drabince od espresso): od 15% zdrowia ataki ostatniej fazy
  plus najmocniejszy atak każdej wcześniejszej, 1,15× szybszy boss, przerwy krótsze o ćwierć i jego ostatnie
  słowo („TERMIN PRZESUNIĘTY NA 2035”).
- **Miniony:** co 16 s czterech wrogów wokół bossa (z ostrzegawczym kręgiem).
- **Wściekłość** po 100 s walki: przerwy ×0,7, boss 1,25× szybszy, baner „WŚCIEKŁOŚĆ”.
- **Atak wymagający ruchu** ma każdy boss: fale da się przeskoczyć, uderzenia i strefy trzeba opuścić, szarże
  ominąć, promienie obiec.
- **Bartek D.** na Opóźnieniu i od espresso: 1,5× więcej lemurów i 1,3× szybszych, łyk kopi luwak leczy 2×
  mocniej, w fazie 3 co 6 s kawa rozlewa się po parkingu jako strefy spowalniające i parzące, a okno liścia
  ma 10% paska zamiast 14%. Na Spokojnym odwrotnie: mniej i wolniejszych lemurów, słabsze łyki, okno 18%.

### Poziomy trudności (`src/content/difficulty.ts`, `src/ui/departures.ts`, `src/core/save.ts`)

- **Spokojny kurs** (do fabuły, wybacza), **Normalnie** (domyślny, ten, który projektuję), **Opóźnienie 120 min**
  (dla ogarniętych). Każdy z opisem na ekranie trasy, co dokładnie robi.
- **Drabinka opóźnień** otwiera się po pierwszym dojeździe do Koluszek: 20 szczebli od „+15 min” do „+5 h”. Każdy
  szczebel to Normalnie plus jeden czytelny modyfikator, a wcześniejsze dalej obowiązują (jak Ascension w Slay
  the Spire). Następny szczebel otwiera pokonanie bossa dowolnej stacji na poprzednim. Wybiera się go na
  tablicy odjazdów PKP (odjazd, kierunek, opóźnienie, uwagi).
- **Nagrody:** butelki ×0,8 / ×1 / ×1,5 (kursy), na drabince +0,08 za szczebel (+5 h: ×2,6); klucz na koszt PKP
  (skrzynka kosztuje wtedy tylko 10 butelek) za pierwsze pokonanie każdego szczebla i za pierwszą stację na
  Opóźnieniu; osiem osiągnięć; tytuły („Pasażer z ulgą” … „Kursowy po ODWOŁANYM”) i ramki w Dzienniku; najwyższe
  pokonane opóźnienie z tytułem i ramką na karcie udostępniania wyniku. Szanse w skrzynkach CS bez zmian.
- **Codzienny kurs:** zawsze Normalnie i jeden modyfikator z drabinki (bez nocy), wybrany z dnia, taki sam dla
  wszystkich. Stacja dnia się nie zmieniła; linki z wynikami z wcześniejszych wersji dalej się otwierają.
- **Migracja zapisu (v4 → v5):** wszystko zostaje, wybór kursu też; kto już dojechał do Koluszek, ma od razu
  otwarty pierwszy szczebel.
