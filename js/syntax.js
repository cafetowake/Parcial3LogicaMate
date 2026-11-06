/*
 * syntax.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Análisis léxico y sintáctico de fórmulas de primer orden.
 *
 * Gramática (de menor a mayor precedencia):
 *   fórmula  ::= impl ( '↔' impl )*
 *   impl     ::= disy ( '→' impl )?                 (asociativa a la derecha)
 *   disy     ::= conj ( '∨' conj )*
 *   conj     ::= unaria ( '∧' unaria )*
 *   unaria   ::= '¬' unaria | ('∀'|'∃') variable unaria | '(' fórmula ')' | atómica
 *   atómica  ::= PRED '(' término {',' término} ')' | término ('='|'≠') término
 *   término  ::= variable | CONST | FUNC '(' término {',' término} ')'
 *
 * Los cuantificadores y la negación ligan con la mayor fuerza, de modo que
 * "∀x P(x) → Q(x)" se lee como "(∀x P(x)) → Q(x)".
 */
(function (global) {
  'use strict'

  const VAR_RE = /^[u-z](?:_?\d+)?$/
  const VAR_PREFIX_RE = /^[u-z](?:_?\d+)?/
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/
  const RESERVED = new Set(['forall', 'exists'])

  const isVariableName = (s) => VAR_RE.test(s)

  /** Devuelve un mensaje de error si el nombre no es válido para un símbolo no lógico. */
  function checkSymbolName(name) {
    if (!name) return 'el nombre está vacío'
    if (!NAME_RE.test(name)) return 'debe iniciar con una letra y usar solo letras, dígitos o guion bajo'
    if (VAR_RE.test(name)) return 'tiene forma de variable (u, v, w, x, y, z con subíndice opcional) y estas están reservadas'
    if (RESERVED.has(name)) return 'es una palabra reservada'
    return null
  }

  class SyntaxError_ extends Error {
    constructor(msg, pos, len) {
      super(msg)
      this.pos = pos
      this.len = len || 1
    }
  }

  const SINGLE = {
    '¬': 'not', '~': 'not', '!': 'not',
    '∧': 'and', '^': 'and', '&': 'and',
    '∨': 'or', '|': 'or',
    '→': 'imp', '↔': 'iff',
    '∀': 'all', '∃': 'ex',
    '=': 'eq', '≠': 'neq',
    '(': 'lp', ')': 'rp', ',': 'comma'
  }
  const CANON = { not: '¬', and: '∧', or: '∨', imp: '→', iff: '↔', all: '∀', ex: '∃', eq: '=', neq: '≠', lp: '(', rp: ')', comma: ',' }

  function tokenize(text) {
    const tokens = []
    let i = 0
    let expectVar = false
    const push = (type, value, pos, len) => tokens.push({ type, value, pos, len })
    while (i < text.length) {
      const ch = text[i]
      if (/\s/.test(ch)) { i++; continue }
      if (expectVar) {
        const m = VAR_PREFIX_RE.exec(text.slice(i))
        if (!m) throw new SyntaxError_('Después de un cuantificador debe ir una variable (u, v, w, x, y, z con subíndice opcional)', i, 1)
        push('var', m[0], i, m[0].length)
        i += m[0].length
        expectVar = false
        continue
      }
      const three = text.substr(i, 3)
      const two = text.substr(i, 2)
      if (three === '<->' || three === '<=>') { push('iff', '↔', i, 3); i += 3; continue }
      if (two === '->' || two === '=>') { push('imp', '→', i, 2); i += 2; continue }
      if (two === '/\\') { push('and', '∧', i, 2); i += 2; continue }
      if (two === '\\/') { push('or', '∨', i, 2); i += 2; continue }
      if (two === '!=') { push('neq', '≠', i, 2); i += 2; continue }
      if (SINGLE[ch]) {
        const type = SINGLE[ch]
        push(type, CANON[type], i, 1)
        i++
        if (type === 'all' || type === 'ex') expectVar = true
        continue
      }
      const m = /^[A-Za-z][A-Za-z0-9_]*/.exec(text.slice(i))
      if (m) {
        const w = m[0]
        if (w === 'forall' || w === 'exists') {
          push(w === 'forall' ? 'all' : 'ex', w === 'forall' ? '∀' : '∃', i, w.length)
          expectVar = true
        } else if (VAR_RE.test(w)) push('var', w, i, w.length)
        else push('name', w, i, w.length)
        i += w.length
        continue
      }
      throw new SyntaxError_(`Carácter no válido «${ch}»`, i, 1)
    }
    if (expectVar) throw new SyntaxError_('Después de un cuantificador debe ir una variable', text.length, 1)
    return tokens
  }

  /**
   * @param {string} text
   * @param {Map<string,{kind:'fn'|'pred',arity:number}>} symbols
   * @returns {{ok:true, ast:object}|{ok:false, error:{msg:string,pos:number,len:number}}}
   */
  function parse(text, symbols) {
    try {
      if (!text || !text.trim()) throw new SyntaxError_('La fórmula está vacía', 0, 1)
      const tokens = tokenize(text)
      const end = text.length
      let k = 0
      const peek = () => tokens[k]
      const next = () => tokens[k++]
      const describe = (t) => (t ? `«${text.substr(t.pos, t.len)}»` : 'el final de la entrada')
      const errAt = (msg, t) => new SyntaxError_(msg, t ? t.pos : end, t ? t.len : 1)

      function parseIff() {
        let l = parseImp()
        while (peek() && peek().type === 'iff') {
          next()
          l = { t: 'iff', l, r: parseImp() }
        }
        return l
      }
      function parseImp() {
        const l = parseOr()
        if (peek() && peek().type === 'imp') {
          next()
          return { t: 'imp', l, r: parseImp() }
        }
        return l
      }
      function parseOr() {
        let l = parseAnd()
        while (peek() && peek().type === 'or') {
          next()
          l = { t: 'or', l, r: parseAnd() }
        }
        return l
      }
      function parseAnd() {
        let l = parseUnary()
        while (peek() && peek().type === 'and') {
          next()
          l = { t: 'and', l, r: parseUnary() }
        }
        return l
      }
      function parseUnary() {
        const tok = peek()
        if (!tok) throw errAt('Se esperaba una fórmula pero la entrada terminó', null)
        if (tok.type === 'not') {
          next()
          return { t: 'not', f: parseUnary() }
        }
        if (tok.type === 'all' || tok.type === 'ex') {
          next()
          const v = next()
          return { t: tok.type, v: v.value, f: parseUnary() }
        }
        if (tok.type === 'lp') {
          next()
          const f = parseIff()
          const close = peek()
          if (!close || close.type !== 'rp') {
            if (close) throw errAt(`Se esperaba «)» o un conectivo y se encontró «${close.value}». ¿Falta un conectivo (∧, ∨, →, ↔) entre dos fórmulas?`, close)
            throw errAt(`Falta cerrar el paréntesis abierto en la posición ${tok.pos + 1}`, close)
          }
          next()
          return f
        }
        return parseAtom()
      }
      function parseAtom() {
        const tok = peek()
        if (tok.type === 'name') {
          const sym = symbols.get(tok.value)
          if (sym && sym.kind === 'pred') {
            next()
            return { t: 'pred', name: tok.value, args: parseArgs(tok, sym) }
          }
        }
        if (tok.type !== 'var' && tok.type !== 'name') {
          throw errAt(`Se esperaba una fórmula pero se encontró ${describe(tok)}`, tok)
        }
        const left = parseTerm()
        const op = peek()
        if (op && (op.type === 'eq' || op.type === 'neq')) {
          next()
          const right = parseTerm()
          return { t: op.type, l: left, r: right }
        }
        throw errAt(`Se esperaba «=» o «≠» después del término «${termToStr(left)}» (un término por sí solo no es una fórmula)`, op)
      }
      function parseArgs(nameTok, sym) {
        const lp = peek()
        if (!lp || lp.type !== 'lp') {
          throw errAt(`El símbolo «${nameTok.value}» tiene aridad ${sym.arity} y debe escribirse con paréntesis, por ejemplo ${nameTok.value}(${Array(sym.arity).fill('x').join(', ')})`, lp || nameTok)
        }
        next()
        const args = []
        if (peek() && peek().type === 'rp') throw errAt(`El símbolo «${nameTok.value}» tiene aridad ${sym.arity} y no admite una lista de argumentos vacía`, peek())
        for (;;) {
          args.push(parseTerm())
          const t = peek()
          if (t && t.type === 'comma') { next(); continue }
          if (t && t.type === 'rp') { next(); break }
          throw errAt(`Se esperaba «,» o «)» en los argumentos de «${nameTok.value}» pero se encontró ${describe(t)}`, t)
        }
        if (args.length !== sym.arity) {
          throw new SyntaxError_(`El símbolo «${nameTok.value}» tiene aridad ${sym.arity} pero recibe ${args.length} argumento(s)`, nameTok.pos, nameTok.len)
        }
        return args
      }
      function parseTerm() {
        const tok = next()
        if (!tok) throw errAt('Se esperaba un término pero la entrada terminó', null)
        if (tok.type === 'var') return { t: 'var', name: tok.value }
        if (tok.type === 'name') {
          const sym = symbols.get(tok.value)
          if (!sym) throw errAt(`El símbolo «${tok.value}» no está declarado en el lenguaje (las variables son u, v, w, x, y, z con subíndice opcional)`, tok)
          if (sym.kind === 'pred') throw errAt(`«${tok.value}» es un predicado y no puede usarse como término`, tok)
          if (sym.arity === 0) {
            if (peek() && peek().type === 'lp') throw errAt(`«${tok.value}» es una constante (aridad 0) y no lleva paréntesis`, peek())
            return { t: 'fn', name: tok.value, args: [] }
          }
          return { t: 'fn', name: tok.value, args: parseArgs(tok, sym) }
        }
        throw errAt(`Se esperaba un término pero se encontró ${describe(tok)}`, tok)
      }

      const ast = parseIff()
      if (peek()) {
        const t = peek()
        throw errAt(t.type === 'rp' ? 'Paréntesis de cierre «)» sin su apertura' : `Símbolo inesperado ${describe(t)}: se esperaba el final de la fórmula`, t)
      }
      return { ok: true, ast }
    } catch (e) {
      if (e instanceof SyntaxError_) return { ok: false, error: { msg: e.message, pos: e.pos, len: e.len } }
      throw e
    }
  }

  // ---------- Utilidades sobre el árbol ----------

  function termToStr(t) {
    if (t.t === 'var') return t.name
    if (t.args.length === 0) return t.name
    return `${t.name}(${t.args.map(termToStr).join(', ')})`
  }

  const BINARY = { and: '∧', or: '∨', imp: '→', iff: '↔' }
  const isBinary = (n) => Object.prototype.hasOwnProperty.call(BINARY, n.t)

  /** Forma completamente parentetizada (sin paréntesis externos). */
  function toStr(n) {
    const wrap = (m) => (isBinary(m) ? `(${toStr(m)})` : toStr(m))
    switch (n.t) {
      case 'pred': return `${n.name}(${n.args.map(termToStr).join(', ')})`
      case 'eq': return `${termToStr(n.l)} = ${termToStr(n.r)}`
      case 'neq': return `${termToStr(n.l)} ≠ ${termToStr(n.r)}`
      case 'not': return `¬${wrap(n.f)}`
      case 'all': return `∀${n.v} ${wrap(n.f)}`
      case 'ex': return `∃${n.v} ${wrap(n.f)}`
      default: return `${wrap(n.l)} ${BINARY[n.t]} ${wrap(n.r)}`
    }
  }

  function termVars(t, out) {
    if (t.t === 'var') out.push(t.name)
    else t.args.forEach((a) => termVars(a, out))
    return out
  }

  const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true })

  /** Variables con alguna aparición libre. */
  function freeVars(n, bound = new Set(), out = new Set()) {
    switch (n.t) {
      case 'pred': n.args.forEach((a) => termVars(a, []).forEach((v) => { if (!bound.has(v)) out.add(v) })); break
      case 'eq': case 'neq': [n.l, n.r].forEach((a) => termVars(a, []).forEach((v) => { if (!bound.has(v)) out.add(v) })); break
      case 'not': freeVars(n.f, bound, out); break
      case 'all': case 'ex': freeVars(n.f, new Set([...bound, n.v]), out); break
      default: freeVars(n.l, bound, out); freeVars(n.r, bound, out)
    }
    return out
  }

  /** Clasifica las variables: libres (alguna aparición libre), ligadas (cuantificadas) y mixtas. */
  function varsInfo(ast) {
    const free = freeVars(ast)
    const quantified = new Set()
    ;(function walk(n) {
      if (n.t === 'all' || n.t === 'ex') { quantified.add(n.v); walk(n.f) } else if (n.t === 'not') walk(n.f)
      else if (n.l) { walk(n.l); walk(n.r) }
    })(ast)
    const mixed = [...free].filter((v) => quantified.has(v))
    return {
      free: [...free].sort(natural),
      bound: [...quantified].sort(natural),
      mixed: mixed.sort(natural),
      closed: free.size === 0
    }
  }

  const api = { tokenize, parse, toStr, termToStr, freeVars, varsInfo, isVariableName, checkSymbolName, termVars, isBinary, natural }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
