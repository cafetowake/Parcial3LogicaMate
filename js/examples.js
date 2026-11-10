/*
 * examples.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Ejemplos tomados de las presentaciones del curso (Interpretaciones y Entornos).
 * Cada ejemplo incluye el valor esperado, que se verifica en las pruebas automáticas.
 */
(function (global) {
  'use strict'
  const examples = [
    {
      id: 'socrates',
      title: 'Todos los hombres son mortales (Sócrates)',
      expected: true,
      state: {
        language: [{ kind: 'pred', name: 'H', arity: 1 }, { kind: 'pred', name: 'M', arity: 1 }, { kind: 'fn', name: 's', arity: 0 }],
        domain: 'socrates, platon, fido',
        functions: { s: 'socrates' },
        predicates: { H: 'socrates, platon', M: 'socrates, platon, fido' },
        formula: '∀x (H(x) → M(x)) ∧ H(s) ∧ M(s)',
        env: {}
      }
    },
    {
      id: 'orden-abierta',
      title: 'Fórmula abierta con entorno: P(x, y) en {0, 1, 2}',
      expected: true,
      state: {
        language: [{ kind: 'pred', name: 'P', arity: 2 }],
        domain: '0, 1, 2',
        functions: {},
        predicates: { P: '(0, 1), (0, 2), (1, 2)' },
        formula: 'P(x, y)',
        env: { x: '0', y: '2' }
      }
    },
    {
      id: 'sucesor',
      title: 'Existencial verdadero y universal falso (R, P en {1, 2, 3})',
      expected: false,
      state: {
        language: [{ kind: 'pred', name: 'P', arity: 1 }, { kind: 'pred', name: 'R', arity: 2 }],
        domain: '1, 2, 3',
        functions: {},
        predicates: { P: '1, 2', R: '(1, 3), (2, 1), (3, 2)' },
        formula: '∀x ∃y R(x, y) ∧ ∀x P(x)',
        env: {}
      }
    },
    {
      id: 'igualdad',
      title: 'Igualdad y constante: Q(x, y) ∧ Q(x, z) → y = z',
      expected: false,
      state: {
        language: [{ kind: 'fn', name: 'i', arity: 0 }, { kind: 'pred', name: 'R', arity: 1 }, { kind: 'pred', name: 'Q', arity: 2 }],
        domain: 'a, b, c',
        functions: { i: 'a' },
        predicates: { R: 'b, c', Q: '(a, a), (a, b), (a, c), (b, c), (c, c)' },
        formula: '∀x ∀y ∀z ((Q(x, y) ∧ Q(x, z)) → y = z)',
        env: {}
      }
    },
    {
      id: 'funciones',
      title: 'Símbolos funcionales: sucesor módulo 3 y orden',
      expected: true,
      state: {
        language: [{ kind: 'fn', name: 's', arity: 1 }, { kind: 'fn', name: 'cero', arity: 0 }, { kind: 'pred', name: 'P', arity: 2 }],
        domain: '0, 1, 2',
        functions: { s: '0 -> 1\n1 -> 2\n2 -> 0', cero: '0' },
        predicates: { P: '(0, 0), (0, 1), (0, 2), (1, 1), (1, 2), (2, 2)' },
        formula: '∀x P(cero, x) ∧ ∀x ∃y s(y) = x',
        env: {}
      }
    },
    {
      id: 'alcance',
      title: 'Alcance de un cuantificador: ∀x P(x) → Q(x) con x libre y ligada',
      expected: false,
      state: {
        language: [{ kind: 'pred', name: 'P', arity: 1 }, { kind: 'pred', name: 'Q', arity: 1 }],
        domain: '1, 2, 3',
        functions: {},
        predicates: { P: '1, 2, 3', Q: '2, 3' },
        formula: '∀x P(x) → Q(x)',
        env: { x: '1' }
      }
    },
    {
      id: 'no-valida',
      title: 'Fórmula no válida: ∀x (P ∨ Q) → (∀x P ∨ ∀x Q)',
      expected: false,
      state: {
        language: [{ kind: 'pred', name: 'P', arity: 1 }, { kind: 'pred', name: 'Q', arity: 1 }],
        domain: '1, 2',
        functions: {},
        predicates: { P: '1', Q: '2' },
        formula: '∀x (P(x) ∨ Q(x)) → (∀x P(x) ∨ ∀x Q(x))',
        env: {}
      }
    }
  ]
  const api = { examples }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
