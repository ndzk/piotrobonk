# PIOTROBONK

**Graj: https://ndzk.github.io/piotrobonk/**

3D survivors-like w przeglądarce. Ktoś rozkradł tory na linii 17 i Piotrek idą z Łodzi Fabrycznej do Koluszek na piechotę. Na każdej stacji muszą pokonać bossa, żeby odbudować tory.

Gra powstaje etapami. Decyzje projektowe są w [DESIGN.md](DESIGN.md).

## Uruchamianie lokalnie

Wymaga Node 26 (`.nvmrc`).

```bash
npm ci
npm run dev
```

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny do `dist/` |
| `npm run build:offline` | jeden samodzielny `index.html` do `dist-offline/`, działa z `file://` |
| `npm run typecheck` / `npm run lint` / `npm test` | TypeScript, ESLint, Vitest |
| `npm run size` | budżet wagi początkowego JS (po buildzie) |
| `npm run e2e` | test dymny w Playwright na buildzie |
| `BASE_URL=https://ndzk.github.io/piotrobonk/ npm run e2e` | ten sam test na żywej stronie |

## Deploy

- Każdy push do `main` przechodzi CI i ląduje na GitHub Pages (źródło: GitHub Actions).
- Tag `v*` tworzy GitHub Release z zipem do grania offline i changelogiem.

### Własna domena (opcjonalnie)

Build używa względnych ścieżek, więc działa pod `/piotrobonk/` i w katalogu głównym domeny bez przebudowy.

1. U dostawcy DNS dodaj rekord `CNAME` z subdomeny (np. `gra.example.com`) na `ndzk.github.io`.
2. Ustaw domenę w repo: Settings → Pages → Custom domain, albo:
   ```bash
   gh api -X PUT repos/ndzk/piotrobonk/pages -f cname=gra.example.com
   ```
3. Po wystawieniu certyfikatu włącz „Enforce HTTPS”.

Plik `CNAME` w repo nie jest potrzebny: przy publikacji przez Actions GitHub go ignoruje, liczy się ustawienie repo.

## Zastrzeżenia

Fan game, niepowiązana z Valve. Counter-Strike i nazwy przedmiotów należą do Valve Corporation.
