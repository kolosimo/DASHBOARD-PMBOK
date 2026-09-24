/**
 * Glossario dei termini mostrati nell'interfaccia.
 * Le sigle restano in inglese (sono standard), la spiegazione è in italiano.
 * Da confermare con l'utente al Gate 0.
 */

export interface VoceGlossario {
  sigla: string
  nome: string
  spiegazione: string
}

export const glossario = {
  BAC: {
    sigla: 'BAC',
    nome: 'Budget a completamento',
    spiegazione: 'Ore a budget di tutti gli elaborati della commessa.',
  },
  PV: {
    sigla: 'PV',
    nome: 'Valore pianificato',
    spiegazione: 'Ore di lavoro che secondo la baseline dovevano essere fatte a oggi.',
  },
  EV: {
    sigla: 'EV',
    nome: 'Valore guadagnato',
    spiegazione:
      'Ore di lavoro effettivamente prodotte: budget di ogni elaborato per il peso del suo stato.',
  },
  AC: {
    sigla: 'AC',
    nome: 'Ore registrate',
    spiegazione: 'Costo effettivo in ore: somma delle ore registrate sulla commessa.',
  },
  SPI: {
    sigla: 'SPI',
    nome: 'Indice di avanzamento',
    spiegazione: 'EV / PV. Sotto 1 la commessa produce meno di quanto pianificato.',
  },
  CPI: {
    sigla: 'CPI',
    nome: 'Indice di efficienza',
    spiegazione: 'EV / AC. Sotto 1 servono più ore del previsto per il lavoro fatto.',
  },
  EAC: {
    sigla: 'EAC',
    nome: 'Stima a completamento',
    spiegazione: 'BAC / CPI: ore totali che la commessa richiederà se l’efficienza resta questa.',
  },
  ETC: {
    sigla: 'ETC',
    nome: 'Ore ancora necessarie',
    spiegazione: 'EAC − AC: ore che servono ancora per finire.',
  },
  VAC: {
    sigla: 'VAC',
    nome: 'Scarto a completamento',
    spiegazione: 'BAC − EAC: negativo se a fine commessa si sforerà il budget.',
  },
  PPC: {
    sigla: 'PPC',
    nome: 'Impegni mantenuti',
    spiegazione:
      'Impegni settimanali fatti sul totale promesso. Misura l’affidabilità del piano del team, non la bravura dei singoli.',
  },
  PCR: {
    sigla: 'PCR',
    nome: 'Vincoli rimossi',
    spiegazione:
      'Vincoli rimossi entro la settimana sul totale di quelli aperti con scadenza nella settimana.',
  },
  TMR: {
    sigla: 'TMR',
    nome: 'Attività rese pronte',
    spiegazione:
      'Attività previste nel lookahead di due settimane prima che sono entrate nel piano della settimana.',
  },
  TA: {
    sigla: 'TA',
    nome: 'Attività anticipate',
    spiegazione:
      'Impegni della settimana che erano già previsti nel lookahead di due settimane prima.',
  },
  WIP: {
    sigla: 'WIP',
    nome: 'Lavoro in corso',
    spiegazione: 'Numero di elaborati in una colonna del Kanban; il limite evita di aprire troppo.',
  },
  WIA: {
    sigla: 'Età',
    nome: 'Età nello stato',
    spiegazione: 'Giorni da cui l’elaborato è nello stato attuale (Work Item Age).',
  },
  CT: {
    sigla: 'Cycle time',
    nome: 'Tempo di attraversamento',
    spiegazione: 'Giorni tra l’inizio del lavoro sull’elaborato e l’emissione.',
  },
  TH: {
    sigla: 'Throughput',
    nome: 'Elaborati emessi per settimana',
    spiegazione: 'Numero di elaborati arrivati allo stato finale nella settimana.',
  },
  CFD: {
    sigla: 'CFD',
    nome: 'Diagramma di flusso cumulativo',
    spiegazione: 'Numero di elaborati in ogni colonna, giorno per giorno.',
  },
} as const satisfies Record<string, VoceGlossario>

export type SiglaGlossario = keyof typeof glossario
