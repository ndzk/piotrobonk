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

### Po drugiej recenzji: kurs Spokojny

46. **Spokojny nie przeprowadzał gracza bez uników.** Bot, który nie robi uników (`scripts/station-balance.ts`, zegar ×2), wygrywał na Spokojnym 2–3 stacje z 8. Przyczyny: dotyk bossa zadawał pełne obrażenia na każdym kursie (mnożnik działał tylko na jego ataki), a w 4–5 minucie fale zjadały pasek, zanim boss się pojawił. Teraz dotyk bossa idzie za kursem, a Spokojny ma 45% obrażeń (było 60%), bossa z 60% zdrowia (było 75%) i 1,6× dłuższe przerwy między jego atakami (było 1,3×). Opis kursu w menu mówi, że boss atakuje rzadziej. Wynik bota po zmianach: 6 z 8 stacji, walki z bossem 14–57 s, raz 132 s (barierki Kierownika Robót).
47. **Bot nie miał nawigacji.** Na Żakowicach przez dwie minuty runu szedł wzdłuż krawędzi peronu, bo jego orbita wypada dokładnie na niej. Wyczuwa teraz ścianę przed sobą: na niski próg (peron) wskakuje, wzdłuż wysokiej ściany idzie bokiem. Czas, w którym bot stoi w miejscu, spadł z około połowy runu do 3–41%. To ten sam bot, który gra demo na ekranie stacji.
48. Symulacja stacji pokazuje teraz zdrowie przy wejściu bossa, długość walki, ile zdrowia zostało bossowi, ile czasu bot stał w miejscu, a run, którego zegar staje na minutę, zgłasza ze zrzutem ekranu. Raz (w jednym z około 10 przebiegów Andrzejowa) zegar gry stanął na 4,6 min; w kolejnych przebiegach z tym wykrywaniem to się nie powtórzyło.
49. **Zostaje:** Żakowice na Spokojnym bot przegrywa w każdym przebiegu, zwykle w falach przed bossem, choć wrogowie i fale są te same na każdej stacji. Nie jest to zaklinowanie (bot stoi w miejscu przez 12% czasu, tyle co gdzie indziej); przyczyny nie znalazłem. Żakowice to przedostatnia stacja, a gracz robi uniki, więc arena zostaje bez zmian.

### Zgłoszenie gracza: „gra się zacina, jak chcę cokolwiek zrobić”

Zmierzone na komputerze gracza (RTX 4070 SUPER, Chromium headless na tej karcie): sama rozgrywka trzymała równe 60 FPS, ale prawie każda akcja w menu zamrażała obraz. Profil CPU, ślad Chrome i licznik kompilacji shaderów pokazały przyczyny:

50. **Shader skina kompilował się od nowa przy każdej miniaturze.** Wszystkie skiny dzielą jeden program, a three.js usuwa program razem z ostatnim materiałem, który go używa. Miniatury w Recyklomacie i Ekwipunku zwalniały materiał po każdym obrazku, więc następny obrazek kompilował program od zera (sekundy na pierwsze otwarcie Recyklomatu i kolejne zacięcia przy przewijaniu). Każda scena (gra, ekran demo w hubie, hub, miniatury, portrety) trzyma teraz materiał-kotwicę, którego nikt nie zwalnia.
51. **Rozgrzewki blokowały.** Gra i hub kompilowały shadery synchronicznie i rysowały klatkę rozgrzewkową (ekran tytułowy stał ponad sekundę), a ekran demo w hubie (render do tekstury) i miniatury miały warianty programów, których rozgrzewka nie znała, więc kompilowały się przy pierwszym kliknięciu. Rozgrzewki kompilują teraz wszystkie warianty, równolegle na GPU (`KHR_parallel_shader_compile`), razem ze szkłem lunety i ćwiekami rękawic. Nowy test e2e liczy kompilacje po starcie: przejście przez hub, Recyklomat, Ekwipunek i początek runu musi ich mieć zero.
52. Pierwsze kliknięcie liczyło wszystkie efekty dźwiękowe (0,3 s): liczą się teraz po kawałku, zanim ktokolwiek kliknie. Twarze Piotrka i Bartka malowały się przy każdej budowie postaci (pięć razy na sesję, tysiące pociągnięć): malują się raz.
53. Rozmycie tła pod kartami, pauzą i ruletką: przeglądarka kompilowała jego shader przy pierwszej karcie (0,2 s), a potem rozmywała cały ekran w każdej klatce. Zastąpione odrobinę ciemniejszą zasłoną.
54. Fonty z polskimi znakami ładują się przed rysowaniem napisów na płótnach (wcześniej tylko łacińskie: ą, ę, ł przychodziły później).

Wynik na tej samej karcie, przed i po:

| Akcja | Przed | Po |
|---|---|---|
| Kliknięcie na ekranie tytułowym | 2,9 s | 0,2 s |
| Pierwsze otwarcie Recyklomatu | 2,8 s | 0,4 s |
| Kolejne miniatury skinów | kompilacja przy każdej | bez kompilacji |
| Start strony (blokada shaderów) | 1,4 s | 0,15 s |
| „Jedziemy” z intrem (raz, nowy gracz) | 1,1 s | 0,4 s |
| Start stacji, awanse, skrzynki, boss, wideorozmowa | | bez kompilacji |

55. **Zostaje:** pierwsze pokazanie danego ekranu w sesji (np. pierwsza karta awansu) kosztuje 0,1–0,3 s w procesie GPU przeglądarki: Chrome kompiluje wtedy potoki do rysowania nowego interfejsu (Skia Graphite i Dawn). To nie kod gry; główny wątek gry jest w tym czasie bezczynny.

### Zgłoszenie gracza: „gra długo się ładuje”

Sieć nie była problemem (HTML w 0,1 s, skrypt w 0,2 s). Czas szedł w kod po załadowaniu, mierzony profilem CPU startu i odstępami między klatkami na tej samej karcie:

56. Twarze Piotrka i Bartka (po cztery miny, włosy, broda, tysiące pociągnięć) malowały się na płótnie w GPU: 0,9 s. Ikony slotów HUD robiły się zaraz po wczytaniu skinów, choć HUD na ekranie tytułowym nie widać, a pierwszy odczyt płótna z GPU kosztował 0,8 s. Płótna, które gra maluje pociągnięciami albo odczytuje (twarze, ikony, miniatury, portrety), są teraz na CPU (`willReadFrequently`): twarze 0,3 s, ikony kilka milisekund.
57. Rozgrzewka portretów budowała też Bartka (0,25 s malowania) tylko po to, żeby skompilować te same programy, które daje Piotrek. Wystarcza Piotrek. Trzy rozgrzewkowe miniatury przy starcie nic nie dawały (zmierzone z nimi i bez), więc ich nie ma.

| Pierwsza wizyta, świeża przeglądarka | Przed | Po |
|---|---|---|
| Ekran tytułowy | 0,3 s | 0,26 s |
| Gotowe do startu | 1,75 s | 0,86 s |
| Płynny obraz (koniec zacięć po starcie) | ~3,4 s | ~1,7 s |

58. **Zostaje:** po „gotowe” przez ~0,75 s nie ma klatek, bo proces GPU przeglądarki kompiluje w tle shadery z rozgrzewek. Główny wątek gry jest wtedy wolny. W kolejnej karcie tej samej przeglądarki to już 0,4 s (przeglądarka pamięta skompilowane shadery).

### Zgłoszenie gracza: Firefox

Zmierzone w Firefoksie 160 gracza (instalacja systemowa, sterowana przez WebDriver BiDi, osobny profil, headless). Firefox nie ma równoległej kompilacji shaderów (`KHR_parallel_shader_compile`) i kompiluje je po kolei w procesie GPU, przez Direct3D.

59. **Shader skina CS2 kompilował się 2,4–2,8 s, za każdym razem.** Przy starcie kompilowało się 8 jego wariantów, więc po „gotowe” obraz stał przez ~20 sekund (97 programów, 22,7 s kompilacji; każdy inny program to 5–25 ms). Direct3D wstawiał kod szumu w każde miejsce użycia i rozwijał pętle: fbm w ośmiu miejscach, szum w dwunastu, kolor palety wybierany pętlą. Teraz każde wykończenie dostaje jeden fbm i jeden szum o skali dobranej z tabeli, wszystkie szumy liczą się raz, w pętlach, których kompilator nie może rozwinąć, a kolor palety to zwykły indeks. Wszystkie 19 wykończeń na broni i rękawicach wychodzi piksel w piksel takie samo (porównane na 57 obrazkach, różnica najwyżej 1/255). Wariant kompiluje się 0,35–0,4 s.
60. Owijki na parasolkach i biletach (skin na siatkach instancjonowanych) kompilują się dopiero wtedy, gdy gracz je założy, a nie u każdego przy starcie. Stare owijki są zwalniane dopiero po skompilowaniu nowych.

| Firefox, start gry | Przed | Po |
|---|---|---|
| Kompilacja shaderów przy starcie | 22,7 s (97 programów) | 3,0 s (93 programy) |
| Jeden wariant shadera skina | 2,4–2,8 s | 0,35–0,4 s |

61. **Zostaje:** Firefox i tak kompiluje shadery wolniej niż Chrome i bez równoległości, więc pierwsze sekundy po starcie są w nim mniej płynne. Płynności klatek Firefoksa nie dało się tu zmierzyć: bez okna składa on obraz programowo i odczytuje WebGL z karty w każdej klatce, co samo rwie klatki.

### Po 1.0: skiny i bronie jak w CS-ie

62. Obrazki skinów i skrzynek z CS-a w Recyklomacie, ruletce, na karcie odkrycia i w ekwipunku (z serwera Steama; bez sieci rysunek gry).
63. Każda z 35 broni w 3D ma prawdziwy kształt, odrysowany z ikony CS, i nosi na bokach prawdziwy obrazek swojego skina, ułożony piksel w piksel (sprawdzone na 10 skinach, także renderowanych w innym kadrze niż ikona). W ręku Piotrka i w podglądzie w hubie wygląda jak w CS-ie; podmiana wzoru na obrazek niczego nie kompiluje.
64. **Zostaje:** noże w 3D mają dotychczasowe kształty i wzór proceduralny; rękawice tak samo.
