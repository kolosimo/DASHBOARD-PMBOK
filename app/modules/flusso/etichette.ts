/**
 * Etichette delle classi di servizio mostrate sulle schede del Kanban.
 * Proposta all'orchestratore: spostarle in app/ui/glossario.ts.
 */
import type { ClasseServizio } from '#domain/types'

export const ETICHETTE_CLASSE: Record<ClasseServizio, { testo: string; spiegazione: string }> = {
  standard: {
    testo: 'standard',
    spiegazione: 'Si lavora in ordine di arrivo.',
  },
  data_fissa: {
    testo: 'data fissa',
    spiegazione: 'Va emesso entro una data concordata: si pianifica a ritroso.',
  },
  urgente: {
    testo: 'urgente',
    spiegazione: 'Passa davanti agli altri e può superare il limite WIP con conferma.',
  },
  intangibile: {
    testo: 'intangibile',
    spiegazione: 'Lavoro utile senza scadenza a breve (per esempio aggiornare modelli di calcolo).',
  },
}
