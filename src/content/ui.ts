// Every player-facing UI string lives here. Piotrek use they/them: plural verbs ("Piotrek idą").
export const UI = {
  title: 'PIOTROBONK',
  route: 'Łódź Fabryczna → Koluszki',
  board: {
    header: 'Odjazdy',
    time: '17:42',
    train: 'Os 17',
    destination: 'Koluszki',
    status: 'ODWOŁANY',
  },
  teaser: 'Ktoś rozkradł tory na całej linii. Piotrek idą do domu na piechotę.',
  noWebGL: {
    title: 'Ta przeglądarka nie ogarnia WebGL2',
    body: 'PIOTROBONK potrzebuje WebGL2. Odpal grę w aktualnym Chrome, Firefoksie albo Safari i sprawdź, czy przyspieszenie sprzętowe jest włączone.',
  },
  crash: {
    title: 'Coś się wyjebało',
    body: 'Gra się wywróciła. Skopiuj raport i podeślij go twórcy, a potem odśwież stronę.',
    copy: 'Kopiuj raport',
    copied: 'Skopiowano',
    copyFailed: 'Zaznaczono raport, skopiuj ręcznie',
    reload: 'Odśwież',
  },
} as const;
