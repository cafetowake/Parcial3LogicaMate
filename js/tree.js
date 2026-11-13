/*
 * tree.js
 * Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala
 * Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos
 *
 * Aporte creativo: árbol sintáctico de la fórmula como SVG, con las variables libres y
 * ligadas coloreadas de forma distinta (las apariciones, no solo los nombres).
 */
(function (global) {
  'use strict'
  const S = typeof require === 'function' ? require('./syntax.js') : global.FOL

  function termNode(t, bound) {
    if (t.t === 'var') return { label: t.name, cls: bound.has(t.name) ? 'bound' : 'free', children: [] }
    return { label: t.name, cls: t.args.length ? 'fn' : 'const', children: t.args.map((a) => termNode(a, bound)) }
  }

  function build(n, bound) {
    switch (n.t) {
      case 'pred': return { label: n.name, cls: 'pred', children: n.args.map((a) => termNode(a, bound)) }
      case 'eq': return { label: '=', cls: 'pred', children: [termNode(n.l, bound), termNode(n.r, bound)] }
      case 'neq': return { label: '≠', cls: 'pred', children: [termNode(n.l, bound), termNode(n.r, bound)] }
      case 'not': return { label: '¬', cls: 'op', children: [build(n.f, bound)] }
      case 'all': case 'ex': return { label: (n.t === 'all' ? '∀' : '∃') + n.v, cls: 'quant', children: [build(n.f, new Set([...bound, n.v]))] }
      default: return { label: { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.t], cls: 'op', children: [build(n.l, bound), build(n.r, bound)] }
    }
  }

  /** Calcula posiciones: hojas en columnas consecutivas, padres centrados sobre sus hijos. */
  function layout(root) {
    let leaf = 0
    let maxDepth = 0
    let maxLen = 1
    ;(function visit(nd, depth) {
      nd.depth = depth
      maxDepth = Math.max(maxDepth, depth)
      maxLen = Math.max(maxLen, nd.label.length)
      nd.children.forEach((c) => visit(c, depth + 1))
      if (nd.children.length === 0) nd.col = leaf++
      else nd.col = (nd.children[0].col + nd.children[nd.children.length - 1].col) / 2
    })(root, 0)
    return { leaves: leaf, maxDepth, maxLen }
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  function toSvg(ast) {
    const root = build(ast, new Set())
    const { leaves, maxDepth, maxLen } = layout(root)
    const slot = Math.max(54, maxLen * 9 + 26)
    const rowH = 62
    const padX = 30
    const padY = 28
    const width = Math.max(1, leaves) * slot + padX * 2
    const height = (maxDepth + 1) * rowH + padY
    const pos = (nd) => [padX + nd.col * slot + slot / 2, padY + nd.depth * rowH]
    const lines = []
    const nodes = []
    ;(function draw(nd) {
      const [x, y] = pos(nd)
      nd.children.forEach((c) => {
        const [cx, cy] = pos(c)
        lines.push(`<line x1="${x}" y1="${y}" x2="${cx}" y2="${cy}" class="edge"/>`)
        draw(c)
      })
      const w = Math.max(30, nd.label.length * 9 + 16)
      nodes.push(`<g class="node ${nd.cls}"><rect x="${x - w / 2}" y="${y - 14}" width="${w}" height="28" rx="${nd.cls === 'free' || nd.cls === 'bound' || nd.cls === 'const' ? 14 : 6}"/><text x="${x}" y="${y + 5}" text-anchor="middle">${esc(nd.label)}</text></g>`)
    })(root)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Árbol sintáctico de la fórmula">${lines.join('')}${nodes.join('')}</svg>`
  }

  const api = { toSvg, build, layout }
  if (typeof module === 'object' && module.exports) module.exports = api
  else global.FOL = Object.assign(global.FOL || {}, api)
})(typeof window !== 'undefined' ? window : globalThis)
