import { useRef, useState, useLayoutEffect, useMemo, useEffect } from 'react'
import useStore from '../store/useStore'
import { RELATIONSHIP_MAP, RELATIONSHIPS } from '../utils/connections'
import { formatDate } from '../utils/format'
import DetailPanel from './DetailPanel'
import EntityForm from './EntityForm'
import { EyeSlashIcon } from '@heroicons/react/24/outline'

// Edge thickness by relationship importance
const REL_WIDTHS = {
  caused: 2.8, led_to: 2.8,
  influenced: 1.8, supported: 1.8,
  opposed: 2.2, responded_to: 1.5, preceded: 1.4,
}

// Card dimensions per entity type
const CARD = {
  chapter:  { w: 156, h: 56 },
  event:    { w: 142, h: 50 },
  subEvent: { w: 124, h: 44 },
}

// Point on card boundary in direction (dx,dy)
function cardBound(cw, ch, dx, dy) {
  const d = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / d, uy = dy / d
  const t = Math.min(cw / 2 / (Math.abs(ux) || 0.001), ch / 2 / (Math.abs(uy) || 0.001))
  return { x: ux * t, y: uy * t }
}

export default function GraphView() {
  const {
    events, chapters, connections,
    focusModeId, setFocusMode, clearFocusMode,
    showConnections, theme,
    updateEvent, deleteEvent,
    updateChapter, deleteChapter,
    updateSubEvent, deleteSubEvent,
    hiddenGraphIds, toggleGraphHidden, unhideAllGraph,
  } = useStore()

  const svgRef = useRef(null)
  const [dims, setDims] = useState({ width: 900, height: 640 })
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [hiddenRels, setHiddenRels] = useState(new Set())
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectionKey, setSelectionKey] = useState(0)
  const [editingEntity, setEditingEntity] = useState(null)

  // Physics refs (no re-render on every tick)
  const posRef = useRef({})
  const velRef = useRef({})
  const simRaf = useRef(null)
  const [positions, setPositions] = useState({})

  // Interaction refs
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const dragNodeRef = useRef(null)
  const [draggingId, setDraggingId] = useState(null)

  const isDark = theme !== 'light'

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => setDims({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // All nodes
  const allNodes = useMemo(() => {
    const nodes = []
    events.forEach(e => nodes.push({
      id: e.id, title: e.title, color: e.color || '#6366f1',
      type: 'event', entity: e, date: e.date,
    }))
    chapters.forEach(c => {
      nodes.push({
        id: c.id, title: c.title, color: c.color || '#8b5cf6',
        type: 'chapter', entity: c, date: c.date,
      })
      ;(c.subEvents || []).forEach(se =>
        nodes.push({
          id: se.id, title: se.title, color: se.color || c.color || '#14b8a6',
          type: 'subEvent', entity: se, date: se.date, chapterId: c.id,
        })
      )
    })
    return nodes
  }, [events, chapters])

  const visibleNodes = useMemo(() =>
    allNodes.filter(n => !hiddenGraphIds.includes(n.id))
  , [allNodes, hiddenGraphIds])

  const visibleConns = useMemo(() =>
    connections.filter(c =>
      !hiddenRels.has(c.relationship) &&
      !hiddenGraphIds.includes(c.fromId) &&
      !hiddenGraphIds.includes(c.toId)
    )
  , [connections, hiddenRels, hiddenGraphIds])

  const edges = useMemo(() =>
    visibleConns.map(c => ({
      id: c.id, source: c.fromId, target: c.toId,
      relationship: c.relationship,
      srcColor: allNodes.find(n => n.id === c.fromId)?.color || '#6366f1',
      tgtColor: allNodes.find(n => n.id === c.toId)?.color || '#6366f1',
    }))
  , [visibleConns, allNodes])

  const relCounts = useMemo(() => {
    const rc = {}
    connections.forEach(c => { rc[c.relationship] = (rc[c.relationship] || 0) + 1 })
    return rc
  }, [connections])

  const connCounts = useMemo(() => {
    const m = {}
    connections.forEach(c => {
      m[c.fromId] = (m[c.fromId] || 0) + 1
      m[c.toId] = (m[c.toId] || 0) + 1
    })
    return m
  }, [connections])

  // Focused IDs
  const focusedIds = useMemo(() => {
    if (!focusModeId) return null
    const ids = new Set([focusModeId])
    connections.forEach(c => {
      if (c.fromId === focusModeId) ids.add(c.toId)
      if (c.toId === focusModeId) ids.add(c.fromId)
    })
    return ids
  }, [focusModeId, connections])

  // ── Physics simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    const n = allNodes.length
    if (n === 0 || dims.width < 50) return

    // Seed positions for new nodes
    allNodes.forEach((node, i) => {
      if (!posRef.current[node.id]) {
        const angle = (i / n) * 2 * Math.PI
        const r = Math.min(dims.width, dims.height) * (n === 1 ? 0 : 0.28)
        posRef.current[node.id] = {
          x: dims.width / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
          y: dims.height / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        }
      }
      velRef.current[node.id] = { vx: 0, vy: 0 }
    })

    let tick = 0
    const k = Math.sqrt((dims.width * dims.height) / Math.max(n, 1))

    const run = () => {
      const alpha = Math.max(0.015, 1 - tick / 220)

      // Zero velocities
      allNodes.forEach(nd => { velRef.current[nd.id] = { vx: 0, vy: 0 } })

      // Repulsion
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = posRef.current[allNodes[i].id]
          const b = posRef.current[allNodes[j].id]
          if (!a || !b) continue
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const f = (k * k) / d * alpha
          velRef.current[allNodes[i].id].vx -= (dx / d) * f
          velRef.current[allNodes[i].id].vy -= (dy / d) * f
          velRef.current[allNodes[j].id].vx += (dx / d) * f
          velRef.current[allNodes[j].id].vy += (dy / d) * f
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const a = posRef.current[edge.source]
        const b = posRef.current[edge.target]
        if (!a || !b) return
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const f = (d * d) / k * 0.5 * alpha
        velRef.current[edge.source].vx += (dx / d) * f
        velRef.current[edge.source].vy += (dy / d) * f
        velRef.current[edge.target].vx -= (dx / d) * f
        velRef.current[edge.target].vy -= (dy / d) * f
      })

      // Apply with speed cap
      const maxSpeed = k * 0.12
      allNodes.forEach(nd => {
        const p = posRef.current[nd.id]
        const v = velRef.current[nd.id]
        if (!p || !v) return
        const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy)
        if (speed > maxSpeed) { v.vx = (v.vx / speed) * maxSpeed; v.vy = (v.vy / speed) * maxSpeed }
        p.x = Math.max(90, Math.min(dims.width - 90, p.x + v.vx))
        p.y = Math.max(60, Math.min(dims.height - 60, p.y + v.vy))
      })

      tick++
      if (tick % 2 === 0) setPositions({ ...posRef.current })
      if (tick < 200) simRaf.current = requestAnimationFrame(run)
      else setPositions({ ...posRef.current })
    }

    cancelAnimationFrame(simRaf.current)
    simRaf.current = requestAnimationFrame(run)
    return () => cancelAnimationFrame(simRaf.current)
  }, [allNodes.length, edges.length, dims.width, dims.height])

  // ── Zoom / pan / drag ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.88 : 1.14
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      setTransform(t => {
        const newScale = Math.max(0.1, Math.min(6, t.scale * delta))
        const ratio = newScale / t.scale
        return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function svgPoint(cx, cy) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (cx - rect.left - transform.x) / transform.scale,
      y: (cy - rect.top - transform.y) / transform.scale,
    }
  }

  function handleMouseDown(e) {
    if (e.button !== 0 || dragNodeRef.current) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y }
  }
  function handleMouseMove(e) {
    if (dragNodeRef.current) {
      const pt = svgPoint(e.clientX, e.clientY)
      posRef.current[dragNodeRef.current] = { x: pt.x, y: pt.y }
      velRef.current[dragNodeRef.current] = { vx: 0, vy: 0 }
      setPositions(p => ({ ...p, [dragNodeRef.current]: { x: pt.x, y: pt.y } }))
      return
    }
    if (!isPanning.current) return
    setTransform(t => ({
      ...t,
      x: panStart.current.ox + (e.clientX - panStart.current.x),
      y: panStart.current.oy + (e.clientY - panStart.current.y),
    }))
  }
  function handleMouseUp() {
    isPanning.current = false
    dragNodeRef.current = null
    setDraggingId(null)
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────
  const scale = transform.scale
  const detailLevel = scale < 0.38 ? 'dot' : scale < 0.78 ? 'card' : 'full'

  // Colors based on theme
  const dotGridColor = isDark ? '#1e2640' : '#c8d4e2'
  const cardBg = isDark ? '#111827' : '#ffffff'
  const cardBorder = isDark ? '#2a3350' : '#d1dce8'
  const cardText = isDark ? '#e2e8f0' : '#1e293b'
  const cardSub = isDark ? '#64748b' : '#64748b'
  const edgeLabelBg = isDark ? '#0d1117' : '#f1f5f9'

  if (allNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center space-y-2">
          <p className="text-slate-400 text-lg">No entities yet</p>
          <p className="text-slate-600 text-sm">Create events and chapters first, then explore connections here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--border)', background: 'var(--bg-deep)' }}>
        {RELATIONSHIPS.filter(r => relCounts[r.id]).map(r => {
          const hidden = hiddenRels.has(r.id)
          return (
            <button key={r.id}
              onClick={() => setHiddenRels(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
              style={{ background: hidden ? 'transparent' : r.color + '18', borderColor: hidden ? 'var(--border)' : r.color + '60', color: hidden ? 'var(--text-dim)' : r.color, opacity: hidden ? 0.5 : 1 }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: hidden ? 'var(--text-dim)' : r.color }} />
              {r.label} ({relCounts[r.id]})
            </button>
          )
        })}
        {hiddenRels.size > 0 && (
          <button onClick={() => setHiddenRels(new Set())} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
            Show all
          </button>
        )}
        <div className="flex-1" />
        {hiddenGraphIds.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
            style={{ borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
            <EyeSlashIcon className="w-3.5 h-3.5" />
            {hiddenGraphIds.length} hidden
            <button onClick={unhideAllGraph} className="ml-1 underline hover:text-white transition-colors">
              Unhide all
            </button>
          </div>
        )}
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {visibleNodes.length} nodes · {visibleConns.length} connections
        </span>
        <button
          onClick={() => { posRef.current = {}; setPositions({}); setTransform({ x: 0, y: 0, scale: 1 }) }}
          className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Reset
        </button>
      </div>

      {/* Focus banner */}
      {focusModeId && (
        <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ background: 'rgba(109,40,217,0.12)', borderColor: 'rgba(139,92,246,0.28)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-sm text-violet-300">
              Focus: <span className="font-semibold text-white">{allNodes.find(n => n.id === focusModeId)?.title || '…'}</span>
              <span className="text-slate-400 ml-2">— only showing connected nodes</span>
            </p>
          </div>
          <button onClick={clearFocusMode} className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border" style={{ borderColor: 'var(--border)' }}>Exit (Esc)</button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Fixed dot-grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <radialGradient id="bg-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor={isDark ? '#1a2035' : '#e4ecf5'} stopOpacity={0.35} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <pattern id="dot-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="1.1" fill={dotGridColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
          <rect width="100%" height="100%" fill="url(#bg-vignette)" />
        </svg>

        {/* Main graph SVG */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1, cursor: draggingId ? 'grabbing' : isPanning.current ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedNode(null)}
        >
          <defs>
            {/* Glow filter */}
            <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="node-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Arrow markers per relationship */}
            {RELATIONSHIPS.map(r => (
              <marker key={r.id} id={`gr-${r.id}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
                <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill={r.color} />
              </marker>
            ))}

            {/* Edge gradients — one per visible edge */}
            {showConnections && edges.map(edge => {
              const sp = positions[edge.source], tp = positions[edge.target]
              if (!sp || !tp) return null
              return (
                <linearGradient key={`grad-${edge.id}`} id={`eg-${edge.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                >
                  <stop offset="0%" stopColor={edge.srcColor} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={edge.tgtColor} stopOpacity={0.85} />
                </linearGradient>
              )
            })}
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

            {/* ── Edges ── */}
            {showConnections && edges.map(edge => {
              const rel = RELATIONSHIP_MAP[edge.relationship]
              if (!rel) return null
              const sp = positions[edge.source], tp = positions[edge.target]
              if (!sp || !tp) return null

              const isActive = !focusedIds || (focusedIds.has(edge.source) && focusedIds.has(edge.target))
              const srcCard = CARD[allNodes.find(n => n.id === edge.source)?.type] || CARD.event
              const tgtCard = CARD[allNodes.find(n => n.id === edge.target)?.type] || CARD.event

              // Card boundary points
              const dxFull = tp.x - sp.x, dyFull = tp.y - sp.y
              const sb = cardBound(srcCard.w, srcCard.h, dxFull, dyFull)
              const tb = cardBound(tgtCard.w, tgtCard.h, -dxFull, -dyFull)
              const sx = sp.x + sb.x, sy = sp.y + sb.y
              const tx = tp.x + tb.x, ty = tp.y + tb.y

              // Midpoint + perpendicular offset for curve
              const mx = (sx + tx) / 2, my = (sy + ty) / 2
              const edgeLen = Math.sqrt(dxFull * dxFull + dyFull * dyFull) || 1
              const curve = Math.min(edgeLen * 0.18, 60)
              const cx = mx + (-dyFull / edgeLen) * curve
              const cy = my + (dxFull / edgeLen) * curve

              // Shorten end for arrowhead
              const dxEnd = tx - cx, dyEnd = ty - cy
              const dEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd) || 1
              const ex = tx - (dxEnd / dEnd) * 6, ey = ty - (dyEnd / dEnd) * 6

              const path = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
              const lw = rel.label.length * 4.8 + 12
              const lmx = (sx + tx) / 2 + (-dyFull / edgeLen) * curve * 0.5
              const lmy = (sy + ty) / 2 + (dxFull / edgeLen) * curve * 0.5
              const lw2 = REL_WIDTHS[edge.relationship] || 1.6

              return (
                <g key={edge.id} style={{ opacity: isActive ? 1 : 0.06, transition: 'opacity 0.25s' }}>
                  {/* Glow on active focused edges */}
                  {isActive && focusedIds && (
                    <path d={path} stroke={rel.color} strokeWidth={lw2 + 6} fill="none" strokeOpacity={0.12} />
                  )}
                  <path
                    d={path}
                    stroke={`url(#eg-${edge.id})`}
                    strokeWidth={lw2}
                    strokeOpacity={0.75}
                    fill="none"
                    markerEnd={`url(#gr-${edge.relationship})`}
                  />
                  {/* Label pill */}
                  {detailLevel !== 'dot' && (
                    <>
                      <rect x={lmx - lw / 2} y={lmy - 7} width={lw} height={13} rx={6.5}
                        fill={edgeLabelBg} fillOpacity={0.92} />
                      <text x={lmx} y={lmy + 3.5} textAnchor="middle" fill={rel.color}
                        fontSize={7} fontWeight={700} letterSpacing={0.5} fontFamily="Inter, sans-serif">
                        {rel.label.toUpperCase()}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

            {/* ── Nodes ── */}
            {visibleNodes.map(node => {
              const p = positions[node.id]
              if (!p) return null

              const isSelected = selectedNode?.id === node.id
              const isFocused = focusModeId === node.id
              const isActive = !focusedIds || focusedIds.has(node.id)
              const isDraggingThis = draggingId === node.id
              const connCount = connCounts[node.id] || 0
              const cd = CARD[node.type]

              return (
                <g
                  key={node.id}
                  className="group"
                  transform={`translate(${p.x},${p.y})`}
                  style={{
                    opacity: isActive ? 1 : 0.1,
                    transition: 'opacity 0.25s',
                    cursor: isDraggingThis ? 'grabbing' : 'pointer',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    dragNodeRef.current = node.id
                    setDraggingId(node.id)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (draggingId) return
                    setSelectedNode(prev => prev?.id === node.id ? null : node)
                    setSelectionKey(k => k + 1)
                  }}
                >
                  {/* Selection pulse ring — SMIL animation */}
                  {isSelected && (
                    <g key={`ring-${node.id}-${selectionKey}`}>
                      <rect
                        x={-cd.w / 2 - 4} y={-cd.h / 2 - 4}
                        width={cd.w + 8} height={cd.h + 8} rx={14}
                        fill="none" stroke={node.color} strokeWidth={2.5}
                      >
                        <animate attributeName="stroke-opacity" from="0.8" to="0" dur="0.6s" fill="freeze" />
                        <animate attributeName="rx" from="14" to="28" dur="0.6s" fill="freeze" />
                        <animate attributeName="x" from={-cd.w/2-4} to={-cd.w/2-18} dur="0.6s" fill="freeze" />
                        <animate attributeName="y" from={-cd.h/2-4} to={-cd.h/2-18} dur="0.6s" fill="freeze" />
                        <animate attributeName="width" from={cd.w+8} to={cd.w+36} dur="0.6s" fill="freeze" />
                        <animate attributeName="height" from={cd.h+8} to={cd.h+36} dur="0.6s" fill="freeze" />
                      </rect>
                    </g>
                  )}

                  {detailLevel === 'dot' ? (
                    /* ── Minimal: dot + short label ── */
                    <>
                      <circle r={6} fill={node.color} fillOpacity={0.85}
                        filter={isSelected || isFocused ? 'url(#node-glow)' : undefined} />
                      <text y={18} textAnchor="middle" fontSize={7} fill={node.color}
                        fontFamily="Inter, sans-serif" fontWeight={600}
                        stroke={isDark ? '#0a0c14' : '#f1f5f9'} strokeWidth={2.5} paintOrder="stroke">
                        {node.title.slice(0, 12)}{node.title.length > 12 ? '…' : ''}
                      </text>
                    </>
                  ) : (
                    /* ── Card ── */
                    <g filter={(isSelected || isFocused) ? 'url(#node-glow-strong)' : undefined}>
                      {/* Card shadow */}
                      <rect
                        x={-cd.w / 2 + 2} y={-cd.h / 2 + 3}
                        width={cd.w} height={cd.h} rx={10}
                        fill={node.color} fillOpacity={0.12}
                      />
                      {/* Card background */}
                      <rect
                        x={-cd.w / 2} y={-cd.h / 2}
                        width={cd.w} height={cd.h} rx={9}
                        fill={cardBg}
                        stroke={isSelected || isFocused ? node.color : cardBorder}
                        strokeWidth={isSelected || isFocused ? 2 : 1}
                      />
                      {/* Colored left accent bar */}
                      <rect
                        x={-cd.w / 2} y={-cd.h / 2}
                        width={4} height={cd.h} rx={9}
                        fill={node.color}
                      />
                      {/* Clip left bar to card shape */}
                      <rect
                        x={-cd.w / 2 + 4} y={-cd.h / 2}
                        width={cd.w - 4} height={cd.h}
                        fill="none"
                      />

                      {/* Type badge (top-right) */}
                      <rect x={cd.w / 2 - 38} y={-cd.h / 2 + 5} width={34} height={11} rx={5.5}
                        fill={node.color} fillOpacity={0.18} />
                      <text x={cd.w / 2 - 21} y={-cd.h / 2 + 13.5} textAnchor="middle"
                        fontSize={6.5} fontWeight={700} fontFamily="Inter, sans-serif"
                        fill={node.color} opacity={0.9}>
                        {node.type === 'chapter' ? 'CHAPTER' : node.type === 'subEvent' ? 'SUB' : 'EVENT'}
                      </text>

                      {/* Hide button (visible on hover) */}
                      <g
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        transform={`translate(${cd.w / 2 - 17}, ${cd.h / 2 - 17})`}
                        style={{ cursor: 'pointer' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); toggleGraphHidden(node.id) }}
                      >
                        <rect width={14} height={14} rx={4} fill={cardBg} stroke={cardBorder} />
                        <EyeSlashIcon x={1.5} y={1.5} width={11} height={11} stroke={cardSub} />
                      </g>

                      {/* Connection count badge */}
                      {connCount > 0 && (
                        <>
                          <circle cx={-cd.w / 2 + 14} cy={-cd.h / 2 + 10} r={8}
                            fill={node.color} fillOpacity={0.2} />
                          <text x={-cd.w / 2 + 14} y={-cd.h / 2 + 13.5} textAnchor="middle"
                            fontSize={7.5} fontWeight={700} fill={node.color} fontFamily="Inter, sans-serif">
                            {connCount}
                          </text>
                        </>
                      )}

                      {/* Title */}
                      <text
                        x={-cd.w / 2 + 12} y={detailLevel === 'full' ? -4 : 4}
                        fontSize={detailLevel === 'full' ? 10 : 10.5}
                        fontWeight={700} fontFamily="Inter, sans-serif"
                        fill={cardText}
                        style={{ maxWidth: cd.w - 50 }}
                      >
                        {(() => {
                          const maxC = Math.floor((cd.w - 52) / 6.2)
                          return node.title.length > maxC ? node.title.slice(0, maxC - 1) + '…' : node.title
                        })()}
                      </text>

                      {/* Date (full detail only) */}
                      {detailLevel === 'full' && (
                        <text x={-cd.w / 2 + 12} y={9}
                          fontSize={8} fontFamily="Inter, sans-serif"
                          fill={cardSub}>
                          {formatDate(node.date)}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-4 flex items-center gap-5 text-xs pointer-events-none"
          style={{ color: 'var(--text-dim)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-4 rounded" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#2a3350' : '#d1dce8'}`, borderLeft: '3px solid #6366f1' }} />
            Event
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-4 rounded" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#2a3350' : '#d1dce8'}`, borderLeft: '3px solid #8b5cf6' }} />
            Chapter
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-4 rounded" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#2a3350' : '#d1dce8'}`, borderLeft: '3px solid #14b8a6' }} />
            Sub-event
          </div>
          <span style={{ color: 'var(--text-dim)' }}>Scroll to zoom · Drag canvas to pan · Drag node to move</span>
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && !editingEntity && (
        <DetailPanel
          entity={allNodes.find(n => n.id === selectedNode.id)?.entity || selectedNode}
          type={selectedNode.type}
          onClose={() => setSelectedNode(null)}
          onEdit={() => setEditingEntity(allNodes.find(n => n.id === selectedNode.id))}
          onDelete={() => {
            const nd = allNodes.find(n => n.id === selectedNode.id)
            if (!nd) return
            if (nd.type === 'event') deleteEvent(nd.entity.id)
            else if (nd.type === 'chapter') deleteChapter(nd.entity.id)
            else deleteSubEvent(nd.chapterId, nd.entity.id)
            setSelectedNode(null)
          }}
        />
      )}

      {editingEntity && (
        <EntityForm
          type={editingEntity.type}
          initial={editingEntity.entity}
          onSave={(form) => {
            if (editingEntity.type === 'event') updateEvent(editingEntity.entity.id, form)
            else if (editingEntity.type === 'chapter') updateChapter(editingEntity.entity.id, form)
            else updateSubEvent(editingEntity.chapterId, editingEntity.entity.id, form)
            setEditingEntity(null)
          }}
          onClose={() => setEditingEntity(null)}
        />
      )}
    </div>
  )
}
