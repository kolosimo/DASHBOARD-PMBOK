import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { registraAudit } from '#shared/audit'
import { ascoltaEventi, pubblica } from '#shared/eventi'
import { conTransazione } from '#tests/helpers/db'

test.group('Dati di esempio (coerenza con il prototipo)', (group) => {
  conTransazione(group)

  test('CL-2026-031: BAC 424 h, EV 242 h, PV W39 312 h, AC 320 h', async ({ assert }) => {
    const [r] = await db
      .rawQuery(
        `
      SELECT
        sum(e.budget_minuti) AS bac,
        sum(e.budget_minuti * s.peso_ev_percento) / 100 AS ev,
        (SELECT sum(minuti) FROM registrazioni_ore ro WHERE ro.elaborato_id IN
           (SELECT id FROM elaborati WHERE commessa_id = c.id)) AS ac,
        (SELECT pv_minuti FROM baseline_pv_settimana pv JOIN baseline b ON b.id = pv.baseline_id
           WHERE b.commessa_id = c.id AND pv.settimana = '2026-09-21') AS pv
      FROM commesse c
      JOIN elaborati e ON e.commessa_id = c.id
      JOIN stati_elaborato s ON s.id = e.stato_id
      WHERE c.codice = 'CL-2026-031'
      GROUP BY c.id
    `
      )
      .then((x) => x.rows)
    assert.equal(r.bac, 424 * 60)
    assert.equal(Number(r.ev), 242 * 60)
    assert.equal(r.pv, 312 * 60)
    assert.equal(r.ac, 320 * 60)
  })

  test('configurazione: 4 discipline, 6 stati con pesi cumulativi, 8 cause', async ({ assert }) => {
    const discipline = await db.from('discipline').orderBy('ordine').select('codice')
    assert.deepEqual(
      discipline.map((d) => d.codice),
      ['MEC', 'ELE', 'IDR', 'ANT']
    )
    const stati = await db.from('stati_elaborato').orderBy('ordine').select('peso_ev_percento')
    assert.deepEqual(
      stati.map((s) => s.peso_ev_percento),
      [0, 20, 50, 70, 85, 100]
    )
    assert.lengthOf(await db.from('cause_non_completamento'), 8)
    const esempio = await db.from('impostazioni').where('di_esempio', false)
    assert.lengthOf(esempio, 0)
  })

  test('sostituzioni BIM: V-16 e L6 senza riferimenti BIM', async ({ assert }) => {
    const v16 = await db.from('vincoli').where('codice', 'V-16').firstOrFail()
    assert.equal(v16.descrizione, 'Tavole strutturali aggiornate dallo strutturista')
    const l6 = await db.from('attivita_lookahead').where('codice', 'L6').firstOrFail()
    assert.equal(l6.titolo, 'Coordinamento impianti / strutture')
    const bim = await db.rawQuery(
      `SELECT count(*) AS n FROM (
         SELECT descrizione AS t FROM vincoli UNION ALL SELECT titolo FROM attivita_lookahead
         UNION ALL SELECT titolo FROM elaborati UNION ALL SELECT nome FROM utenti
       ) x WHERE t ILIKE '%bim%' OR t ILIKE '%ifc%'`
    )
    assert.equal(bim.rows[0].n, 0)
  })

  test('piano W39: 7 impegni, 5 fatti; storico W31–W38 negli snapshot', async ({ assert }) => {
    const imp = await db
      .from('impegni as i')
      .join('piani_settimanali as p', 'p.id', 'i.piano_id')
      .where('p.settimana', '2026-09-21')
      .select('i.fatto')
    assert.lengthOf(imp, 7)
    assert.equal(imp.filter((i) => i.fatto).length, 5)
    assert.lengthOf(await db.from('snapshot_lps'), 8)
    assert.lengthOf(await db.from('snapshot_evm'), 9)
  })
})

test.group('Audit ed eventi', (group) => {
  conTransazione(group)

  test('audit_log accetta solo inserimenti', async ({ assert }) => {
    const voce = await registraAudit({ utenteId: null, azione: 'prova', entita: 'test' })
    await assert.rejects(
      () => db.from('audit_log').where('id', voce.id).update({ azione: 'modificata' }),
      /solo inserimenti/
    )
  })

  test('pubblica invia l’evento sul canale della commessa', async ({ assert }) => {
    const ricevuti: { canale: string; tipo: string }[] = []
    const smetti = ascoltaEventi((canale, e) => ricevuti.push({ canale, tipo: e.tipo }))
    pubblica(7, 'elaborato.stato_cambiato', { elaboratoId: 3 })
    smetti()
    assert.deepEqual(ricevuti, [{ canale: 'commesse/7', tipo: 'elaborato.stato_cambiato' }])
  })
})
