import { test } from '@japa/runner'
import * as formato from '#ui/formato'
import { glossario } from '#ui/glossario'

test.group('Formato it-IT', () => {
  test('null, undefined e non finiti diventano "n.d."', ({ assert }) => {
    assert.equal(formato.indice(null), 'n.d.')
    assert.equal(formato.indice(undefined), 'n.d.')
    assert.equal(formato.percento(Number.NaN), 'n.d.')
    assert.equal(formato.ore(Number.POSITIVE_INFINITY), 'n.d.')
    assert.equal(formato.data(null), 'n.d.')
    assert.equal(formato.settimana(null), 'n.d.')
  })

  test('numeri, indici e percentuali con la virgola', ({ assert }) => {
    assert.equal(formato.indice(0.7756), '0,78')
    assert.equal(formato.numero(1234.5, 1), '1.234,5')
    assert.equal(formato.percento(5 / 7), '71%')
  })

  test('ore da minuti', ({ assert }) => {
    assert.equal(formato.ore(25440), '424 h')
    assert.equal(formato.oreEsatte(90), '1,5 h')
    assert.equal(formato.oreEsatte(120), '2 h')
    assert.equal(formato.oreMinuti(95), '1:35')
  })

  test('date in ora di Roma', ({ assert }) => {
    assert.equal(formato.data('2026-09-24'), '24/09/2026')
    assert.equal(formato.dataBreve('2026-09-29'), '29/09')
    assert.equal(formato.dataOra('2026-09-27T22:30:00Z'), '28/09/2026 00:30')
    assert.equal(formato.settimana('2026-09-21'), 'W39')
  })

  test('glossario: EAC e ETC con i nomi decisi', ({ assert }) => {
    assert.equal(glossario.EAC.nome, 'Stima a completamento')
    assert.equal(glossario.ETC.nome, 'Ore ancora necessarie')
  })
})
