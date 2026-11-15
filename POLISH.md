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

## Druga recenzja (świeży recenzent, cała gra)

Pełny przegląd od zera: bot i skrypty na komputerze i telefonie, wszystkie stacje, finał, menu, recyklomat, balans narzędziami. 32 punkty; co z nimi:

### Blokery

14. **Telefon: pierwsza karta awansu blokowała grę.** W trybie „wstrzymanym” (karty, skrzynka, wideorozmowa) znikały tylko przyciski dotykowe, a strefy gałki i kamery dalej przejmowały każde stuknięcie nad kartami. Strefy nie łapią teraz nowych palców w tym trybie; kciuk trzymany na gałce zostaje. Test e2e na Androidzie wybiera kartę stuknięciem (wcześniej celowo blokował awanse).
15. **Zakończenie: Piotrek zostawali na torze, gdy pociąg odjeżdżał.** Ukrycie przy wsiadaniu nadpisywała co klatkę reguła „ukryj, gdy kamera jest blisko”. Wsiadanie ma teraz własny stan.

### Duże

16. Ruletka przy powiększonym tekście (115 i 130%) przejeżdżała wygraną: mierzyła prostokąty ekranu w powiększonej warstwie. Mierzy teraz w pikselach warstwy; sprawdzone przy 100, 115 i 130%.
17. Kamera przechodząca przez zwykłego wroga (robotnika, autobus ZKA) dawała prawie czarny ekran: obrys znikał tylko u bossów. Każdy wróg blisko kamery znika teraz ditheringiem, na odległości zależnej od rozmiaru modelu (jeden program shadera dla wszystkich, zakres w uniformie).
18. Bartek D. świecił na łososiowo przez całą walkę (błysk przy każdym trafieniu, bez wygaszania; aura i kałuże trafiają co klatkę). Błysk gaśnie płynnie i nie częściej niż trzy razy na sekundę, więc Bartek zostaje rozpoznawalny.
19. Filiżanka po liściu rozbijała się pod zaparkowanym autem, kręcona spod niego. Miejsce parkingowe na jej torze lotu jest puste.
20. „Smycz”, która przenosi zgubionych wrogów bliżej gracza, przenosiła też bossów (Bartek lądował w powietrzu na drugim końcu parkingu). Bossowie są z niej wyłączeni.
21. Ujęcie odbudowy prawie nie pokazywało Piotrka (stało w stałym miejscu nad areną). Liczy się teraz od Piotrka: za nimi i wyżej, z tymi samymi kolizjami co zwykła kamera, z torami za nimi. Pociąg nie wisi już nad horyzontem przez całą odbudowę (pokazuje się, gdy rusza). Ślady wybuchów są jaśniejsze (sadza, nie czarna dziura w kadrze).
22. **Telefon (863×360):** wideorozmowa była ucięta u góry i u dołu, w recyklomacie zawartość skrzynki, siatka kontraktu i skup ściskały się do paska, w ekwipunku nie było widać przycisków. Rozmowa ma na niskim ekranie układ poziomy (twarz z lewej), a panele recyklomatu i ekwipunku przewijają się jako jedna strona. Ustawienia i Dziennik na takim ekranie chowają wielki tytuł (zakładki mówią, gdzie jesteś).
23. Hurtowa sprzedaż w skupie (z ★ i Covertami w zaznaczeniu) szła jednym kliknięciem. Sprzedaż czegoś od Classified wzwyż albo więcej niż pięciu skinów naraz wymaga drugiego kliknięcia.
24. **Mechaniki bossów z briefu.** Dotąd bossowie różnili się liczbami, nie zasadami. Teraz: Biletomat ogłusza („TRANSAKCJA ODRZUCONA”), nici Pajęczycy spowalniają, a szpule toczą się po arenie, Król Skupu Złomu rzuca szynami i włącza magnes, który ciągnie Piotrka i wyjmuje im butelki z kieszeni, „OBJAZD” autobusu ZKA i barierki Kierownika Robót zamykają kawałki areny (nie da się w nie wejść), a fale dźwiękowe Megafonu odwracają sterowanie na 3 s. Każdy efekt ma komunikat i swój kolor strefy. Sprawdzone w grze na każdej stacji i osobno pod nogami gracza (ogłuszenie: 0,82 s bez ruchu, nici: 1,7 zamiast 7,2 m/s).
25. **Muzyka inna dla każdej stacji i bossa (brief).** Stacje dzieliły melodię i bas Fabrycznej, bossowie jeden motyw. `src/content/compose.ts` pisze każdej stacji i każdemu bossowi własny bas, melodię i akordy z ziarna (skala, progresja czterech taktów, styl basu, motyw A A′ B A). Test pilnuje, że żadne dwie się nie powtarzają.
26. **Czytelność:** Piotrka zasłoniętego przez tłum, latarnię albo kiosk widać jako żółtą sylwetkę w kratkę (rysowaną tylko tam, gdzie coś jest przed nimi). Boss poza ekranem ma strzałkę na krawędzi. Dithering bossa przy kamerze zaczyna się bliżej (mniej „szumu” na pół ekranu).
27. **Balans:** gęstsze pierwsze minuty (pusty plac przez cztery minuty), autobus ZKA zadaje mniej (trzy przejazdy zabierały cały pasek), elity mniej mnożą obrażenia, bossowie kolejnych stacji mają więcej zdrowia (walka wydłuża się w dół linii), ewolucje biją o 30% mocniej od broni bazowej (skok mocy, a nie zamiennik). Nowe narzędzie `scripts/station-balance.ts`: bot gra cały naturalny run na każdej stacji i każdym kursie (bez debugowego sprzętu, zegar ×3).

### Drobne

28. Karta stacji: „Czas walki z bossem” zamiast mylącego „Czas na stacji”, „Nowy rekord!” dopiero przy pobiciu wcześniejszego czasu, „Otwarta stacja” tylko za pierwszym razem.
29. Podsumowanie po śmierci liczy obrażenia na sekundę od chwili zdobycia broni; Esc albo B przechodzi do menu.
30. Podpowiedzi stref dotyku raz na run (nie po każdej pauzie) i nie na karcie tytułowej bossa. „AWANS!” i „SKRZYNKA!” na telefonie stoją pod zegarem. Toast „działa offline” nie przykrywa karty wyniku.
31. Zwolnienie po ewolucji (brief): gra wraca do pełnej prędkości przez 1,4 s.
32. Codzienny kurs pokazuje się w hubie po pierwszej zaliczonej stacji (nie przed intro).
33. Mapa trasy: pierwsze stuknięcie palcem w stację ją pokazuje, drugie rusza; przez chwilę po otwarciu mapa nie przyjmuje klawiszy (Enter z wideorozmowy nie startuje stacji).
34. Recyklomat: obrazki zawartości skrzynki nie są przystankami dla strzałek, prawo z listy skrzynek idzie do „Otwórz”, LB i RB przełączają zakładki.
35. Bez alokacji w pętli: HUD porównuje liczby zamiast budować domknięcia i napisy co klatkę, wejście nie tworzy tablic i obiektów, karty awansu nie przepisują przycisków co klatkę, napisy końcowe mierzą układ raz.
36. Głośność: liść jest najmocniejszym dźwiękiem gry, nóż albo rękawice ★ głośniejsze od zwykłej skrzynki, rozbicie filiżanki i dolewka lemura słyszalne.
37. Jedno naciśnięcie nie pomija już i karty „Czas do domu”, i napisów: pierwsze przechodzi do napisów, kolejne kończy je po chwili.
38. Esc w trakcie składania kontraktu nie zamyka recyklomatu pod animacją.
39. Komunikaty HUD liczą czas gry: czekają w pauzie i przy kartach, nie przechodzą do następnego runu.
40. Intro: trzy areny buduje i kompiluje raz na starcie, cięcia tylko je podmieniają (bez zacięć); ujęcie „Pod Dino” zaczyna się szeroko, z napisem DINO, i najeżdża na Bartka.
41. Ikony: Telefon ma baterię 2% (zamiast trzeciej błyskawicy obok Iskry i Energetyka), Puszka leci (inna niż Energetyk i butelka), Rozkład Jazdy to otwarta książeczka, a Tabela Kursów tablica odjazdów z zegarem.
42. Teksty: „Pokonaj ZKA Ostatni Kurs”, „Opóźnienie 120 minut” jak nazwa kursu, „Najlepszy czas walki” wszędzie, „Wyjazdy” zamiast drugiego znaczenia „kursu”, „Ubijaj lemury” (do gracza na „ty”), „w jedno popołudnie” zamiast nieprawdziwych „siedmiu minut”, „ruszyć” nie zostaje samo w drugiej linii, „Czas do domu” wszędzie w tym samym formacie.
43. Strażnik startu nie ogłasza „Gra się nie załadowała” po sztywnych 12 s na wolnym łączu: czeka, aż skrypt się pobierze.
44. Pauza pokazuje stację, czas, kurs i wersję. W Zapisie jest „Usuń cały postęp” (dwa kliknięcia, wyłączone w runie).
45. Kod zapisu nie rozpakuje się ponad 8 MB (zabezpieczenie przed „bombą”), a link `?wynik=` musi wskazywać stację z planu tego dnia.
