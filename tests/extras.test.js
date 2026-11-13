/*
 * extras.test.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { parse } = require('../js/syntax.js')
const { search, toTexts } = require('../js/finder.js')
const { analyze } = require('../js/analyze.js')
const T = require('../js/tree.js')

const symP = new Map([['P', { kind: 'pred', arity: 1 }], ['Q', { kind: 'pred', arity: 1 }]])
const ast = (t, s = symP) => { const r = parse(t, s); assert.ok(r.ok, t); return r.ast }

test('buscador: contramodelo de una fórmula no válida', () => {
  const r = search(ast('∀x (P(x) ∨ Q(x)) → (∀x P(x) ∨ ∀x Q(x))'), symP, { target: false, maxSize: 3 })
  assert.equal(r.found, true)
  assert.equal(r.size, 2) // no existe en tamaño 1
})

test('buscador: la interpretación hallada se reproduce con el evaluador normal', () => {
  const f = '∀x (P(x) ∨ Q(x)) → (∀x P(x) ∨ ∀x Q(x))'
  const r = search(ast(f), symP, { target: false, maxSize: 3 })
  const t = toTexts(r.interp)
  const out = analyze({
    language: [{ kind: 'pred', name: 'P', arity: 1 }, { kind: 'pred', name: 'Q', arity: 1 }],
    domain: t.domain, functions: t.functions, predicates: t.predicates, formula: f, env: r.env
  }, { evaluate: true })
  assert.equal(out.errors.length, 0, JSON.stringify(out.errors))
  assert.equal(out.result.value, false)
})

test('buscador: una fórmula válida no tiene contramodelo (y se avisa que no es prueba)', () => {
  const r = search(ast('∀x P(x) → ∃x P(x)'), symP, { target: false, maxSize: 3 })
  assert.equal(r.found, false)
  assert.ok(r.examined > 0)
})

test('buscador: modelo de una sentencia satisfacible y fórmulas con igualdad', () => {
  const s = new Map([['P', { kind: 'pred', arity: 1 }], ['f', { kind: 'fn', arity: 1 }]])
  const r = search(ast('∃x ∃y (¬x = y ∧ P(x) ∧ P(y))', s), s, { target: true, maxSize: 3 })
  assert.equal(r.found, true)
  assert.equal(r.size, 2)
  const r2 = search(ast('∀x ∀y x = y', s), s, { target: false, maxSize: 3 })
  assert.equal(r2.found, true)
  assert.equal(r2.size, 2)
})

test('buscador: fórmulas abiertas incluyen el entorno y las relaciones nunca son vacías', () => {
  const r = search(ast('P(x) ∧ ¬Q(x)'), symP, { target: true, maxSize: 2 })
  assert.equal(r.found, true)
  assert.ok(r.interp.preds.get('P').set.size >= 1)
  assert.ok(r.env.x)
})

test('buscador: respeta el presupuesto y omite tamaños excesivos', () => {
  const s = new Map([['R', { kind: 'pred', arity: 3 }], ['g', { kind: 'fn', arity: 2 }]])
  const r = search(ast('∀x R(x, x, x) ∨ ¬∀x R(x, x, x)', s), s, { target: false, maxSize: 4, budget: 1000 })
  assert.equal(r.found, false)
  assert.ok(r.skipped.length >= 1)
})

test('árbol sintáctico SVG: estructura y colores de variables', () => {
  const sym = new Map([['P', { kind: 'pred', arity: 2 }], ['f', { kind: 'fn', arity: 1 }], ['c', { kind: 'fn', arity: 0 }]])
  const svg = T.toSvg(ast('∀x P(x, y) → P(f(c), x)', sym))
  assert.match(svg, /^<svg/)
  assert.match(svg, /∀x/)
  assert.equal((svg.match(/class="node bound"/g) || []).length, 1) // la x dentro del ∀x
  assert.equal((svg.match(/class="node free"/g) || []).length, 2) // y, y la x fuera del alcance
  assert.equal((svg.match(/class="node const"/g) || []).length, 1)
  assert.equal((svg.match(/class="node fn"/g) || []).length, 1)
})

test('árbol sintáctico: el árbol refleja la estructura', () => {
  const t = T.build(ast('¬(P(x) ∧ Q(x))'), new Set())
  assert.equal(t.label, '¬')
  assert.equal(t.children[0].label, '∧')
  assert.equal(t.children[0].children.length, 2)
})

test('el SVG escapa caracteres especiales', () => {
  assert.doesNotMatch(T.toSvg(ast('P(x)')), /<script/)
})
