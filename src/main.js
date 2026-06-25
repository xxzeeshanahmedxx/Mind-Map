import './style.css'

const STORAGE_KEY = 'personal-mind-map-vite-v1'
const WORLD_WIDTH = 4200
const WORLD_HEIGHT = 2800

const defaultNode = {
  x: 520,
  y: 360,
  w: 150,
  h: 52,
  text: 'New idea',
  fill: '#ffffff',
  color: '#0f172a',
  border: '#e6e6e6',
  font: 'Inter',
  size: 15,
  bold: false,
  italic: false,
  underline: false,
  align: 'center',
  shape: 'rounded',
  borderW: 1,
  radius: 10,
  opacity: 100,
  padding: 7,
  shadow: true,
}

let state = {
  nodes: [],
  links: [],
  selectedId: null,
  selectedLinkId: null,
  connectMode: false,
  connectFrom: null,
  pan: { x: 140, y: 70 },
  zoom: 1,
  canvas: {
    color: '#f6f5f4',
    grid: true,
  },
  linkDefaults: {
    color: '#0075de',
    width: 3,
    type: 'curve',
    dash: false,
    arrow: false,
  },
  outline: '',
  search: '',
}

const history = []
const future = []
let isRestoring = false
let dragState = null
let panState = null

const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const clone = (value) => JSON.parse(JSON.stringify(value))
const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const app = $('#app')
app.innerHTML = `
  <div class="app-shell">
    <header class="top-nav no-print">
      <div class="brand-block">
        <div class="brand-mark">✦</div>
        <div>
          <h1 class="brand-title">Mind Map Canvas</h1>
          <p class="brand-subtitle">Private workspace</p>
        </div>
      </div>
      <button id="addNode" class="tool-btn tool-btn-primary">+ Node</button>
      <button id="addChild" class="tool-btn">+ Child</button>
      <button id="connectMode" class="tool-btn">Connect</button>
      <button id="duplicateNode" class="tool-btn">Duplicate</button>
      <button id="deleteNode" class="tool-btn tool-btn-danger">Delete</button>
      <button id="undoBtn" class="tool-btn">Undo</button>
      <button id="redoBtn" class="tool-btn">Redo</button>
      <button id="fitBtn" class="tool-btn">Fit</button>
      <div class="ml-auto flex items-center gap-2">
        <span id="status" class="status-pill">Ready</span>
        <span id="zoomLabel" class="zoom-pill">100%</span>
      </div>
    </header>

    <div class="workspace-grid">
      <aside class="sidebar sidebar-left sidebar-scroll no-print">
        <section class="panel">
          <h2 class="panel-title">Project</h2>
          <div class="grid grid-cols-2 gap-2">
            <button id="saveLocal" class="tool-btn">Save</button>
            <button id="loadLocal" class="tool-btn">Load</button>
            <button id="exportJson" class="tool-btn">Export</button>
            <button id="importJsonButton" class="tool-btn">Import</button>
            <button id="clearMap" class="tool-btn">Clear</button>
            <button id="printMap" class="tool-btn">Print</button>
          </div>
          <input id="importJson" class="hidden" type="file" accept="application/json" />
          <p class="muted-copy mt-3">Everything stays local in your browser. Export JSON for a backup.</p>
        </section>

        <section class="panel">
          <h2 class="panel-title">Canvas</h2>
          <div class="grid grid-cols-2 gap-3">
            <label><span class="form-label">Color</span><input id="canvasColor" type="color" class="color-input" /></label>
            <label class="flex items-end gap-2 pb-1"><input id="gridToggle" type="checkbox" class="h-5 w-5 accent-[#0075de]" /> <span class="form-label">Grid</span></label>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <button id="zoomOut" class="tool-btn">−</button>
            <button id="zoomReset" class="tool-btn">100%</button>
            <button id="zoomIn" class="tool-btn">+</button>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Search Nodes</h2>
          <input id="searchInput" class="form-input" placeholder="Search ideas..." />
          <div id="nodeList" class="thin-scroll mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1"></div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Outline to Mind Map</h2>
          <textarea id="outline" class="textarea-input thin-scroll min-h-32" placeholder="Main topic\nFirst point\nSecond point\nExample\nConclusion"></textarea>
          <button id="outlineToNodes" class="tool-btn tool-btn-primary mt-3 w-full">Create From Outline</button>
          <p class="muted-copy mt-2">First line becomes the center. Remaining lines become connected ideas.</p>
        </section>
      </aside>

      <main id="viewport" class="canvas-shell">
        <div class="canvas-tip no-print">
          <b style="color:var(--notion-ink)">Controls:</b> drag canvas to pan · wheel to zoom · double-click node to edit · Delete removes selected
        </div>
        <div id="world" class="canvas-grid absolute left-0 top-0" style="width:${WORLD_WIDTH}px;height:${WORLD_HEIGHT}px;">
          <svg id="links" class="absolute inset-0 overflow-visible" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></svg>
          <div id="nodesLayer" class="absolute inset-0"></div>
        </div>
      </main>

      <aside class="sidebar sidebar-right sidebar-scroll no-print">
        <section class="panel">
          <h2 class="panel-title">Node Formatting</h2>
          <div id="noSelection" class="rounded-lg border border-dashed border-[#e6e6e6] p-4 muted-copy">Select a node to edit.</div>
          <div id="nodePanel" class="hidden space-y-4">
            <label><span class="form-label">Text</span><textarea id="nodeText" class="textarea-input thin-scroll min-h-20"></textarea></label>
            <div class="grid grid-cols-3 gap-3">
              <label><span class="form-label">Text</span><input id="textColor" type="color" class="color-input" /></label>
              <label><span class="form-label">Fill</span><input id="fillColor" type="color" class="color-input" /></label>
              <label><span class="form-label">Border</span><input id="borderColor" type="color" class="color-input" /></label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label><span class="form-label">Font</span><select id="fontFamily" class="form-input"><option>Inter</option><option>Arial</option><option>Verdana</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option><option>Trebuchet MS</option><option>Impact</option></select></label>
              <label><span class="form-label">Size</span><input id="fontSize" type="number" min="8" max="96" class="form-input" /></label>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button id="boldBtn" class="tool-btn">Bold</button>
              <button id="italicBtn" class="tool-btn">Italic</button>
              <button id="underlineBtn" class="tool-btn">Underline</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label><span class="form-label">Align</span><select id="align" class="form-input"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              <label><span class="form-label">Shape</span><select id="shape" class="form-input"><option value="rounded">Rounded</option><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option><option value="diamond">Diamond</option></select></label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label><span class="form-label">Width</span><input id="nodeW" type="number" min="40" max="900" class="form-input" /></label>
              <label><span class="form-label">Height</span><input id="nodeH" type="number" min="30" max="700" class="form-input" /></label>
              <label><span class="form-label">Border</span><input id="borderW" type="number" min="0" max="24" class="form-input" /></label>
              <label><span class="form-label">Radius</span><input id="radius" type="number" min="0" max="120" class="form-input" /></label>
              <label><span class="form-label">Opacity %</span><input id="opacity" type="number" min="10" max="100" class="form-input" /></label>
              <label><span class="form-label">Padding</span><input id="padding" type="number" min="0" max="80" class="form-input" /></label>
            </div>
            <label class="flex items-center gap-2"><input id="shadowToggle" type="checkbox" class="h-5 w-5 accent-[#0075de]" /><span class="form-label">Soft shadow</span></label>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Connector Formatting</h2>
          <div class="grid grid-cols-2 gap-3">
            <label><span class="form-label">Color</span><input id="lineColor" type="color" class="color-input" /></label>
            <label><span class="form-label">Thickness</span><input id="lineWidth" type="number" min="1" max="20" class="form-input" /></label>
            <label><span class="form-label">Type</span><select id="lineType" class="form-input"><option value="curve">Curved</option><option value="straight">Straight</option><option value="elbow">Elbow</option></select></label>
            <label class="flex items-end gap-2 pb-1"><input id="lineDash" type="checkbox" class="h-5 w-5 accent-[#0075de]" /> <span class="form-label">Dashed</span></label>
          </div>
          <button id="applyLineAll" class="tool-btn mt-3 w-full">Apply to All Lines</button>
        </section>

        <section class="panel">
          <h2 class="panel-title">Shortcuts</h2>
          <ul class="space-y-2 muted-copy">
            <li><b style="color:var(--notion-ink-secondary)">Ctrl/⌘ + S:</b> save locally</li>
            <li><b style="color:var(--notion-ink-secondary)">Ctrl/⌘ + Z:</b> undo</li>
            <li><b style="color:var(--notion-ink-secondary)">Ctrl/⌘ + D:</b> duplicate node</li>
            <li><b style="color:var(--notion-ink-secondary)">Delete:</b> delete selected</li>
            <li><b style="color:var(--notion-ink-secondary)">Esc:</b> cancel connection mode</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
`

const els = {
  viewport: $('#viewport'),
  world: $('#world'),
  nodesLayer: $('#nodesLayer'),
  links: $('#links'),
  status: $('#status'),
  zoomLabel: $('#zoomLabel'),
  nodeList: $('#nodeList'),
  noSelection: $('#noSelection'),
  nodePanel: $('#nodePanel'),
}

function status(message) {
  els.status.textContent = message
  window.clearTimeout(status.timer)
  status.timer = window.setTimeout(() => (els.status.textContent = 'Ready'), 1800)
}

function snapshot() {
  if (isRestoring) return
  history.push(JSON.stringify({ ...state, selectedId: state.selectedId, selectedLinkId: state.selectedLinkId }))
  if (history.length > 120) history.shift()
  future.length = 0
}

function restore(serialized) {
  isRestoring = true
  state = JSON.parse(serialized)
  isRestoring = false
  render()
  syncPanels()
}

function selectedNode() {
  return state.nodes.find((node) => node.id === state.selectedId) || null
}

function addNode(props = {}) {
  snapshot()
  const node = { ...clone(defaultNode), id: uid('node'), ...props }
  state.nodes.push(node)
  state.selectedId = node.id
  state.selectedLinkId = null
  render()
  syncPanels()
  status('Node added')
  return node
}

function addChild() {
  const parent = selectedNode()
  if (!parent) {
    addNode({ x: 560, y: 380, text: 'Main topic', fill: '#f6f5f4', border: '#e6e6e6', bold: true, size: 26 })
    return
  }
  const child = addNode({
    x: parent.x + parent.w + 80,
    y: parent.y + parent.h / 2 + 24,
    text: 'Child idea',
  })
  state.links.push({ id: uid('link'), from: parent.id, to: child.id, ...clone(state.linkDefaults) })
  render()
}

function duplicateNode() {
  const node = selectedNode()
  if (!node) return
  addNode({ ...clone(node), id: uid('node'), x: node.x + 42, y: node.y + 42, text: `${node.text} copy` })
}

function deleteSelected() {
  if (!state.selectedId) return
  snapshot()
  state.nodes = state.nodes.filter((node) => node.id !== state.selectedId)
  state.links = state.links.filter((link) => link.from !== state.selectedId && link.to !== state.selectedId)
  state.selectedId = null
  state.selectedLinkId = null
  render()
  syncPanels()
  status('Deleted')
}

function clearMap() {
  if (!confirm('Clear the entire map?')) return
  snapshot()
  state.nodes = []
  state.links = []
  state.selectedId = null
  render()
  syncPanels()
  status('Map cleared')
}

function worldPointFromEvent(event) {
  const rect = els.viewport.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left - state.pan.x) / state.zoom,
    y: (event.clientY - rect.top - state.pan.y) / state.zoom,
  }
}

function applyTransform() {
  els.world.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`
  els.world.style.transformOrigin = '0 0'
  els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`
}

function render() {
  els.world.style.backgroundColor = state.canvas.color
  els.world.classList.toggle('canvas-grid', state.canvas.grid)
  applyTransform()
  drawLinks()
  drawNodes()
  drawNodeList()
}

function drawNodes() {
  els.nodesLayer.innerHTML = ''
  const fragment = document.createDocumentFragment()

  state.nodes.forEach((node) => {
    const div = document.createElement('div')
    div.className = `node-card ${node.id === state.selectedId ? 'selected' : ''}`
    div.dataset.id = node.id
    div.style.left = `${node.x}px`
    div.style.top = `${node.y}px`
    div.style.width = `${node.w}px`
    div.style.height = `${node.h}px`
    div.style.background = node.fill
    div.style.color = node.color
    div.style.border = `${node.borderW}px solid ${node.border}`
    div.style.fontFamily = node.font
    div.style.fontSize = `${node.size}px`
    div.style.fontWeight = node.bold ? '900' : '500'
    div.style.fontStyle = node.italic ? 'italic' : 'normal'
    div.style.textDecoration = node.underline ? 'underline' : 'none'
    div.style.textAlign = node.align
    div.style.opacity = node.opacity / 100
    div.style.padding = `${node.padding}px`
    div.style.boxShadow = node.shadow ? 'rgba(0,0,0,0.01) 0 0.175px 1.041px, rgba(0,0,0,0.02) 0 0.8px 2.925px, rgba(0,0,0,0.027) 0 2.025px 7.847px, rgba(0,0,0,0.04) 0 4px 18px' : 'none'
    div.style.borderRadius = node.shape === 'ellipse' ? '9999px' : node.shape === 'rounded' ? `${node.radius}px` : '0px'
    if (node.shape === 'diamond') div.classList.add('shape-diamond')

    const inner = document.createElement('div')
    inner.className = 'node-inner'
    inner.textContent = node.text
    div.appendChild(inner)

    div.addEventListener('mousedown', startNodeDrag)
    div.addEventListener('click', (event) => {
      event.stopPropagation()
      if (state.connectMode) {
        handleConnectClick(node.id)
        return
      }
      state.selectedId = node.id
      state.selectedLinkId = null
      render()
      syncPanels()
    })
    div.addEventListener('dblclick', (event) => {
      event.stopPropagation()
      startInlineEdit(div, inner, node)
    })
    fragment.appendChild(div)
  })

  els.nodesLayer.appendChild(fragment)
}

function drawLinks() {
  els.links.innerHTML = ''
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  els.links.appendChild(defs)

  state.links.forEach((link) => {
    const from = state.nodes.find((node) => node.id === link.from)
    const to = state.nodes.find((node) => node.id === link.to)
    if (!from || !to) return

    const x1 = from.x + from.w / 2
    const y1 = from.y + from.h / 2
    const x2 = to.x + to.w / 2
    const y2 = to.y + to.h / 2

    let d
    if (link.type === 'straight') {
      d = `M ${x1} ${y1} L ${x2} ${y2}`
    } else if (link.type === 'elbow') {
      const midX = (x1 + x2) / 2
      d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    } else {
      const bend = Math.max(80, Math.abs(x2 - x1) * 0.45)
      d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', link.color)
    path.setAttribute('stroke-width', link.width)
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    if (link.dash) path.setAttribute('stroke-dasharray', '12 9')
    els.links.appendChild(path)
  })
}

function drawNodeList() {
  const query = state.search.trim().toLowerCase()
  const nodes = query ? state.nodes.filter((node) => node.text.toLowerCase().includes(query)) : state.nodes
  els.nodeList.innerHTML = ''

  if (!nodes.length) {
    els.nodeList.innerHTML = '<div class="mini-node-button">No nodes found.</div>'
    return
  }

  nodes.forEach((node) => {
    const item = document.createElement('button')
    item.className = `mini-node-button ${node.id === state.selectedId ? 'active' : ''}`
    item.innerHTML = `<div class="font-bold">${escapeHtml(node.text.slice(0, 48)) || 'Untitled'}</div><div style="margin-top:4px;color:var(--notion-ink-faint);font-size:12px">x:${Math.round(node.x)} y:${Math.round(node.y)}</div>`
    item.addEventListener('click', () => {
      state.selectedId = node.id
      focusNode(node)
      render()
      syncPanels()
    })
    els.nodeList.appendChild(item)
  })
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))
}

function startInlineEdit(card, inner, node) {
  snapshot()
  card.classList.add('editing')
  inner.contentEditable = 'true'
  inner.focus()
  document.getSelection().selectAllChildren(inner)

  const finish = () => {
    node.text = inner.innerText.trim() || 'Idea'
    inner.contentEditable = 'false'
    card.classList.remove('editing')
    render()
    syncPanels()
  }

  inner.addEventListener('blur', finish, { once: true })
  inner.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      inner.blur()
    }
  })
}

function startNodeDrag(event) {
  if (event.target.isContentEditable) return
  event.stopPropagation()
  const node = state.nodes.find((item) => item.id === event.currentTarget.dataset.id)
  if (!node) return
  snapshot()
  const point = worldPointFromEvent(event)
  state.selectedId = node.id
  state.selectedLinkId = null
  dragState = { id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y }
  render()
  syncPanels()
  document.addEventListener('mousemove', moveNode)
  document.addEventListener('mouseup', stopNodeDrag)
}

function moveNode(event) {
  if (!dragState) return
  const node = state.nodes.find((item) => item.id === dragState.id)
  if (!node) return
  const point = worldPointFromEvent(event)
  node.x = Math.round(point.x - dragState.offsetX)
  node.y = Math.round(point.y - dragState.offsetY)
  render()
}

function stopNodeDrag() {
  dragState = null
  document.removeEventListener('mousemove', moveNode)
  document.removeEventListener('mouseup', stopNodeDrag)
}

function handleConnectClick(nodeId) {
  if (!state.connectFrom) {
    state.connectFrom = nodeId
    status('Choose the second node')
    return
  }
  if (state.connectFrom !== nodeId) {
    snapshot()
    state.links.push({ id: uid('link'), from: state.connectFrom, to: nodeId, ...clone(state.linkDefaults) })
    status('Nodes connected')
  }
  state.connectFrom = null
  state.connectMode = false
  $('#connectMode').classList.remove('is-active')
  render()
}

function updateNode(key, value) {
  const node = selectedNode()
  if (!node) return
  snapshot()
  node[key] = value
  render()
  syncPanels()
}

function syncPanels() {
  $('#canvasColor').value = state.canvas.color
  $('#gridToggle').checked = state.canvas.grid
  $('#searchInput').value = state.search
  $('#outline').value = state.outline
  $('#lineColor').value = state.linkDefaults.color
  $('#lineWidth').value = state.linkDefaults.width
  $('#lineType').value = state.linkDefaults.type
  $('#lineDash').checked = state.linkDefaults.dash

  const node = selectedNode()
  els.noSelection.classList.toggle('hidden', Boolean(node))
  els.nodePanel.classList.toggle('hidden', !node)
  if (!node) return

  $('#nodeText').value = node.text
  $('#textColor').value = node.color
  $('#fillColor').value = node.fill
  $('#borderColor').value = node.border
  $('#fontFamily').value = node.font
  $('#fontSize').value = node.size
  $('#align').value = node.align
  $('#shape').value = node.shape
  $('#nodeW').value = node.w
  $('#nodeH').value = node.h
  $('#borderW').value = node.borderW
  $('#radius').value = node.radius
  $('#opacity').value = node.opacity
  $('#padding').value = node.padding
  $('#shadowToggle').checked = node.shadow

  $('#boldBtn').classList.toggle('is-active', node.bold)
  
  $('#italicBtn').classList.toggle('is-active', node.italic)
  
  $('#underlineBtn').classList.toggle('is-active', node.underline)
  
}

function focusNode(node) {
  const rect = els.viewport.getBoundingClientRect()
  state.pan.x = rect.width / 2 - (node.x + node.w / 2) * state.zoom
  state.pan.y = rect.height / 2 - (node.y + node.h / 2) * state.zoom
}

function fitToNodes() {
  if (!state.nodes.length) return
  const minX = Math.min(...state.nodes.map((node) => node.x))
  const minY = Math.min(...state.nodes.map((node) => node.y))
  const maxX = Math.max(...state.nodes.map((node) => node.x + node.w))
  const maxY = Math.max(...state.nodes.map((node) => node.y + node.h))
  const rect = els.viewport.getBoundingClientRect()
  const mapW = Math.max(1, maxX - minX)
  const mapH = Math.max(1, maxY - minY)
  state.zoom = Math.min(1.7, Math.max(0.22, Math.min((rect.width - 160) / mapW, (rect.height - 160) / mapH)))
  state.pan.x = 80 - minX * state.zoom
  state.pan.y = 80 - minY * state.zoom
  render()
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `mind-map-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

function importJson(file) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      snapshot()
      const incoming = JSON.parse(reader.result)
      state = { ...state, ...incoming, selectedId: incoming.selectedId || null, selectedLinkId: null }
      render()
      syncPanels()
      status('Imported JSON')
    } catch {
      alert('This JSON file could not be imported.')
    }
  }
  reader.readAsText(file)
}

function createFromOutline() {
  const lines = $('#outline').value.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return
  snapshot()
  state.outline = $('#outline').value
  state.nodes = []
  state.links = []

  const root = { ...clone(defaultNode), id: uid('node'), x: 1850, y: 1280, w: 210, h: 72, text: lines[0], fill: '#f6f5f4', border: '#e6e6e6', size: 19, bold: true }
  state.nodes.push(root)

  const count = lines.length - 1
  lines.slice(1).forEach((line, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, count)
    const distanceX = 380
    const distanceY = 240
    const node = { ...clone(defaultNode), id: uid('node'), x: root.x + Math.cos(angle) * distanceX, y: root.y + Math.sin(angle) * distanceY, text: line }
    const palette = [
      ['#ffffff', '#e6e6e6'],
      ['#ffffff', '#e6e6e6'],
      ['#ffffff', '#e6e6e6'],
      ['#ffffff', '#e6e6e6'],
      ['#ffffff', '#e6e6e6'],
      ['#ffffff', '#e6e6e6'],
    ][index % 6]
    node.fill = palette[0]
    node.border = palette[1]
    state.nodes.push(node)
    state.links.push({ id: uid('link'), from: root.id, to: node.id, ...clone(state.linkDefaults) })
  })

  state.selectedId = root.id
  state.zoom = 0.72
  focusNode(root)
  render()
  syncPanels()
  status('Outline converted')
}

function bindEvents() {
  $('#addNode').addEventListener('click', () => {
    const rect = els.viewport.getBoundingClientRect()
    const center = {
      x: (rect.width / 2 - state.pan.x) / state.zoom,
      y: (rect.height / 2 - state.pan.y) / state.zoom,
    }
    addNode({ x: Math.round(center.x - 75), y: Math.round(center.y - 26) })
  })
  $('#addChild').addEventListener('click', addChild)
  $('#duplicateNode').addEventListener('click', duplicateNode)
  $('#deleteNode').addEventListener('click', deleteSelected)
  $('#clearMap').addEventListener('click', clearMap)
  $('#printMap').addEventListener('click', () => window.print())
  $('#fitBtn').addEventListener('click', fitToNodes)

  $('#connectMode').addEventListener('click', (event) => {
    state.connectMode = !state.connectMode
    state.connectFrom = null
    event.currentTarget.classList.toggle('is-active', state.connectMode)
    
    status(state.connectMode ? 'Click two nodes to connect' : 'Connection mode off')
  })

  $('#undoBtn').addEventListener('click', () => {
    if (!history.length) return
    future.push(JSON.stringify(state))
    restore(history.pop())
    status('Undo')
  })
  $('#redoBtn').addEventListener('click', () => {
    if (!future.length) return
    history.push(JSON.stringify(state))
    restore(future.pop())
    status('Redo')
  })

  $('#saveLocal').addEventListener('click', () => {
    state.outline = $('#outline').value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    status('Saved locally')
  })
  $('#loadLocal').addEventListener('click', () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return alert('No saved map found in this browser yet.')
    restore(saved)
    status('Loaded')
  })
  $('#exportJson').addEventListener('click', exportJson)
  $('#importJsonButton').addEventListener('click', () => $('#importJson').click())
  $('#importJson').addEventListener('change', (event) => {
    const file = event.target.files?.[0]
    if (file) importJson(file)
    event.target.value = ''
  })

  $('#canvasColor').addEventListener('input', (event) => {
    state.canvas.color = event.target.value
    render()
  })
  $('#canvasColor').addEventListener('change', snapshot)
  $('#gridToggle').addEventListener('change', (event) => {
    snapshot()
    state.canvas.grid = event.target.checked
    render()
  })

  $('#searchInput').addEventListener('input', (event) => {
    state.search = event.target.value
    drawNodeList()
  })
  $('#outline').addEventListener('input', (event) => {
    state.outline = event.target.value
  })
  $('#outlineToNodes').addEventListener('click', createFromOutline)

  const numericMap = { fontSize: 'size', nodeW: 'w', nodeH: 'h', borderW: 'borderW', radius: 'radius', opacity: 'opacity', padding: 'padding' }
  const directMap = { nodeText: 'text', textColor: 'color', fillColor: 'fill', borderColor: 'border', fontFamily: 'font', align: 'align', shape: 'shape' }

  Object.entries(directMap).forEach(([id, key]) => {
    $(`#${id}`).addEventListener(id === 'nodeText' ? 'input' : 'change', (event) => updateNode(key, event.target.value))
  })
  Object.entries(numericMap).forEach(([id, key]) => {
    $(`#${id}`).addEventListener('change', (event) => updateNode(key, Number(event.target.value)))
  })

  $('#shadowToggle').addEventListener('change', (event) => updateNode('shadow', event.target.checked))
  $('#boldBtn').addEventListener('click', () => selectedNode() && updateNode('bold', !selectedNode().bold))
  $('#italicBtn').addEventListener('click', () => selectedNode() && updateNode('italic', !selectedNode().italic))
  $('#underlineBtn').addEventListener('click', () => selectedNode() && updateNode('underline', !selectedNode().underline))

  $('#lineColor').addEventListener('input', (event) => {
    state.linkDefaults.color = event.target.value
  })
  $('#lineWidth').addEventListener('change', (event) => {
    state.linkDefaults.width = Number(event.target.value)
  })
  $('#lineType').addEventListener('change', (event) => {
    state.linkDefaults.type = event.target.value
  })
  $('#lineDash').addEventListener('change', (event) => {
    state.linkDefaults.dash = event.target.checked
  })
  $('#applyLineAll').addEventListener('click', () => {
    snapshot()
    state.links = state.links.map((link) => ({ ...link, ...clone(state.linkDefaults) }))
    drawLinks()
    status('Applied to all connectors')
  })

  $('#zoomIn').addEventListener('click', () => zoomBy(1.15))
  $('#zoomOut').addEventListener('click', () => zoomBy(0.85))
  $('#zoomReset').addEventListener('click', () => {
    state.zoom = 1
    render()
  })

  els.viewport.addEventListener('mousedown', (event) => {
    if (event.target !== els.viewport && event.target !== els.world) return
    state.selectedId = null
    syncPanels()
    render()
    panState = { x: event.clientX - state.pan.x, y: event.clientY - state.pan.y }
    els.viewport.style.cursor = 'grabbing'
  })
  document.addEventListener('mousemove', (event) => {
    if (!panState) return
    state.pan.x = event.clientX - panState.x
    state.pan.y = event.clientY - panState.y
    applyTransform()
  })
  document.addEventListener('mouseup', () => {
    panState = null
    els.viewport.style.cursor = 'grab'
  })
  els.viewport.addEventListener('wheel', (event) => {
    event.preventDefault()
    const oldZoom = state.zoom
    state.zoom = Math.min(3, Math.max(0.18, state.zoom * (event.deltaY < 0 ? 1.1 : 0.9)))
    const rect = els.viewport.getBoundingClientRect()
    const mx = event.clientX - rect.left
    const my = event.clientY - rect.top
    state.pan.x = mx - (mx - state.pan.x) * (state.zoom / oldZoom)
    state.pan.y = my - (my - state.pan.y) * (state.zoom / oldZoom)
    applyTransform()
  }, { passive: false })

  document.addEventListener('keydown', (event) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      $('#saveLocal').click()
      return
    }
    if (typing) return
    if (event.key === 'Delete') deleteSelected()
    if (event.key === 'Escape') {
      state.connectMode = false
      state.connectFrom = null
      $('#connectMode').classList.remove('is-active')
      status('Cancelled')
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateNode()
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      $('#undoBtn').click()
    }
  })
}

function zoomBy(multiplier) {
  state.zoom = Math.min(3, Math.max(0.18, state.zoom * multiplier))
  render()
}

function seedDemo() {
  const main = { ...clone(defaultNode), id: uid('node'), x: 1850, y: 1280, w: 210, h: 72, text: 'Explain Your Topic', fill: '#f6f5f4', border: '#e6e6e6', size: 19, bold: true }
  const n1 = { ...clone(defaultNode), id: uid('node'), x: 2190, y: 1110, text: 'Definition', fill: '#ffffff', border: '#e6e6e6' }
  const n2 = { ...clone(defaultNode), id: uid('node'), x: 2195, y: 1430, text: 'Examples', fill: '#ffffff', border: '#e6e6e6' }
  const n3 = { ...clone(defaultNode), id: uid('node'), x: 1530, y: 1110, text: 'Why it matters', fill: '#ffffff', border: '#e6e6e6' }
  const n4 = { ...clone(defaultNode), id: uid('node'), x: 1535, y: 1430, text: 'Conclusion', fill: '#ffffff', border: '#e6e6e6' }
  state.nodes = [main, n1, n2, n3, n4]
  state.links = [n1, n2, n3, n4].map((node) => ({ id: uid('link'), from: main.id, to: node.id, ...clone(state.linkDefaults) }))
  state.selectedId = main.id
  state.outline = 'Explain Your Topic\nDefinition\nWhy it matters\nExamples\nConclusion'
  focusNode(main)
}

bindEvents()
seedDemo()
render()
syncPanels()
