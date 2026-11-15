// Every spoken line: the intro, Bartek D.'s video calls between stations, the finale. Piotrek use
// they/them: in their own lines only plural or genderless forms ("jesteśmy", "idziemy", never "byłem").
// Bartek D. talks to Piotrek in the plural too ("wy", "wasza teczka").

import type { Expression } from './characters';

export type Speaker = 'piotrek' | 'bartek' | 'megafon' | 'krol';

export interface Line {
  speaker: Speaker;
  /** Face on the portrait (Piotrek and Bartek only). */
  face?: Expression;
  text: string;
}

export const SPEAKERS: Record<Speaker, { name: string; color: string }> = {
  piotrek: { name: 'Piotrek', color: '#ffd400' },
  bartek: { name: 'Bartek D.', color: '#7fdc8a' },
  megafon: { name: 'Megafon', color: '#ff8a5c' },
  krol: { name: 'Król Skupu Złomu', color: '#c9a36b' },
};

/** The intro, shot by shot. Each shot has its own place, camera move and lines (see src/game/intro.ts). */
export const INTRO: { id: 'board' | 'theft' | 'scrap' | 'coffee' | 'resolve'; caption?: string; lines: Line[] }[] = [
  {
    id: 'board',
    caption: 'Łódź Fabryczna, 17:38',
    lines: [
      { speaker: 'piotrek', face: 'neutral', text: 'Dobra. 17:42, osobowy do Koluszek. Dwadzieścia minut i jesteśmy w domu.' },
      { speaker: 'megafon', text: 'Pociąg osobowy do Koluszek został odwołany. Pozostałe też. Wszystkie.' },
      { speaker: 'piotrek', face: 'angry', text: 'ODWOŁANY? Nawet ten o 23:58?' },
      { speaker: 'megafon', text: 'Przyczyna: brak torów na całej linii 17. Przepraszamy za utrudnienia.' },
      { speaker: 'piotrek', face: 'butthurt', text: 'Brak CZEGO?' },
    ],
  },
  {
    id: 'theft',
    caption: 'Wczoraj wieczorem',
    lines: [
      { speaker: 'bartek', face: 'angry', text: 'Dwadzieścia minut do domu. DWADZIEŚCIA. Ja do roboty jadę godzinę dziesięć z przesiadką.' },
      { speaker: 'bartek', face: 'smirk', text: 'To ja wam zaraz pokażę dwadzieścia minut. Szyna po szynie.' },
    ],
  },
  {
    id: 'scrap',
    caption: 'Skup złomu, Andrzejów',
    lines: [
      { speaker: 'krol', text: 'Szyny kolejowe? Ja tu pytań nie zadaję. Sto osiemdziesiąt złotych za tonę.' },
      { speaker: 'bartek', face: 'smirk', text: 'Bierz. I powiedz mi, gdzie w tym mieście sprzedają kopi luwak.' },
    ],
  },
  {
    id: 'coffee',
    caption: 'Pod Dino, Koluszki',
    lines: [
      { speaker: 'bartek', face: 'smirk', text: 'Kopi luwak. Kawa, która przeszła przez lemura. Na wylot.' },
      { speaker: 'bartek', face: 'smirk', text: 'Wiecie, ile kosztuje filiżanka? Dokładnie tyle co tory od Łodzi do Koluszek.' },
      { speaker: 'bartek', face: 'neutral', text: 'Na zdrowie. Moje. Do zobaczenia w Koluszkach, za jakieś sto lat.' },
    ],
  },
  {
    id: 'resolve',
    lines: [
      { speaker: 'piotrek', face: 'angry', text: 'Bartek. No oczywiście, że Bartek.' },
      { speaker: 'piotrek', face: 'smirk', text: 'Dobra. Idziemy wzdłuż linii. Na każdej stacji odbudujemy tory, a w Koluszkach Bartek dostanie liścia.' },
    ],
  },
];

/** Bartek D. calls after each cleared station (keyed by that station), sipping his coffee. */
export const CALLS: Record<string, Line[]> = {
  fabryczna: [
    { speaker: 'bartek', face: 'smirk', text: 'Halo? Słychać? Słyszałem, że rozwaliliście biletomat. Brawo. Zostało tylko osiem stacji.' },
    { speaker: 'bartek', face: 'neutral', text: 'Ja w tym czasie wypiję trzy filiżanki. Spokojnie, dla was nie zostawię.' },
  ],
  niciarniana: [
    { speaker: 'bartek', face: 'butthurt', text: 'Pajęczyca z Niciarnianej. To była moja ulubiona. Uszyła mi sweter.' },
    { speaker: 'bartek', face: 'smirk', text: 'Nieważne. Wiecie, że kopi luwak kosztuje więcej niż wasz bilet miesięczny? Roczny też.' },
  ],
  widzew: [
    { speaker: 'bartek', face: 'angry', text: 'Kanar Prime? Myślałem, że on was zatrzyma na dłużej. Mnie kontrolował trzy razy w tym tygodniu.' },
    { speaker: 'bartek', face: 'smirk', text: 'A ja nawet nie jeżdżę pociągiem. No bo jak, skoro nie ma torów.' },
  ],
  andrzejow: [
    { speaker: 'bartek', face: 'butthurt', text: 'Rozwaliliście mi kontakt w skupie. Z czego ja teraz będę kupował kawę?' },
    { speaker: 'bartek', face: 'smirk', text: 'Spokojnie. Mam zapas na dwa tygodnie. Lemury pracują na trzy zmiany.' },
  ],
  bedon: [
    { speaker: 'bartek', face: 'smirk', text: 'Autobus ZKA? Ja nim nigdy nie jeżdżę. Ja jeżdżę taksówką. Z filiżanką. Bez spodka, bo trzęsie.' },
  ],
  justynow: [
    { speaker: 'bartek', face: 'butthurt', text: 'Gołąb Matka miała pisklęta. Dużo piskląt. Mam nadzieję, że jesteście z siebie dumni.' },
    { speaker: 'bartek', face: 'smirk', text: 'Ja jestem. Z siebie. Zawsze.' },
  ],
  galkowek: [
    { speaker: 'bartek', face: 'angry', text: 'Kierownik robót miał się tym zająć do 2031 roku. Wy zrobiliście to w jedno popołudnie. To nie fair.' },
    { speaker: 'bartek', face: 'neutral', text: 'Nie podoba mi się to. Wcale mi się to nie podoba.' },
  ],
  zakowice: [
    { speaker: 'bartek', face: 'smirk', text: 'Dobra. Koluszki. Czekam pod Dino. Mam krzesło, mam kawę, mam lemury.' },
    { speaker: 'bartek', face: 'smirk', text: 'A wy macie co? Teczkę? Powodzenia.' },
  ],
};

/** The finale: Bartek's shouts by phase, the slap prompt, and the epilogue. */
export const FINALE = {
  insults: ['DWADZIEŚCIA MINUT, HA!', 'MOJA KAWA KOSZTUJE WIĘCEJ NIŻ WASZE BUTY', 'IDŹCIE PIESZO, DOBRZE WAM ZROBI', 'ZIARNO PROSTO OD LEMURA', 'SPÓŹNICIE SIĘ NA KOLACJĘ', 'NIE MA TORÓW, NIE MA PROBLEMU'],
  refill: 'LEMURY, DOLEWKA!',
  sip: '*siorb*',
  gulp: 'DUSZKIEM!',
  miss: ['Pudło!', 'Ha! Nawet tego nie umiecie.', 'Kawa mi stygnie, pośpieszcie się.'],
  after: [
    { speaker: 'bartek', face: 'butthurt', text: 'Moja... filiżanka... Była z porcelany...' },
    { speaker: 'piotrek', face: 'smirk', text: 'A tory były ze stali. Smacznego, Bartek.' },
  ] as Line[],
  train: [{ speaker: 'piotrek', face: 'smirk', text: 'No. To teraz do domu. Dwadzieścia minut.' }] as Line[],
  /** The hint by his cup as the fight starts. */
  hint: 'Pełna filiżanka to jego tarcza. Ubijaj lemury, zanim doniosą dolewkę.',
};
