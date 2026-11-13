# PIOTROBONK: decyzje projektowe

Dziennik decyzji. Każda decyzja, którą podjąłem sam zamiast pytać, ląduje tutaj z uzasadnieniem.

## Stack

| Element | Wybór | Dlaczego |
|---|---|---|
| Bundler | Vite 8 (Rolldown) | szybki, hashowane nazwy plików z pudełka |
| Język | TypeScript 6.0, `strict` | TS 7 (natywny) jeszcze nie jest wspierany przez typescript-eslint (`<6.1`) |
| Render | Three.js r187, `WebGLRenderer` (WebGL2) | WebGPU jeszcze nie wszędzie, WebGL2 działa w Chrome/Firefox/Safari desktop i iOS |
| Lint | ESLint 10 + `typescript-eslint` `strictTypeChecked`, `--max-warnings 0` | poprzeczka „zero ostrzeżeń” |
| Testy | Vitest 5 (logika), Playwright 1.65 (e2e) | |
| Node | 26 (LTS), `.nvmrc` | ten sam lokalnie i w CI |
| Minimum przeglądarek | Chrome/Edge/Firefox z ostatnich 2 lat, Safari 16+ (iOS 16+) | WebGL2 + ES2022; `lib` w tsconfig = ES2022, żeby nie przemycić nowszych API bez transpilacji |
| Font | Barlow Condensed przez `@fontsource` (500/700/800, z latin-ext) | wąski, „tablicowy”, pełne polskie znaki, bundlowany lokalnie |

## Ścieżki i hosting

- `base: './'` (ścieżki względne). Jeden build działa pod `ndzk.github.io/piotrobonk/`, pod własną domeną w katalogu głównym i z rozpakowanego zipa. Gra nie ma routingu, więc względne ścieżki nic nie psują.
- Pages publikowane przez GitHub Actions (`upload-pages-artifact` + `deploy-pages`), nie z gałęzi.
- Pages nie pozwala ustawiać nagłówków, więc: hashowane nazwy plików (Vite) + service worker od etapu 6. Nic, co wymaga COOP/COEP (`SharedArrayBuffer`).
- Wszystkie klucze `localStorage` i nazwy cache service workera zaczynają się od `piotrobonk:` (jeden origin `ndzk.github.io` dla wszystkich repo).

## Build offline (release)

- `npm run build:offline` buduje przez `vite-plugin-singlefile` jeden `index.html` z wszystkim w środku (JS, CSS, fonty jako data URI). Moduły ES ładowane z osobnych plików nie działają z `file://`, a inline działają. Zip w releasie = otwierasz `index.html` i grasz.
- Service worker i PWA będą tylko w buildzie online.

## TypeScript i lint

- Dwa projekty TS: `tsconfig.app.json` (kod gry, tylko typy przeglądarki) i `tsconfig.node.json` (testy, skrypty, konfiguracje). `process` czy `require` w `src/` nie przejdą typechecku ani lintu.
- `noUncheckedIndexedAccess` jest wyłączone świadomie: gra stoi na tablicach typowanych indeksowanych w gorących pętlach, a ta flaga wymusza tam `?? 0` albo `!` na każdym odczycie. Zamiast tego struktury danych są obiektami z nazwanymi polami tam, gdzie to możliwe.

## CI/CD

- `checks.yml` (reużywalny): `npm ci --ignore-scripts` → typecheck → lint → Vitest → build → budżet wagi → build offline → Playwright. Wołany przez CI i przez Release, więc nic nie wychodzi bez testów.
- `ci.yml`: push do `main` i każdy PR. Na `main` dodatkowo deploy na Pages, a potem job `live`: czeka, aż CDN zacznie serwować nowy commit (meta `piotrobonk-version` z pełnym SHA), i odpala całe e2e na żywym adresie.
- `release.yml`, na tag `v*`: tag musi być na `main` i zgadzać się z `version` w `package.json` (inaczej stopka i raporty błędów pokazywałyby złą wersję). Publikowany zip to dokładnie ten build offline, który przeszedł testy. Changelog od poprzedniego tagu `v*`, link „graj online” z API Pages (działa też po zmianie domeny), tagi z `-` idą jako prerelease, ponowne uruchomienie aktualizuje istniejący release.
- Bezpieczeństwo łańcucha dostaw: `persist-credentials: false`, `npm ci --ignore-scripts`, a uprawnienie `contents: write` ma tylko job publikujący, który nie instaluje zależności.
- E2E: 5 projektów Playwrighta: Chromium, Firefox, WebKit (desktop), iPhone 15 i Pixel 7 w poziomie. Lokalnie i w CI serwer stoi pod `/piotrobonk/`, jak na Pages. Testy: ekran startowy bez błędów, ostrzeżeń i odpowiedzi HTTP ≥ 400; brak WebGL2; nakładka błędu (przyciski w zasięgu na telefonie, kopiowanie); nieudane pobranie bundla; strona 404 (tylko na żywo); build offline z `file://`.
- Budżet wagi (`scripts/check-size.ts`): czyta manifest Vite, sumuje gzip chunka wejściowego i jego statycznych importów (bez leniwych `import()`). Limit 1,5 MiB.
- Firefox w CI: headless Firefox na Linuksie bez GPU w ogóle odmawia WebGL (żadna flaga tego nie zmienia). Z oknem pod Xvfb dostaje programowy Mesa llvmpipe, więc cały Playwright idzie przez `xvfb-run`, a tylko projekt Firefox ma `headless: false` w CI. Bez tego test spadał na panel „brak WebGL2” (który przy okazji okazał się działać poprawnie).
- E2E w CI leci na SwiftShaderze (runnery nie mają GPU). Flagi `--use-angle=swiftshader --enable-unsafe-swiftshader` włączamy jawnie, żeby Chrome nie ostrzegał o niejawnym fallbacku. Headless Chrome na SwiftShaderze sam loguje „GPU stall due to ReadPixels” przy kompozycji kanwy. Ten jeden komunikat jest ignorowany wyłącznie w CI. Lokalnie, na prawdziwym GPU, test jest w pełni rygorystyczny.

## Teksty i zaimki

- Wszystkie teksty dla gracza są w `src/content/`.
- Piotrek: oni/ich, czasowniki w liczbie mnogiej („Piotrek idą”, „Piotrek zebrali butelkę”, „Bartek im zazdrościł”).
- Gracz to Piotrek, więc UI zwracające się do gracza w 2. osobie używa tylko form bez rodzaju: czas teraźniejszy, tryb rozkazujący, formy bezosobowe („Nie żyjesz”, „Zebrano 12 butelek”). Nigdy „zebrałeś/zginąłeś”.
- Wypowiedzi samego Piotrka w 1. osobie: liczba mnoga albo formy bez rodzaju. Nigdy „wróciłem”.
- Bartek D.: formy męskie, tak jak w briefie.
- `tests/pronouns.test.ts` skanuje literały w `src/content/`: po mianowniku „Piotrek”, do końca zdania składowego albo następnego imienia, szuka form męskich liczby pojedynczej (czasowniki na „-ł”, „jest”, „on/jego/mu/go”…). To heurystyka: przy dialogach (etap 5) dojdzie sprawdzanie kwestii z `speaker: 'piotrek'` pod kątem „-łem”.

## Wygląd UI

- Paleta PKP: niebieski `#0d3b8c`, żółty `#ffd400`; tablica odjazdów `#0b0f24` z bursztynowym `#ffc83a`; alarm `#ff5a3c`.
- Każdy ekran wchodzi animacją `rise` (ruch + przenikanie). `prefers-reduced-motion` skraca animacje.

## RNG

- `mulberry32` (`src/core/rng.ts`): 32-bitowy stan, zero alokacji, stan można zapisać i odtworzyć (replay, codzienny kurs). Seed z tekstu przez FNV-1a, np. data dla codziennego kursu.

## Postacie z prawdziwych osób

- Zdjęcia referencyjne leżą w `ref/` (w `.gitignore`). Nigdy nie trafiają do repo ani do builda. Do repo idą tylko modele i tekstury zrobione na ich podstawie.
- Finał: Bartek D. ma w dupie **kij**, dosłownie jak w powiedzeniu „mieć kij w dupie”. Świadomie nie robię tu rekwizytu w kształcie penisa. Bartek jest rozpoznawalną prawdziwą osobą, a gra jest publiczna, więc seksualizowany gag o realnej osobie odpada. Kij niesie dokładnie ten sam żart.

## Etap 0: ekran tymczasowy

- Do czasu huba (etap 4) stroną startową jest scena tytułowa: zmierzch nad linią 17, kamera jedzie wzdłuż toru z rozkradzionymi odcinkami szyn, tablica odjazdów „ODWOŁANY”. Tor powtarza się co 84 m, więc niekończący się najazd kamery zawija się bez szwu.
- Brak WebGL2 → panel z komunikatem zamiast białego ekranu. Kontekst WebGL2 tworzymy sami i podajemy Three.js, więc nie ma kontekstu-sondy (Firefox ostrzegał przy jego zwalnianiu), a odmowa kontekstu (GPU na czarnej liście, limit kontekstów) też trafia na ten panel.
- Globalny `error`/`unhandledrejection` → nakładka „Coś się wyjebało” z raportem (wersja, SHA, przeglądarka, URL, stack z komunikatem, plik:linia:kolumna) i przyciskiem kopiowania. Firefox i Safari nie wkładają komunikatu do `stack`, więc raport dokleja go sam. Ignorowane: nieprzezroczyste „Script error.” i błędy z innych originów (rozszerzenia, wstrzyknięte skrypty), żeby cudzy kod nie blokował gry.
- Strażnik startu w `index.html` (klasyczny skrypt inline, przed bundlem): gdy bundle się nie pobierze albo nie sparsuje, a także gdy nie wystartuje w 12 s, pokazuje statyczny komunikat „Gra się nie załadowała”. Ten sam blok zastępuje `<noscript>`.
- `public/404.html`: tablica „Nie ma takiej stacji” z przyciskiem powrotu, który sam wybiera `/piotrobonk/` albo `/` przy własnej domenie.
- Fonty: własne `@font-face` tylko z woff2 (latin + latin-ext). Fallbacki woff i zbędne podzbiory nie trafiają do builda ani do zipa offline.
- Rozdzielczość kanwy śledzi rozmiar CSS (`ResizeObserver`) i zmiany DPR (`matchMedia` na `resolution`). Przy `prefers-reduced-motion` kamera stoi.

## Etap 1: postacie i rdzeń rozgrywki

### Modele Piotrka i Bartka D.

- Jedno zdjęcie twarzy na wprost na osobę (więcej nie ma). Profil, tył głowy, sylwetka i wzrost to założenia: oboje 180 cm, ubrania jak na zdjęciach plus dobrane spodnie i buty. Notatki z cechami i pomiarami leżą lokalnie w `ref/` (poza repo).
- Proporcje twarzy zmierzone na zdjęciach w jednostkach rozstawu źrenic (`face` w `src/content/characters.ts`), a kształty brwi, oczu, ust, nozdrzy, linii brody i grzywki obrysowane na zdjęciu wyrównanym do modelu po źrenicach (`traced`). Twarze są malowane proceduralnie na canvasie z tych danych; miny (neutralna, wkurwiona, cwaniacki uśmiech, ból dupy) to deformacje obrysów. Wariant z teksturą rzutowaną ze zdjęcia odrzucony przez użytkownika.
- Głowa: własna siatka (loft eliptycznych pierścieni, zawsze poziomych) z rzeźbą (oczodoły, łuki brwiowe, kości policzkowe, żuchwa). Włosy: czapka z maską alfa plus kępki (Piotrek) albo pasma grzywki (Bartek). Broda Bartka: powłoka z dziurą na usta.
- Stylizacja: głowa 1,28× większa niż anatomicznie, żeby twarz była czytelna z kamery w grze.
- Narzędzia (tylko dev): `node scripts/render-characters.ts` → `ref/porownanie.png` (zdjęcie wyrównane, model, nakładka 50%, 4 strony, 4 miny); `face=0|1` i `trace=0|1` do pomiarów.

### Pętla i symulacja

- Symulacja w stałym kroku 60 Hz (`TUNING.simHz`), render z interpolacją pozycji (gracz, wrogowie), więc 120 Hz jest płynne. Hitstop zamraża symulację, a render dalej chodzi (kamera trzęsie). Slow-mo przy śmierci przez `timeScale`.
- Seedowany RNG (`?seed=`) dla spawnów i kart.
- Wrogowie w tablicach typowanych (SoA), jeden `InstancedMesh` na typ plus instancjonowany obrys (wspólny `instanceMatrix`). Hash przestrzenny (sortowanie zliczające, komórka 2 m) przebudowywany co krok: separacja tłumu, trafienia, kontakt. Zero alokacji w pętli gry (pule, preallocowane wektory, cache geometrii smug).
- Cienie: okrągłe „bloby” zamiast shadow mapy (czytelniej w tłumie, tanio).
- Shadery i tekstury min są kompilowane i wgrywane zawczasu (`Game.warmup` → `renderer.compile`, `initTexture`), gra buduje się w tle zaraz po pokazaniu ekranu tytułowego.

### Ruch i kamera (wszystko w `src/content/tuning.ts`)

- Przyspieszenie w stylu Quake'a: tarcie na ziemi, przyspieszanie do prędkości docelowej, w powietrzu słaba kontrola, ale pęd zostaje. Skok z coyote time i buforem wejścia, zmienna wysokość skoku (puszczenie spacji ucina wznoszenie).
- Bunny hop: skok w oknie 0,1 s po lądowaniu pomija tarcie i dodaje trochę prędkości.
- Ślizg: zryw w kierunku ruchu z niskim tarciem; skok ze ślizgu zachowuje pęd; ślizg w powietrzu to zjazd w dół (lądowanie z wciśniętym ślizgiem przechodzi w ślizg).
- Kolizje: pionowy walec kontra AABB (siatka 4 m), wchodzenie na stopnie do 0,42 m, rampy jako pochylnie. Kamera TPP: swobodne rozglądanie, przesunięcie przez ramię, raycast do ścian i koron drzew, wstrząs „trauma²”, FOV rośnie z prędkością.

### Arena: Łódź Fabryczna

- Układ w danych (`src/content/stations.ts`): tory linii 17 z rozkradzionymi szynami, peron z wiatą i rampami (na dach wiaty da się wejść po skrzyniach), nowy dworzec ze szklaną fasadą i napisem, rampa na taras, garaże z rampą na dachy, działki z szopami i płotami, kiosk RUCH, latarnie, drzewa. Zmierzch.
- Statyka scalona do kilku draw calli (kolory w wierzchołkach, toon). Grunt to kafelkowane proceduralne tekstury (ostre z każdej odległości). Niebo to kopuła z gradientem.

### Broń, wrogowie, XP, karty

- Teczka z Pracy: łuk przed Piotrkiem wycelowany w najbliższego wroga, poziom 4 dodaje zamach do tyłu. Kryty (bazowo 6% + szczęście) z hitstopem i wstrząsem.
- Wrogowie etapu 1: gołębie (stado, latają), szczury, robotnicy z łopatami (od 1:50). Animacje proceduralne (podskok, machanie skrzydłami, kiwanie), błysk i zgniecenie przy trafieniu, śmierć: wybrzuszenie, spłaszczenie i rozpad na kawałki w kolorach wroga.
- Fale: grupy na sekundę rosną liniowo między punktami kluczowymi, HP wrogów rośnie o 22% na minutę, maruderzy daleko od gracza wracają bliżej.
- Monety XP z magnesem, łączą się, gdy jest ich za dużo. Dźwięk zbierania wznosi się przy serii.
- Karty: rzadkość (zwykła/rzadka/epicka/legendarna) losowana z wag, które szczęście przesuwa ku rzadszym; rzadkość mnoży liczbowe ulepszenia (×1 / ×1,35 / ×1,75 / ×2,4). Limit 4 bronie i 4 pasywki. Losuj ponownie (2), pomiń (3), wyrzuć z puli (2). Gdy nie ma co ulepszać: Zapiekanka z Dworca (leczenie).

### Dźwięk

- Efekty syntetyzowane jak w jsfxr (`src/content/sfx.ts`, `src/audio/synth.ts`), renderowane raz do buforów przy pierwszym geście. Limity głosów i odstępów, żeby 400 wrogów nie robiło kakofonii.
- Muzyka: sekwencer kroków z harmonogramem z wyprzedzeniem. Fabryczna: brudne techno 126 BPM (stopa, klaps, hi-haty przez przester, kwasowy bas, chiptune'owe arpeggio), warstwy włączają się wraz z czasem runu. Menu: spokojna pętla 92 BPM.
- `AudioContext` powstaje dopiero przy prawdziwym geście użytkownika (inaczej przeglądarka ostrzega w konsoli).

### Bot i testy

- `?bot=1`: AI trzyma się dystansu zamachu, ucieka przy niskim HP, krąży po arenie, wybiera pierwszą kartę. `scripts/bot-run.ts` gra botem w headless Chromium i zapisuje zrzuty oraz statystyki.
- `?debug=1` i F1: FPS, czasy symulacji i renderu, liczba encji, draw calle, nieśmiertelność, +poziom, +100 wrogów, zabij wszystkich, zbierz monety.

### Etap 1: zmiany po recenzji

- Stany: każde przejście (pauza, karty, śmierć, podsumowanie, wyjście, ekran tytułowy) czyści zaległe naciśnięcia (`Input.flush`), bo Spacja/A to jednocześnie skok i „zatwierdź”, a Esc to pauza i „wstecz”. Śmierć jest sprawdzana zaraz po obrażeniach, przed regeneracją i przed awansem. Karty działają przy 1–3 pozycjach; Zapiekanki nie da się wyrzucić z puli, a gdy nie ma już nic do ulepszenia, leczy od razu (toast zamiast okna z jedną kartą).
- Determinizm: osobne strumienie RNG (spawny, karty, krytyki, łupy), seedowane z `?seed=` albo nowym seedem na każdy run. Kosmetyka (cząsteczki, liczby) używa `Math.random`, bo nie wpływa na symulację.
- Ruch: przy zderzeniu ze ścianą znika tylko składowa prędkości wchodząca w ścianę (ślizganie po ścianach). Ślizg nigdy nie zwalnia poniżej biegu; kolejne ślizgi szybko po sobie dają coraz mniejszy zryw. Ślizg ma bufor jak skok. Ślizg w powietrzu to „zjazd”: dźwięk, poza, a lądowanie odpycha wrogów falą uderzeniową.
- Animacja Piotrka chodzi na czasie symulacji: w pauzie i przy kartach stoi. Ciało obraca się w stronę ciosu. Po trafieniu postać mruga (nietykalność). Śmierć: upadek na plecy, sterowanie wyłączone, potem smutny dżingiel i muzyka menu.
- Kamera: cztery promienie (rogi kwadratu wokół osi), minimalny dystans 0,25 m, a poniżej 0,9 m Piotrek znika z widoku zamiast pokazywać wnętrze modelu. Wysokość celu jest tłumiona (`camera.follow`), więc schodki i lądowania nie szarpią.
- Odczucia walki: wstrząs i hitstop raz na atak, nie na każdego trafionego wroga; hitstop krytyka najwyżej co 0,35 s, hitstop od obrażeń najwyżej raz na sekundę. Liczby obrażeń zmniejszają się tuż przy kamerze i rzedną w tłumie. Odłamki są mniejsze, jest ich mniej przy zatłoczonym ekranie i odbijają się od dachu lub peronu, na którym zginął wróg.
- Balans: pancerz to procent blokowanych obrażeń (Kurtka 7% na poziom, limit 60%). Obrażenia wrogów rosną o 12% na minutę. Termos nie pojawia się, dopóki żadna broń nie korzysta z czasu trwania (bronie etapu 2). Elity (12× HP, ×1,6 obrażeń, złote, większe, 6 monet) w 3., 5. i 7. minucie, potem co 2 minuty, z toastem i sygnałem. Fale gęstnieją mocniej po 4. minucie. Wrogowie naziemni wspinają się po ścianach do Piotrka stojącego na dachu, gołębie przelatują nad budynkami. Teczka sięga wyżej (−2 / +2,6 m). Bot z kartami priorytetowymi dochodzi do 6. minuty.
- Spawny wybierają miejsce poza kadrem kamery, nie na dachach, z obłoczkiem kurzu.
- Wydajność: zapytania do hasha wypełniają bufor indeksów (`Enemies.query`), separacja tłumu iteruje komórki bez domknięć, callbacki pętli są polami klasy, cyfry obrażeń liczone arytmetycznie, HUD dostaje sloty tylko przy zmianie ekwipunku. Mniej segmentów sfer w modelach wrogów (oczy i drobne kulki to osobne bardzo proste sfery).
- Arena: drzwi garaży od strony placu z lamelami, pasy okien i pilastry na bokach i z tyłu hali, klimatyzatory na dachu, jaśniejszy spód wiaty z listwą świetlną, plamy światła pod latarniami, miękkie cienie przy podstawach budynków, pierścień drzew i krzaków przy płocie, rampa na taras hali przesunięta na zewnątrz ściany, schodki ze skrzyń prowadzą na dach wiaty (dach na 4,32 m, najwyższa skrzynia 3,1 m).
- UI: ustawienia w pauzie (muzyka, efekty, czułość kamery, odwrócenie osi Y, wstrząsy), zapisywane w `localStorage` pod `piotrobonk:settings` z wersją i naprawą błędnych danych. Na padzie podpisy przycisków pokazują X / Y / Select. Pad nie odblokowuje dźwięku w przeglądarkach, więc toast prosi o klik lub klawisz. Kompaktowe karty na telefonie w poziomie. HUD i ekran tytułowy mają animacje wejścia przy każdym pokazaniu. Liczby w tekstach kart z przecinkiem dziesiętnym, a szablony tekstów są w `src/content/items.ts` (skanuje je test zaimków).
- Fonty: gra buduje napisy i atlas cyfr dopiero po załadowaniu fontu.

## Etap 2: bronie, pasywki, ewolucje, przedmioty na mapie

### Bronie

- 11 broni bazowych, każda ma 7 poziomów ulepszeń i własne zachowanie (`kind` w `src/content/items.ts`): Teczka z Pracy (zamach), Bilet Miesięczny (bumerang), Kawa z Automatu (rzucane kubki zostawiają kałuże), Sos Czosnkowy (aura), Telefon na 2% (piorun skaczący po wrogach), Parasol (orbitujące parasole), Gwizdek Konduktora (stożek, odrzut), Puszka (rzut łukiem, wybuch), Gnat z CS (serie w najbliższego), Iskra z Trakcji (uderzenia z góry w losowych wrogów), Rozkład Jazdy (kartki lecące w linii, przebijają).
- Statystyki broni są danymi (`WeaponStats`: obrażenia, odnowienie, zasięg, obszar, kąt, odrzut, liczba, prędkość, czas trwania, przebicie, skoki). Poziomy dodają lub mnożą; rzadkość karty skaluje tylko wartości liczbowe, nigdy liczbę pocisków, przebicia ani skoków (takie karty są zawsze zwykłe). Wynik jest liczony raz na poziom i trzymany w pamięci podręcznej, bo pętla gry pyta o niego co krok.
- Każda broń ma osobny slot czasu odnowienia trafień na wrogu (4 sloty), więc dwie bronie nie blokują się nawzajem, a orbitujące parasole nie biją tego samego wroga co klatkę.
- Parasole przechodzące przez kamerę rozpływają się ditheringiem zamiast zasłaniać pół ekranu.

### Pasywki i ewolucje

- 10 pasywek: Nerka (magnes), Energetyk (szybkość ataku), Klapki (prędkość), Kurtka (pancerz), Zdrapka (szczęście), Termos (czas trwania), Okulary (krytyki), Kanapka (regeneracja), Bilet Ulgowy (+1 pocisk, maks. 2 poziomy), Tabela (doświadczenie).
- Ewolucja = broń na maks. poziomie + jej pasywka w ekwipunku + skrzynka. Każda pasywka jest kluczem do dokładnie jednej ewolucji (test w `progress.test.ts`). Ewolucja zastępuje broń w tym samym slocie i dostaje własny efekt: fala uderzeniowa (Teczka Prezesa), przyciąganie monet (Bilet Sieciowy), spowolnienie (Espresso z Fabrycznej), kradzież życia (Kebab XXL Na Grubym), ogłuszenie (Powerbank), łuki między uderzeniami (Sieć Trakcyjna 3 kV), podatność na obrażenia ×1,5 (Kontrola Biletów), wybuchy kasetowe (Zgrzewka z Biedronki), wachlarz kartek (Rozkład Jazdy 2026/27), pięć parasoli z silnym odrzutem (Parasol Burzowy).
- Ewolucji nie ma w puli kart; bazowa wersja ewoluowanej broni też z niej znika.

### Skrzynki, butelki, kawa, kosze

- Waluta runu to butelki i puszki z kaucją (0,50 zł za sztukę, licznik w HUD pokazuje też kwotę). Wypadają z wrogów (3,5%), z koszy, z elit; Złomiarz zbiera butelki z ziemi i oddaje je po śmierci.
- Skrzynki: na mapie są zawsze trzy płatne (cena rośnie o 5 butelek z każdą otwartą, start 8), nowa pojawia się 20 s po otwarciu. Elity i autobus zostawiają darmową skrzynkę. Zawartość: ewolucja, jeśli jakaś jest gotowa; inaczej 1 albo 3 ulepszenia posiadanych rzeczy (szczęście zwiększa szansę na 3); gdy nie ma czego ulepszać, 5–10 butelek. Otwieranie: podniesienie wieka ze snopem światła, potem ekran z odsłanianiem kart albo duża animacja ewolucji. Ekran blokuje wejście na chwilę, żeby przytrzymany przycisk nie zamknął go od razu.
- Automaty z kawą (3 na Fabrycznej): stanie przy automacie przez 3 s parzy kawę (pierścień postępu na automacie i podpowiedź w HUD); każdy automat działa raz i daje losową, jeszcze niewziętą stałą premię do końca runu.
- Kosze na śmieci rozbija się wejściem lub ślizgiem (ślizg ma większy zasięg) i wybuchami; wypadają z nich butelki, czasem Pączek z Biedronki (leczenie).

### Nowi wrogowie

- Złomiarz (od 1. minuty) z wózkiem: idzie do najbliższej butelki na ziemi zamiast do Piotrka, więc warto go ubić, zanim zabierze łup.
- Autobus MPK (4:00, 6:40, potem co 2,5 minuty): pokazuje linię szarży, rusza po prostej z dużą prędkością, przy zderzeniu mocno bije. Po zniszczeniu wybucha i zostawia skrzynkę.

### Wydajność

- Żadnych alokacji w pętli: pociski, belki, pierścienie, kałuże i parasole to pule na `InstancedMesh`; zapytania przestrzenne wypełniają wspólne bufory; bufory piorunów i liczniki skrzynek są polami klas.
- Rozgrzewka shaderów pokazuje na chwilę wszystkie ukryte obiekty (pulę skrzynek, aury), bo `renderer.compile` pomija niewidoczne.
- Bot dochodzi do 16. poziomu w 4 minuty przy ponad 1300 zabitych, 60 FPS, symulacja ok. 0,2 ms, ok. 70 draw calli.
