/**
 * Dati di esempio ripresi dal prototipo (prototipo/index.html), con le
 * sostituzioni decise nel piano:
 * - V-16 = "Tavole strutturali aggiornate dallo strutturista";
 * - L6 = "Coordinamento impianti / strutture";
 * - responsabile "PM" (nessun riferimento BIM).
 *
 * Data di riferimento: giovedì 24/09/2026, settimana W39 (lunedì 21/09/2026).
 * Ore in ore intere nel prototipo: il seeder le converte in minuti.
 */

export const OGGI = '2026-09-24'
export const LUNEDI_CORRENTE = '2026-09-21'
export const DOMINIO_EMAIL = 'climosfera.example'

export const UTENTI = [
  { slug: 'admin', nome: 'Amministratore', ruolo: 'admin' },
  { slug: 'direzione', nome: 'Direzione', ruolo: 'direzione' },
  { slug: 'pm1', nome: 'PM 1', ruolo: 'pm' },
  { slug: 'pm2', nome: 'PM 2', ruolo: 'pm' },
  { slug: 'mec1', nome: 'Progettista MEC 1', ruolo: 'progettista' },
  { slug: 'mec2', nome: 'Progettista MEC 2', ruolo: 'progettista' },
  { slug: 'ele1', nome: 'Progettista ELE 1', ruolo: 'progettista' },
  { slug: 'ele2', nome: 'Progettista ELE 2', ruolo: 'progettista' },
  { slug: 'idr1', nome: 'Progettista IDR 1', ruolo: 'progettista' },
  { slug: 'qualita', nome: 'Resp. qualità', ruolo: 'progettista' },
] as const

export type SlugUtente = (typeof UTENTI)[number]['slug']

export const DISCIPLINE = [
  { codice: 'MEC', nome: 'Impianti meccanici', ordine: 1 },
  { codice: 'ELE', nome: 'Impianti elettrici', ordine: 2 },
  { codice: 'IDR', nome: 'Impianti idrico-sanitari', ordine: 3 },
  { codice: 'ANT', nome: 'Antincendio', ordine: 4 },
] as const

export const COLONNE_KANBAN = [
  { codice: 'da_fare', nome: 'Da fare', ordine: 1, limiteWipDefault: null },
  { codice: 'in_corso', nome: 'In corso', ordine: 2, limiteWipDefault: 4 },
  { codice: 'in_verifica', nome: 'In verifica', ordine: 3, limiteWipDefault: 3 },
  { codice: 'emesso', nome: 'Emesso', ordine: 4, limiteWipDefault: null },
] as const

/** Pesi EV cumulativi 0/20/50/70/85/100: di esempio, da confermare al Gate 0 */
export const STATI = [
  { codice: 'non_iniziato', nome: 'Non iniziato', ordine: 0, peso: 0, colonna: 'da_fare' },
  { codice: 'impostato', nome: 'Impostato', ordine: 1, peso: 20, colonna: 'in_corso' },
  {
    codice: 'calcoli',
    nome: 'Calcoli e dimensionamento',
    ordine: 2,
    peso: 50,
    colonna: 'in_corso',
  },
  {
    codice: 'emissione_interna',
    nome: 'Emissione interna',
    ordine: 3,
    peso: 70,
    colonna: 'in_verifica',
  },
  { codice: 'verificato', nome: 'Verificato', ordine: 4, peso: 85, colonna: 'in_verifica' },
  { codice: 'emesso_cliente', nome: 'Emesso al cliente', ordine: 5, peso: 100, colonna: 'emesso' },
] as const

export const CAUSE = [
  { codice: 'input_mancante', nome: 'Input mancante da altri' },
  { codice: 'criteri_cambiati', nome: 'Criteri o requisiti cambiati' },
  { codice: 'approvazione_attesa', nome: 'Approvazione cliente/ente attesa' },
  { codice: 'risorsa_non_disponibile', nome: 'Risorsa non disponibile' },
  { codice: 'stima_ottimista', nome: 'Stima troppo ottimista' },
  { codice: 'errore_rilavorazione', nome: 'Errore o rilavorazione' },
  { codice: 'priorita_cambiata', nome: 'Priorità cambiata dal PM' },
  { codice: 'altro', nome: 'Altro' },
] as const

export const COMMESSE = [
  {
    codice: 'CL-2026-031',
    nome: 'Scuola primaria – impianti meccanici ed elettrici',
    cliente: 'Comune (esempio)',
    pm: 'pm1',
    dataInizio: '2026-07-01',
    dataFinePrevista: '2026-11-13',
    membri: [
      ['pm1', 'pm'],
      ['mec1', 'progettista'],
      ['mec2', 'progettista'],
      ['ele1', 'progettista'],
      ['ele2', 'progettista'],
      ['idr1', 'progettista'],
      ['qualita', 'verificatore'],
      ['pm2', 'osservatore'],
    ],
    milestone: [
      { titolo: 'Avvio commessa', dataPrevista: '2026-07-01', dataEffettiva: '2026-07-01' },
      { titolo: 'Definitivo approvato', dataPrevista: '2026-09-04', dataEffettiva: '2026-09-04' },
      { titolo: 'Esecutivo meccanico', dataPrevista: '2026-10-30', dataEffettiva: null },
      { titolo: 'Esecutivo elettrico', dataPrevista: '2026-11-06', dataEffettiva: null },
      { titolo: 'Emissione finale', dataPrevista: '2026-11-13', dataEffettiva: null },
    ],
  },
  {
    codice: 'CL-2026-018',
    nome: 'Uffici Lotto B – HVAC e BMS',
    cliente: 'Società immobiliare (esempio)',
    pm: 'pm2',
    dataInizio: '2026-05-04',
    dataFinePrevista: '2026-12-18',
    membri: [
      ['pm2', 'pm'],
      ['mec2', 'progettista'],
      ['ele2', 'progettista'],
    ],
    milestone: [
      { titolo: 'Definitivo', dataPrevista: '2026-10-02', dataEffettiva: null },
      { titolo: 'Esecutivo', dataPrevista: '2026-12-11', dataEffettiva: null },
    ],
  },
  {
    codice: 'CL-2025-077',
    nome: 'RSA – antincendio e idrico-sanitario',
    cliente: 'Fondazione (esempio)',
    pm: 'pm1',
    dataInizio: '2025-11-03',
    dataFinePrevista: '2027-01-29',
    membri: [
      ['pm1', 'pm'],
      ['idr1', 'progettista'],
      ['qualita', 'verificatore'],
    ],
    milestone: [
      { titolo: 'Pratica VVF', dataPrevista: '2026-09-30', dataEffettiva: null },
      { titolo: 'Collaudo', dataPrevista: '2027-01-15', dataEffettiva: null },
    ],
  },
] as const

/**
 * Elaborati di CL-2026-031. bud e ac in ore; st = stato attuale (ordine),
 * pv = stato pianificato a oggi (ordine), age = giorni nello stato.
 */
export const ELABORATI = [
  {
    codice: 'MEC-RT-001',
    titolo: 'Relazione tecnica impianti meccanici',
    d: 'MEC',
    bud: 40,
    st: 3,
    ac: 31,
    pv: 4,
    age: 6,
    cls: 'standard',
    resp: 'mec1',
  },
  {
    codice: 'MEC-CA-002',
    titolo: 'Calcolo carichi termici invernali ed estivi',
    d: 'MEC',
    bud: 60,
    st: 5,
    ac: 66,
    pv: 5,
    age: 0,
    cls: 'standard',
    resp: 'mec2',
  },
  {
    codice: 'MEC-PL-101',
    titolo: 'Pianta PT – impianto di riscaldamento',
    d: 'MEC',
    bud: 48,
    st: 2,
    ac: 30,
    pv: 4,
    age: 12,
    cls: 'standard',
    resp: 'mec1',
  },
  {
    codice: 'MEC-PL-102',
    titolo: 'Pianta P1 – impianto di riscaldamento',
    d: 'MEC',
    bud: 48,
    st: 1,
    ac: 14,
    pv: 3,
    age: 4,
    cls: 'standard',
    resp: 'mec1',
  },
  {
    codice: 'MEC-PL-110',
    titolo: 'VMC – piante e schemi funzionali',
    d: 'MEC',
    bud: 56,
    st: 2,
    ac: 38,
    pv: 3,
    age: 9,
    cls: 'standard',
    resp: 'mec2',
  },
  {
    codice: 'ELE-SC-201',
    titolo: 'Schemi quadri elettrici',
    d: 'ELE',
    bud: 64,
    st: 2,
    ac: 40,
    pv: 2,
    age: 15,
    cls: 'standard',
    resp: 'ele1',
  },
  {
    codice: 'ELE-PL-210',
    titolo: 'Pianta PT – illuminazione',
    d: 'ELE',
    bud: 36,
    st: 3,
    ac: 24,
    pv: 3,
    age: 3,
    cls: 'standard',
    resp: 'ele2',
  },
  {
    codice: 'IDR-PL-301',
    titolo: 'Impianto idrico-sanitario – piante',
    d: 'IDR',
    bud: 40,
    st: 1,
    ac: 18,
    pv: 2,
    age: 5,
    cls: 'standard',
    resp: 'idr1',
  },
  {
    codice: 'ANT-RT-401',
    titolo: 'Relazione tecnica antincendio',
    d: 'ANT',
    bud: 32,
    st: 4,
    ac: 30,
    pv: 4,
    age: 2,
    cls: 'data_fissa',
    resp: 'pm1',
    dataFissa: '2026-09-30',
  },
] as const

/** Ore della settimana W39 (lun–ven), in ore */
export const ORE_SETTIMANA: { utente: SlugUtente; elaborato: string; ore: number[] }[] = [
  { utente: 'mec1', elaborato: 'MEC-PL-101', ore: [4, 6, 3, 0, 0] },
  { utente: 'mec1', elaborato: 'MEC-RT-001', ore: [2, 0, 3, 0, 0] },
  { utente: 'ele1', elaborato: 'ELE-SC-201', ore: [6, 5, 0, 0, 0] },
]

/** Impegni del piano settimanale W39 (promesso) */
export const IMPEGNI_W39 = [
  {
    descrizione: 'Completare dimensionamento radiatori PT',
    elaborato: 'MEC-PL-101',
    lp: 'mec1',
    fatto: true,
    causa: null,
  },
  {
    descrizione: 'Schemi VMC aula tipo',
    elaborato: 'MEC-PL-110',
    lp: 'mec2',
    fatto: true,
    causa: null,
  },
  {
    descrizione: 'Schema quadro elettrico generale',
    elaborato: 'ELE-SC-201',
    lp: 'ele1',
    fatto: false,
    causa: 'input_mancante',
  },
  {
    descrizione: 'Impostazione tavola idrico PT',
    elaborato: 'IDR-PL-301',
    lp: 'idr1',
    fatto: true,
    causa: null,
  },
  {
    descrizione: 'Verifica interna relazione antincendio',
    elaborato: 'ANT-RT-401',
    lp: 'pm1',
    fatto: false,
    causa: 'risorsa_non_disponibile',
  },
  {
    descrizione: 'Revisione relazione dopo commenti di verifica',
    elaborato: 'MEC-RT-001',
    lp: 'mec1',
    fatto: true,
    causa: null,
  },
  {
    descrizione: 'Calcolo illuminotecnico corridoi',
    elaborato: 'ELE-PL-210',
    lp: 'ele2',
    fatto: true,
    causa: null,
  },
] as const

/**
 * Storico dei piani chiusi W31–W38: [promessi, fatti]. PPC risultanti
 * 50/58/56/63/60/67/67/73%, vicini a quelli del prototipo (52…72%).
 * Le 30 cause di "no" riproducono il Pareto del prototipo.
 */
export const STORICO_PIANI: [number, number][] = [
  [10, 5],
  [12, 7],
  [9, 5],
  [8, 5],
  [10, 6],
  [9, 6],
  [9, 6],
  [11, 8],
]
export const CAUSE_STORICHE: Record<string, number> = {
  input_mancante: 9,
  approvazione_attesa: 5,
  risorsa_non_disponibile: 4,
  stima_ottimista: 4,
  criteri_cambiati: 3,
  errore_rilavorazione: 2,
  priorita_cambiata: 2,
  altro: 1,
}

/** Lookahead a 6 settimane (W40–W45). Settimane come numero ISO 2026. */
export const LOOKAHEAD = [
  {
    codice: 'L1',
    titolo: 'MEC-PL-102 · Pianta P1 riscaldamento',
    da: 40,
    a: 41,
    elaborato: 'MEC-PL-102',
  },
  {
    codice: 'L2',
    titolo: 'ELE-SC-201 · Schemi quadri elettrici',
    da: 40,
    a: 42,
    elaborato: 'ELE-SC-201',
  },
  {
    codice: 'L3',
    titolo: 'ELE-PL-210 · Emissione illuminazione PT',
    da: 40,
    a: 40,
    elaborato: 'ELE-PL-210',
  },
  {
    codice: 'L5',
    titolo: 'ANT-RT-401 · Emissione relazione antincendio',
    da: 40,
    a: 40,
    elaborato: 'ANT-RT-401',
  },
  {
    codice: 'L4',
    titolo: 'MEC-PL-110 · VMC piante e schemi',
    da: 41,
    a: 43,
    elaborato: 'MEC-PL-110',
  },
  {
    codice: 'L7',
    titolo: 'IDR-PL-301 · Idrico-sanitario piante',
    da: 41,
    a: 42,
    elaborato: 'IDR-PL-301',
  },
  { codice: 'L6', titolo: 'Coordinamento impianti / strutture', da: 42, a: 43, elaborato: null },
  {
    codice: 'M1',
    titolo: 'Milestone · Esecutivo meccanico',
    da: 44,
    a: 44,
    milestone: 'Esecutivo meccanico',
  },
  {
    codice: 'M2',
    titolo: 'Milestone · Esecutivo elettrico',
    da: 45,
    a: 45,
    milestone: 'Esecutivo elettrico',
  },
] as const

/** Registro vincoli. resp = slug utente oppure testo esterno */
export const VINCOLI = [
  {
    codice: 'V-12',
    descrizione: "Layout arredi P1 dall'architetto",
    categoria: 'input_da_altri',
    attivita: ['L1'],
    resp: 'pm1',
    serveEntro: '2026-09-29',
    rimosso: false,
  },
  {
    codice: 'V-13',
    descrizione: 'Planimetria architettonica rev. C',
    categoria: 'input_da_altri',
    attivita: ['L2'],
    resp: 'pm1',
    serveEntro: '2026-09-29',
    rimosso: false,
  },
  {
    codice: 'V-14',
    descrizione: "Conferma ricambi d'aria dal committente",
    categoria: 'approvazione',
    attivita: ['L4'],
    resp: 'pm1',
    serveEntro: '2026-10-06',
    rimosso: false,
  },
  {
    codice: 'V-15',
    descrizione: 'Verificatore interno disponibile',
    categoria: 'risorsa',
    attivita: ['L5'],
    resp: 'qualita',
    serveEntro: '2026-09-29',
    rimosso: false,
  },
  {
    codice: 'V-16',
    descrizione: 'Tavole strutturali aggiornate dallo strutturista',
    categoria: 'input_da_altri',
    attivita: ['L6'],
    resp: 'pm1',
    serveEntro: '2026-10-13',
    rimosso: false,
  },
  {
    codice: 'V-17',
    descrizione: 'Criteri illuminotecnici approvati',
    categoria: 'criteri',
    attivita: ['L3'],
    resp: 'ele1',
    serveEntro: '2026-10-06',
    rimosso: true,
  },
] as const

/** PV cumulato (ore) per settimana W30…W46, congelato nella baseline */
export const PV_SERIE = [
  0, 18, 45, 80, 122, 168, 212, 252, 285, 312, 340, 362, 382, 398, 410, 419, 424,
]
/** Frazioni di EV storico W30…W39 (W39 = EV attuale) */
export const EV_FRAZIONI = [0, 0.05, 0.13, 0.23, 0.35, 0.48, 0.6, 0.72, 0.86, 1]
