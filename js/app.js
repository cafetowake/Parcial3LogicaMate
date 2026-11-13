/*
 * app.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Interfaz gráfica. Toda la lógica de validación y evaluación vive en los demás módulos.
 */
(function () {
  'use strict'
  const F = window.FOL
  const $ = (sel, root = document) => root.querySelector(sel)

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue
      if (k === 'class') node.className = v
      else if (k === 'text') node.textContent = v
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
      else node.setAttribute(k, v === true ? '' : v)
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
    }
    return node
  }

  // ---------- Estado ----------
  const state = { rows: [], texts: {}, env: {}, hasResult: false }
  let rowCounter = 0
  const newRow = (kind, name, arity) => ({ id: ++rowCounter, kind, name: name || '', arity: arity === undefined ? 1 : arity })

  let editors = new Map() // nombre -> {name, kind, arity, textarea, helper, err, open, sig}
  let editorsSig = ''
  let envSig = ''
  let timer = null

  function readInput() {
    const functions = {}
    const predicates = {}
    for (const r of state.rows) {
      const n = r.name.trim()
      if (!n) continue
      if (r.kind === 'fn') functions[n] = state.texts[n] || ''
      else predicates[n] = state.texts[n] || ''
    }
    return {
      language: state.rows.map((r) => ({ kind: r.kind, name: r.name, arity: r.arity })),
      domain: $('#domain').value,
      functions,
      predicates,
      formula: $('#formula').value,
      env: state.env
    }
  }

  function schedule(opts) {
    clearTimeout(timer)
    timer = setTimeout(() => refresh(opts), 120)
  }

  // ---------- Lenguaje ----------
  function renderLangRows() {
    const box = $('#lang-rows')
    box.textContent = ''
    for (const row of state.rows) {
      const kind = el('select', { 'aria-label': 'Tipo de símbolo' },
        el('option', { value: 'pred', text: 'Predicado' }), el('option', { value: 'fn', text: 'Función' }))
      kind.value = row.kind
      const name = el('input', { type: 'text', value: row.name, placeholder: row.kind === 'pred' ? 'P' : 'f', 'aria-label': 'Nombre del símbolo', maxlength: 24, spellcheck: 'false', autocomplete: 'off' })
      const arity = el('input', { type: 'number', min: row.kind === 'pred' ? 1 : 0, max: 5, value: row.arity, 'aria-label': 'Aridad' })
      const del = el('button', { type: 'button', class: 'icon', title: 'Quitar símbolo', 'aria-label': 'Quitar símbolo', text: '✕' })
      kind.addEventListener('change', () => { row.kind = kind.value; arity.min = row.kind === 'pred' ? 1 : 0; name.placeholder = row.kind === 'pred' ? 'P' : 'f'; schedule() })
      name.addEventListener('input', () => { row.name = name.value; schedule() })
      arity.addEventListener('input', () => { row.arity = arity.value; schedule() })
      del.addEventListener('click', () => { state.rows = state.rows.filter((r) => r.id !== row.id); renderLangRows(); schedule() })
      box.append(el('div', { class: 'lang-row' }, kind, name, arity, del))
    }
  }

  function addRow(kind, arity, suggested) {
    const used = new Set(state.rows.map((r) => r.name.trim()))
    const pool = kind === 'pred' ? ['P', 'Q', 'R', 'S', 'T', 'U1', 'U2'] : arity === 0 ? ['a', 'b', 'c', 'd', 'e', 'k1', 'k2'] : ['f', 'g', 'h', 'j', 'k', 'm', 'n']
    const name = pool.find((p) => !used.has(p)) || suggested || ''
    state.rows.push(newRow(kind, name, arity))
    renderLangRows()
    schedule()
  }

  // ---------- Interpretación ----------
  const domainList = () => F.parseDomain($('#domain').value)

  function syncEditors(force) {
    const symbols = F.parseLanguage(state.rows).symbols
    const sig = JSON.stringify([...symbols.entries()])
    if (sig !== editorsSig || force) {
      editorsSig = sig
      const old = editors
      editors = new Map()
      const box = $('#interp-editors')
      box.textContent = ''
      for (const [name, s] of symbols) {
        const ed = { name, kind: s.kind, arity: s.arity, open: old.has(name) ? old.get(name).open : false, sig: '' }
        ed.textarea = el('textarea', {
          rows: s.kind === 'fn' && s.arity > 0 ? 4 : 2, spellcheck: 'false', 'aria-label': `Interpretación de ${name}`,
          placeholder: s.kind === 'pred' ? (s.arity === 1 ? '1, 2' : '(1, 2), (2, 3)') : s.arity === 0 ? 'a' : 'a -> b'
        })
        ed.textarea.value = state.texts[name] || ''
        ed.textarea.addEventListener('input', () => { state.texts[name] = ed.textarea.value; ed.sig = ''; schedule() })
        ed.err = el('div', { class: 'errors', hidden: true })
        ed.helper = el('div', { class: 'helper' })
        ed.toggle = el('button', { type: 'button', class: 'ghost', text: 'Tabla', 'aria-expanded': String(ed.open) })
        ed.toggle.addEventListener('click', () => { ed.open = !ed.open; ed.toggle.setAttribute('aria-expanded', String(ed.open)); ed.sig = ''; renderHelper(ed) })
        const kindText = s.kind === 'pred' ? `predicado de aridad ${s.arity}` : s.arity === 0 ? 'constante' : `función de aridad ${s.arity}`
        const sym = s.kind === 'pred' ? `${name}^I ⊆ D${s.arity > 1 ? '^' + s.arity : ''}` : s.arity === 0 ? `${name}^I ∈ D` : `${name}^I : D${s.arity > 1 ? '^' + s.arity : ''} → D`
        ed.box = el('div', { class: 'editor' },
          el('header', null, el('span', { class: 'title' }, name, ' ', el('span', { class: 'kind' }, `· ${kindText} · `, el('span', { class: 'mono' }, sym))), ed.toggle),
          ed.textarea, ed.err, ed.helper)
        editors.set(name, ed)
        box.append(ed.box)
      }
      if (symbols.size === 0) box.append(el('p', { class: 'help' }, 'Aún no hay símbolos no lógicos. Solo podrá escribir fórmulas con igualdad entre variables.'))
    }
    const dom = domainList()
    const dsig = dom.errors.length ? 'x' : dom.domain.join('\u0001')
    for (const ed of editors.values()) {
      if (ed.sig !== dsig + '|' + ed.open) renderHelper(ed, dom)
    }
  }

  const MAX_CELLS = 100

  function renderHelper(ed, dom) {
    dom = dom || domainList()
    ed.helper.textContent = ''
    ed.sig = (dom.errors.length ? 'x' : dom.domain.join('\u0001')) + '|' + ed.open
    if (!ed.open) return
    if (dom.errors.length) { ed.helper.append(el('p', { class: 'help' }, 'Defina primero un dominio válido.')); return }
    const D = dom.domain
    const all = F.tuples(D, ed.arity)
    if (all.length > MAX_CELLS) { ed.helper.append(el('p', { class: 'help' }, `La tabla tendría ${all.length} celdas. Use el campo de texto.`)); return }
    const write = (text) => { ed.textarea.value = text; state.texts[ed.name] = text; schedule() }
    if (ed.kind === 'pred') {
      const set = new Set(F.parsePredicate(ed.textarea.value, ed.name, ed.arity, D).set)
      const fmt = () => all.filter((t) => set.has(F.key(t))).map((t) => (ed.arity === 1 ? t[0] : `(${t.join(', ')})`)).join(', ')
      const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `Tuplas de ${ed.name}` })
      for (const t of all) {
        const k = F.key(t)
        const b = el('button', { type: 'button', class: 'chip' + (set.has(k) ? ' on' : ''), 'aria-pressed': String(set.has(k)), text: F.showTuple(t) })
        b.addEventListener('click', () => {
          if (set.has(k)) set.delete(k); else set.add(k)
          b.classList.toggle('on', set.has(k)); b.setAttribute('aria-pressed', String(set.has(k)))
          write(fmt())
        })
        chips.append(b)
      }
      ed.helper.append(el('p', { class: 'help' }, 'Haga clic en las tuplas que pertenecen a la relación.'), chips)
    } else {
      const table = new Map(F.parseFunction(ed.textarea.value, ed.name, ed.arity, D).table)
      const fmt = () => all.filter((t) => table.has(F.key(t))).map((t) => (ed.arity === 0 ? table.get(F.key(t)) : `${t.join(', ')} -> ${table.get(F.key(t))}`)).join('\n')
      const grid = el('div', { class: 'fn-grid' })
      for (const t of all) {
        const k = F.key(t)
        const sel = el('select', { 'aria-label': `Valor de ${ed.name}${ed.arity ? '(' + t.join(', ') + ')' : ''}` }, el('option', { value: '', text: '—' }), D.map((d) => el('option', { value: d, text: d })))
        sel.value = table.get(k) || ''
        sel.addEventListener('change', () => { if (sel.value) table.set(k, sel.value); else table.delete(k); write(fmt()) })
        grid.append(el('label', null, ed.arity === 0 ? `${ed.name} =` : `${ed.name}(${t.join(', ')}) =`, sel))
      }
      ed.helper.append(el('p', { class: 'help' }, 'Elija el valor de la función para cada tupla del dominio.'), grid)
    }
  }

  // ---------- Errores ----------
  function showErrors(box, list) {
    box.textContent = ''
    if (!list.length) { box.hidden = true; return }
    box.hidden = false
    box.append(el('ul', null, list.map((e) => el('li', { text: e.msg }))))
  }

  function renderErrors(res) {
    const by = (pred) => res.errors.filter(pred)
    showErrors($('#err-lang'), by((e) => e.where === 'lenguaje'))
    showErrors($('#err-domain'), by((e) => e.where === 'dominio'))
    showErrors($('#err-env'), by((e) => e.where === 'entorno'))
    for (const ed of editors.values()) showErrors(ed.err, by((e) => e.where === `f:${ed.name}` || e.where === `P:${ed.name}`))
  }

  // ---------- Fórmula ----------
  function renderFormulaInfo(res) {
    const box = $('#formula-info')
    box.textContent = ''
    const text = $('#formula').value
    if (!text.trim()) { box.append(el('p', { class: 'help' }, 'Escriba una fórmula o use los botones de símbolos.')); return }
    const p = F.parse(text, res.symbols)
    if (!p.ok) {
      const { msg, pos, len } = p.error
      const under = ' '.repeat(Math.max(0, pos)) + '^'.repeat(Math.max(1, len))
      box.append(el('div', { class: 'caret-box', role: 'alert' }, el('b', null, `Error de sintaxis (posición ${pos + 1}): `), msg,
        el('pre', null, text, '\n', el('span', { class: 'caret' }, under))))
      return
    }
    const info = F.varsInfo(p.ast)
    const vlist = (arr, cls) => (arr.length ? arr.flatMap((v, i) => [i ? ', ' : '', el('span', { class: cls }, v)]) : 'ninguna')
    box.append(
      el('p', { class: 'info-line' }, el('b', null, 'Lectura con paréntesis'), el('code', null, F.toStr(p.ast))),
      el('p', { class: 'info-line' }, el('b', null, 'Tipo'), info.closed ? 'Fórmula cerrada (enunciado)' : 'Fórmula abierta'),
      el('p', { class: 'info-line' }, el('b', null, 'Variables libres'), vlist(info.free, 'var-free')),
      el('p', { class: 'info-line' }, el('b', null, 'Variables ligadas'), vlist(info.bound, 'var-bound'))
    )
    if (info.mixed.length) {
      box.append(el('div', { class: 'warn' }, `La variable ${info.mixed.join(', ')} aparece libre y también ligada. Recuerde que un cuantificador solo alcanza a la subfórmula inmediata. Use paréntesis si desea ampliar su alcance.`))
    }
    const tree = el('details', { class: 'tree-box', open: true }, el('summary', null, 'Árbol sintáctico'))
    const scroll = el('div', { class: 'tree-scroll' })
    scroll.innerHTML = F.toSvg(p.ast)
    tree.append(scroll, el('div', { class: 'legend' },
      el('span', null, el('span', { class: 'var-free' }, '● variable libre')),
      el('span', null, el('span', { class: 'var-bound' }, '● variable ligada')),
      el('span', null, '■ predicado o conectivo')))
    box.append(tree)
  }

  // ---------- Entorno ----------
  function renderEnv(res) {
    const body = $('#env-body')
    const dom = domainList()
    const list = $('#dl-domain')
    list.textContent = ''
    if (!dom.errors.length) dom.domain.forEach((d) => list.append(el('option', { value: d })))
    const free = res.freeVars
    const sig = JSON.stringify([free, dom.domain, !!res.parsed])
    if (sig === envSig) return
    envSig = sig
    body.textContent = ''
    if (!res.parsed) { body.append(el('p', { class: 'help' }, 'Se solicitará el entorno cuando la fórmula sea sintácticamente correcta.')); return }
    if (free.length === 0) { body.append(el('p', { class: 'help' }, 'La fórmula es cerrada. Su verdad no depende del entorno.')); return }
    body.append(el('p', { class: 'help' }, 'Un entorno l fija cada variable libre en un elemento de D. Escriba el valor o elíjalo de la lista.'))
    const grid = el('div', { class: 'env-grid' })
    for (const v of free) {
      const inp = el('input', { type: 'text', list: 'dl-domain', value: state.env[v] || '', placeholder: 'elemento de D', 'aria-label': `Valor de ${v}`, spellcheck: 'false', autocomplete: 'off' })
      inp.addEventListener('input', () => { state.env[v] = inp.value; schedule() })
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') evaluateNow() })
      grid.append(el('label', null, el('span', { class: 'label' }, `l(${v}) =`), inp))
    }
    body.append(grid)
  }

  // ---------- Refresco general ----------
  function refresh() {
    syncEditors(false)
    const input = readInput()
    const res = F.analyze(input, { evaluate: false })
    renderErrors(res)
    renderFormulaInfo(res)
    renderEnv(res)
    if (state.hasResult) $('#result').classList.add('stale')
  }

  // ---------- Resultado ----------
  const envText = (env) => {
    const ks = Object.keys(env)
    return ks.length ? `{${ks.map((k) => `${k} ↦ ${env[k]}`).join(', ')}}` : ''
  }

  function nodeHead(nd) {
    return [
      el('span', { class: 'vb ' + (nd.value ? 't' : 'f'), text: nd.value ? 'V' : 'F' }),
      el('span', { class: 'f' }, nd.text),
      nd.env.length ? el('span', { class: 'env' }, ` [${nd.env.map(([k, a]) => `${k} ↦ ${a}`).join(', ')}]`) : ''
    ]
  }

  function checksEl(nd) {
    const wrap = el('div', { class: 'checks', 'aria-label': 'Valor de la subfórmula para cada elemento' })
    nd.checks.forEach((c) => wrap.append(el('span', { class: 'vb ' + (c.value ? 't' : 'f'), text: `${c.a}: ${c.value ? 'V' : 'F'}` })))
    return wrap
  }

  function traceEl(nd, open) {
    const d = el('details', null, el('summary', { class: 'tsum' }, nodeHead(nd)))
    const fill = () => {
      d.append(el('div', { class: 'body' }, nd.why))
      if (nd.checks) d.append(checksEl(nd))
      if (nd.truncated) d.append(el('div', { class: 'body' }, 'La traza de algunos elementos se omitió por su tamaño, pero su valor sí se calculó.'))
      nd.children.forEach((c) => d.append(c.children.length === 0 && !c.checks ? leafEl(c) : traceEl(c, false)))
    }
    if (open) { d.open = true; fill() } else d.addEventListener('toggle', () => { if (d.open && !d.dataset.done) { d.dataset.done = '1'; fill() } })
    return d
  }
  function leafEl(nd) {
    return el('div', { class: 'leaf' }, el('div', { class: 'tsum' }, nodeHead(nd)), el('div', { class: 'body' }, nd.why))
  }

  function renderResult(r, input) {
    const box = $('#result')
    box.textContent = ''
    box.classList.remove('stale')
    const formal = r.closed ? `I ${r.value ? '⊨' : '⊭'} φ` : `I ${r.value ? '⊨' : '⊭'}_l φ`
    box.append(el('div', { class: 'stale-note' }, 'Los datos cambiaron después de esta evaluación. Presione Evaluar para actualizar el resultado.'))
    box.append(el('div', { class: 'verdict ' + (r.value ? 'true' : 'false'), role: 'status' },
      el('span', { class: 'word' }, r.value ? 'VERDADERO' : 'FALSO'),
      el('span', { class: 'formal' }, formal)))
    box.append(el('p', { class: 'meta' }, el('code', null, r.formula), r.closed ? ' es un enunciado: la elección del entorno es irrelevante.' : ` evaluada en el entorno l = ${envText(r.env)}.`))
    const reasons = el('ol', { class: 'reasons', 'aria-label': 'Razones decisivas' })
    r.summary.forEach((ln) => {
      const nd = ln.node
      const li = el('li', { style: `margin-left:${ln.depth * 18}px` })
      if (ln.text.startsWith('Valor de la subfórmula')) li.append(el('div', { class: 'sub' }, ln.text), checksEl(nd))
      else li.append(...nodeHead(nd), el('div', { class: 'sub' }, nd.why))
      reasons.append(li)
    })
    box.append(el('h3', null, 'Razones decisivas'), reasons)
    const trace = el('details', { class: 'trace-box' }, el('summary', null, 'Traza completa de la evaluación'))
    const holder = el('div', { class: 'trace' })
    trace.addEventListener('toggle', () => { if (trace.open && !holder.firstChild) holder.append(traceEl(r.trace, true)) })
    trace.append(holder)
    box.append(trace)
    state.hasResult = true
  }

  function evaluateNow() {
    clearTimeout(timer)
    refresh()
    const input = readInput()
    const res = F.analyze(input, { evaluate: true, full: $('#full-eval').checked })
    const status = $('#status')
    const box = $('#result')
    if (!res.result) {
      state.hasResult = false
      box.textContent = ''
      status.classList.add('err')
      status.textContent = ''
      const list = res.errors.length ? res.errors : [{ msg: 'Complete el lenguaje, el dominio y la fórmula.' }]
      status.append(el('strong', null, 'No se puede evaluar: la entrada tiene errores y no recibe valor de verdad.'),
        el('ul', null, list.slice(0, 12).map((e) => el('li', { text: (e.where ? `[${sectionName(e.where)}] ` : '') + e.msg }))),
        list.length > 12 ? el('div', null, `… y ${list.length - 12} error(es) más.`) : '')
      return
    }
    status.classList.remove('err')
    status.textContent = ''
    renderResult(res.result, input)
  }
  const sectionName = (w) => ({ lenguaje: 'Lenguaje', dominio: 'Dominio', formula: 'Fórmula', entorno: 'Entorno', evaluacion: 'Evaluación' }[w] || (w.startsWith('f:') ? `Función ${w.slice(2)}` : w.startsWith('P:') ? `Predicado ${w.slice(2)}` : w))

  // ---------- Cargar, exportar e importar ----------
  function loadState(st) {
    state.rows = st.language.map((r) => newRow(r.kind, r.name, r.arity))
    state.texts = Object.assign({}, st.functions || {}, st.predicates || {})
    state.env = Object.assign({}, st.env || {})
    $('#domain').value = st.domain || ''
    $('#formula').value = st.formula || ''
    state.hasResult = false
    $('#result').textContent = ''
    $('#status').textContent = ''
    $('#status').classList.remove('err')
    envSig = ''
    renderLangRows()
    syncEditors(true)
    refresh()
  }

  function toolbarMsg(msg, isErr) {
    const m = $('#toolbar-msg')
    m.textContent = msg || ''
    m.classList.toggle('err', !!isErr)
  }

  function exportJson() {
    const input = readInput()
    const data = { version: 1, language: input.language.map((r) => ({ kind: r.kind, name: r.name.trim(), arity: Number(r.arity) })), domain: input.domain, functions: input.functions, predicates: input.predicates, formula: input.formula, env: input.env }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = el('a', { href: URL.createObjectURL(blob), download: 'interpretacion.json' })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toolbarMsg('Se exportó el archivo interpretacion.json con el lenguaje, la interpretación, la fórmula y el entorno.')
  }

  function importJson(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result)
        const okRows = Array.isArray(d.language) && d.language.every((r) => r && (r.kind === 'pred' || r.kind === 'fn') && typeof r.name === 'string')
        if (!okRows || typeof d.domain !== 'string' || typeof d.formula !== 'string') throw new Error('estructura inesperada')
        const strs = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => typeof v === 'string'))
        loadState({ language: d.language.map((r) => ({ kind: r.kind, name: r.name, arity: r.arity })), domain: d.domain, functions: strs(d.functions), predicates: strs(d.predicates), formula: d.formula, env: strs(d.env) })
        toolbarMsg(`Se importó «${file.name}».`)
      } catch (e) {
        toolbarMsg(`No se pudo importar el archivo: ${e.message}. Verifique que sea un JSON exportado por esta aplicación.`, true)
      }
    }
    reader.onerror = () => toolbarMsg('No se pudo leer el archivo.', true)
    reader.readAsText(file)
  }

  // ---------- Buscador ----------
  function runFinder(target) {
    const msg = $('#finder-msg')
    msg.classList.remove('err')
    const input = readInput()
    const res = F.analyze(input, { evaluate: false })
    if (res.errors.some((e) => e.where === 'lenguaje')) { msg.classList.add('err'); msg.textContent = 'Corrija primero el lenguaje.'; return }
    if (!res.parsed) { msg.classList.add('err'); msg.textContent = 'Escriba primero una fórmula sintácticamente correcta.'; return }
    msg.textContent = 'Buscando…'
    setTimeout(() => {
      const k = Number($('#finder-size').value)
      const r = F.search(res.parsed.ast, res.symbols, { target, maxSize: k })
      const what = target ? 'modelo' : 'contramodelo'
      if (!r.found) {
        const skip = r.skipped.length ? ` Se omitieron los tamaños ${r.skipped.join(', ')} por exceder el presupuesto de búsqueda.` : ''
        msg.textContent = `No se encontró ningún ${what} con dominios de tamaño 1 a ${k} (se examinaron ${r.examined} casos).${skip} Esto no prueba que la fórmula sea ${target ? 'insatisfacible' : 'válida'}, solo que no hay ${what} tan pequeño.`
        return
      }
      const t = F.toTexts(r.interp)
      loadState({ language: input.language, domain: t.domain, functions: t.functions, predicates: t.predicates, formula: input.formula, env: r.env })
      evaluateNow()
      msg.textContent = `Se encontró un ${what} con un dominio de ${r.size} elemento(s) tras examinar ${r.examined} caso(s). Ya está cargado arriba${target ? '' : ' (la fórmula es falsa en él, luego no es válida)'}.`
    }, 30)
  }

  // ---------- Entrada con teclado: equivalentes ASCII ----------
  const ASCII = [['<->', '↔'], ['<=>', '↔'], ['->', '→'], ['=>', '→'], ['/\\', '∧'], ['\\/', '∨'], ['!=', '≠'], ['&', '∧'], ['^', '∧'], ['|', '∨'], ['~', '¬']]
  function normalizeAscii(s) {
    let out = s
    for (const [a, b] of ASCII) out = out.split(a).join(b)
    return out
  }
  function setupFormulaInput() {
    const inp = $('#formula')
    inp.addEventListener('input', () => {
      const pos = inp.selectionStart
      const before = normalizeAscii(inp.value.slice(0, pos))
      const after = normalizeAscii(inp.value.slice(pos))
      const next = before + after
      if (next !== inp.value) { inp.value = next; inp.setSelectionRange(before.length, before.length) }
      schedule()
    })
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') evaluateNow() })
    document.querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => {
      let s = b.dataset.ins
      const quant = s === '∀' || s === '∃'
      if (quant) s += 'x '
      const a = inp.selectionStart
      const z = inp.selectionEnd
      inp.value = inp.value.slice(0, a) + s + inp.value.slice(z)
      inp.focus()
      if (quant) inp.setSelectionRange(a + 1, a + 2)
      else inp.setSelectionRange(a + s.length, a + s.length)
      schedule()
    }))
    $('#btn-clear-formula').addEventListener('click', () => { inp.value = ''; inp.focus(); schedule() })
  }

  // ---------- Inicio ----------
  function init() {
    const sel = $('#examples')
    F.examples.forEach((ex) => sel.append(el('option', { value: ex.id, text: ex.title })))
    sel.addEventListener('change', () => {
      const ex = F.examples.find((e) => e.id === sel.value)
      if (!ex) return
      loadState(JSON.parse(JSON.stringify(ex.state)))
      evaluateNow()
      toolbarMsg(`Ejemplo cargado: ${ex.title}. Puede modificarlo libremente.`)
    })
    $('#add-pred').addEventListener('click', () => addRow('pred', 1))
    $('#add-fn').addEventListener('click', () => addRow('fn', 1))
    $('#add-const').addEventListener('click', () => addRow('fn', 0))
    $('#domain').addEventListener('input', () => schedule())
    $('#domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') evaluateNow() })
    $('#btn-eval').addEventListener('click', evaluateNow)
    $('#full-eval').addEventListener('change', () => { if (state.hasResult) $('#result').classList.add('stale') })
    $('#btn-export').addEventListener('click', exportJson)
    $('#file-import').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = '' })
    $('#btn-model').addEventListener('click', () => runFinder(true))
    $('#btn-counter').addEventListener('click', () => runFinder(false))
    setupFormulaInput()
    loadState(JSON.parse(JSON.stringify(F.examples[0].state)))
  }
  init()
})()
