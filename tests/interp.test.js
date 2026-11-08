/*
 * interp.test.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const I = require('../js/interp.js')
const { run, base } = require('./helpers.js')

const msgs = (r, where) => r.errors.filter((e) => !where || e.where === where).map((e) => e.msg)

test('lenguaje: validaciones', () => {
  const l = I.parseLanguage([{ kind: 'pred', name: 'P', arity: 0 }, { kind: 'fn', name: 'f', arity: -1 }, { kind: 'pred', name: '', arity: 1 },
    { kind: 'pred', name: 'Q', arity: 'a' }, { kind: 'fn', name: 'x', arity: 1 }, { kind: 'fn', name: 'R', arity: 9 }])
  assert.equal(l.errors.length, 6)
  const dup = I.parseLanguage([{ kind: 'pred', name: 'P', arity: 1 }, { kind: 'fn', name: 'P', arity: 1 }])
  assert.match(dup.errors[0].msg, /más de una vez/)
  const ok = I.parseLanguage([{ kind: 'fn', name: 'c', arity: '0' }, { kind: 'pred', name: 'P', arity: '2' }])
  assert.equal(ok.errors.length, 0)
  assert.deepEqual(ok.symbols.get('P'), { kind: 'pred', arity: 2 })
})

test('dominio: vacío, repetidos, elementos inválidos, llaves', () => {
  assert.match(I.parseDomain('').errors[0].msg, /no vacío/)
  assert.match(I.parseDomain(' , ,').errors[0].msg, /no vacío/)
  assert.match(I.parseDomain('a, b, a').errors[0].msg, /repetido/)
  assert.match(I.parseDomain('a, b c').errors[0].msg, /no es válido/)
  assert.deepEqual(I.parseDomain('{1, 2, 3}').domain, ['1', '2', '3'])
  assert.deepEqual(I.parseDomain('a\nb;c').domain, ['a', 'b', 'c'])
  assert.match(I.parseDomain(Array.from({ length: 31 }, (_, i) => 'e' + i).join(',')).errors[0].msg, /máximo/)
})

test('predicados: formatos aceptados y rechazados', () => {
  const D = ['1', '2', '3']
  assert.equal(I.parsePredicate('2, 3', 'Q', 1, D).set.size, 2)
  assert.equal(I.parsePredicate('{(2),(3)}', 'Q', 1, D).set.size, 2)
  assert.equal(I.parsePredicate('(1,2) (2,3)\n(3,1)', 'P', 2, D).set.size, 3)
  assert.equal(I.parsePredicate('(1,2),(1,2)', 'P', 2, D).set.size, 1)
  assert.match(I.parsePredicate('', 'Q', 1, D).errors[0].msg, /vacía/)
  assert.match(I.parsePredicate('{}', 'P', 2, D).errors[0].msg, /vacía/)
  assert.match(I.parsePredicate('(1,2,3)', 'P', 2, D).errors[0].msg, /3 componente/)
  assert.match(I.parsePredicate('(1)', 'P', 2, D).errors[0].msg, /1 componente/)
  assert.match(I.parsePredicate('(1,9)', 'P', 2, D).errors[0].msg, /no pertenece/)
  assert.match(I.parsePredicate('1, 2', 'P', 2, D).errors[0].msg, /entre paréntesis/)
  assert.match(I.parsePredicate('(1,2', 'P', 2, D).errors[0].msg, /Falta cerrar/)
  assert.match(I.parsePredicate('1,2)', 'Q', 1, D).errors[0].msg, /sin su apertura/)
  assert.match(I.parsePredicate('7', 'Q', 1, D).errors[0].msg, /no pertenece/)
})

test('funciones: formatos, totalidad y conflictos', () => {
  const D = ['1', '2']
  assert.equal(I.parseFunction('1 -> 2\n2 -> 1', 'f', 1, D).errors.length, 0)
  assert.equal(I.parseFunction('f(1) = 2; f(2) = 2', 'f', 1, D).errors.length, 0)
  assert.equal(I.parseFunction('(1) → 2\n(2) → 1', 'f', 1, D).errors.length, 0)
  assert.equal(I.parseFunction('1, 1 -> 1\n1, 2 -> 2\n2, 1 -> 2\n2, 2 -> 1', 'g', 2, D).errors.length, 0)
  assert.equal(I.parseFunction('2', 'c', 0, D).errors.length, 0)
  assert.equal(I.parseFunction('c = 2', 'c', 0, D).errors.length, 0)
  assert.match(I.parseFunction('1 -> 2', 'f', 1, D).errors[0].msg, /Falta asignar.*1 tupla.*2/)
  assert.match(I.parseFunction('', 'c', 0, D).errors[0].msg, /constante/)
  assert.match(I.parseFunction('1 -> 2\n2 -> 9', 'f', 1, D).errors[0].msg, /no pertenece/)
  assert.match(I.parseFunction('1 -> 2\n1 -> 1\n2 -> 1', 'f', 1, D).errors[0].msg, /dos valores distintos/)
  assert.match(I.parseFunction('1, 2 -> 1', 'f', 1, D).errors[0].msg, /aridad 1/)
  assert.match(I.parseFunction('1 2', 'f', 1, D).errors[0].msg, /formato/)
  assert.match(I.parseFunction('1 -> 1 2', 'f', 1, D).errors[0].msg, /no es un elemento válido/)
})

test('entorno: faltantes e inválidos', () => {
  assert.match(I.parseEnv(['x'], {}, ['1']).errors[0].msg, /Falta asignar/)
  assert.match(I.parseEnv(['x'], { x: '  ' }, ['1']).errors[0].msg, /Falta asignar/)
  assert.match(I.parseEnv(['x'], { x: '7' }, ['1']).errors[0].msg, /no pertenece/)
  assert.deepEqual(I.parseEnv(['x', 'y'], { x: '1', y: ' 1 ' }, ['1']).env, { x: '1', y: '1' })
})

test('analyze: ninguna entrada incorrecta recibe valor de verdad', () => {
  const cases = {
    'fórmula con error de sintaxis': { formula: 'Q(x' },
    'símbolo no declarado': { formula: 'R(c)' },
    'aridad incorrecta': { formula: 'P(c)' },
    'dominio vacío': { domain: '' },
    'dominio con repetidos': { domain: '1, 1' },
    'tupla fuera del dominio': { predicates: { P: '(1, 9)', Q: '2' } },
    'tupla de largo incorrecto': { predicates: { P: '(1)', Q: '2' } },
    'relación vacía': { predicates: { P: '(1, 2)', Q: '' } },
    'función incompleta': { functions: { f: '1 -> 2', c: '1' } },
    'función con valor fuera de D': { functions: { f: '1 -> 2\n2 -> 3\n3 -> 8', c: '1' } },
    'constante sin valor': { functions: { f: '1 -> 2\n2 -> 3\n3 -> 1', c: '' } },
    'falta entorno': { formula: 'Q(x)', env: {} },
    'entorno fuera de D': { formula: 'Q(x)', env: { x: '99' } },
    'lenguaje con nombre inválido': { language: [{ kind: 'pred', name: 'x', arity: 1 }] }
  }
  for (const [name, over] of Object.entries(cases)) {
    const r = run(over)
    assert.ok(r.errors.length > 0, `${name}: debe tener errores`)
    assert.equal(r.result, null, `${name}: no debe haber resultado`)
  }
})

test('analyze: detecta variables libres y exige entorno solo para ellas', () => {
  let r = run({ formula: 'P(x, y) ∧ ∀z Q(z)' }, { evaluate: false })
  assert.deepEqual(r.freeVars, ['x', 'y'])
  r = run({ formula: '∀x ∃y P(x, y)' }, { evaluate: true })
  assert.deepEqual(r.freeVars, [])
  assert.equal(r.errors.length, 0)
  assert.equal(typeof r.result.value, 'boolean')
})

test('analyze: varios errores se acumulan en secciones distintas', () => {
  const r = run({ domain: '', formula: 'Q(' })
  const wheres = new Set(r.errors.map((e) => e.where))
  assert.ok(wheres.has('dominio') && wheres.has('formula'))
})
