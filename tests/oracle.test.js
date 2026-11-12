/*
 * oracle.test.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Prueba de propiedades: se compara el evaluador del proyecto contra un evaluador mínimo e
 * independiente (sin trazas ni cortocircuito) sobre fórmulas, interpretaciones y entornos aleatorios.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { parse } = require('../js/syntax.js')
const { evaluate } = require('../js/evaluator.js')
const I = require('../js/interp.js')

let seed = 12345
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]

const symbols = new Map([['P', { kind: 'pred', arity: 2 }], ['Q', { kind: 'pred', arity: 1 }], ['f', { kind: 'fn', arity: 1 }], ['g', { kind: 'fn', arity: 2 }], ['c', { kind: 'fn', arity: 0 }]])
const VARS = ['x', 'y', 'z']

function genTerm(d) {
  const r = rnd()
  if (d <= 0 || r < 0.4) return rnd() < 0.7 ? pick(VARS) : 'c'
  if (r < 0.75) return `f(${genTerm(d - 1)})`
  return `g(${genTerm(d - 1)}, ${genTerm(d - 1)})`
}
function genFormula(d) {
  const r = rnd()
  if (d <= 0 || r < 0.25) {
    const k = rnd()
    if (k < 0.4) return `P(${genTerm(1)}, ${genTerm(1)})`
    if (k < 0.7) return `Q(${genTerm(1)})`
    return `${genTerm(1)} ${rnd() < 0.7 ? '=' : '≠'} ${genTerm(1)}`
  }
  if (r < 0.35) return `¬(${genFormula(d - 1)})`
  if (r < 0.55) return `${pick(['∀', '∃'])}${pick(VARS)} (${genFormula(d - 1)})`
  const op = pick(['∧', '∨', '→', '↔'])
  return `(${genFormula(d - 1)}) ${op} (${genFormula(d - 1)})`
}
function genInterp(k) {
  const D = Array.from({ length: k }, (_, i) => String(i))
  const fns = new Map()
  const preds = new Map()
  const t1 = I.tuples(D, 1)
  const t2 = I.tuples(D, 2)
  fns.set('f', { arity: 1, table: new Map(t1.map((t) => [I.key(t), pick(D)])) })
  fns.set('g', { arity: 2, table: new Map(t2.map((t) => [I.key(t), pick(D)])) })
  fns.set('c', { arity: 0, table: new Map([['', pick(D)]]) })
  preds.set('Q', { arity: 1, set: new Set(t1.filter((_, i) => i === 0 || rnd() < 0.5).map(I.key)) })
  preds.set('P', { arity: 2, set: new Set(t2.filter((_, i) => i === 0 || rnd() < 0.5).map(I.key)) })
  return { domain: D, fns, preds }
}

// Evaluador de referencia
function term(t, env, M) {
  if (t.t === 'var') return env[t.name]
  return M.fns.get(t.name).table.get(t.args.map((a) => term(a, env, M)).join('\u001f'))
}
function ref(n, env, M) {
  switch (n.t) {
    case 'pred': return M.preds.get(n.name).set.has(n.args.map((a) => term(a, env, M)).join('\u001f'))
    case 'eq': return term(n.l, env, M) === term(n.r, env, M)
    case 'neq': return term(n.l, env, M) !== term(n.r, env, M)
    case 'not': return !ref(n.f, env, M)
    case 'and': return ref(n.l, env, M) && ref(n.r, env, M)
    case 'or': return ref(n.l, env, M) || ref(n.r, env, M)
    case 'imp': return !ref(n.l, env, M) || ref(n.r, env, M)
    case 'iff': return ref(n.l, env, M) === ref(n.r, env, M)
    case 'all': return M.domain.every((a) => ref(n.f, { ...env, [n.v]: a }, M))
    case 'ex': return M.domain.some((a) => ref(n.f, { ...env, [n.v]: a }, M))
  }
}

test('el evaluador coincide con el de referencia en 1500 casos aleatorios', () => {
  let trues = 0
  for (let i = 0; i < 1500; i++) {
    const text = genFormula(4)
    const p = parse(text, symbols)
    assert.ok(p.ok, text + ' ' + JSON.stringify(p.error))
    const M = genInterp(1 + Math.floor(rnd() * 3))
    const env = { x: pick(M.domain), y: pick(M.domain), z: pick(M.domain) }
    const expected = ref(p.ast, env, M)
    if (expected) trues++
    for (const opts of [{}, { full: true }, { trace: false }]) {
      const r = evaluate(p.ast, M, env, opts)
      assert.equal(r.value, expected, `${text} ${JSON.stringify(opts)}`)
    }
  }
  assert.ok(trues > 200 && trues < 1300, 'el generador debe producir ambos valores (' + trues + ')')
})
