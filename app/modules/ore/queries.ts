/**
 * Query di lettura delle ore. Proprietario: agente A4.
 *
 * Regola: nessuna classifica per persona. Le ore per persona compaiono solo
 * se l'abilità `vedeOrePerPersona` lo consente (il controllo è nel controller)
 * e sono sempre in ordine alfabetico, mai per quantità di ore.
 *
 * Le tabelle `elaborati`, `commesse`, `membri_commessa` e `utenti` sono lette
 * in join (sola lettura); l'unica tabella scritta dal modulo è `registrazioni_ore`.
 */
import db from '@adonisjs/lucid/services/db'
import type { DataIso, Lunedi, Minuti } from '#domain/types'
import { domenicaDi } from '#shared/calendario'

export interface OreCommessa {
  commessaId: number
  settimana: Lunedi
  /** Una riga per ogni elaborato della commessa (anche senza ore), in ordine di codice */
  perElaborato: {
    elaboratoId: number
    codice: string
    titolo: string
    minutiSettimana: Minuti
    /** Ore registrate dall'inizio fino alla domenica della settimana (AC cumulato) */
    minutiTotali: Minuti
    budgetMinuti: Minuti
  }[]
  totaleSettimanaMinuti: Minuti
  /** Ore registrate sulla commessa fino alla domenica della settimana */
  totaleCommessaMinuti: Minuti
}

function intero(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * Ore della commessa aggregate per elaborato, per la settimana indicata
 * (da lunedì a domenica), più il cumulato fino alla fine della settimana.
 * Una sola query; le registrazioni successive alla settimana non contano.
 */
export async function oreCommessa(commessaId: number, settimana: Lunedi): Promise<OreCommessa> {
  const domenica = domenicaDi(settimana)
  const righe = await db
    .from('elaborati as e')
    .leftJoin('registrazioni_ore as r', (j) => {
      j.on('r.elaborato_id', '=', 'e.id').andOnVal('r.data', '<=', domenica)
    })
    .where('e.commessa_id', commessaId)
    .groupBy('e.id', 'e.codice', 'e.titolo', 'e.budget_minuti')
    .orderBy('e.codice', 'asc')
    .select('e.id', 'e.codice', 'e.titolo', 'e.budget_minuti')
    .select(
      db.raw('COALESCE(SUM(r.minuti) FILTER (WHERE r.data >= ?), 0)::int AS minuti_settimana', [
        settimana,
      ])
    )
    .select(db.raw('COALESCE(SUM(r.minuti), 0)::int AS minuti_totali'))

  const perElaborato = righe.map((r) => ({
    elaboratoId: Number(r.id),
    codice: String(r.codice),
    titolo: String(r.titolo),
    minutiSettimana: intero(r.minuti_settimana),
    minutiTotali: intero(r.minuti_totali),
    budgetMinuti: intero(r.budget_minuti),
  }))
  return {
    commessaId,
    settimana,
    perElaborato,
    totaleSettimanaMinuti: perElaborato.reduce((a, r) => a + r.minutiSettimana, 0),
    totaleCommessaMinuti: perElaborato.reduce((a, r) => a + r.minutiTotali, 0),
  }
}

export interface OrePersonaCommessa {
  utenteId: number
  nome: string
  minutiSettimana: Minuti
  minutiTotali: Minuti
}

/**
 * Ore per persona della commessa (settimana e cumulato fino alla domenica).
 * Da mostrare SOLO se `vedeOrePerPersona` lo consente. Ordine alfabetico per
 * nome: mai per ore (niente classifiche, art. 4 Statuto dei lavoratori).
 */
export async function orePerPersona(
  commessaId: number,
  settimana: Lunedi
): Promise<OrePersonaCommessa[]> {
  const domenica = domenicaDi(settimana)
  const righe = await db
    .from('registrazioni_ore as r')
    .join('elaborati as e', 'e.id', 'r.elaborato_id')
    .join('utenti as u', 'u.id', 'r.utente_id')
    .where('e.commessa_id', commessaId)
    .where('r.data', '<=', domenica)
    .groupBy('u.id', 'u.nome')
    .orderBy('u.nome', 'asc')
    .select('u.id', 'u.nome')
    .select(
      db.raw('COALESCE(SUM(r.minuti) FILTER (WHERE r.data >= ?), 0)::int AS minuti_settimana', [
        settimana,
      ])
    )
    .select(db.raw('SUM(r.minuti)::int AS minuti_totali'))
  return righe.map((r) => ({
    utenteId: Number(r.id),
    nome: String(r.nome),
    minutiSettimana: intero(r.minuti_settimana),
    minutiTotali: intero(r.minuti_totali),
  }))
}

// ---------------------------------------------------------------------------
// Timesheet personale
// ---------------------------------------------------------------------------

export interface CellaOre {
  data: DataIso
  /** null se nel giorno non c'è una registrazione */
  registrazioneId: number | null
  minuti: Minuti
  /** 0 se la registrazione non esiste ancora */
  version: number
}

export interface RigaTimesheet {
  elaboratoId: number
  codice: string
  titolo: string
  commessaId: number
  commessaCodice: string
  /** true se l'utente è il responsabile dell'elaborato */
  responsabile: boolean
  budgetMinuti: Minuti
  /** Ore di tutti sull'elaborato, dall'inizio a oggi */
  minutiElaboratoTotali: Minuti
  /** 7 celle, da lunedì a domenica */
  celle: CellaOre[]
  minutiSettimana: Minuti
}

/**
 * Righe del timesheet di un utente per una settimana (7 giorni da `giorni`).
 *
 * Elaborati delle commesse attive di cui l'utente è membro o PM, più quelli
 * su cui ha già ore nella settimana (anche se nel frattempo è uscito dal team).
 * Ordine: prima gli elaborati di cui è responsabile, poi per commessa e codice.
 */
export async function righeTimesheet(
  utenteId: number,
  giorni: DataIso[]
): Promise<RigaTimesheet[]> {
  const lunedi = giorni[0]
  const domenica = giorni[giorni.length - 1]

  const elaborati = await db
    .from('elaborati as e')
    .join('commesse as c', 'c.id', 'e.commessa_id')
    .where((q) => {
      q.where((m) => {
        m.where('c.stato', 'attiva').where((p) => {
          p.where('c.pm_id', utenteId).orWhereExists((s) => {
            s.from('membri_commessa as mc')
              .whereRaw('mc.commessa_id = c.id')
              .where('mc.utente_id', utenteId)
          })
        })
      }).orWhereExists((s) => {
        s.from('registrazioni_ore as r0')
          .whereRaw('r0.elaborato_id = e.id')
          .where('r0.utente_id', utenteId)
          .whereBetween('r0.data', [lunedi, domenica])
      })
    })
    .select(
      'e.id',
      'e.codice',
      'e.titolo',
      'e.budget_minuti',
      'e.responsabile_id',
      'c.id as commessa_id',
      'c.codice as commessa_codice'
    )
    .select(
      db.raw(
        '(SELECT COALESCE(SUM(rt.minuti), 0)::int FROM registrazioni_ore rt WHERE rt.elaborato_id = e.id) AS minuti_totali'
      )
    )
    .orderByRaw('CASE WHEN e.responsabile_id = ? THEN 0 ELSE 1 END', [utenteId])
    .orderBy('c.codice', 'asc')
    .orderBy('e.codice', 'asc')

  const registrazioni = await db
    .from('registrazioni_ore')
    .where('utente_id', utenteId)
    .whereBetween('data', [lunedi, domenica])
    .select('id', 'elaborato_id', 'data', 'minuti', 'version')

  const perChiave = new Map<string, { id: number; minuti: number; version: number }>()
  for (const r of registrazioni) {
    perChiave.set(`${r.elaborato_id}|${String(r.data)}`, {
      id: Number(r.id),
      minuti: Number(r.minuti),
      version: Number(r.version),
    })
  }

  return elaborati.map((e) => {
    const celle = giorni.map((data) => {
      const r = perChiave.get(`${e.id}|${data}`)
      return {
        data,
        registrazioneId: r?.id ?? null,
        minuti: r?.minuti ?? 0,
        version: r?.version ?? 0,
      }
    })
    return {
      elaboratoId: Number(e.id),
      codice: String(e.codice),
      titolo: String(e.titolo),
      commessaId: Number(e.commessa_id),
      commessaCodice: String(e.commessa_codice),
      responsabile: e.responsabile_id !== null && Number(e.responsabile_id) === utenteId,
      budgetMinuti: intero(e.budget_minuti),
      minutiElaboratoTotali: intero(e.minuti_totali),
      celle,
      minutiSettimana: celle.reduce((a, c) => a + c.minuti, 0),
    }
  })
}

/** Minuti registrati dall'utente in un giorno, su tutti gli elaborati */
export async function minutiGiornoUtente(utenteId: number, data: DataIso): Promise<Minuti> {
  const r = await db
    .from('registrazioni_ore')
    .where('utente_id', utenteId)
    .where('data', data)
    .sum('minuti as totale')
    .first()
  return intero(r?.totale)
}

/** Minuti registrati dall'utente tra due date (incluse) */
export async function minutiPeriodoUtente(
  utenteId: number,
  da: DataIso,
  a: DataIso,
  elaboratoId?: number
): Promise<Minuti> {
  const q = db.from('registrazioni_ore').where('utente_id', utenteId).whereBetween('data', [da, a])
  if (elaboratoId !== undefined) q.where('elaborato_id', elaboratoId)
  const r = await q.sum('minuti as totale').first()
  return intero(r?.totale)
}

/** Minuti di tutti sull'elaborato, dall'inizio */
export async function minutiElaborato(elaboratoId: number): Promise<Minuti> {
  const r = await db
    .from('registrazioni_ore')
    .where('elaborato_id', elaboratoId)
    .sum('minuti as totale')
    .first()
  return intero(r?.totale)
}
