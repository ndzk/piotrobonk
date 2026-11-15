# POLISH.md: etap 7, szlif

Lista wszystkiego, co przejście całej gry pokazało jako brzydkie, toporne, niezbalansowane albo zepsute, i co z tym zrobiono. Każda pozycja jest naprawiona, chyba że przy niej stoi powód, dla którego zostaje.

## Jak grane

- **Botem, cała linia:** `play7.mjs` (skrypt roboczy, poza repo) gra botem każdą z dziewięciu stacji na buildzie produkcyjnym: początek, gęsta fala po przeskoku zegara, wejście bossa, walka, upadek bossa, odbudowa torów, pociąg i wideorozmowa. W Koluszkach dalej przez nokaut, QTE, liść, filiżankę, zakończenie na peronie i napisy, aż do huba. Zrzuty w każdym z tych momentów, FPS, czas symulacji i renderu, konsola.
- **„Ręcznie”, jak nowy gracz:** `manual7.mjs` klika grę od zera na komputerze i na telefonie (Pixel 7 poziomo): ekran tytułowy, hub, intro, mapa trasy, pierwsza stacja, pauza, ustawienia w pauzie, śmierć i podsumowanie, recyklomat z ruletką, kontrakt, skup, ekwipunek z podglądem 3D, codzienny kurs i jego bilet.
- Wszystko headless (software GL), więc FPS w raportach to SwiftShader, nie prawdziwa karta.

## Znalezione i naprawione

### Kamera

1. **Odbudowa torów była kręcona kamerą za plecami gracza.** Gdy boss padał przy ścianie albo kamera patrzyła w niebo, z odbudowy było widać chodnik albo kawałek muru, a torów wcale. Teraz kamera po upadku bossa w ok. 1 s przejeżdża do ujęcia linii znad areny (Piotrek na pierwszym planie, tory w środku kadru) i zostaje w nim przez odbudowę, kartę stacji i wideorozmowę. Jeśli w tym miejscu stoi wiata albo dach, kamera podnosi się nad nie.
2. **Przejazd pociągu kręciła osobna kamera, która w Bedoniu i Andrzejowie wisiała nad dachem wiaty**, a pociąg był małą kreską przy horyzoncie. Teraz kamera zostaje w ujęciu odbudowy i tylko obraca się za czołem pociągu, a potem wraca na tory.
3. **Czarny ekran, gdy boss stał za plecami gracza:** w Fabrycznej przy Biletomacie, w Bedoniu w autobusie ZKA było widać same liczby obrażeń. Bryła bossa już wcześniej znikała ditheringiem przy kamerze, ale jego obrys (powiększona powłoka rysowana od środka) nie, więc z wnętrza malował cały ekran na czarno. Obrys bossa znika teraz tym samym ditheringiem, a gdy kamera jest w środku modelu (długi autobus), obrysu nie ma wcale. Sprawdzone najgorszym przypadkiem na wszystkich dziewięciu bossach: gracz przy bossie, kamera obrócona w jego stronę. Próba z kamerą unoszoną nad bossa odpadła: przy bossie przyklejonym do gracza bryła i tak zasłaniała Piotrka.
4. **Błysk, iskry i liczby obrażeń zamarzały po upadku bossa:** po pokonaniu bossa symulacja staje, a z nią aktualizacja efektów, więc biała kula błysku wisiała nad areną przez całą odbudowę, kartę stacji i wideorozmowę. Efekty grają teraz do końca i znikają (ten sam błąd był wcześniej w finale).

### Interfejs

5. Toast osiągnięć w hubie wchodził na odsłonę noża z krzesła Bartka i na otwarte panele. Teraz czeka, aż menu huba będzie na wierzchu.
6. **Mapa trasy na telefonie:** opis kursu („Tak jak jest w rozkładzie. Boss po 6 minutach”) nie miał swojego miejsca w układzie na niski ekran, lądował pod listą stacji i był ucięty dolną krawędzią, a wolne miejsce rozciągało przycisk „Kurs” na dwie puste linie. Opis stoi teraz pod kursem w prawej kolumnie, a nadmiar wysokości zbiera pusty ostatni wiersz.
7. **Menu huba na telefonie (ok. 360 px wysokości)** nie mieściło się: po zejściu strzałkami do „Ekwipunku” logo uciekało za górną krawędź, a lista sprzętu za dolną. Na tak niskim ekranie znika podtytuł linii i lista sprzętu (sprzęt widać na Piotrku w scenie i w Ekwipunku), więc wszystkie przyciski i bank stoją na ekranie.

### Dźwięk

8. **Przesterowanie:** pomiar wszystkich 61 efektów (szczyt, RMS, najgłośniejsze 100 ms) pokazał, że warstwy niektórych dźwięków sumują się ponad pełną skalę: liść +6,4 dBFS, ciężki strzał +2,3, lądowanie po skoku na wrogów +1,5, wybuch +0,8. Na wyjściu to twarde, cyfrowe obcięcie. Syntezator zaokrągla teraz łagodnie szczyty powyżej 0,7, więc wszystkie efekty mieszczą się pod 0 dBFS, a ich głośność (najgłośniejsze 100 ms) zmieniła się o mniej niż 0,5 dB.
9. **Muzyka nad efektami:** pomiar szyn miksu w prawdziwym runie (bot na Widzewie: początek, gęsta fala, boss) dał RMS muzyki −15,6 dB przy efektach −21,2 dB na początku stacji, czyli muzyka zagłuszała trafienia i zbieranie. Szyna muzyki jest teraz o 3 dB niżej (suwak w ustawieniach dalej ma pełny zakres). W walce z bossem efekty i tak są głośniejsze, interfejs zostaje cicho w tle.

### Balans

10. **Nowe narzędzie: `scripts/weapon-balance.ts`** (z briefu: „czy żadna broń nie dominuje”). Każda broń sama, na najwyższym poziomie, ta sama arena i ta sama późna fala, nieśmiertelny Piotrek bez awansów. Mierzy obrażenia na sekundę czasu gry i zabicia na minutę, osobno dla broni i ewolucji.
11. **Kawa z Automatu prawie nie zabijała:** 0,65 mediany obrażeń i 101 zabić na minutę przy ok. 380 u reszty, a jej ewolucja Espresso 0,54 mediany. Zwiększenie obrażeń, lepsze celowanie i większe kałuże nic nie dały, więc sprawdziłem w grze, co jest w kałużach: po czterech minutach ok. 70% fali to gołębie, a kałuża rani tylko to, co chodzi. Kubek przy lądowaniu parzy teraz raz wszystko w promieniu, gołębie też, a kałuża zostaje dla chodzących. Pierwszy kubek leci tam, gdzie tłum schodzi się do Piotrka, i z wyprzedzeniem (cel zdąży podejść), a kałuże są trochę większe. Wynik: Kawa 190 DPS i 365 zabić na minutę, Espresso 189 DPS, obie w środku stawki. Opis Kawy mówi o gołębiach.
12. Gnat z CS był najmocniejszy z broni bazowych (1,5 mediany obrażeń): dwa ostatnie poziomy dają mniej obrażeń (+7 i +8 zamiast +9 i +12). Rozkład Jazdy 2026/27 był najmocniejszą ewolucją: obrażenia 56 zamiast 62. Obie dalej są na górze (zabijają jednym strzałem większość fali, więc pomiar obrażeń się tu nasyca), ale liczba zabić jest u nich taka jak u reszty. Po strojeniu bronie bazowe mieszczą się w 0,73–1,33 mediany obrażeń, ewolucje w 0,89–1,35, a zabicia na minutę w 347–466: żadna nie dominuje i żadna nie odstaje.
13. **Bossowie** (`scripts/boss-balance.ts`, kurs Normalnie, rozwinięta postać, bot bez uników): wszyscy do pokonania. Przędzalniana Pajęczyca z drugiej stacji padała w 16 s, szybciej niż Biletomat z pierwszej (23 s). Ma więcej zdrowia (4800 zamiast 3700) i trwa teraz ok. 33 s, czyli między pierwszą a trzecią stacją.
