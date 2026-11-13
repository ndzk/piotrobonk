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
