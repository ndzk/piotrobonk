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
| Font | Barlow Condensed przez `@fontsource` (500/700/800, z latin-ext) | wąski, „tablicowy”, pełne polskie znaki, bundlowany lokalnie |

## Ścieżki i hosting

- `base: './'` (ścieżki względne). Jeden build działa pod `ndzk.github.io/piotrobonk/`, pod własną domeną w katalogu głównym i z rozpakowanego zipa. Gra nie ma routingu, więc względne ścieżki nic nie psują.
- Pages publikowane przez GitHub Actions (`upload-pages-artifact` + `deploy-pages`), nie z gałęzi.
- Pages nie pozwala ustawiać nagłówków, więc: hashowane nazwy plików (Vite) + service worker od etapu 6. Nic, co wymaga COOP/COEP (`SharedArrayBuffer`).
- Wszystkie klucze `localStorage` i nazwy cache service workera zaczynają się od `piotrobonk:` (jeden origin `ndzk.github.io` dla wszystkich repo).

## Build offline (release)

- `npm run build:offline` buduje przez `vite-plugin-singlefile` jeden `index.html` z wszystkim w środku (JS, CSS, fonty jako data URI). Moduły ES ładowane z osobnych plików nie działają z `file://`, a inline działają. Zip w releasie = otwierasz `index.html` i grasz.
- Service worker i PWA będą tylko w buildzie online.

## CI/CD

- `ci.yml`, na każdy push i PR: `npm ci` → typecheck → lint → Vitest → build → budżet wagi → Playwright smoke. Na push do `main` dodatkowo job `deploy` na Pages.
- `release.yml`, na tag `v*`: build offline, zip, changelog z commitów od poprzedniego tagu, GitHub Release.
- Budżet wagi (`scripts/check-size.ts`): czyta manifest Vite, sumuje gzip chunka wejściowego i jego statycznych importów (bez leniwych `import()`). Limit 1,5 MiB.
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
- Brak WebGL2 → panel z komunikatem zamiast białego ekranu. Globalny `error`/`unhandledrejection` → nakładka „Coś się wyjebało” z raportem (wersja, SHA, przeglądarka, stack) i przyciskiem kopiowania.
