/*
 * evaluator.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Semántica de Tarski: decide I ⊨_l φ para una interpretación finita I y un entorno l.
 * Además de un valor de verdad construye una traza con las razones decisivas:
 *   - testigo para un existencial verdadero
 *   - contraejemplo para un universal falso
 *   - comprobación completa para un universal verdadero o un existencial falso
 */
(function (global) {
  'use strict'
  const S = typeof require === 'function' ? require('./syntax.js') : global.FOL
  const I = typeof require === 'function' ? require('./interp.js') : global.FOL

  const V = (b) => (b ? 'verdadera' : 'falsa')

  class LimitError extends Error {}

  function evalTerm(t, env, ctx) {
    if (++ctx.steps > ctx.maxSteps) throw new LimitError('La evaluación excede el límite de pasos permitido. Reduzca el dominio o el anidamiento de cuantificadores.')
    if (t.t === 'var') return env[t.name]
    const f = ctx.interp.fns.get(t.name)
    const args = t.args.map((a) => evalTerm(a, env, ctx))
    return f.table.get(I.key(args))
  }

  const envPairs = (n, env) => [...S.freeVars(n)].sort(S.natural).map((v) => [v, env[v]])

  function mk(ctx, n, env, value, why, extra) {
    if (!ctx.trace) return null
    ctx.nodes++
    return Object.assign({ kind: n.t, text: S.toStr(n), env: envPairs(n, env), value, why, children: [], decisive: [] }, extra)
  }

  const kids = (...xs) => xs.filter(Boolean)

  function ev(n, env, ctx) {
    if (++ctx.steps > ctx.maxSteps) throw new LimitError('La evaluación excede el límite de pasos permitido. Reduzca el dominio o el anidamiento de cuantificadores.')
    switch (n.t) {
      case 'pred': {
        const vals = n.args.map((a) => evalTerm(a, env, ctx))
        const v = ctx.interp.preds.get(n.name).set.has(I.key(vals))
        let node = null
        if (ctx.trace) {
          const parts = n.args.map((a, i) => `${S.termToStr(a)} = ${vals[i]}`)
          const tup = I.showTuple(vals)
          node = mk(ctx, n, env, v, `Los argumentos valen ${parts.join(', ')}. Como ${tup} ${v ? '∈' : '∉'} ${n.name}^I, la fórmula es ${V(v)}.`, { tuple: vals })
        }
        return { v, n: node }
      }
      case 'eq': case 'neq': {
        const a = evalTerm(n.l, env, ctx)
        const b = evalTerm(n.r, env, ctx)
        const same = a === b
        const v = n.t === 'eq' ? same : !same
        const node = ctx.trace
          ? mk(ctx, n, env, v, `${S.termToStr(n.l)} = ${a} y ${S.termToStr(n.r)} = ${b}. ${same ? 'Son el mismo elemento' : 'Son elementos distintos'}, luego ${n.t === 'eq' ? 'la igualdad' : 'la desigualdad'} es ${V(v)}.`)
          : null
        return { v, n: node }
      }
      case 'not': {
        const c = ev(n.f, env, ctx)
        const v = !c.v
        const node = mk(ctx, n, env, v, `La subfórmula es ${V(c.v)}, luego su negación es ${V(v)}.`, { children: kids(c.n), decisive: kids(c.n) })
        return { v, n: node }
      }
      case 'and': {
        const l = ev(n.l, env, ctx)
        if (!l.v && !ctx.full) {
          return { v: false, n: mk(ctx, n, env, false, 'El primer miembro es falso, luego la conjunción es falsa.', { children: kids(l.n), decisive: kids(l.n) }) }
        }
        const r = ev(n.r, env, ctx)
        const v = l.v && r.v
        let why
        let dec
        if (v) { why = 'Ambos miembros son verdaderos.'; dec = kids(l.n, r.n) } else if (!l.v && !r.v) { why = 'Ambos miembros son falsos.'; dec = kids(l.n, r.n) } else if (!l.v) { why = 'El primer miembro es falso, luego la conjunción es falsa.'; dec = kids(l.n) } else { why = 'El segundo miembro es falso, luego la conjunción es falsa.'; dec = kids(r.n) }
        return { v, n: mk(ctx, n, env, v, why, { children: kids(l.n, r.n), decisive: dec }) }
      }
      case 'or': {
        const l = ev(n.l, env, ctx)
        if (l.v && !ctx.full) {
          return { v: true, n: mk(ctx, n, env, true, 'El primer miembro es verdadero, luego la disyunción es verdadera.', { children: kids(l.n), decisive: kids(l.n) }) }
        }
        const r = ev(n.r, env, ctx)
        const v = l.v || r.v
        let why
        let dec
        if (!v) { why = 'Ambos miembros son falsos.'; dec = kids(l.n, r.n) } else if (l.v && r.v) { why = 'Ambos miembros son verdaderos.'; dec = kids(l.n, r.n) } else if (l.v) { why = 'El primer miembro es verdadero, luego la disyunción es verdadera.'; dec = kids(l.n) } else { why = 'El segundo miembro es verdadero, luego la disyunción es verdadera.'; dec = kids(r.n) }
        return { v, n: mk(ctx, n, env, v, why, { children: kids(l.n, r.n), decisive: dec }) }
      }
      case 'imp': {
        const l = ev(n.l, env, ctx)
        if (!l.v && !ctx.full) {
          return { v: true, n: mk(ctx, n, env, true, 'El antecedente es falso, luego la implicación es verdadera.', { children: kids(l.n), decisive: kids(l.n) }) }
        }
        const r = ev(n.r, env, ctx)
        const v = !l.v || r.v
        let why
        let dec
        if (!l.v) { why = 'El antecedente es falso, luego la implicación es verdadera.'; dec = kids(l.n) } else if (r.v) { why = 'El consecuente es verdadero, luego la implicación es verdadera.'; dec = kids(r.n) } else { why = 'El antecedente es verdadero y el consecuente es falso, luego la implicación es falsa.'; dec = kids(l.n, r.n) }
        return { v, n: mk(ctx, n, env, v, why, { children: kids(l.n, r.n), decisive: dec }) }
      }
      case 'iff': {
        const l = ev(n.l, env, ctx)
        const r = ev(n.r, env, ctx)
        const v = l.v === r.v
        const why = v ? `Ambos miembros son ${l.v ? 'verdaderos' : 'falsos'}, luego la equivalencia es verdadera.` : `Los miembros tienen valores distintos (${V(l.v)} y ${V(r.v)}), luego la equivalencia es falsa.`
        return { v, n: mk(ctx, n, env, v, why, { children: kids(l.n, r.n), decisive: kids(l.n, r.n) }) }
      }
      case 'all': case 'ex': return evQuant(n, env, ctx)
      default: throw new Error(`Nodo desconocido: ${n.t}`)
    }
  }

  function evQuant(n, env, ctx) {
    const isAll = n.t === 'all'
    const D = ctx.interp.domain
    const children = []
    const checks = []
    const decisiveKids = []
    const hits = [] // elementos que deciden: contraejemplos (∀) o testigos (∃)
    const passes = [] // elementos que no deciden
    let omitted = false
    for (const a of D) {
      const e2 = Object.assign({}, env, { [n.v]: a })
      const saved = ctx.trace
      if (ctx.trace && ctx.nodes > ctx.maxNodes) { ctx.trace = false; omitted = true }
      const c = ev(n.f, e2, ctx)
      ctx.trace = saved
      const decides = isAll ? !c.v : c.v
      checks.push({ a, value: c.v })
      if (c.n) children.push(Object.assign(c.n, { binding: [n.v, a] }))
      if (decides) {
        hits.push(a)
        if (c.n) decisiveKids.push(c.n)
        if (!ctx.full) break
      } else passes.push(a)
    }
    const decided = hits.length > 0
    const v = isAll ? !decided : decided
    const x = n.v
    let why
    let mode
    let dec
    if (decided) {
      mode = isAll ? 'counterexample' : 'witness'
      const first = hits[0]
      const what = isAll ? 'Contraejemplo' : 'Testigo'
      const pred = isAll ? 'falsa' : 'verdadera'
      const total = ctx.full && hits.length > 1
        ? ` ${isAll ? 'Contraejemplos' : 'Testigos'} en total: ${hits.length} de ${D.length} (${hits.join(', ')}).`
        : ''
      why = `${what}: ${x} = ${first}, pues la subfórmula es ${pred} para ese elemento.${total}`
      dec = ctx.full ? decisiveKids : decisiveKids.slice(0, 1)
    } else {
      mode = 'complete'
      why = isAll
        ? `Comprobación completa: los ${D.length} elementos del dominio satisfacen la subfórmula, sin contraejemplos.`
        : `Comprobación completa: ninguno de los ${D.length} elementos del dominio satisface la subfórmula, no hay testigos.`
      dec = children.slice()
    }
    const node = mk(ctx, n, env, v, why, {
      children, decisive: dec, checks, mode, element: decided ? hits[0] : null, hits, truncated: omitted, domainSize: D.length
    })
    return { v, n: node }
  }

  /**
   * @param {object} ast
   * @param {object} interp {domain, fns, preds}
   * @param {object} env variable -> elemento
   * @param {{full?:boolean, trace?:boolean, maxSteps?:number, maxNodes?:number}} opts
   */
  function evaluate(ast, interp, env, opts = {}) {
    const ctx = {
      interp,
      full: !!opts.full,
      trace: opts.trace !== false,
      steps: 0,
      nodes: 0,
      maxSteps: opts.maxSteps || 5e6,
      maxNodes: opts.maxNodes || 20000
    }
    try {
      const r = ev(ast, env || {}, ctx)
      return { ok: true, value: r.v, trace: r.n, steps: ctx.steps }
    } catch (e) {
      if (e instanceof LimitError) return { ok: false, error: e.message }
      throw e
    }
  }

  /** Resumen lineal de las razones decisivas (sigue solo los hijos decisivos). */
  function summarize(root, opts = {}) {
    const maxLines = opts.maxLines || 40
    const maxDepth = opts.maxDepth || 10
    const lines = []
    const env = (nd) => (nd.env.length ? ` [${nd.env.map(([k, a]) => `${k} ↦ ${a}`).join(', ')}]` : '')
    function walk(nd, depth) {
      if (lines.length >= maxLines) return
      const head = `${nd.text}${env(nd)} es ${V(nd.value)}`
      lines.push({ depth, node: nd, text: `${head}. ${nd.why}` })
      if (nd.mode === 'complete') {
        const marks = nd.checks.slice(0, 12).map((c) => `${c.a}: ${c.value ? 'V' : 'F'}`)
        const more = nd.checks.length > 12 ? `, … (${nd.checks.length} en total)` : ''
        lines.push({ depth: depth + 1, node: nd, text: `Valor de la subfórmula para cada elemento → ${marks.join(', ')}${more}` })
        return
      }
      if (depth >= maxDepth) return
      for (const c of nd.decisive) walk(c, depth + 1)
    }
    walk(root, 0)
    return lines
  }

  const api = { evaluate, summarize }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
