# Balans i trudność Piotrobonka

Ten plik zapisuje decyzje i liczby przebudowy trudności: dlaczego gra była za łatwa, co się zmieniło i jak to
mierzymy. Zasada nadrzędna: gra ma być wymagająca, ale uczciwa. Śmierć wynika z błędu gracza albo słabego
buildu, nigdy z ataku, którego nie dało się przeczytać.

## Wyniki

### Zmiana podejścia (po pierwszym graniu na żywo)

Strojenie pod win rate bota było złą miarą: bot gra słabiej od człowieka, więc gra „trudna dla bota” (dobry bot
~65% na Normalnie) była dla gracza za łatwa, a bronie siekły wszystko. Słabe bronie podciągałem w górę, zamiast
ściągać mocne w dół, i trzymałem wynik gęstością fal: wyszedł ekran czyszczony w ułamku sekundy. Teraz bronie
stroję po **liczbie trafień potrzebnych na wroga** (osobno, bez bota), a bot jest tylko kontrolą, że da się
wygrać i że stanie w miejscu przegrywa:

- każda broń atakuje o 30% rzadziej i bije o 15% słabiej, limit przyspieszenia ataków to 28% (było 38%),
  Gnat z CS strzela najwyżej ok. 2 razy na sekundę (było ponad 3);
- mniej celów naraz: piorun telefonu przeskakuje na najwyżej 6 wrogów (było 9), Powerbank 2 × 5 (było 3 × 9),
  Parasol burzowy 4 parasole (było 7), Sieć trakcyjna 5 iskier (było 8), mniej biletów, puszek, iskier i kartek;
- zwykli wrogowie mają półtora raza więcej zdrowia: szczur w pierwszej minucie potrzebuje dwóch zamachów teczką,
  robotnik w połowie runu trzech, czterech trafień z rozwiniętej broni; za to fal jest o jedną czwartą mniej, a
  poziomy przychodzą za mniej doświadczenia (to samo tempo awansów przy mniejszej liczbie zabójstw);
- walka z bossem trwa około minuty, a nie 20–30 s: zdrowie bossów ×0,8 / ×1,9 / ×2 (Spokojny / Normalnie /
  Opóźnienie), żeby było widać wszystkie fazy, a wściekłość po 2 minutach i Ostatni pociąg miały znaczenie.
  Dobry bot bije bossa na Normalnie 53 s, średni 59 s (wcześniej 21–27 s); Spokojny ma słabszych wrogów (×0,75).

- **Bez zalewu i pustki.** Po osłabieniu broni tempo spawnu zostało z czasów mocnych broni: tłum rósł do 240 wrogów
  w półtorej minuty, a potem rozkręcony build czyścił go do kilkudziesięciu (pustka). Do tego dyrektor fal miał
  szczyt ×2,2 i oddech ×0,2. Teraz spawn jest o ok. 60% rzadszy, szczyt ×1,6, oddech ×0,6, a pod falami jest
  podłoga: przy mniej niż 8 + 6 na minutę żywych wrogów (do 50) grupa przychodzi od razu. Na planszy jest stale
  30–70 wrogów, z krótkimi szczytami do ok. 150.

- **Naprawdę trudno (po kolejnym graniu: boss padał w 13 s, „gra dla dzieci”).** Bossowie ×3 zdrowia na
  Normalnie i ×3,3 na Opóźnieniu (na stronie było ×0,75: to, co padało w 13 s, teraz wytrzymuje ok. 50 s), wrogowie
  biją o połowę mocniej (Normalnie ×1,5, Opóźnienie ×1,9), zdrowie wrogów rośnie o 22% na minutę, pączek wypada
  z kosza w 20% (było 28%). Autobus na rozpędzie przejeżdża na śmierć jednym trafieniem, bez względu na pancerz
  (na Spokojnym tylko boli), za to ma 360 HP zamiast 520, żeby dało się go rozbić, zanim zrobi kilka szarż.
  Bot przy tym: dobry 8% na Normalnie, średni 6%, Spokojny średni 67%. Bot jest tu tylko dowodem, że da się
  wygrać; trudność stroi granie człowieka.

Bot po tej zmianie (bramka CI, 36 runów): Spokojny średni ok. 70–80%, Normalnie dobry 14–17% i średni 8–14%,
Opóźnienie dobry 11–14%, AFK ginie po 67 s. Tabele niżej są sprzed tej zmiany i zostają jako zapis drogi.

Pomiar końcowy: 12 seedów dziennych × 9 stacji = 108 runów na komórkę (błąd standardowy win rate ok. 4–5 pp),
ten sam bot i te same seedy przed zmianami (stara gra z gałęzi `main`, 8 seedów, 72 runy) i po nich.

| kurs | bot | przed | po | cel |
|---|---|---:|---:|---|
| Spokojny | AFK (średni czas życia) | 225 s | 124 s | < 180 s |
| Spokojny | słaby | 53% | 25% | – |
| Spokojny | średni | 86% | 92% | ~85% |
| Spokojny | dobry | 94% | 95% | – |
| Normalnie | AFK | 117 s | 74 s | < 90 s |
| Normalnie | słaby | 11% | 0% | < 10% |
| Normalnie | średni | 47% | 28% | 30–35% |
| Normalnie | dobry | 49% | 67% | 60–65% |
| Opóźnienie 120 min | AFK | 71 s | 67 s | – |
| Opóźnienie 120 min | średni | 24% | 6% | – |
| Opóźnienie 120 min | dobry | 36% | 35% | 25–30% |

Najważniejsze, co pokazuje tabela: w starej grze dobry i średni gracz wygrywali na Normalnie prawie tak samo
(49% i 47%), w nowej różnica to 39 pp. O wyniku decyduje ruch i build, nie szczęście w kartach.

Pozostałe cele na Normalnie (średni i dobry bot razem):

| miara | przed | po | cel |
|---|---:|---:|---|
| HP przy wejściu bossa | 76–83% | 70–77% | 50–70% |
| sytuacje z HP < 30% na run | 0,7 | 0,6–1,0 | ≥ 2 |
| obrażenia otrzymane na minutę (dobry bot) | 24 | 26 | – |
| leczenie na minutę (dobry bot) | 9 | 13 | – |
| czas walki z bossem (dobry bot) | 50 s | 27 s | – |
| pierwsza ewolucja (dobry bot) | 5:36 | 5:18 | od 4:30 |
| broń w wygranych dobrego bota (najczęstsza) | 40% | 40% (sos) | ~30% |
| win rate z daną bronią (rozrzut między broniami) | 35–68% | 59–76% | – |

**Czego nie osiągnąłem:** dwóch sytuacji z HP < 30% na run. Średnio jest jedna na run średniego bota i 0,6 u
dobrego. Próbowałem ostrzejszych szczytów fal (×2,6 zamiast ×2,2) z cichszym oddechem i większą szansą na
pączka: zamiast odbić od dna wychodziło więcej śmierci (średni bot z 32% na 22%), a sytuacji z niskim HP nie
przybyło. Bot przy niskim HP gra ostrożniej i leczy się z ziemi, więc dołki są rzadkie, ale kończą się
śmiercią częściej niż odbiciem. To pierwsza rzecz do sprawdzenia w grze na żywo: czy runy są dość nerwowe.
Udział najczęstszej broni (40%) jest nad celem, ale to blisko tego, ile wynosi samo losowanie (trzy wolne sloty
na dziesięć broni to ok. 30% runów na broń), a win rate z każdą bronią mieści się w 59–76% przy średniej 67%:
żadna broń nie wygrywa sama i żadna nie jest bezużyteczna (w starej grze parasol 35%, kawa 68%).

### Drabinka opóźnień (dobry bot, Normalnie)

Najpierw każdy modyfikator osobno, na samym Normalnie (4 seedy × 9 stacji = 36 runów, bez modyfikatora 58%):

| modyfikator | wygrane | | modyfikator | wygrane |
|---|---:|---|---|---:|
| Przepełniony skład (fale +30%) | 36% | | Prace torowe | 53% |
| Elity z podwójnym afiksem | 42% | | Sezon na gołębie, Kontrola w każdym wagonie, Elity z potrójnym afiksem | 56% |
| Automaty zepsute | 42% | | Brak klimy, Awaria biletomatu, Espresso, Twarde siedzenia, Ostatni pociąg wcześniej, ODWOŁANY | 58% |
| Kanar na każdej stacji, Bez ulgi, Zepsuty rozkład | 47% | | Godzina szczytu, Tłok na peronie | 61% |
| Ostry hamulec | 50% | | Pociąg skrócony | 69% |

Pierwsza kolejność (od pomysłu, nie z pomiaru) dawała 64% → 22% już na drugim szczeblu, potem wzrost i płaskie 6%
na końcu. Teraz ciężkie modyfikatory przychodzą co dwa, trzy szczeble, przeplatane lekkimi, a Przepełniony skład
ma +15% zamiast +30%. Noc (ODWOŁANY), brak klimy i biletomatu prawie nie ruszają bota, który widzi wszystko i nie
liczy na regenerację, ale człowiek je poczuje. Pociąg skrócony botowi pomaga (tłum szybciej wchodzi w zasięg
broni): stoi pod koniec drabinki, gdzie inne modyfikatory to przykrywają; do poprawienia w mechanice.

| szczebel | 0 | +30 min | +1 h | +1 h 30 | +2 h | +2 h 30 | +3 h | +3 h 30 | +4 h | +4 h 30 | +5 h |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| wygrane (36 runów) | 58% | 50% | 58% | 47% | 50% | 22% | 25% | 14% | 3% | 6% | 8% |

Trend spada od 58% do 8% i ODWOŁANY zostaje powyżej zera. Przy 36 runach na szczebel różnice do ok. 8 pp to szum.
Jedyny wyraźny skok zostaje na +2 h 30 (Elity z podwójnym afiksem: elita szybka i wampir naraz to dla dobrego
bota najczęstsza śmierć na drabince); to następny kandydat do złagodzenia.

## Diagnoza: co było nie tak ze starą grą

Pomiar starej gry tym samym botem i na tych samych seedach co nowej (tabela wyżej) pokazał, że problem nie
był w samym poziomie trudności, tylko w tym, od czego zależał wynik:

- **Umiejętność nie miała znaczenia.** Na Normalnie dobry bot wygrywał 49%, średni 47%. Run do bossa był
  bezpieczny (HP przy wejściu bossa 76–83%, mniej niż jedna sytuacja z HP < 30% na run), bo wszyscy wrogowie
  byli wolniejsi od gracza (najszybszy gołąb 4,4 m/s przy 7,2 m/s), nikt nie atakował z dystansu i nie
  pojawiał się przed graczem. Kto biegł, ten nie obrywał.
- **Wynik zależał od broni.** Ta sama stara gra z botem, który wie, że bilet i kawa są przegięte (tabela siły
  broni z ławki starej gry), dawała 80% wygranych zamiast 49%. Najlepsza broń zadawała 7,6× tyle, co najsłabsza:
  sos i parasol nic nie dawały, bilet i kawa same niosły run.
- **Pancerz i regeneracja skalowały się liniowo.** Dwie legendarne kurtki dawały prawie maksimum bloku, a
  legendarna kanapka 0,84 HP/s na poziom. Kebab XXL leczył 2 HP za każde zabójstwo bez limitu, czyli dziesiątki
  HP na sekundę w tłumie.
- **Ginęło się u bossa, i to nieuczciwie.** Prawie połowa botów, które doszły do bossa, przegrywała walkę
  (86 s średnio u średniego bota), często od ataków bez szans na unik, jak krąg Gołębia Matki 6 m po 0,5 s
  ostrzeżenia.

## Jak mierzymy

Symulacja jest prawdziwym kodem gry, nie modelem: `scripts/sim.ts` buduje `src/` (Vite, tryb SSR) razem z cienką
atrapą przeglądarki (`scripts/sim/shim.ts`: DOM, canvas i WebGL to zaślepki, zegar ekranów i `setTimeout` idą
czasem gry) i gra runy na wątkach roboczych, bez rysowania, około 100 razy szybciej niż w czasie rzeczywistym.
Seedy to seedy Codziennego kursu z kolejnych dni od 2026-01-01, zmieszane ze stacją (każdy przystanek danego dnia
ma własne karty i spawny; wcześniej dziewięć stacji jednego dnia losowało to samo i cztery dni były czterema
próbkami, a nie 36). Każda kombinacja (stacja × kurs × bot) dostaje te same seedy, więc porównania są parami.
Ten sam seed i te same wejścia dają zawsze ten sam run (`node scripts/sim/determinism.ts`), także na tym samym
wątku po innych runach.

```bash
node scripts/sim.ts --runs=12                     # pełny pomiar: 9 stacji × 3 kursy × 4 boty × 12 seedów (~15 min)
node scripts/sim.ts --runs=8 --kurs=normalnie --bot=good --drabinka=0,5,10,20
node scripts/sim.ts --runs=8 --bot=none --warianty=plik.json   # warianty bota na tych samych seedach
node scripts/sim/weapons.ts                       # ławka broni: każda broń osobno, maks. poziom, prawdziwy tłum
node scripts/sim/trace.ts widzew normalnie good 656369120 0.25  # jeden run z zapisem decyzji bota
node scripts/sim-ci.ts                            # szybka bramka CI (stałe seedy, widełki niżej, ~3 min)
```

Raport (`.sim/<nazwa>.md`) daje dla każdej kombinacji: win rate stacji, czas przeżycia (u AFK), HP przy wejściu
bossa, sytuacje z HP < 30% na run (nowa liczy się dopiero po powrocie powyżej 45%), obrażenia otrzymane i leczenie
na minutę, DPS gracza, czas walki z bossem, minutę pierwszej ewolucji, krzywe DPS gracza i HP wrogów co minutę,
udział broni i par broni w wygranych, źródła obrażeń i ostatnie ciosy. Przy 144 runach na kombinację błąd
standardowy win rate to około 4 pp; decyzje strojenia zapadały na takich próbach, nie na szybkiej bramce.

### Boty

Cztery poziomy w `src/game/bot.ts`, wszystkie na tym samym kodzie, różnią się profilem:

| bot | reakcja | patrzy naprzód | widzi | karty | uniki |
|---|---|---|---|---|---|
| AFK | – | – | – | losowe | stoi w miejscu |
| słaby | 0,42 s | 0,35 s | ostrzeżenia na ziemi dopiero w ¾ czasu, nie widzi pocisków ani fal | losowe | brak, ±30° błędu kierunku |
| średni | 0,2 s | 0,6 s | ostrzeżenia od 30% ich czasu, fale, promienie, pasy szarż, 4 najbliższe pociski | nowe bronie, potem ulepszenia, potem kanapka i kurtka | bez ślizgu, skacze nad falą w 45% |
| dobry | 0,06 s | 0,5 s | wszystko od pierwszej klatki, 14 pocisków | wszystkie sloty broni, ulepszenia, pasywka do ewolucji, potem leczenie i pancerz | ślizg jako opcja ucieczki, skok nad falą w 90% |

**Kalibracja dobrego bota.** Pierwsza wersja dobrego bota przegrywała ze średnim (50% wobec 64% na Normalnie), co
podważało każdy pomiar. Warianty na tych samych 72 seedach, każdy zmieniający jedną rzecz, pokazały trzy przyczyny:

- **Za długi horyzont.** Patrzenie 1 s naprzód z założeniem, że każdy wróg może dobiec połowę swojej drogi,
  czyniło każdy kierunek w tłumie „niebezpiecznym” i bot przestawał je rozróżniać. 0,5 s i jedna czwarta drogi:
  +17 pp.
- **Zła wiedza o broniach.** Bot ładował poziomy w bronie najlepsze na ławce (bóg, tłum ×3), a te nie były
  najlepsze w prawdziwym runie. Bez tej tabeli (gust losowy, bronie są wyrównane): +24 pp na Opóźnieniu.
  Pomiar kart: w runie trwającym sześć minut nowa broń daje więcej niż ulepszenie, ulepszenie więcej niż
  pasywka, a z pasywek leczenie i pancerz wygrywają więcej niż obrażenia.
- **Za późno widziane ostrzeżenia.** Bot liczył zaznaczony krąg (petarda, lądowanie dachowca) dopiero, gdy
  wybuch mieścił się w horyzoncie, czyli w ostatnich 0,5 s. Teraz krąg liczy się od chwili namalowania: +13 pp.

Po kalibracji dobry bot wygrywa ze średnim wyraźnie na każdym kursie (tabela wyników), a jego śmierci to
w większości kontakt z tłumem i ataki wymagające ruchu w złym momencie, czyli to, czego oczekujemy od gry.

## Zasady projektowe

1. **Mechanika przed cyferkami.** Najpierw nowe zachowania (wrogowie szybsi od gracza, rzucający, szarżujący,
   skaczący z góry, tarcze, dyrektor fal, wydarzenia), dopiero na końcu mnożniki HP i obrażeń. Gdy mnożnik był
   potrzebny, to po to, żeby Normalnie było po prostu bazowymi liczbami gry (×1), a pozostałe kursy odchyleniem.
2. **Krzywa runu.** Napięty początek (pierwszy szczyt fali to zawsze pierścień, a kibice rzucają od 70. sekundy:
   stanie w miejscu zabija), w środku fantazja mocy z rosnącą presją, na końcu boss, które przechodzi tylko
   dobry build z dobrym ruchem, a „Ostatni pociąg” rozlicza DPS buildu.
3. **Zero rubber-bandingu od Normalnie w górę.** Dyrektor fal na Normalnie i wyżej zależy wyłącznie od seeda i
   zegara (długości faz losowane z seeda), nie od zdrowia gracza ani tłumu. Ten sam seed to ta sama gra, także w
   Codziennym kursie. Tylko na Spokojnym kursie dyrektor czyta zdrowie gracza i tłum: przy wysokiej intensywności
   kończy szczyt wcześniej i wydłuża przerwę (maksymalnie dwukrotnie), bo ten kurs ma wybaczać.
4. **Trudniej znaczy trudniej.** Żaden modyfikator trudności nie może dawać więcej nagrody niż zagrożenia
   (pomiar drabinki to wyłapał, niżej).
5. **Uczciwość.** Każdy atak ma telegraf, który da się przeczytać i przed którym da się uciec:
   - uderzenie i strefa bossa w miejscu gracza ostrzegają co najmniej tak długo, ile trwa wybiegnięcie z nich przy
     85% prędkości biegu (wcześniej Gołąb Matka trafiała kręgiem 6 m po 0,5 s ostrzeżenia, a strefy Kanara Prime,
     Kierownika i Megafonu gryzły po 0,5 s, czyli nie do uniknięcia bez ślizgu), telegraf nigdy nie jest krótszy
     niż 0,3 s;
   - nic nie pojawia się graczowi pod nogami: spawn fali najbliżej 12 m (przy płocie bierze drugą stronę, a wzór
     przecięty płotem traci tę stronę zamiast tłoczyć się przy graczu), a przywołani (miniony bossa, pomocnicy
     Przywoływacza) i paczki z rozbitego paczkomatu przez pierwsze 0,7 / 0,45 s stoją oszołomieni i nie ranią;
   - ogłuszenie przerywa przygotowanie rzutu, szarży i skoku, a raca zatrzymuje się na ścianie (osłona działa);
   - fale uderzeniowe bossów da się przeskoczyć (stopy wyżej niż 0,45 m nad ziemią, gdy fala przechodzi);
   - kibic świeci racą przez 1 s i świeci przy tym na pomarańczowo, kurier maluje pas i pulsuje na czerwono,
     kot przykuca, a miejsce lądowania jest zaznaczone przez cały skok;
   - zagrożenia spoza kadru mają strzałki na krawędzi ekranu (szarża, rzut, skok, strefy kontroli biletów, strona
     hordy złomiarzy, elita, najwyżej dwie dla Nocnych Kanarów), ważniejsze pierwsze i nigdy na pasku zdrowia;
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
- **Leczenie przeniesione z pasywek na podnoszenie z ziemi:** Kanapka od Mamy 0,2 HP/s na poziom (było 0,35) i
  bez mnożnika rzadkości; kawa Inka 0,25 HP/s (było 0,5); Kebab XXL 1 HP za zabójstwo i najwyżej 2 HP na
  sekundę. W zamian Pączek z kosza wypada z szansą 28% i leczy 25 HP, a każda elita zostawia pączka za 30 HP:
  powrót z niskiego zdrowia trzeba sobie wybiec i wywalczyć, a nie odstać. Zapiekanka (karta zastępcza) 20 HP.
- **Ewolucje najwcześniej od 3:30 / 4:30 / 5:00** (Spokojny / Normalnie / Opóźnienie): skrzynka przed tą minutą
  daje ulepszenia, a na ekranie pojawia się komunikat, za ile ewolucja będzie gotowa.
- **Bez karty ryzyka.** „Bilet bez ulgi” (więcej wrogów za więcej doświadczenia) wyleciał: przy dobrym ruchu
  dodatkowe XP zamieniało się w siłę szybciej, niż rosło zagrożenie, więc karta tylko ułatwiała grę.

### Bronie (`src/content/items.ts`, `node scripts/sim/weapons.ts`)

Ławka broni gra każdą broń osobno, na maksymalnym poziomie, od 4. do 6. minuty w prawdziwym tłumie (gracz
nieśmiertelny, wrogowie z czterokrotnym zdrowiem, żeby mierzyć obrażenia, a nie to, ile wrogów zdąży podejść).
W starej grze najlepsza broń zadawała 7,6× tyle, co najsłabsza; teraz każda bazowa broń mieści się w 0,75–1,5×
mediany, a ewolucje w podobnym pasie między sobą. Potem udział w wygranych dobrego bota (prawdziwe runy)
skorygował to, czego ławka nie widzi (zasięg, ruch, bossowie):

| broń | było (obrażenia / cooldown) | jest | dlaczego |
|---|---|---|---|
| Teczka | 15 / 0,9 s | 26 / 0,8 s, zasięg 3,6 | broń startowa nie zabijała pierwszej fali |
| Bilet | 26 / 1,2 s | 10 / 1,3 s | przebijające bilety same niosły run |
| Kawa | 8 / 2,1 s | 5 / 2,3 s | kałuże kumulowały się w tłumie |
| Sos | 5 / 0,45 s, 2,2 m | 15 / 0,35 s, 3,7 m | aura nie sięgała poza ciało gracza |
| Telefon | 26 / 1,1 s | 20 / 1,15 s | pioruny łańcuchowe: 80% wygranych z nim |
| Parasol | 9 / 0,5 s, 1 parasol | 21 / 0,45 s, 2 parasole | orbita za blisko i za słaba |
| Gwizdek | 18 / 2,6 s | 44 / 1,9 s | stożek bez znaczenia |
| Puszka | 22 / 2,2 s | 17 / 2,2 s | odrzut i obszar wystarczały |
| Gnat z CS | 16, bez przebicia | 19, przebija 1 | po wzmocnieniu 91% wygranych z nim, więc z powrotem w dół (mniejsze ulepszenia) |
| Iskra | 20 / 2 s | 19, większy obszar | wyrównana z resztą |
| Rozkład | leciał w kierunku biegu | leci w najbliższego wroga | gracz zwykle biegnie od tłumu, więc kartki leciały w pustkę |

Ewolucje dostały to samo: Bilet sieciowy z 109 na 60, Espresso z 26 na 14, a słabe w górę (Teczka prezesa 62 →
110, Kebab XXL 18 → 62, Parasol burzowy 31 → 100, Zgrzewka 39 → 66).

### Wrogowie i fale (`src/game/director.ts`, `src/game/enemies.ts`, `src/content/enemies.ts`)

- **Dyrektor fal** (jak AI Director z Left 4 Dead): cykl budowanie → szczyt → wygaszenie → oddech, długości faz z
  seeda. Na Normalnie szczyt ×2,2, oddech ×0,2: presja przychodzi falami, a między nimi jest czas na pączka.
  Każdy szczyt otwiera wzór, którego zwykły strumień nie robi: pierścień zamykający się wokół gracza (jak w
  Vampire Survivors; 14 wrogów plus 3 na minutę), ściana wrogów w poprzek drogi (szczury do przeskoczenia albo
  ciała do prześlizgnięcia), grupa prosto przed graczem, stado z boku. Pierwszy szczyt (około 55. sekundy) to
  zawsze pierścień: kto stoi, ten zostaje otoczony, kto idzie, ten z niego wychodzi.
- **Spawny przed kierunkiem biegu:** 30% grup pojawia się 17–23 m przed graczem, gdy biegnie. Bieganie w kółko
  po arenie przestało być bezpieczną pętlą.
- **Gęstość:** 1,9 grupy/s na starcie (było 0,6), 2,3 w 45. s, 2,8 w 2. minucie, 3,6 w 4., 4,4 w 5.; zdrowie
  wrogów rośnie o 28% na minutę (było 22%): słaby build w środku runu realnie nie nadąża. Obrażenia wrogów rosną
  o 7,5% na minutę (było 9%).
- **Wrogowie nie wiszą na płotach:** niską przeszkodę (do 1,15 m) przeskakują, przy ścianie idą wzdłuż niej w
  stronę gracza, zamiast pchać się w miejscu.
- **Nowe archetypy**, każdy z telegrafem i w klimacie linii 17:
  - *Spóźniony pasażer* (sprinter): biegnie 7,8 m/s, szybciej niż gracz (7,2 m/s), przez 2,4 s, potem przez
    1,3 s łapie oddech. Ruch, ślizg i bunny hop naprawdę mają znaczenie.
  - *Kibic z racą* (strzelec, od 70. sekundy): zatrzymuje się 9 m od gracza, podnosi racę na 1 s (świeci),
    rzuca tam, gdzie gracz stał. Krok w bok to unik; stojący dostaje zawsze.
  - *Kurier na hulajnodze* (szarża z telegrafem): z 11 m staje, maluje czerwony pas na 0,9 s, rusza 15 m/s.
  - *Paczkomat na nóżkach* (dzieli się): rozbity rozsypuje się na trzy szybkie paczki.
  - *Ochroniarz z tarczą*: tarcza od frontu bierze 80% trafienia (niebieskie iskry i brzęk), z boku, od tyłu i z
    góry (pioruny, kałuże, iskry z trakcji) nie chroni.
  - *Brygadzista z megafonem* (buff): trzyma się za tłumem, wrogowie w promieniu 7 m (żółty krąg) biegną 1,3×
    szybciej i dostają 30% mniej.
  - *Janusz z petardą*: po śmierci zostawia petardę, która po 0,9 s wybucha w zaznaczonym kręgu 2,6 m (12 obrażeń).
  - *Dachowiec* (skoczek z góry): przykuca i skacze łukiem tam, gdzie gracz stał, także na dach i peron.
    Dach i skok przestały być bezpieczną strefą; miejsce lądowania widać przez cały lot (11 obrażeń).
- **Elity z afiksami** (jak w Diablo): Szybki (1,5× prędkości), Pancerny (połowa obrażeń, odporny na odrzut),
  Wampir (leczy się 20% zdrowia za każde trafienie gracza i regeneruje 1,5% na sekundę), Wybuchowy (po śmierci
  krąg 3,4 m), Teleportujący (co 4,5 s pojawia się obok gracza, 0,6 s fioletowego ostrzeżenia), Przywoływacz
  (co 6 s woła trzech pomocników). Elita to już nie zawsze najtwardszy typ, tylko losowy z wytrzymalszych.
  Na Spokojnym i Normalnie jeden afiks, na Opóźnieniu 120 min dwa, na drabince dwa albo trzy. Każdy afiks pulsuje
  pod elitą swoim kolorem, a jej nazwa z afiksami jest w komunikacie i na ekranie śmierci.
- **Wydarzenia o stałych minutach** (zapowiedziane 3 s wcześniej): 2:15 nalot gołębi (18 gołębi naraz ze
  wszystkich stron, 1,2× szybszych), 3:35 kontrola biletów (cztery strefy kontroli z przerwami i czterech
  kanarów), 4:50 horda złomiarzy (dwunastu z jednej strony i 18 butelek do wyścigu).
- **„Ostatni pociąg”**: jeśli boss nie padnie w 270 / 180 / 150 s walki (Spokojny / Normalnie / Opóźnienie),
  co 5 s przychodzi coraz większa fala Nocnych Kanarów. Są nieśmiertelne, nie da się ich ogłuszyć ani
  spowolnić (gwizdek i kawa ich nie zatrzymają) i przyspieszają z 6,2 do 9,6 m/s, więc w końcu zabijają. HUD odlicza czas do odjazdu, a po nim miga „Nocne Kanary!”. To test DPS buildu, jak
  finałowy rój w Megabonku.

### Bossowie (`src/game/boss.ts`, `TUNING.boss`)

- Telegrafy skalowane kursem: Spokojny 1,25×, Normalnie 1×, Opóźnienie 0,85×, drabinka od „Bartek pije podwójne
  espresso” jeszcze 0,85×, ale zawsze z regułą ucieczki i minimum 0,3 s.
- **Dodatkowa faza** od Opóźnienia 120 min (i na drabince od espresso): od 15% zdrowia ataki ostatniej fazy
  plus najmocniejszy atak każdej wcześniejszej, 1,15× szybszy boss, przerwy krótsze o ćwierć i jego ostatnie
  słowo („TERMIN PRZESUNIĘTY NA 2035”).
- **Miniony:** co 16 s czterech wrogów wokół bossa (z ostrzegawczym kręgiem).
- **Wściekłość** po 120 s walki: przerwy ×0,7, boss 1,25× szybszy, baner „WŚCIEKŁOŚĆ”.
- **Atak wymagający ruchu** ma każdy boss: fale da się przeskoczyć, uderzenia i strefy trzeba opuścić, szarże
  ominąć, promienie obiec.
- **Bartek D.** na Opóźnieniu i od espresso: 1,5× więcej lemurów i 1,3× szybszych, łyk kopi luwak leczy 2×
  mocniej, w fazie 3 co 6 s kawa rozlewa się po parkingu jako strefy spowalniające i parzące, a okno liścia
  ma 10% paska zamiast 14%. Na Spokojnym odwrotnie: mniej i wolniejszych lemurów, słabsze łyki, okno 18%.

### Poziomy trudności (`src/content/difficulty.ts`, `src/ui/departures.ts`, `src/core/save.ts`)

- **Spokojny kurs** (do fabuły, wybacza), **Normalnie** (domyślny, bazowe liczby gry), **Opóźnienie 120 min**
  (dla ogarniętych). Każdy z opisem na ekranie trasy, co dokładnie robi:

  | | zdrowie wrogów | ich obrażenia | gęstość | boss po | zdrowie bossa | tempo bossa | telegraf | afiksy elit | dodatkowa faza | ostatni pociąg |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
  | Spokojny | ×0,85 | ×0,55 | ×0,85 | 5:00 | ×0,65 | ×1,4 | ×1,25 | 1 | nie | 270 s |
  | Normalnie | ×1 | ×1 | ×1 | 6:00 | ×1 | ×1 | ×1 | 1 | nie | 180 s |
  | Opóźnienie | ×1,15 | ×1,25 | ×1,1 | 7:00 | ×1,05 | ×0,8 | ×0,85 | 2 | tak | 150 s |

- **Drabinka opóźnień** otwiera się po pierwszym dojeździe do Koluszek: 20 szczebli od „+15 min” do „+5 h”. Każdy
  szczebel to Normalnie plus jeden czytelny modyfikator, a wcześniejsze dalej obowiązują (jak Ascension w Slay
  the Spire). Następny szczebel otwiera pokonanie bossa dowolnej stacji na poprzednim. Wybiera się go na
  tablicy odjazdów PKP (odjazd, kierunek, opóźnienie, uwagi).
- **Drabinka nie może ułatwiać.** Pierwszy pomiar szczebel po szczeblu pokazał, że szczeble 4–10 były łatwiejsze
  od zera (72–78% wobec 56%): dodatkowy elitarny kanar zostawiał skrzynię, paczkę XP i pączka, a gęstsze fale
  dawały więcej doświadczenia, więc dobry build rósł szybciej, niż rosło zagrożenie. Teraz kanar z drabinki nic
  po sobie nie zostawia, a przy modyfikatorach gęstości fal (Przepełniony skład, Zepsuty rozkład) ten sam XP
  dzieli się na więcej wrogów.
- **Nagrody:** butelki ×0,8 / ×1 / ×1,5 (kursy), na drabince +0,08 za szczebel (+5 h: ×2,6); klucz na koszt PKP
  (skrzynka kosztuje wtedy tylko 10 butelek) za pierwsze pokonanie każdego szczebla i za pierwszą stację na
  Opóźnieniu; osiem osiągnięć; tytuły („Pasażer z ulgą” … „Kursowy po ODWOŁANYM”) i ramki w Dzienniku; najwyższe
  pokonane opóźnienie z tytułem i ramką na karcie udostępniania wyniku. Szanse w skrzynkach CS bez zmian.
- **Codzienny kurs:** zawsze Normalnie i jeden modyfikator z drabinki (bez nocy), wybrany z dnia, taki sam dla
  wszystkich. Stacja dnia się nie zmieniła; linki z wynikami z wcześniejszych wersji dalej się otwierają.
- **Migracja zapisu (v4 → v5):** wszystko zostaje, wybór kursu też; kto już dojechał do Koluszek, ma od razu
  otwarty pierwszy szczebel.
