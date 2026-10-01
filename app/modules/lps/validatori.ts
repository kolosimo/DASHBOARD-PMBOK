/**
 * Validatori VineJS dei moduli del Last Planner. I campi vuoti arrivano come
 * null (bodyparser `convertEmptyStringsToNull`).
 */
import vine from '@vinejs/vine'
import { CATEGORIE_VINCOLO, TIPI_ATTIVITA_LOOKAHEAD } from '#domain/types'
import { SCALA_PUNTI } from '#domain/punti'

const DATA = /^\d{4}-\d{2}-\d{2}$/

const idFacoltativo = () => vine.number().withoutDecimals().min(1).nullable().optional()

export const validatoreAttivita = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1).optional(),
    codice: vine.string().trim().minLength(1).maxLength(20),
    titolo: vine.string().trim().minLength(1).maxLength(300),
    tipo: vine.enum(TIPI_ATTIVITA_LOOKAHEAD),
    elaborato_id: idFacoltativo(),
    disciplina_id: idFacoltativo(),
    responsabile_id: idFacoltativo(),
    settimana_inizio: vine.string().regex(DATA),
    settimana_fine: vine.string().regex(DATA),
  })
)

export const validatoreVincolo = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1).optional(),
    descrizione: vine.string().trim().minLength(1).maxLength(500),
    categoria: vine.enum(CATEGORIE_VINCOLO),
    stato: vine.enum(['da_analizzare', 'aperto'] as const),
    responsabile_id: idFacoltativo(),
    responsabile_esterno: vine.string().trim().maxLength(200).nullable().optional(),
    data_necessaria: vine.string().regex(DATA).nullable().optional(),
    identificato_il: vine.string().regex(DATA).nullable().optional(),
    note: vine.string().trim().maxLength(2000).nullable().optional(),
    attivita: vine.array(vine.number().withoutDecimals().min(1)).optional(),
  })
)

export const validatoreVersione = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
  })
)

export const validatoreImpegno = vine.create(
  vine.object({
    descrizione: vine.string().trim().maxLength(500).nullable().optional(),
    attivita_id: idFacoltativo(),
    elaborato_id: idFacoltativo(),
    last_planner_id: idFacoltativo(),
    punti: vine
      .number()
      .in([...SCALA_PUNTI])
      .nullable()
      .optional(),
  })
)

export const validatorePunti = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    punti: vine
      .number()
      .in([...SCALA_PUNTI])
      .nullable()
      .optional(),
  })
)

export const validatoreEsito = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    fatto: vine
      .enum(['si', 'no'] as const)
      .nullable()
      .optional(),
    fatto_attuale: vine
      .enum(['si', 'no', ''] as const)
      .nullable()
      .optional(),
    causa_id: idFacoltativo(),
    perche: vine.array(vine.string().trim().maxLength(300).nullable()).maxLength(5).optional(),
  })
)
