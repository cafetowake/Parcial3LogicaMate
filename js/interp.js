/*
 * interp.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Validación del lenguaje, del dominio, de las interpretaciones y de los entornos.
 * Toda entrada incorrecta produce errores y nunca un valor de verdad.
 */
(function (global) {
  'use strict'
  const S = typeof require === 'function' ? require('./syntax.js') : global.FOL

  const MAX_DOMAIN = 30
  const MAX_ARITY = 5
  const MAX_TABLE = 4096
  const SEP = '\u001f'

  const key = (tuple) => tuple.join(SEP)
  const ELEM_RE = /^[^\s,(){}<>"';]+$/u

  /** Todas las tuplas de D^n en orden lexicográfico según el orden del dominio. */
  function tuples(domain, n) {
    let out = [[]]
    for (let i = 0; i < n; i++) {
      const nxt = []
      for (const t of out) for (const d of domain) nxt.push([...t, d])
      out = nxt
    }
    return out
  }

  const showTuple = (t) => (t.length === 1 ? t[0] : `(${t.join(', ')})`)
  const listSome = (items, max = 6) =>
    items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')}, … (${items.length} en total)`

  /** @param {{kind:string,name:string,arity:any}[]} rows */
  function parseLanguage(rows) {
    const errors = []
    const symbols = new Map()
    rows.forEach((r, i) => {
      const name = (r.name || '').trim()
      const where = 'lenguaje'
      const label = name ? `«${name}»` : `la fila ${i + 1}`
      const problem = S.checkSymbolName(name)
      if (problem) { errors.push({ where, msg: `Símbolo ${label}: ${problem}.` }); return }
      const raw = String(r.arity).trim()
      if (!/^\d+$/.test(raw)) { errors.push({ where, msg: `Símbolo «${name}»: la aridad debe ser un entero no negativo.` }); return }
      const arity = Number(raw)
      const min = r.kind === 'pred' ? 1 : 0
      if (arity < min || arity > MAX_ARITY) {
        errors.push({ where, msg: `Símbolo «${name}»: la aridad de un ${r.kind === 'pred' ? 'predicado' : 'símbolo funcional'} debe estar entre ${min} y ${MAX_ARITY}.` })
        return
      }
      if (symbols.has(name)) { errors.push({ where, msg: `El símbolo «${name}» está declarado más de una vez.` }); return }
      symbols.set(name, { kind: r.kind === 'pred' ? 'pred' : 'fn', arity })
    })
    return { errors, symbols }
  }

  function parseDomain(text) {
    const errors = []
    const where = 'dominio'
    const cleaned = (text || '').replace(/[{}]/g, ' ')
    const items = cleaned.split(/[,\n;]/).map((s) => s.trim()).filter((s) => s.length > 0)
    if (items.length === 0) return { errors: [{ where, msg: 'El dominio debe ser un conjunto finito no vacío.' }], domain: [] }
    const seen = new Set()
    const domain = []
    for (const it of items) {
      if (!ELEM_RE.test(it)) { errors.push({ where, msg: `El elemento «${it}» no es válido (no use espacios ni los símbolos , ( ) { } ; < > " ').` }); continue }
      if (seen.has(it)) { errors.push({ where, msg: `El elemento «${it}» está repetido en el dominio.` }); continue }
      seen.add(it)
      domain.push(it)
    }
    if (domain.length > MAX_DOMAIN) errors.push({ where, msg: `El dominio admite como máximo ${MAX_DOMAIN} elementos.` })
    return { errors, domain }
  }

  /** Interpretación de un símbolo funcional: líneas «a, b -> c» (una constante se escribe «c»). */
  function parseFunction(text, name, arity, domain) {
    const where = `f:${name}`
    const errors = []
    const table = new Map()
    const dset = new Set(domain)
    if (Math.pow(domain.length, arity) > MAX_TABLE) {
      return { errors: [{ where, msg: `La tabla de «${name}» tendría más de ${MAX_TABLE} entradas. Reduzca el dominio o la aridad.` }], table }
    }
    const lines = (text || '').split(/[\n;]/).map((s) => s.trim()).filter(Boolean)
    for (const line of lines) {
      const m = /^(.*?)(->|→|↦|=)(.*)$/.exec(line)
      let lhs
      let rhs
      if (m) { lhs = m[1].trim(); rhs = m[3].trim() } else if (arity === 0) { lhs = ''; rhs = line } else {
        errors.push({ where, msg: `Línea «${line}»: use el formato «a, b -> c» (argumentos, flecha y valor).` })
        continue
      }
      if (lhs.startsWith(name) && /^(\s|\(|$)/.test(lhs.slice(name.length))) lhs = lhs.slice(name.length).trim()
      if (arity === 0 && lhs === '()') lhs = ''
      else if (lhs.startsWith('(') && lhs.endsWith(')')) lhs = lhs.slice(1, -1).trim()
      const args = lhs === '' ? [] : lhs.split(',').map((s) => s.trim())
      if (args.length !== arity || args.some((a) => a === '')) {
        errors.push({ where, msg: `Línea «${line}»: «${name}» tiene aridad ${arity} y se recibieron ${args.filter((a) => a !== '').length} argumento(s).` })
        continue
      }
      if (!ELEM_RE.test(rhs)) { errors.push({ where, msg: `Línea «${line}»: el valor «${rhs}» no es un elemento válido.` }); continue }
      const bad = [...args, rhs].find((e) => !dset.has(e))
      if (bad !== undefined) { errors.push({ where, msg: `Línea «${line}»: el elemento «${bad}» no pertenece al dominio.` }); continue }
      const k = key(args)
      if (table.has(k) && table.get(k) !== rhs) {
        errors.push({ where, msg: `«${arity ? `${name}(${args.join(', ')})` : name}» está definido con dos valores distintos («${table.get(k)}» y «${rhs}»).` })
        continue
      }
      table.set(k, rhs)
    }
    const missing = tuples(domain, arity).filter((t) => !table.has(key(t)))
    if (missing.length > 0 && errors.length === 0) {
      errors.push({
        where,
        msg: arity === 0
          ? `Falta asignar un valor a la constante «${name}».`
          : `Falta asignar «${name}» en ${missing.length} tupla(s): ${listSome(missing.map(showTuple))}. La función debe estar definida en todo ${'D'}${arity > 1 ? '^' + arity : ''}.`
      })
    }
    return { errors, table }
  }

  /** Interpretación de un predicado: lista de tuplas «(a, b), (c, d)» o elementos sueltos si es unario. */
  function parsePredicate(text, name, arity, domain) {
    const where = `P:${name}`
    const errors = []
    const set = new Set()
    const dset = new Set(domain)
    const cleaned = (text || '').replace(/[{};\n]/g, ' ')
    const toks = []
    let i = 0
    while (i < cleaned.length) {
      const ch = cleaned[i]
      if (/\s/.test(ch)) { i++; continue }
      if (ch === '(' || ch === ')' || ch === ',') { toks.push({ t: ch, v: ch }); i++; continue }
      let j = i
      while (j < cleaned.length && !/[\s(),]/.test(cleaned[j])) j++
      toks.push({ t: 'e', v: cleaned.slice(i, j) })
      i = j
    }
    const items = []
    let k = 0
    let failed = false
    const fail = (msg) => { errors.push({ where, msg }); failed = true }
    while (k < toks.length && !failed) {
      const tk = toks[k]
      if (tk.t === ',') { k++; continue }
      if (tk.t === 'e') {
        if (arity !== 1) { fail(`«${name}» tiene aridad ${arity}: cada tupla debe escribirse entre paréntesis, por ejemplo (${Array(arity).fill('a').join(', ')}). Se encontró «${tk.v}».`); break }
        items.push([tk.v]); k++; continue
      }
      if (tk.t === ')') { fail('Paréntesis de cierre «)» sin su apertura.'); break }
      // tupla entre paréntesis
      k++
      const elems = []
      let closed = false
      while (k < toks.length) {
        const t2 = toks[k]
        if (t2.t === 'e') { elems.push(t2.v); k++ } else if (t2.t === ',') { k++ } else if (t2.t === ')') { closed = true; k++; break } else { fail('Paréntesis «(» anidado: las tuplas no pueden contener otras tuplas.'); break }
      }
      if (failed) break
      if (!closed) { fail('Falta cerrar un paréntesis en la lista de tuplas.'); break }
      items.push(elems)
    }
    if (!failed) {
      for (const t of items) {
        if (t.length !== arity) { errors.push({ where, msg: `La tupla ${showTuple(t)} tiene ${t.length} componente(s) pero «${name}» tiene aridad ${arity}.` }); continue }
        const bad = t.find((e) => !dset.has(e))
        if (bad !== undefined) { errors.push({ where, msg: `La tupla ${showTuple(t)} contiene el elemento «${bad}», que no pertenece al dominio.` }); continue }
        set.add(key(t))
      }
      if (errors.length === 0 && set.size === 0) errors.push({ where, msg: `La relación «${name}» no puede ser vacía.` })
    }
    return { errors, set }
  }

  function buildInterpretation(symbols, domainText, fnTexts, predTexts) {
    const dom = parseDomain(domainText)
    const errors = [...dom.errors]
    const interp = { domain: dom.domain, fns: new Map(), preds: new Map() }
    if (dom.errors.length > 0) return { errors, interp: null, skipped: true }
    for (const [name, sym] of symbols) {
      if (sym.kind === 'fn') {
        const r = parseFunction((fnTexts || {})[name], name, sym.arity, dom.domain)
        errors.push(...r.errors)
        interp.fns.set(name, { arity: sym.arity, table: r.table })
      } else {
        const r = parsePredicate((predTexts || {})[name], name, sym.arity, dom.domain)
        errors.push(...r.errors)
        interp.preds.set(name, { arity: sym.arity, set: r.set })
      }
    }
    return { errors, interp: errors.length ? null : interp }
  }

  /** Valida el entorno: una asignación a D para cada variable libre. */
  function parseEnv(freeVars, values, domain) {
    const errors = []
    const env = {}
    const dset = new Set(domain)
    for (const v of freeVars) {
      const raw = ((values || {})[v] || '').trim()
      if (raw === '') { errors.push({ where: 'entorno', msg: `Falta asignar un valor a la variable libre «${v}».` }); continue }
      if (!dset.has(raw)) { errors.push({ where: 'entorno', msg: `El valor «${raw}» asignado a «${v}» no pertenece al dominio.` }); continue }
      env[v] = raw
    }
    return { errors, env }
  }

  const api = { tuples, key, showTuple, parseLanguage, parseDomain, parseFunction, parsePredicate, buildInterpretation, parseEnv, MAX_DOMAIN, MAX_ARITY, MAX_TABLE }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
