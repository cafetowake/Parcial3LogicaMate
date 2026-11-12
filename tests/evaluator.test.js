/*
 * evaluator.test.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { run } = require('./helpers.js')
const { analyze } = require('../js/analyze.js')
const { summarize } = require('../js/evaluator.js')
const { examples } = require('../js/examples.js')

const val = (formula, over = {}, full = false) => {
  const r = run(Object.assign({ formula }, over), { evaluate: true, full })
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors))
  return r.result
}

test('los ejemplos del curso dan el valor esperado', () => {
  for (const ex of examples) {
    const r = analyze(ex.state, { evaluate: true })
    assert.equal(r.errors.length, 0, `${ex.id}: ${JSON.stringify(r.errors)}`)
    assert.equal(r.result.value, ex.expected, ex.id)
  }
})

test('valores del ejemplo de la presentación Entornos (P en {0,1,2})', () => {
  const st = (formula, env) => ({ language: [{ kind: 'pred', name: 'P', arity: 2 }], domain: '0, 1, 2', functions: {}, predicates: { P: '(0,1),(0,2),(1,2)' }, formula, env })
  assert.equal(analyze(st('P(x, y)', { x: '0', y: '2' }), { evaluate: true }).result.value, true)
  assert.equal(analyze(st('P(x, y)', { x: '2', y: '1' }), { evaluate: true }).result.value, false)
  assert.equal(analyze(st('∃x ∀y P(x, y)', {}), { evaluate: true }).result.value, false)
})

test('átomos: predicados, igualdad, desigualdad, funciones y constantes', () => {
  assert.equal(val('Q(c)').value, false) // c = 1, Q = {2,3}
  assert.equal(val('Q(f(c))').value, true) // f(1) = 2
  assert.equal(val('f(f(f(c))) = c').value, true)
  assert.equal(val('f(c) ≠ c').value, true)
  assert.equal(val('P(c, f(c))').value, true)
  assert.equal(val('P(f(c), c)').value, false)
})

test('conectivos: tablas de verdad', () => {
  const T = 'Q(f(c))'
  const F = 'Q(c)'
  const cases = [
    [`¬${T}`, false], [`¬${F}`, true],
    [`${T} ∧ ${T}`, true], [`${T} ∧ ${F}`, false], [`${F} ∧ ${T}`, false], [`${F} ∧ ${F}`, false],
    [`${T} ∨ ${T}`, true], [`${T} ∨ ${F}`, true], [`${F} ∨ ${T}`, true], [`${F} ∨ ${F}`, false],
    [`${T} → ${T}`, true], [`${T} → ${F}`, false], [`${F} → ${T}`, true], [`${F} → ${F}`, true],
    [`${T} ↔ ${T}`, true], [`${T} ↔ ${F}`, false], [`${F} ↔ ${T}`, false], [`${F} ↔ ${F}`, true]
  ]
  for (const [f, v] of cases) {
    assert.equal(val(f).value, v, f)
    assert.equal(val(f, {}, true).value, v, f + ' (completa)')
  }
})

test('cuantificadores: valores y alcance', () => {
  assert.equal(val('∃x Q(x)').value, true)
  assert.equal(val('∀x Q(x)').value, false)
  assert.equal(val('∀x ∃y P(x, y)').value, false) // 3 no tiene sucesor
  assert.equal(val('∃x ∀y (y = x → Q(y))').value, true)
  assert.equal(val('∀x (Q(x) → ∃y P(y, x))').value, true)
  // alcance mínimo: (∀x Q(x)) → Q(x) con x libre
  assert.equal(val('∀x Q(x) → Q(x)', { env: { x: '1' } }).value, true)
  assert.equal(val('∀x (Q(x) → Q(x))').value, true)
  // sombra: el cuantificador interno manda sobre x
  assert.equal(val('Q(x) ∧ ∃x ¬Q(x)', { env: { x: '2' } }).value, true)
  assert.equal(val('Q(x) ∧ ∃x ¬Q(x)', { env: { x: '1' } }).value, false)
  // cuantificador vacuo
  assert.equal(val('∀x Q(c)').value, false)
  assert.equal(val('∃x Q(f(c))').value, true)
})

test('el entorno decide fórmulas abiertas', () => {
  assert.equal(val('Q(x)', { env: { x: '2' } }).value, true)
  assert.equal(val('Q(x)', { env: { x: '1' } }).value, false)
  assert.equal(val('Q(x)', { env: { x: '2' } }).closed, false)
  assert.equal(val('∃x Q(x)').closed, true)
})

test('razón decisiva: testigo para ∃ verdadero', () => {
  const r = val('∃x Q(x)')
  assert.equal(r.trace.mode, 'witness')
  assert.equal(r.trace.element, '2')
  assert.match(r.trace.why, /Testigo: x = 2/)
  assert.equal(r.trace.decisive.length, 1)
  assert.deepEqual(r.trace.decisive[0].env, [['x', '2']])
  assert.equal(r.trace.decisive[0].value, true)
  // el primer elemento no sirvió y quedó registrado en la comprobación
  assert.deepEqual(r.trace.checks, [{ a: '1', value: false }, { a: '2', value: true }])
})

test('razón decisiva: contraejemplo para ∀ falso', () => {
  const r = val('∀x Q(x)')
  assert.equal(r.trace.mode, 'counterexample')
  assert.equal(r.trace.element, '1')
  assert.match(r.trace.why, /Contraejemplo: x = 1/)
  assert.equal(r.trace.decisive[0].value, false)
})

test('razón decisiva: comprobación completa para ∀ verdadero y ∃ falso', () => {
  let r = val('∀x (Q(x) → Q(x))')
  assert.equal(r.trace.mode, 'complete')
  assert.equal(r.trace.value, true)
  assert.equal(r.trace.checks.length, 3)
  assert.ok(r.trace.checks.every((c) => c.value))
  assert.match(r.trace.why, /Comprobación completa.*3 elementos/)
  assert.equal(r.trace.decisive.length, 3)
  r = val('∃x (Q(x) ∧ ¬Q(x))')
  assert.equal(r.trace.mode, 'complete')
  assert.equal(r.trace.value, false)
  assert.ok(r.trace.checks.every((c) => !c.value))
  assert.match(r.trace.why, /ninguno de los 3 elementos/)
})

test('evaluación completa lista todos los testigos y contraejemplos', () => {
  let r = val('∃x Q(x)', {}, true)
  assert.deepEqual(r.trace.hits, ['2', '3'])
  assert.match(r.trace.why, /Testigos en total: 2 de 3/)
  r = val('∀x Q(x)', {}, true)
  assert.deepEqual(r.trace.hits, ['1'])
  r = val('∀x (Q(x) ∨ P(x, x))', {}, true)
  assert.deepEqual(r.trace.hits, ['1'])
  // en la evaluación completa se evalúan ambos miembros
  const c = val('Q(c) ∧ Q(f(c))', {}, true)
  assert.equal(c.trace.children.length, 2)
  const lazy = val('Q(c) ∧ Q(f(c))')
  assert.equal(lazy.trace.children.length, 1)
})

test('razones en conectivos', () => {
  assert.match(val('Q(c) → Q(c)').trace.why, /antecedente es falso/)
  assert.match(val('Q(f(c)) → Q(c)').trace.why, /antecedente es verdadero y el consecuente es falso/)
  assert.match(val('Q(f(c)) ∨ Q(c)').trace.why, /primer miembro es verdadero/)
  assert.match(val('Q(c) ∨ Q(c)').trace.why, /Ambos miembros son falsos/)
  assert.match(val('Q(c) ∧ Q(f(c))').trace.why, /primer miembro es falso/)
  assert.match(val('Q(f(c)) ∧ Q(c)').trace.why, /segundo miembro es falso/)
  assert.match(val('¬Q(c)').trace.why, /negación es verdadera/)
  assert.match(val('P(c, f(c))').trace.why, /\(1, 2\) ∈ P\^I/)
  assert.match(val('P(f(c), c)').trace.why, /\(2, 1\) ∉ P\^I/)
  assert.match(val('f(c) = f(c)').trace.why, /mismo elemento/)
})

test('cortocircuito: no se evalúa lo innecesario salvo en evaluación completa', () => {
  const lazy = val('Q(c) ∧ ∀x ∀y ∀z P(x, y)')
  const full = val('Q(c) ∧ ∀x ∀y ∀z P(x, y)', {}, true)
  assert.ok(lazy.steps < full.steps)
  assert.equal(lazy.value, full.value)
})

test('resumen lineal de razones decisivas', () => {
  const r = val('∃x ∀y (P(x, y) ∨ x = y)')
  const lines = summarize(r.trace)
  assert.ok(lines.length >= 3)
  assert.equal(lines[0].depth, 0)
  assert.match(lines[0].text, /es (verdadera|falsa)/)
  const full = val('∀x (Q(x) → Q(x))')
  const l2 = summarize(full.trace)
  assert.match(l2[l2.length - 1].text, /para cada elemento/)
})

test('límite de pasos: se informa y no se devuelve valor', () => {
  const lang = [{ kind: 'pred', name: 'P', arity: 2 }]
  const dom = Array.from({ length: 30 }, (_, i) => i + 1).join(',')
  const pairs = []
  for (let i = 1; i <= 30; i++) for (let j = 1; j <= 30; j++) pairs.push(`(${i},${j})`)
  const st = { language: lang, domain: dom, functions: {}, predicates: { P: pairs.join(',') }, formula: '∀a1 ∀b1 ∀c1 ∀d1 ∀e1 ∀f1 P(a1, b1)'.replace(/[a-f]1/g, (m) => 'xyzuvw'[m.charCodeAt(0) - 97] + '1'), env: {} }
  const r = analyze(st, { evaluate: true, full: true })
  assert.equal(r.result, null)
  assert.match(r.errors[0].msg, /límite/)
})

test('trazas grandes se recortan sin perder el valor', () => {
  const dom = Array.from({ length: 25 }, (_, i) => i + 1).join(',')
  const pairs = []
  for (let i = 1; i <= 25; i++) for (let j = 1; j <= 25; j++) pairs.push(`(${i},${j})`)
  const st = { language: [{ kind: 'pred', name: 'P', arity: 2 }], domain: dom, functions: {}, predicates: { P: pairs.join(',') }, formula: '∀x ∀y ∀z (P(x, y) ∧ P(y, z))', env: {} }
  const r = analyze(st, { evaluate: true })
  assert.equal(r.errors.length, 0)
  assert.equal(r.result.value, true)
  assert.ok(r.result.trace)
  const countNodes = (n) => 1 + n.children.reduce((a, c) => a + countNodes(c), 0)
  assert.ok(countNodes(r.result.trace) < 25000, 'la traza debe estar acotada')
})
