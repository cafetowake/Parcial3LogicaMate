/*
 * syntax.test.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const S = require('../js/syntax.js')

const sym = new Map([['P', { kind: 'pred', arity: 2 }], ['Q', { kind: 'pred', arity: 1 }], ['f', { kind: 'fn', arity: 1 }], ['g', { kind: 'fn', arity: 2 }], ['c', { kind: 'fn', arity: 0 }]])
const show = (t) => { const r = S.parse(t, sym); assert.ok(r.ok, t + ' -> ' + JSON.stringify(r.error)); return S.toStr(r.ast) }
const err = (t) => { const r = S.parse(t, sym); assert.equal(r.ok, false, t); return r.error }

test('precedencia: ¬ > ∧ > ∨ > → > ↔', () => {
  assert.equal(show('Q(x) ∨ Q(y) ∧ Q(z)'), 'Q(x) ∨ (Q(y) ∧ Q(z))')
  assert.equal(show('Q(x) ∧ Q(y) → Q(z) ∨ Q(w)'), '(Q(x) ∧ Q(y)) → (Q(z) ∨ Q(w))')
  assert.equal(show('¬Q(x) ∧ Q(y)'), '¬Q(x) ∧ Q(y)')
  assert.equal(show('Q(x) → Q(y) ↔ Q(z)'), '(Q(x) → Q(y)) ↔ Q(z)')
})

test('la implicación asocia a la derecha y ∧, ∨ a la izquierda', () => {
  assert.equal(show('Q(x) → Q(y) → Q(z)'), 'Q(x) → (Q(y) → Q(z))')
  assert.equal(show('Q(x) ∧ Q(y) ∧ Q(z)'), '(Q(x) ∧ Q(y)) ∧ Q(z)')
})

test('los cuantificadores ligan como la negación (alcance mínimo)', () => {
  assert.equal(show('∀x Q(x) → Q(y)'), '∀x Q(x) → Q(y)')
  const r = S.parse('∀x Q(x) → Q(x)', sym)
  assert.equal(r.ast.t, 'imp')
  assert.equal(r.ast.l.t, 'all')
  assert.deepEqual(S.varsInfo(r.ast).free, ['x'])
  assert.deepEqual(S.varsInfo(r.ast).mixed, ['x'])
  assert.equal(show('∀x (Q(x) → Q(x))'), '∀x (Q(x) → Q(x))')
  assert.deepEqual(S.varsInfo(S.parse('∀x (Q(x) → Q(x))', sym).ast).free, [])
})

test('acepta alternativas ASCII y la forma ∀xP(x) sin espacio', () => {
  assert.equal(show('forall x (Q(x) -> ~Q(f(x)))'), '∀x (Q(x) → ¬Q(f(x)))')
  assert.equal(show('exists y Q(y) /\\ Q(c) \\/ Q(c)'), '(∃y Q(y) ∧ Q(c)) ∨ Q(c)')
  assert.equal(show('∀xP(x,c)'), '∀x P(x, c)')
  assert.equal(show('∀x∃y P(x, y)'), '∀x ∃y P(x, y)')
  assert.equal(show('Q(x) <-> Q(y)'), 'Q(x) ↔ Q(y)')
  assert.equal(show('x != c'), 'x ≠ c')
  assert.equal(show('Q(x) & Q(y) | Q(z)'), '(Q(x) ∧ Q(y)) ∨ Q(z)')
})

test('términos anidados e igualdad', () => {
  assert.equal(show('g(f(x), c) = f(f(y))'), 'g(f(x), c) = f(f(y))')
  assert.equal(show('¬(x = y)'), '¬x = y')
})

test('variables con subíndice', () => {
  assert.equal(show('∀x1 ∃x_2 P(x1, x_2)'), '∀x1 ∃x_2 P(x1, x_2)')
  assert.equal(S.isVariableName('z12'), true)
  assert.equal(S.isVariableName('a'), false)
})

test('variables libres y ligadas', () => {
  const info = S.varsInfo(S.parse('∃x (P(y, z) ∧ ∀y ¬P(y, x) ∨ P(y, z))', sym).ast)
  assert.deepEqual(info.free, ['y', 'z'])
  assert.deepEqual(info.bound, ['x', 'y'])
  assert.deepEqual(info.mixed, ['y'])
  assert.equal(info.closed, false)
  assert.equal(S.varsInfo(S.parse('∀x Q(x)', sym).ast).closed, true)
})

test('errores de sintaxis con posición', () => {
  assert.match(err('').msg, /vacía/)
  assert.match(err('Q(x').msg, /Se esperaba/)
  assert.match(err('Q(x))').msg, /sin su apertura/)
  assert.match(err('(Q(x)').msg, /Falta cerrar/)
  assert.equal(err('(Q(x)').pos, 5)
  assert.match(err('Q(x) ∧').msg, /Se esperaba una fórmula/)
  assert.match(err('∧ Q(x)').msg, /Se esperaba una fórmula/)
  assert.match(err('Q(x) Q(y)').msg, /inesperado/)
  assert.match(err('∀ Q(x)').msg, /variable/)
  assert.match(err('∀').msg, /variable/)
  assert.match(err('Q(x) # Q(y)').msg, /no válido/)
  assert.equal(err('Q(x) # Q(y)').pos, 5)
})

test('errores de símbolos y aridades', () => {
  assert.match(err('R(x)').msg, /no está declarado/)
  assert.match(err('Q(a)').msg, /no está declarado/)
  assert.match(err('P(x)').msg, /aridad 2 pero recibe 1/)
  assert.match(err('Q(x, y)').msg, /aridad 1 pero recibe 2/)
  assert.match(err('Q()').msg, /vacía/)
  assert.match(err('Q x').msg, /paréntesis/)
  assert.match(err('c(x) = x').msg, /constante/)
  assert.match(err('f = x').msg, /aridad 1/)
  assert.match(err('f(x)').msg, /Se esperaba «=»/)
  assert.match(err('Q(P(x, y))').msg, /predicado/)
  assert.match(err('x').msg, /Se esperaba «=»/)
  assert.match(err('f(x, y) = x').msg, /aridad 1 pero recibe 2/)
})

test('nombres de símbolos', () => {
  assert.equal(S.checkSymbolName('Mayor'), null)
  assert.equal(S.checkSymbolName('c1'), null)
  assert.match(S.checkSymbolName('x'), /variable/)
  assert.match(S.checkSymbolName('1a'), /letra/)
  assert.match(S.checkSymbolName(''), /vacío/)
  assert.match(S.checkSymbolName('forall'), /reservada/)
})

test('conectivo faltante entre dos fórmulas dentro de paréntesis', () => {
  const lang = new Map([['P', { kind: 'pred', arity: 1 }]])
  const r = S.parse('(P(x) P(y))', lang)
  assert.equal(r.ok, false)
  assert.match(r.error.msg, /conectivo/)
})
