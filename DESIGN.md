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
- Autobus ZKA (4:00, 6:40, potem co 2,5 minuty): pokazuje linię szarży, rusza po prostej z dużą prędkością, przy zderzeniu mocno bije. Po zniszczeniu wybucha i zostawia skrzynkę.

### Wydajność

- Żadnych alokacji w pętli: pociski, belki, pierścienie, kałuże i parasole to pule na `InstancedMesh`; zapytania przestrzenne wypełniają wspólne bufory; bufory piorunów i liczniki skrzynek są polami klas.
- Rozgrzewka shaderów pokazuje na chwilę wszystkie ukryte obiekty (pulę skrzynek, aury), bo `renderer.compile` pomija niewidoczne.
- Bot dochodzi do 16. poziomu w 4 minuty przy ponad 1300 zabitych, 60 FPS, symulacja ok. 0,2 ms, ok. 70 draw calli.

### Etap 2: zmiany po recenzji

- Wybór typu wrogów przeniesiony do `src/game/spawn.ts` i objęty testami. Wcześniej wiszący `else` sprawiał, że każda fala była stadem gołębi, więc Kawa i Espresso (kałuże nie działają na latających) nie robiły nic, a elity były losowe.
- Bumerangi i kartki nie mogą trafiać tego samego wroga częściej niż co 0,4 s (wcześniej pamiętały tylko 10 ostatnich trafionych i w tłumie mełły jednego wroga kilkadziesiąt razy). Powrót biletu ma ograniczoną prędkość i krótsze życie. Obrażenia Biletu i Rozkładu podniesione, bo każde przejście liczy się teraz raz.
- Feedback pocisków zbiera się raz na krok symulacji, a nie na każde trafienie: wcześniej seria pocisków trzymała wstrząs ekranu na maksimum i co chwilę zatrzymywała grę hitstopem.
- Skrzynka otwarta w tym samym kroku co awans nie gubi już swojego ekranu (ekran nagrody wychodzi ze stanu gry, nie z `setTimeout`). Test e2e pilnuje tej kolejności.
- Rzadkość nie skaluje już pasywek z całkowitą wartością (Bilet Ulgowy): dwie legendarne karty dawały +5 pocisków do każdej broni.
- Gnat nie strzela w pustkę (dźwięk tylko przy wystrzale), Piotrek trzymają pistolet w lewej ręce, mają pozę celowania z odrzutem i błysk wylotowy zamiast machania teczką.
- Autobus: zderzenia liczone z prostokąta nadwozia (nie z okręgu 1,5 m), pas ostrzegawczy to trwała naklejka na ziemi z pulsującymi pasami (wcześniej belki z puli dodawane co klatkę, które przy pauzie zatykały pulę), a autobus, który dwa razy pod rząd rozbije się tuż po starcie, pojawia się w innym miejscu. Za autobus jest teraz stała porcja doświadczenia zamiast pięciu poziomów naraz.
- Ogłuszeni wrogowie nie zadają obrażeń dotykiem, dzięki czemu Gwizdek i Kontrola mają sens; oba dostały też więcej obrażeń. Status widać na wrogu: fiolet (podatność), błękit (ogłuszenie), cyjan (spowolnienie).
- Parasole trafiają też wrogów stojących tuż przy Piotrku (bramka kątowa zamiast pierścienia), a Parasol Burzowy spowalnia i wygląda inaczej niż zwykły.
- Kubki Kawy celują tylko w wrogów na ziemi, Zgrzewka naprawdę rozrzuca mniejsze ładunki, łuki Sieci Trakcyjnej idą do najbliższych wrogów i nie trafiają dwa razy tego samego.
- Widoczność: aura ma wyraźny ząbkowany pierścień i normalne (nie addytywne) mieszanie, kałuże pulsują i mają gorącą obwódkę, wybuchy mają błysk, dym i przypalenia, pociski są większe i interpolowane, iskry nie wybielają ekranu.
- Skrzynki świecą słupem światła, znikają płynnie, a ich cena na mapie podąża za aktualną. Skrzynka daje 1, 3 albo 5 ulepszeń (jak w Vampire Survivors). Automaty z kawą są solidne (kamera nie wchodzi do środka) i po użyciu gasną całkowicie.
- Teksty: polskie liczby mnogie w podpowiedziach i kartach (`{butelka|butelki|butelek}` w `src/core/text.ts`), opis Gnata bez obietnicy skinów, „Kebab XXL na grubym”. Kolejka toastów zamiast nadpisywania. Cena skrzynki na czerwono, gdy brakuje butelek.
- Ewolucje: gwiazdka na ikonie i w HUD (poziom wraca do 1, więc sam numer wyglądał jak degradacja), karta pokazuje, co daje nowy efekt, promienie się obracają, a wyjście ekranu znów jest animowane. Po zamknięciu ewolucja ma swój moment w świecie: pierścień, błysk i dźwięk przy Piotrku.
- Wydajność: osobne materiały dla mesh instancjonowanych i zwykłych (wspólny materiał kazał Three.js przebudowywać program co rysowanie), kolory z definicji parsowane raz, zero tablic i domknięć w pętli (kałuże, aury, spawny, podpowiedzi). Statystyki broni liczone raz na poziom.
- Butelki i jedzenie nie znikają, gdy pula przedmiotów jest pełna: wypierają monetę XP. Pula skrzynek ma 10 miejsc i przetwarza najdalszą płatną, więc darmowa nagroda z elity nigdy nie przepada.
- Balans po pomiarach DPS (tłum 150 wrogów i pojedynczy cel): żadna broń nie odstaje ponad 10× od reszty. Telefon i Powerbank wzmocnione, Zgrzewka osłabiona, Gnat jest specjalistą od pojedynczego celu.
- Sterowanie dotykowe (przyciski interakcji na ekranie) jest częścią etapu 6, razem z PWA i resztą rzeczy platformowych.

## Etap 3: trasa, bossowie, odbudowa torów, zapis

### Trasa i zapis

- Stacje to osobne pliki w `src/content/stations/` (jeden na przystanek) z listą `STATIONS` w kolejności jazdy: Łódź Fabryczna, Łódź Niciarniana, Łódź Widzew, Łódź Andrzejów, Bedoń, Justynów, Gałkówek, Żakowice, Koluszki. Wspólne kawałki areny (peron, wiata, podjazdy, latarnie, rozkradziony tor) robi `baseArena` z `shared.ts`.
- Pora dnia przesuwa się wzdłuż linii: Fabryczna o zmierzchu, Koluszki w nocy. Każda stacja ma własne niebo, mgłę, światło i paletę ziemi.
- Postęp siedzi w `localStorage` pod `piotrobonk:save` (wersjonowany i naprawiany jak ustawienia): butelki w banku, łączny czas, liczba runów i śmierci, poziom trudności oraz per stacja: czy odbudowana, najlepszy czas i rekord pokonanych. Stacja otwiera się, gdy poprzednia jest odbudowana.
- Mapa trasy (`src/ui/route.ts`) jest między ekranem tytułowym a runem: lista przystanków z kropkami na linii, stan każdego (zamknięte / tu stoją tory / tory odbudowane), boss stacji, rekordy, wybór kursu i licznik „Czas do domu”.
- Trzy kursy (`TUNING.difficulty`): Spokojny kurs (−15% HP wrogów, −20% obrażeń, boss po 5 min), Normalnie (boss po 6 min), Opóźnienie 120 min (+35% HP, +25% obrażeń, gęstsze fale, boss po 7 min).
- `?stacja=widzew` wchodzi prosto na wybraną arenę z pominięciem menu (używa tego bot, testy e2e i debug).

### Bossowie

- Dane bossa są w `src/content/bosses.ts`: HP, promień, prędkość, paleta, 2–3 fazy, a w każdej fazie lista ataków z czasem telegrafu, odnowieniem, obrażeniami i zasięgiem. Kod w `src/game/boss.ts` tylko je odgrywa, więc kolejny boss to wpis w danych plus model.
- Boss jest zwykłym wrogiem w puli (`behavior: 'boss'`), tylko sterowanym przez kontroler, a nie przez AI pościgu. Dzięki temu każda broń trafia go normalnie, liczby obrażeń, krytyki i zabójstwo działają bez wyjątków.
- Rodzaje ataków (wspólne implementacje, różne liczby w danych): `slam` (zaznaczone koło, potem cios), `ring` (pierścień pocisków), `spread` (wachlarz w gracza), `charge` (szarża po linii), `summon` (wezwanie zwykłych wrogów), `zone` (pola, z których trzeba uciec), `wave` (rozchodzący się pierścień), `beam` (omiatająca wiązka).
- Każdy atak jest najpierw telegrafowany: czerwone, pulsujące koło albo pas na ziemi (`src/game/hazards.ts`), dopiero potem boli. Strefy świecą pomarańczowo, dopóki działają.
- Faza zmienia się na progach HP, z banerem i wstrząsem. Ataki mają własne okrzyki („TRANSAKCJA ODRZUCONA”).
- Oprawa: tytułowa karta na pół ekranu przed walką, pasek HP z nazwą i numerem fazy u góry, własny motyw muzyczny (148 BPM) i spokojniejszy kawałek po wygranej.
- W trakcie walki fale lecą dalej, ale rzadziej (`TUNING.boss.waveScale`), żeby tłum nie zasłaniał bossa.

### Odbudowa torów

- Rozkradzione szyny nie znikają na dobre: `World` zapamiętuje, gdzie ich brakuje, i po pokonaniu bossa wsuwa je z powrotem (`rebuildTracks(t)`), od środka stacji na zewnątrz. Potem jest ekran „Tory odbudowane” z czasem i liczbą pokonanych, a mapa trasy otwiera kolejny przystanek.
- Śmierć też coś zostawia: połowa zebranych butelek idzie do banku, czas doliczany jest do „Czasu do domu”, a rekord pokonanych zapisany.

### Narzędzia

- `node scripts/render-station.ts <id> [katalog]` renderuje arenę z czterech ujęć (`dev/station.html`), żeby oglądać stacje bez grania.
- Debug (F1) dostał „Wywołaj bossa” i „Następna stacja”.

### Etap 3: zmiany po recenzji

- Boss jest trzymany przez `uid`, nie przez indeks w puli wrogów. Pula zwija się przy każdej śmierci, więc po zabiciu bossa bronią kontroler przejmował losowego gołębia, pasek HP wracał do pełna, a stacja nigdy się nie kończyła.
- Śmierć bossa ma teraz wypłatę: doświadczenie, butelki, wybuch, dźwięk i liczy się do licznika pokonanych. Wcześniej pula była czyszczona zanim przeleciał zamiatacz, więc po bossie nie zostawało nic.
- Pociąg nie stoi już na graczu przez całą odbudowę (był pokazywany, zanim dostał pozycję), ma koła na szynach i pasy okien w pudle, a nie czarną płytę na dachu.
- Nic nie wisi w powietrzu w czasie finału: liczby obrażeń, cząsteczki, bumerangi i aury są sprzątane razem z wrogami.
- Wiązka bossa bije pełnymi kęsami co 0,7 s zamiast rozsmarowywać obrażenia na klatki. Wcześniej stanie w niej kosztowało 5 HP na 3 sekundy i dawało nietykalność na wszystko inne.
- Każdy atak jest widoczny, zanim zaboli: pierścień zaciskający się na bossie (ring, wachlarz, wezwanie), pas na ziemi dla szarży. Szarża naprawdę przejeżdża po tym pasie, a nie pojawia się jako seria ciosów. Żaden znacznik nie może mieć ostrzeżenia krótszego niż 0,3 s.
- Wiązka trzyma się bossa, a nie miejsca, w którym stał przy zamachu. Zmiana fazy nie anuluje już ogłoszonego ataku.
- Boss wchodzi za Piotrkiem na dachy i perony (kamping na wiacie wyłączał większość ataków), ma kolizję wysokości, a jeśli utknie na innym poziomie niż gracz, po czterech sekundach pojawia się obok niego.
- Boss blisko kamery rozpływa się ditheringiem jak parasole, więc nie zasłania całego ekranu. Liczby obrażeń lecą nad bossem, nie w jego kolanach. Autobus ZKA ma prostokątny hitbox całego nadwozia.
- Balans: HP bossów spłaszczone (2600 → 5800 zamiast 2600 → 9000), zegar nie dokłada już HP bossowi, a „Opóźnienie 120 min” daje szybsze ataki i mocniejszych wrogów zamiast dłuższej gąbki. Strefy Bedonia (3 × 7 m na 7 s) zabijały zmaksowanego bota w 16 sekund; są mniejsze, krótsze i rzadsze.
- Strefy i wiązki biją w odstępach (1,2 s i 1 s) zamiast opierać się na klatkach nietykalności gracza. Wcześniej długa strefa była ścianą obrażeń, przez którą nie dało się przejść.
- Rekord stacji to czas samej walki, nie całego runu, więc najłatwiejszy kurs nie wygrywa z definicji.
- Mapa trasy: zamknięte stacje da się obejrzeć (boss, rekordy), pulsuje tylko ta następna, kurs ma opis tego, co zmienia, widać bank butelek i liczbę kursów, a Koluszki mają stan „Finał · wkrótce”, bo finałowy boss jest częścią etapu 5.
- Ekran po walce pokazuje czas walki, pokonanych, butelki do banku, nową stację i „Nowy rekord!”. Pauza działa w intrze bossa i w czasie odbudowy, a utrata fokusu je zatrzymuje.
- HUD ma podpis nad zegarem („DO BOSSA” / „CZAS NA STACJI”), więc liczba nie zmienia znaczenia po cichu. `fmtTime` pokazuje godziny, gdy licznik przekroczy godzinę.
- Dźwięk: szyny wracają z brzękiem, pociąg trąbi, muzyka startuje pod przejazdem, a slam, strefa, wiązka i okrzyki bossa mają własne dźwięki.
- Wydajność: materiały i tekstury areny są zwalniane przy zmianie stacji (Three.js nie zwalnia tekstur razem z materiałem, więc każda podróż zostawiała kilka tekstur), kolory bossów parsowane raz (`src/render/palette.ts`), a typ wroga wyszukiwany pętlą zamiast domknięcia.
- Narzędzie: `node scripts/boss-balance.ts [kurs] [--god]` przechodzi wszystkich bossów botem i wypisuje czas walki oraz pozostałe HP.
- `?stacja=` działa tylko razem z `?debug=` albo `?bot=`, żeby nie dało się ominąć całej linii jednym adresem. Zapis z nowszej wersji nie jest czytany po kawałku, tylko zaczynany od zera.
- Areny: środek każdej stacji ma teraz za czym się schować i na co wejść (winda i fontanna na Fabrycznej, kotłownia i bębny przędzy w Niciarnianej, pergola i kiosk na Widzewie, prasa do złomu w Andrzejowie, stosy drewna w Bedoniu, stodoła GS i silosy w Justynowie, barakowóz i hałdy w Gałkówku, nastawnia i dźwignie w Żakowicach, pylon i wiata dla palących w Koluszkach). Na każdej zostaje otwarty plac 18–26 m na walkę z bossem i wolne kółko 6 m wokół miejsca startu.
- Pora dnia idzie teraz równo przez całą linię: słońce od pomarańczowego 2,3 do księżycowego fioletu 1,2, a podbicie nieba rośnie pod koniec, żeby nocne stacje dało się czytać. Mgła zaczyna się dopiero od 44–46 m (było 26–36), więc arena nie jest już różową plamą zaraz za peronem.
- Dino w Koluszkach zostaje: finał ze specyfikacji dzieje się pod Dino i sklep jest częścią żartu, tak samo jak Biedronka i kiosk RUCH. To parodia, nie podszywanie się: gra nigdzie nie udaje, że jest powiązana z siecią.

## Etap 4: butelki, hub, recyklomat, skiny CS2

### Kontynuacja na PC

- Etapy 0–3 powstały w sesji na Macu. Od etapu 4 praca idzie na Windowsie: Node 24 zamiast 26 (Vite, TypeScript i testy działają, `npm ci` tylko ostrzega o `engines`). Pełny Chromium z Playwrighta nie startuje na tym systemie (błąd konfiguracji side-by-side), więc lokalnie testy idą przez `PW_SHELL=1` (headless shell, ten sam silnik). CI dalej używa pełnego Chromium.
- Headless shell nie ma GPU, więc lokalnie leci na SwiftShaderze tak jak CI: testy uruchamiam z `CI=1`, a filtr szumu SwiftShadera łapie też „Blit feedback loop” (kompozytor kopiuje kanwę sam na siebie; three.js blituje tylko przy MSAA, którego gra nie używa).

### Butelki

- Po śmierci wszystkie zebrane butelki idą do banku (brief: „Zebrane butelki zostają na koncie”). Na Macu była połowa; wyrównane do briefu. Wyjście z runu przez pauzę też oddaje butelki i czas, bo inaczej opłacałoby się raczej zginąć niż wyjść.
- Zapis pamięta `deposit`: butelki z ostatniego runu, które hub jeszcze nie „wrzucił”. Wejście do huba odgrywa wrzucanie ich do recyklomatu (lecące butelki, brzdęk, licznik na ekranie automatu). Bank jest aktualny od razu; `deposit` to tylko animacja.
- Ceny: skrzynka 20 + klucz 30 = 50 butelek (25 zł). Skup: Mil-Spec 4, Restricted 16, Classified 60, Covert 220, ★ 1200, mnożone przez stan (FN 1,35 … BS 0,8) i StatTrak™ (1,6). Jak w CS skrzynka średnio się nie zwraca (test pilnuje, że wartość oczekiwana skupu jest mniejsza od ceny).

### Dane skinów

- `scripts/fetch-skins.ts` pobiera z ByMykel/CSGO-API `skins_not_grouped.json`, `crates.json` i `collections.json`. Adres bymykel.github.io przekierowuje dziś na domenę, która ich nie serwuje, więc skrypt próbuje go pierwszy, a potem bierze te same pliki z repozytorium (`raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/`).
- Do gry trafiają wszystkie 42 skrzynki z broniami (typ „Case”), ich zawartość, rzadkie przedmioty (noże i rękawice) i kolekcje: 1305 skinów. Warianty zużycia, StatTrak™ i Souvenir są zwijane do jednego wpisu na skin (dostępność StatTrak™ i Souvenir jako flagi). Pola: broń, wzór, faza Dopplera, rzadkość, typ wykończenia, min/max float, kolekcja, paleta.
- Paleta: skrypt pobiera obrazek skina do pamięci (128×96), dekoduje go w Chromium z Playwrighta (zero bibliotek do obrazków), robi k-means na nieprzezroczystych pikselach i zapisuje 3–5 kolorów. Pierwszy kolor to najczęstszy (podkład), reszta jest ułożona wg udziału ważonego nasyceniem, żeby cienki czerwony pasek Redline'a wygrał z trzecim odcieniem szarego zamka. Obrazki nigdy nie trafiają na dysk ani do repo.
- Snapshot (`src/content/skins/snapshot.json`, 285 kB, 69 kB gzip) jest osobnym chunkiem ładowanym leniwie przez `import('./snapshot.json?raw')`. Jako tekst, bo TypeScript inaczej wyprowadza typ z 300 kB JSON-a. Początkowy JS bez niego: 271 KiB gzip.
- Nazwy broni, skinów, rzadkości (Mil-Spec, Restricted…) i stanów (Factory New…) zostają po angielsku, tak jak mówi o nich każdy gracz CS w Polsce. Reszta UI jest po polsku.

### Skrzynki, kontrakty, skup (`src/game/skins.ts`)

- Szanse jak w CS: Mil-Spec 79,92%, Restricted 15,98%, Classified 3,2%, Covert 0,64%, ★ 0,26%, StatTrak™ 10% (tylko gdy skin ma wersję StatTrak™; rękawice nigdy). Gdy skrzynka nie ma jakiegoś poziomu, jego udział rozkłada się proporcjonalnie na resztę. Test statystyczny na milionie otwarć.
- Float losowany równomiernie między min a max skina; stan wg progów FN 0,07 / MW 0,15 / FT 0,38 / WW 0,45 / BS.
- Wynik skrzynki i kontraktu jest losowany z RNG, którego stan siedzi w zapisie (`caseRng`), i zapisywany przed animacją. Odświeżenie strony w trakcie ruletki niczego nie zmienia i nie pozwala przelosować.
- Ruletka to dekoracja: pas 54 kafelków losowanych z lekko podbitymi rzadszymi poziomami (żeby kusiło), wygrana na 47. pozycji, lądowanie w losowym miejscu kafelka, zwalnianie `1 − (1 − t)⁴` przez 6,2 s, tyknięcie na każdym kafelku pod kreską, przewijanie klikiem, spacją albo A. ★ w pasie to złoty kafelek z gwiazdką, jak w CS; nóż albo rękawice widać dopiero na karcie wyniku.
- Kontrakt: 10 skinów jednej rzadkości (Mil-Spec–Covert), wszystkie StatTrak™ albo wszystkie zwykłe, każdy z kolekcji. Wynik: kolekcja losowana proporcjonalnie do liczby wkładów z niej, potem równo skin poziomu wyżej z tej kolekcji; kolekcje bez wyższego poziomu odpadają. Float wyniku to średnia znormalizowanych floatów wkładów przeniesiona na zakres wyniku (zasada CS2 od 2025). Dziesięć Covertów daje ★ z puli skrzynek, z których pochodzą ich kolekcje (CS2 od 2025 robi to z pięciu; tu zostaje dziesięć dla spójności zasady). Ekran pokazuje listę możliwych wyników z procentami.
- Skup przyjmuje zaznaczone skiny hurtem; założonych nie przyjmuje (komunikat na ekranie automatu).

### Wygląd skinów (`src/render/skin-material.ts`, `src/render/cs-models.ts`)

- Jeden program shadera dla wszystkich wykończeń: `MeshToonMaterial` z `onBeforeCompile`, typ wykończenia jest uniformem, nie definem, i `customProgramCacheKey` jest stały. Założenie nowego skina nie kompiluje niczego w trakcie gry.
- Wzory to szum 3D w przestrzeni obiektu (bez UV, bez szwów na modelach z prostopadłościanów): solid, anodized (gradient), anodized multicolored (kolor per część), airbrush (miękkie plamy), hydrographic (kamuflaż), spray-paint, custom paint (wygięte pasy z akcentami), patina, gunsmith (panele), Fade (gradient wzdłuż broni), Marble Fade, Doppler (marmur), Case Hardened (niebiesko-złoty szum, kolory stałe jak w CS), Tiger Tooth, Crimson/Emerald Web, Damascus, Slaughter, skóra rękawic. Wykończenia metaliczne dostają połysk przy krawędziach.
- Zużycie z floatu: farba odpryskuje plamami szumu i na końcach części, odsłaniając stal, plus drobne rysy. Factory New jest czysty, Battle-Scarred poobijany.
- Palety z obrazków są ciemniejsze niż skin w grze (studyjne światło), więc shader dostaje kolory z podbitym nasyceniem.
- Modele broni z przepisów w `src/content/skins/catalog.ts` (zamek, lufa, chwyt, magazynek prosty/zakrzywiony/bęben/rura, kolba pełna/szkieletowa/bullpup, luneta, tłumik, podwójne Beretty). Noże: obrys ostrza wyciągnięty w `ExtrudeGeometry`, rękojeść, jelec, pierścień karambitu, dzielona rękojeść motylka, dwa sztylety Shadow Daggers. Rękawice: powłoka na dłoni Piotrka, kciuk, mankiet, nakładki na knykcie dla ćwiekowanych i moto.

### Skiny w grze

- Gnat z CS bierze model i zachowanie z założonego skina: klasa broni (pistolet, auto-pistolet, Beretty, Deagle/R8, SMG, karabin z serią 3, karabin z lunetą, AWP/SSG przebijające rząd, auto-snajperki, strzelby ze śrutem, Negev/M249 jako spray, Zeus ogłuszający) plus poprawki per broń. Całkowity DPS każdej klasy jest zbliżony (mnożnik 1,1–1,4 w pojedynczy cel); różni je kształt obrażeń, nie siła. Bez skina Gnat to goły Glock-18. Karta Gnata mówi, jak strzela założona broń.
- Pociski mają kolor akcentu z palety skina, a każda klasa ma własny dźwięk (ciężki strzał, krótka seria).
- Nóż ★ zastępuje teczkę w prawej ręce, a smuga zamachu bierze kolor z palety noża. Rękawice ★ są na rękach cały czas.
- Wzór dowolnego skina (poza rękawicami) można nałożyć na teczkę, bilety, kubki, parasole, puszki i rozkłady jazdy. Nazwa broni na kartach i w podsumowaniu zmienia się wtedy na „Parasol (AWP | Asiimov)”. Ewolucja dziedziczy wzór broni bazowej.
- StatTrak™ liczy zabójstwa założonej broni (Gnat, nóż albo broń z wzorem) w każdym runie, który się skończy: wygranym, przegranym albo przerwanym.

### Hub (`src/hub/hub-scene.ts`, `src/content/hub.ts`)

- Ekran „kliknij, żeby ruszyć” zostaje (odblokowuje dźwięk), a za nim jest hub: plac przed Łodzią Fabryczną o zmierzchu zbudowany tym samym kodem `World` co areny. Piotrek stoją na środku z założonym ekwipunkiem, po prawej recyklomat z ekranem (bank, kwota, komunikaty) i podświetlonym wlotem, po lewej gablota z pucharem z turnieju CS i nożem ★ na obrotowej podstawce, wokół gołębie dziobiące płyty.
- Tryb attract: na telebimie dworca bot gra prawdziwy run. To ta sama instancja `Game` w trybie demo: renderuje do tekstury 960×540, ma wyciszony dźwięk (`gameAudio.muted`), ukryte UI runu, własny wejściowy `Input` bez nasłuchu klawiatury, kartonowy zapis i sam bierze karty i skrzynki. Pokazuje tylko stacje, które gracz już ma odblokowane, żeby nie spoilerować trasy, a po śmierci albo odbudowie torów przeskakuje na kolejną.
- Menu to panele DOM przy krawędziach, a kamera huba płynie do tego, o czym jest menu: plan ogólny, zbliżenie na recyklomat, Piotrek z oglądanym przedmiotem.
- Ekwipunek pokazuje wybrany skin w 3D obok Piotrka: obrót przeciąganiem myszy albo prawą gałką, noże robią swój inspekt (obrót albo przewrót, przycisk „Inspekt” powtarza), Piotrek w hubie co kilka sekund kręcą nożem w dłoni.
- Miniaturki do list i ruletki: model skina renderowany raz do małego render targetu, odczytywany asynchronicznie (`readRenderTargetPixelsAsync`, bez wstrzymywania GPU) i trzymany jako PNG per skin i stan zużycia.
- Nawigacja padem i klawiaturą po siatkach: `SpatialMenu` wybiera najbliższy przycisk w kierunku strzałki, mierząc położenie na ekranie. Działa tak samo na zakładkach, liście skrzynek, siatce kafelków i rzędzie przycisków.
- Panele mają jawny stan „otwarty”: panel w trakcie animacji wyjścia nie przechwytuje już klawiszy.

### Etap 4: zmiany po recenzji

- Ekonomia: skrzynka z kluczem kosztuje 30 butelek (było 50), a pierwsze odbudowanie każdej stacji daje skrzynkę na koszt PKP (ekran „Tory odbudowane” o tym mówi). Skup idzie drabinką ×10 (Mil-Spec 1, Restricted 10, Classified 100, Covert 1000, ★ 3500), więc kontrakt jest mniej więcej neutralny wartościowo, a skrzynka dalej zwraca średnio ok. ¾ ceny (test pilnuje obu rzeczy). Kontrakt na ★ bierze pięć Covertów, jak w CS2.
- Butelki z bossa idą prosto do banku (wcześniej wypadały na ziemię już po zakończeniu runu i przepadały). Run jest bankowany raz: wyjście z pauzy w czasie odbudowy nie liczy go drugi raz. Zamknięcie albo odświeżenie karty w trakcie runu też zabiera butelki i czas do domu (`pagehide`).
- Zapis ma numer rewizji. Karta, która zobaczy w pamięci nowszą rewizję (inna karta grała dalej) albo zapis z nowszej wersji gry, przestaje zapisywać i prosi o odświeżenie, zamiast nadpisać postęp. Zdarzenie `storage` z innej karty pokazuje to od razu.
- Wynik skrzynki albo kontraktu, którego gracz nie zobaczył (zamknięta strona w trakcie ruletki), pokazuje się przy następnym wejściu do huba. Nowe skiny mają plakietkę „NOWE”, dopóki ich nie wybierzesz w ekwipunku.
- Klasy Gnata wyrównane po pomiarach recenzenta (AK słabszy, Glock i AWP poprawione, strzelby z dłuższym zasięgiem, węższym rozrzutem i przebiciem). Broń automatyczna (SMG, karabiny maszynowe, pistolety automatyczne) zamienia dodatkowe strzały z poziomów i Biletu Ulgowego na +60% szybkostrzelności za każdy, bo jej serie i tak by się na siebie nakładały.
- Shader: zużycie zjada najwyżej ok. 40% farby na Battle-Scarred, w plamach tam, gdzie się ociera, a nie w pasach wzdłuż broni (znikł „kod kreskowy” z gunsmithów i krawędzi). Rękawice blakną i szarzeją jak materiał, zamiast odpryskiwać do stali. Skórzane rękawice mają panele z palety (mankiet, dłoń, kostki, szwy).
- Palety: Fade, Marble Fade, fazy Dopplera i Gamma Dopplera oraz Crimson/Emerald Web mają kolory jak w CS niezależnie od obrazka, a ok. 50 najbardziej znanych skinów (Asiimovy, Redline, Vulcan, Neon Rider, Printstreamy, Vice…) ma ręcznie dobraną paletę w `src/content/skins/looks.ts`.
- Noże: każdy model ma własny obrys (pazur karambitu i talona, tanto ursusa, hak gut knife, piła na grzbiecie M9, huntsmana i survivala, kukri wygięte do przodu), ostrze ze szlifem zamiast płaskiej wstążki, Shadow Daggers z poprzeczną rękojeścią. Geometria rękawic jest wspólna dla typu (wcześniej każde założenie zostawiało nowe geometrie).
- Miniatury w 1,5× rozdzielczości, karta wyniku rysowana osobno w dużym rozmiarze, renderowanie jednej miniatury na klatkę, pamięć najwyżej 320 obrazków.
- Hub: gablota ma szkło z refleksem i ramę ze słupków, a bez noża stoi w niej sam puchar. Piotrek trzymają założonego gnata skośnie w dół, widocznie. Gołębie chodzą, patrzą, dokąd idą, i trzymają się z dala od kamery. Kupiona skrzynka wyjeżdża z automatu do tacki. Inspekt ma ruch dla każdego przedmiotu (broń obraca się i pokazuje drugą stronę, rękawice się obracają, noże robią swój flip, spin albo twirl), a przeciąganie wstrzymuje powolny obrót.
- Wydajność huba: demo jest symulowane co klatkę, ale rysowane co drugą i tylko wtedy, gdy telebim jest w kadrze i nic go nie zasłania. Demo zostaje na jednej stacji (bez przebudowy areny w tle). Shader skinów kompiluje się raz w warmupie także w wersjach instancjonowanych (parasole, pociski), więc zakładanie skinów niczego nie kompiluje.
- W runie: Piotrek noszą gnata przed sobą (low ready), a nie jak laskę przy nodze. Ikony w HUD i na kartach pokazują nóż zamiast teczki i sylwetkę klasy broni Gnata.
- UI recyklomatu: ruletka pojawia się od razu po zapłacie (obrazki dochodzą w trakcie), przyciemnia i rozmywa tło, klik w dowolnym miejscu ją pomija, tyknięcia są głośniejsze pod koniec, a panel znika, więc nie da się już kliknąć „Wróć” w trakcie. Złoty kafelek ★ pokazuje listę noży i rękawic ze skrzynki. Nagłówki kart (przycisk otwarcia, opcje kontraktu, przycisk sprzedaży) nie przewijają się z siatką. Podgląd kontraktu liczy szanse z tego, co naprawdę w nim jest, i pokazuje wszystkie wyniki. Sprzedaż czegoś od Classified w górę wymaga drugiego kliknięcia. Skup ma filtr rzadkości, „Zaznacz widoczne”, sortowanie od najtańszych i wyszarzone założone skiny. Ceny mają jednostkę (ikonka butelki).
- UI ekwipunku: filtry zmieniają się w obie strony (klik w ◀, prawy klik, strzałki), jest „Wyczyść filtry”, zaznaczenie idzie za filtrami, pusty ekwipunek prowadzi do recyklomatu. Wzór na inne bronie to rząd przełączników zamiast cyklu (teczki nie ma na liście, gdy jest nóż). Plakietka mówi, gdzie skin jest założony.
- Nawigacja: strzałki i Tab przesuwają jedno i to samo zaznaczenie (nie ma już dwóch obwódek naraz).
- Telefon w poziomie: panele zostają po prawej i nie zasłaniają całej sceny, przyciski akcji są w nieprzewijanych nagłówkach, karta wyniku mieści się na ekranie. Poniżej 900 px szerokości panele zajmują ekran.
- Ustawienia z poziomu huba (głośność itd.) wchodzą w etapie 6 razem z pełnym ekranem ustawień.
