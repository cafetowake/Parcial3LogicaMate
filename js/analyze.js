/*
 * analyze.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Orquesta todas las validaciones y, si no hay errores, evalúa la fórmula.
 * Regla central: una entrada incorrecta jamás recibe valor de verdad.
 */
(function (global) {
  'use strict'
  const dep = typeof require === 'function'
    ? Object.assign({}, require('./syntax.js'), require('./interp.js'), require('./evaluator.js'))
    : global.FOL

  /**
   * @param {{language:object[], domain:string, functions:object, predicates:object, formula:string, env:object}} input
   * @param {{evaluate?:boolean, full?:boolean}} opts
   */
  function analyze(input, opts = {}) {
    const errors = []
    const out = { errors, parsed: null, freeVars: [], result: null, symbols: null, interp: null, env: null }

    const lang = dep.parseLanguage(input.language || [])
    errors.push(...lang.errors)
    out.symbols = lang.symbols

    // Fórmula: se analiza con la parte válida del lenguaje, pero solo se reportan sus errores si el lenguaje es correcto.
    let parsed = null
    const p = dep.parse(input.formula || '', lang.symbols)
    if (p.ok) {
      const info = dep.varsInfo(p.ast)
      parsed = { ast: p.ast, text: dep.toStr(p.ast), info }
      out.parsed = parsed
      out.freeVars = info.free
    } else if (lang.errors.length === 0) {
      errors.push({ where: 'formula', msg: p.error.msg, pos: p.error.pos, len: p.error.len })
    } else {
      out.formulaSkipped = true
    }

    const built = dep.buildInterpretation(lang.symbols, input.domain, input.functions, input.predicates)
    errors.push(...built.errors)
    out.interp = built.interp

    let envOk = false
    if (parsed && built.interp) {
      const e = dep.parseEnv(parsed.info.free, input.env, built.interp.domain)
      errors.push(...e.errors)
      out.env = e.env
      envOk = e.errors.length === 0
    }

    if (opts.evaluate && errors.length === 0 && parsed && built.interp && envOk) {
      const r = dep.evaluate(parsed.ast, built.interp, out.env, { full: !!opts.full })
      if (r.ok) {
        out.result = {
          value: r.value,
          trace: r.trace,
          steps: r.steps,
          closed: parsed.info.closed,
          summary: dep.summarize(r.trace),
          formula: parsed.text,
          env: out.env,
          full: !!opts.full
        }
      } else errors.push({ where: 'evaluacion', msg: r.error })
    }
    return out
  }

  const api = { analyze }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
