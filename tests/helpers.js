/*
 * helpers.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 */
const { analyze } = require('../js/analyze.js')

/** Atajo: lenguaje {P:2, Q:1, f:1, c:0} sobre un estado base modificable. */
function base(over = {}) {
  return Object.assign({
    language: [{ kind: 'pred', name: 'P', arity: 2 }, { kind: 'pred', name: 'Q', arity: 1 }, { kind: 'fn', name: 'f', arity: 1 }, { kind: 'fn', name: 'c', arity: 0 }],
    domain: '1, 2, 3',
    functions: { f: '1 -> 2\n2 -> 3\n3 -> 1', c: '1' },
    predicates: { P: '(1, 2), (2, 3), (1, 3)', Q: '2, 3' },
    formula: 'Q(c)',
    env: {}
  }, over)
}
const run = (over, opts = { evaluate: true }) => analyze(base(over), opts)
module.exports = { base, run }
