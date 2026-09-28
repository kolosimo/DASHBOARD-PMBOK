/**
 * CambioStatoService: uno stato alla volta, ritorno con motivo, WIP con
 * conferma e audit, 409 su doppio spostamento, transizioni ed eventi.
 */
import { test } from '@japa/runner'
import Elaborato from '#models/elaborato'
import Commessa from '#models/commessa'
import StatoElaborato from '#models/stato_elaborato'
import TransizioneElaborato from '#models/transizione_elaborato'
import AuditLog from '#models/audit_log'
import Utente from '#models/utente'
import Disciplina from '#models/disciplina'
import { ConflittoVersione } from '#shared/optimistic'
import { ascoltaEventi, type Evento } from '#shared/eventi'
import CambioStatoService, {
  ElaboratoNonTrovato,
  PassaggioNonAmmesso,
  WipDaConfermare,
} from '#modules/flusso/cambio_stato_service'
import { conTransazione } from '#tests/helpers/db'
import db from '@adonisjs/lucid/services/db'

async function elaborato(codice: string) {
  return Elaborato.findByOrFail('codice', codice)
}
async function stato(codice: string) {
  return StatoElaborato.findByOrFail('codice', codice)
}
async function utenteId(slug: string) {
  return (await Utente.findByOrFail('email', `${slug}@climosfera.example`)).id
}

test.group('Flusso · CambioStatoService', (group) => {
  conTransazione(group)

  test('avanti di uno stato: stato, stato_dal, versione, transizione, audit ed evento', async ({
    assert,
  }) => {
    const el = await elaborato('MEC-PL-102') // Impostato (1), colonna In corso
    const calcoli = await stato('calcoli')
    const mec1 = await utenteId('mec1')
    const eventi: Evento[] = []
    const smetti = ascoltaEventi((_canale, e) => eventi.push(e))
    try {
      const esito = await CambioStatoService.cambia({
        elaboratoId: el.id,
        versioneAttesa: el.version,
        aStatoId: calcoli.id,
        utenteId: mec1,
      })
      assert.equal(esito.aStato.codice, 'calcoli')
      assert.isFalse(esito.wipSforato)
    } finally {
      smetti()
    }

    const ora = await Elaborato.findOrFail(el.id)
    assert.equal(ora.statoId, calcoli.id)
    assert.equal(ora.version, el.version + 1)
    assert.isTrue(ora.statoDal > el.statoDal)

    const ultima = await TransizioneElaborato.query()
      .where('elaborato_id', el.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(ultima.daStatoId, el.statoId)
    assert.equal(ultima.aStatoId, calcoli.id)
    assert.equal(ultima.utenteId, mec1)
    assert.isFalse(ultima.wipSforato)
    assert.equal(ultima.avvenutaIl.toMillis(), ora.statoDal.toMillis())

    const voce = await AuditLog.query()
      .where('azione', 'elaborato.stato_cambiato')
      .where('entita_id', String(el.id))
      .firstOrFail()
    assert.equal(voce.commessaId, el.commessaId)
    assert.equal(voce.utenteId, mec1)

    assert.lengthOf(eventi, 1)
    assert.equal(eventi[0].tipo, 'elaborato.stato_cambiato')
    assert.equal(eventi[0].commessaId, el.commessaId)
    assert.equal(eventi[0].elaboratoId, el.id)
  })

  test('salto di stato rifiutato (422) senza modifiche', async ({ assert }) => {
    const el = await elaborato('MEC-PL-102') // Impostato (1)
    const emissione = await stato('emissione_interna') // 3
    const prima = await TransizioneElaborato.query().where('elaborato_id', el.id).count('* as n')
    try {
      await CambioStatoService.cambia({
        elaboratoId: el.id,
        versioneAttesa: el.version,
        aStatoId: emissione.id,
        motivo: 'di corsa',
        utenteId: null,
      })
      assert.fail('doveva rifiutare')
    } catch (errore) {
      assert.instanceOf(errore, PassaggioNonAmmesso)
      assert.equal((errore as PassaggioNonAmmesso).status, 422)
    }
    const ora = await Elaborato.findOrFail(el.id)
    assert.equal(ora.statoId, el.statoId)
    assert.equal(ora.version, el.version)
    const dopo = await TransizioneElaborato.query().where('elaborato_id', el.id).count('* as n')
    assert.equal(Number(dopo[0].$extras.n), Number(prima[0].$extras.n))
  })

  test('indietro: senza motivo rifiutato, con motivo ammesso e registrato', async ({ assert }) => {
    const el = await elaborato('ELE-SC-201') // Calcoli (2)
    const impostato = await stato('impostato')
    for (const motivo of [null, '   ']) {
      try {
        await CambioStatoService.cambia({
          elaboratoId: el.id,
          versioneAttesa: el.version,
          aStatoId: impostato.id,
          motivo,
          utenteId: null,
        })
        assert.fail('doveva rifiutare')
      } catch (errore) {
        assert.instanceOf(errore, PassaggioNonAmmesso)
      }
    }
    await CambioStatoService.cambia({
      elaboratoId: el.id,
      versioneAttesa: el.version,
      aStatoId: impostato.id,
      motivo: '  Nuovo input dal cliente sui carichi  ',
      utenteId: null,
    })
    const ultima = await TransizioneElaborato.query()
      .where('elaborato_id', el.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(ultima.aStatoId, impostato.id)
    assert.equal(ultima.motivo, 'Nuovo input dal cliente sui carichi')
  })

  test('WIP: sforare chiede conferma e motivo; confermato va in audit', async ({ assert }) => {
    // In verifica ha 3 elaborati con limite 3: MEC-PL-101 (Calcoli) non può entrare senza conferma
    const el = await elaborato('MEC-PL-101')
    const emissione = await stato('emissione_interna')
    for (const [conferma, motivo] of [
      [false, null],
      [false, 'serve'],
      [true, null],
    ] as const) {
      try {
        await CambioStatoService.cambia({
          elaboratoId: el.id,
          versioneAttesa: el.version,
          aStatoId: emissione.id,
          confermaWip: conferma,
          motivo,
          utenteId: null,
        })
        assert.fail('doveva chiedere conferma')
      } catch (errore) {
        assert.instanceOf(errore, WipDaConfermare)
        const e = errore as WipDaConfermare
        assert.equal(e.status, 422)
        assert.equal(e.elaboratiInColonna, 3)
        assert.equal(e.colonna.limiteWip, 3)
        assert.include(e.message, 'In verifica')
      }
    }
    assert.equal((await Elaborato.findOrFail(el.id)).statoId, el.statoId)

    const pm1 = await utenteId('pm1')
    const esito = await CambioStatoService.cambia({
      elaboratoId: el.id,
      versioneAttesa: el.version,
      aStatoId: emissione.id,
      confermaWip: true,
      motivo: 'Consegna anticipata richiesta dal cliente',
      utenteId: pm1,
    })
    assert.isTrue(esito.wipSforato)
    const ultima = await TransizioneElaborato.query()
      .where('elaborato_id', el.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.isTrue(ultima.wipSforato)
    const voce = await AuditLog.query().where('azione', 'kanban.wip_sforato').firstOrFail()
    assert.equal(voce.utenteId, pm1)
    assert.equal(voce.commessaId, el.commessaId)
    const dopo = voce.datiDopo as Record<string, unknown>
    assert.equal(dopo.colonna, 'in_verifica')
    assert.equal(dopo.limiteWip, 3)
    assert.equal(dopo.elaboratiPrima, 3)
    assert.equal(dopo.motivo, 'Consegna anticipata richiesta dal cliente')
  })

  test('passaggio nella stessa colonna non controlla il WIP', async ({ assert }) => {
    // In corso è già oltre il limite (5 su 4): Impostato → Calcoli resta in colonna
    const el = await elaborato('IDR-PL-301')
    const esito = await CambioStatoService.cambia({
      elaboratoId: el.id,
      versioneAttesa: el.version,
      aStatoId: (await stato('calcoli')).id,
      utenteId: null,
    })
    assert.isFalse(esito.wipSforato)
  })

  test('verso una colonna senza limite (Emesso) nessuna conferma', async ({ assert }) => {
    const el = await elaborato('ANT-RT-401') // Verificato (4)
    const esito = await CambioStatoService.cambia({
      elaboratoId: el.id,
      versioneAttesa: el.version,
      aStatoId: (await stato('emesso_cliente')).id,
      utenteId: null,
    })
    assert.equal(esito.aStato.codice, 'emesso_cliente')
  })

  test('doppio spostamento dalla stessa versione: il secondo è 409', async ({ assert }) => {
    const el = await elaborato('MEC-PL-110') // Calcoli (2)
    const impostato = await stato('impostato')
    await CambioStatoService.cambia({
      elaboratoId: el.id,
      versioneAttesa: el.version,
      aStatoId: impostato.id,
      motivo: 'rilavorazione',
      utenteId: null,
    })
    try {
      await CambioStatoService.cambia({
        elaboratoId: el.id,
        versioneAttesa: el.version,
        aStatoId: impostato.id,
        motivo: 'rilavorazione',
        utenteId: null,
      })
      assert.fail('doveva essere 409')
    } catch (errore) {
      assert.instanceOf(errore, ConflittoVersione)
      assert.equal((errore as ConflittoVersione).status, 409)
    }
    const n = await TransizioneElaborato.query()
      .where('elaborato_id', el.id)
      .where('a_stato_id', impostato.id)
      .whereNotNull('da_stato_id')
      .where('motivo', 'rilavorazione')
    assert.lengthOf(n, 1)
  })

  test('elaborato di un’altra commessa → 404', async ({ assert }) => {
    const el = await elaborato('MEC-PL-102')
    const altra = await Commessa.findByOrFail('codice', 'CL-2026-018')
    try {
      await CambioStatoService.cambia({
        elaboratoId: el.id,
        commessaId: altra.id,
        versioneAttesa: el.version,
        aStatoId: (await stato('calcoli')).id,
        utenteId: null,
      })
      assert.fail('doveva essere 404')
    } catch (errore) {
      assert.instanceOf(errore, ElaboratoNonTrovato)
    }
  })

  test('stato iniziale e nascita di un elaborato nuovo (per il modulo anagrafiche)', async ({
    assert,
  }) => {
    const commessa = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const disciplina = await Disciplina.findByOrFail('codice', 'MEC')
    const nuovo = await db.transaction(async (trx) => {
      const iniziale = await CambioStatoService.statoIniziale(trx)
      const el = await Elaborato.create(
        {
          commessaId: commessa.id,
          codice: 'MEC-NU-900',
          titolo: 'Elaborato di prova',
          disciplinaId: disciplina.id,
          budgetMinuti: 600,
          classeServizio: 'standard',
          statoId: iniziale.statoId,
          statoDal: iniziale.statoDal,
        },
        { client: trx }
      )
      await CambioStatoService.registraNascita(el, null, trx)
      return el
    })
    const nonIniziato = await stato('non_iniziato')
    assert.equal(nuovo.statoId, nonIniziato.id)
    const storia = await TransizioneElaborato.query().where('elaborato_id', nuovo.id)
    assert.lengthOf(storia, 1)
    assert.isNull(storia[0].daStatoId)
    assert.equal(storia[0].aStatoId, nonIniziato.id)
  })
})
