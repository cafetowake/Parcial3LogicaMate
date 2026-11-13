/*
 * finder.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Aporte creativo: búsqueda exhaustiva de un modelo (I ⊨ φ) o de un contramodelo (I ⊭ φ)
 * entre todas las interpretaciones del lenguaje declarado sobre dominios {1..k}, k pequeño.
 * Respeta las mismas reglas del proyecto: funciones totales y relaciones no vacías.
 * Encontrar un contramodelo prueba que la fórmula no es válida, pero NO encontrarlo
 * en tamaños pequeños no prueba su validez (lo indica el resultado).
 */
(function (global) {
  'use strict'
  const dep = typeof require === 'function'
    ? Object.assign({}, require('./syntax.js'), require('./interp.js'), require('./evaluator.js'))
    : global.FOL

  /**
   * @param {object} ast
   * @param {Map} symbols
   * @param {{target:boolean, maxSize?:number, budget?:number}} opts target=true busca modelo, false contramodelo
   */
  function search(ast, symbols, opts) {
    const target = opts.target
    const maxSize = opts.maxSize || 3
    const budget = opts.budget || 300000
    const free = dep.varsInfo(ast).free
    const syms = [...symbols.entries()]
    let examined = 0
    const skipped = []

    for (let k = 1; k <= maxSize; k++) {
      const domain = Array.from({ length: k }, (_, i) => String(i + 1))
      // radix de cada símbolo
      const radices = []
      let total = Math.pow(k, free.length)
      let tooBig = false
      for (const [, s] of syms) {
        const cells = Math.pow(k, s.arity)
        const r = s.kind === 'fn' ? Math.pow(k, cells) : Math.pow(2, cells) - 1
        radices.push(r)
        total *= r
        if (!Number.isFinite(total) || total > budget) { tooBig = true; break }
      }
      if (tooBig) { skipped.push(k); continue }
      const tupleLists = syms.map(([, s]) => dep.tuples(domain, s.arity))
      const envs = dep.tuples(domain, free.length)
      const idx = new Array(syms.length).fill(0)
      for (;;) {
        const interp = { domain, fns: new Map(), preds: new Map() }
        syms.forEach(([name, s], si) => {
          const tl = tupleLists[si]
          if (s.kind === 'fn') {
            const table = new Map()
            let x = idx[si]
            tl.forEach((t) => { table.set(dep.key(t), domain[x % k]); x = Math.floor(x / k) })
            interp.fns.set(name, { arity: s.arity, table })
          } else {
            const set = new Set()
            let x = idx[si] + 1 // máscara no vacía
            tl.forEach((t) => { if (x % 2 === 1) set.add(dep.key(t)); x = Math.floor(x / 2) })
            interp.preds.set(name, { arity: s.arity, set })
          }
        })
        for (const tuple of envs) {
          const env = {}
          free.forEach((v, i) => { env[v] = tuple[i] })
          examined++
          const r = dep.evaluate(ast, interp, env, { trace: false })
          if (r.ok && r.value === target) {
            return { found: true, size: k, interp, env, examined, skipped }
          }
        }
        // avanzar el odómetro
        let p = 0
        while (p < idx.length) {
          idx[p]++
          if (idx[p] < radices[p]) break
          idx[p] = 0
          p++
        }
        if (p === idx.length) break
      }
    }
    return { found: false, examined, skipped, maxSize }
  }

  /** Convierte una interpretación encontrada en los textos que usa la interfaz. */
  function toTexts(interp) {
    const functions = {}
    const predicates = {}
    for (const [name, f] of interp.fns) {
      functions[name] = dep.tuples(interp.domain, f.arity)
        .map((t) => (f.arity === 0 ? f.table.get(dep.key(t)) : `${t.join(', ')} -> ${f.table.get(dep.key(t))}`)).join('\n')
    }
    for (const [name, p] of interp.preds) {
      predicates[name] = dep.tuples(interp.domain, p.arity).filter((t) => p.set.has(dep.key(t)))
        .map((t) => (p.arity === 1 ? t[0] : `(${t.join(', ')})`)).join(', ')
    }
    return { domain: interp.domain.join(', '), functions, predicates }
  }

  const api = { search, toTexts }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
