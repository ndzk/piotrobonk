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
| `npm run e2e` | buduje oba warianty i odpala testy e2e w Chromium, Firefoksie, WebKicie oraz na emulowanym iPhonie i Pixelu |
| `BASE_URL=https://ndzk.github.io/piotrobonk/ npx playwright test` | te same testy na żywej stronie |

Przed pierwszym `npm run e2e` zainstaluj przeglądarki: `npx playwright install chromium firefox webkit`.

## Deploy

- Każdy push do `main` przechodzi CI i ląduje na GitHub Pages (źródło: GitHub Actions). Po deployu CI czeka, aż CDN zacznie serwować nowy commit, i odpala testy e2e na żywej stronie.
- Tag `v*` (na commicie z `main`, zgodny z `version` w `package.json`) przechodzi te same testy i tworzy GitHub Release z zipem do grania offline i changelogiem.

Wydanie wersji:

```bash
npm version patch --no-git-tag-version
git commit -am "Release v$(node -p 'require(\"./package.json\").version')"
git tag "v$(node -p 'require(\"./package.json\").version')"
git push origin main --tags
```

### Własna domena (opcjonalnie)

Build używa względnych ścieżek, więc działa pod `/piotrobonk/` i w katalogu głównym domeny bez przebudowy.

1. Zweryfikuj domenę na koncie GitHuba (Settings → Pages → Add a domain). Bez tego ktoś inny mógłby podpiąć twoją domenę pod swoje Pages.
2. Ustaw DNS:
   - subdomena (np. `gra.example.com`): rekord `CNAME` na `ndzk.github.io`;
   - domena główna (np. `example.com`): rekordy `A` na `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` oraz `AAAA` na `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
3. Ustaw domenę w repo: Settings → Pages → Custom domain, albo:
   ```bash
   gh api -X PUT repos/ndzk/piotrobonk/pages -f cname=gra.example.com
   ```
4. Po wystawieniu certyfikatu włącz „Enforce HTTPS” i zmień `homepage` w `package.json`.

Plik `CNAME` w repo nie jest potrzebny: przy publikacji przez Actions GitHub go ignoruje, liczy się ustawienie repo.

## Zastrzeżenia

Fan game, niepowiązana z Valve. Counter-Strike i nazwy przedmiotów należą do Valve Corporation.
