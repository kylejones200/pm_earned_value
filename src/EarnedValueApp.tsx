import React, { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
// Raw markdown imports for Resources view (Vite ?raw)
// Using non-branded files per request
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CharterMd from '../Project_Charter.md?raw'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import EventsMd from '../Random_Event_Cards.md?raw'

// Simple Earned Value tracker for 10 weeks with linear PV by default
// PV/week defaults to $100,000 but can be adjusted if BAC changes mid-course.
// Users enter weekly EV and AC; the table computes cumulative values and CPI/SPI.

type WeekRow = {
  // Planning inputs
  planEvWeek: number | ''
  planAcWeek: number | ''
  // Resolved actuals
  evWeek: number | ''
  acWeek: number | ''
  // Annotation
  note: string
}

const DEFAULT_WEEKS = 10
const DEFAULT_PV_PER_WEEK = 100_000
const DEFAULT_BAC = 1_000_000

export default function EarnedValueApp() {
  type View = 'game' | 'resources'
  const [view, setView] = useState<View>('game')
  const [weeks, setWeeks] = useState<WeekRow[]>(
    Array.from({ length: DEFAULT_WEEKS }, () => ({ planEvWeek: '', planAcWeek: '', evWeek: '', acWeek: '', note: '' }))
  )
  const [pvPerWeek, setPvPerWeek] = useState<number>(DEFAULT_PV_PER_WEEK)
  const [bac, setBac] = useState<number>(DEFAULT_BAC)
  const [currentWeek, setCurrentWeek] = useState<number>(0) // 0-based index
  // Event card selection (cards 1–30)
  type CardId =
    | 'none'
    | 'supplier_delay'            // 1
    | 'weather_shutdown'          // 2
    | 'staff_overtime'            // 3
    | 'scope_change'              // 4
    | 'lucky_break'               // 5
    | 'permit_slip'               // 6
    | 'equipment_failure'         // 7
    | 'skilled_crew'              // 8 (option)
    | 'supply_discount'           // 9 conditional
    | 'engagement_boost'          // 10 next-week +EV
    | 'grid_study_delay'          // 11 EV cap 20k
    | 'design_optimization'       // 12 AC -20k
    | 'safety_standdown'          // 13 EV=0 AC+30k
    | 'vendor_substitution'       // 14 (option) else next week cap 40k
    | 'inspection_pass'           // 15 +30k EV
    | 'rework_required'           // 16 EV -35k cumulative
    | 'weather_window'            // 17 if AC >= plan AC then +25k EV
    | 'price_inflation'           // 18 AC *1.15
    | 'permit_fee_increase'       // 19 AC +20k
    | 'site_access_constraint'    // 20 EV cap 60k
    | 'training_investment'       // 21 AC +20k; next week +30k EV
    | 'sub_no_show'               // 22 (option) else EV=0
    | 'fx_favorable'              // 23 AC -15k
    | 'donation_materials'        // 24 EV +25k
    | 'storm_damage'              // 25 EV -20k; AC +10k
    | 'productivity_surge'        // 26 EV +50%
    | 'scope_clarification'       // 27 next week ignore EV cap
    | 'funding_hold'              // 28 AC cap 50k
    | 'logistics_optimization'    // 29 if AC >= 80k then AC -10k, EV +10k
    | 'extra_qa_cycle'            // 30 EV cap 40k
  const [selectedCard, setSelectedCard] = useState<CardId>('none')
  const [optHireSkilledCrew, setOptHireSkilledCrew] = useState<boolean>(true)
  const [optVendorPay, setOptVendorPay] = useState<boolean>(true) // card 14
  const [optExpediteNoShow, setOptExpediteNoShow] = useState<boolean>(false) // card 22
  const [lastOutcome, setLastOutcome] = useState<null | {
    week: number
    prod: { label: string, mult: number }
    cost: { label: string, mult: number }
    evApplied: number
    acApplied: number
  }>(null)
  const [isDark, setIsDark] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false)

  // Format helpers
  const formatNum = (n: number | ''): string => {
    if (n === '' || isNaN(n as number)) return ''
    try { return (n as number).toLocaleString() } catch { return String(n) }
  }
  const parseNum = (s: string): number | '' => {
    if (s.trim() === '') return ''
    const n = Number(s.replace(/[^0-9.-]/g, ''))
    return isNaN(n) ? '' : n
  }

  // Derived PV cumulative values (linear, based on pvPerWeek)
  const pvCum = useMemo(() => weeks.map((_, i) => pvPerWeek * (i + 1)), [weeks.length, pvPerWeek])

  // Derived cumulative EV/AC from weekly entries
  const evCum = useMemo(() => {
    let total = 0
    return weeks.map((w) => {
      const add = typeof w.evWeek === 'number' ? w.evWeek : 0
      total += add
      return total
    })
  }, [weeks])

  const acCum = useMemo(() => {
    let total = 0
    return weeks.map((w) => {
      const add = typeof w.acWeek === 'number' ? w.acWeek : 0
      total += add
      return total
    })
  }, [weeks])

  // Chart helpers
  function buildPath(series: number[], width: number, height: number, yMaxHint?: number) {
    const n = series.length
    if (!n) return ''
    const maxVal = Math.max(1, yMaxHint ?? Math.max(...series))
    const pad = 12
    const w = Math.max(1, width - pad * 2)
    const h = Math.max(1, height - pad * 2)
    const stepX = n > 1 ? w / (n - 1) : w
    const y = (v: number) => pad + h - (v / maxVal) * h
    const x = (i: number) => pad + i * stepX
    let d = `M ${x(0)} ${y(series[0] || 0)}`
    for (let i = 1; i < n; i++) {
      d += ` L ${x(i)} ${y(series[i] || 0)}`
    }
    return d
  }

  function setWeekValue(idx: number, key: keyof WeekRow, value: string) {
    setWeeks((prev) => {
      const next = [...prev]
      if (key === 'evWeek' || key === 'acWeek' || key === 'planEvWeek' || key === 'planAcWeek') {
        const n = value === '' ? '' : Number(value.replace(/[^0-9.-]/g, ''))
        next[idx] = { ...next[idx], [key]: isNaN(n as number) ? '' : (n as number) }
      } else {
        next[idx] = { ...next[idx], [key]: value }
      }
      return next
    })
  }

  function resetAll() {
    setWeeks(Array.from({ length: DEFAULT_WEEKS }, () => ({ planEvWeek: '', planAcWeek: '', evWeek: '', acWeek: '', note: '' })))
    setPvPerWeek(DEFAULT_PV_PER_WEEK)
    setBac(DEFAULT_BAC)
    setCurrentWeek(0)
    setLastOutcome(null)
  }

  // Next-week modifiers from certain cards
  const [nextWeekMod, setNextWeekMod] = useState<{ evBonus: number; evCap: number | null; ignoreEvCap: boolean }>({ evBonus: 0, evCap: null, ignoreEvCap: false })

  function resolveCurrentWeek() {
    if (currentWeek < 0 || currentWeek >= weeks.length) return
    const row = weeks[currentWeek]
    const planEV = typeof row.planEvWeek === 'number' ? row.planEvWeek : 0
    const planAC = typeof row.planAcWeek === 'number' ? row.planAcWeek : 0
    // Start with planned values
    let evApplied = planEV
    let acApplied = planAC
    let outcomeNote = ''

    // Apply pending next-week modifiers FIRST
    if (nextWeekMod.evBonus) {
      evApplied += nextWeekMod.evBonus
      outcomeNote = [outcomeNote, `Next-week EV bonus +$${nextWeekMod.evBonus.toLocaleString()}`].filter(Boolean).join('; ')
    }
    if (nextWeekMod.evCap != null && !nextWeekMod.ignoreEvCap) {
      evApplied = Math.min(evApplied, nextWeekMod.evCap)
      outcomeNote = [outcomeNote, `Next-week EV cap $${nextWeekMod.evCap.toLocaleString()}`].filter(Boolean).join('; ')
    }
    // Clear next-week modifiers after applying
    if (nextWeekMod.evBonus || nextWeekMod.evCap != null || nextWeekMod.ignoreEvCap) {
      setNextWeekMod({ evBonus: 0, evCap: null, ignoreEvCap: false })
    }

    // Apply card effects
    switch (selectedCard) {
      case 'supplier_delay':
        evApplied = Math.min(planEV, Math.round(planEV * 0.5))
        outcomeNote = 'Supplier delay: EV capped at 50% of plan.'
        break
      case 'weather_shutdown':
        evApplied = 0
        acApplied = planAC + 50_000
        outcomeNote = 'Weather shutdown: EV=0, AC +$50k overhead.'
        break
      case 'staff_overtime':
        evApplied = planEV + 50_000
        acApplied = planAC + 30_000
        outcomeNote = 'Staff overtime: +$50k EV, +$30k AC.'
        break
      case 'scope_change': {
        const delta = 100_000
        const remaining = Math.max(weeks.length - currentWeek, 1)
        const addPerWeek = Math.round(delta / remaining)
        // Update BAC and PV/week for remaining weeks proportionally
        setBac(prev => prev + delta)
        setPvPerWeek(prev => prev + addPerWeek)
        outcomeNote = `Scope change: BAC +$${delta.toLocaleString()}; PV/week +$${addPerWeek.toLocaleString()} for remaining weeks.`
        break }
      case 'lucky_break':
        evApplied = planEV + 40_000
        outcomeNote = 'Lucky break: +$40k EV at no cost.'
        break
      case 'permit_slip':
        evApplied = Math.min(planEV, 30_000)
        outcomeNote = 'Permit slippage: EV limited to $30k this week.'
        break
      case 'equipment_failure':
        evApplied = Math.max(0, planEV - 40_000)
        acApplied = planAC + 25_000
        outcomeNote = 'Equipment failure: EV −$40k, AC +$25k.'
        break
      case 'skilled_crew':
        if (optHireSkilledCrew) {
          evApplied = planEV + 90_000
          acApplied = planAC + 60_000
          outcomeNote = 'Skilled crew hired: +$90k EV for +$60k AC.'
        } else {
          outcomeNote = 'Skilled crew available (declined): no change.'
        }
        break
      case 'supply_discount':
        // Conditional: handled after AC known
        outcomeNote = 'Supply bulk discount: If AC ≥ $120k this week, EV +$20k.'
        break
      case 'engagement_boost':
        setNextWeekMod(prev => ({ ...prev, evBonus: prev.evBonus + 20_000 }))
        outcomeNote = 'Community engagement boost: Next week EV +$20k.'
        break
      case 'grid_study_delay':
        evApplied = Math.min(evApplied, 20_000)
        outcomeNote = 'Grid study delay: EV capped at $20k this week.'
        break
      case 'design_optimization':
        acApplied = Math.max(0, acApplied - 20_000)
        outcomeNote = 'Design optimization: AC −$20k (same EV).'
        break
      case 'safety_standdown':
        evApplied = 0
        acApplied = acApplied + 30_000
        outcomeNote = 'Safety stand-down: EV=0; AC +$30k fixed cost.'
        break
      case 'vendor_substitution':
        if (optVendorPay) {
          acApplied = acApplied + 15_000
          outcomeNote = 'Vendor substitution paid: Avoided two-week slip; no EV cap.'
        } else {
          setNextWeekMod(prev => ({ ...prev, evCap: 40_000 }))
          outcomeNote = 'Vendor substitution declined: Next week EV cap $40k.'
        }
        break
      case 'inspection_pass':
        evApplied = evApplied + 30_000
        outcomeNote = 'Inspection pass: +$30k EV at no cost.'
        break
      case 'rework_required':
        evApplied = evApplied - 35_000
        outcomeNote = 'Rework required: EV −$35k cumulatively.'
        break
      case 'weather_window':
        // If spend at least planned AC, +25k EV
        // We'll check after other AC changes
        outcomeNote = 'Weather window: If AC ≥ planned AC, +$25k EV.'
        break
      case 'price_inflation':
        acApplied = Math.round(acApplied * 1.15)
        outcomeNote = 'Price inflation: AC ×1.15 this week.'
        break
      case 'permit_fee_increase':
        acApplied = acApplied + 20_000
        outcomeNote = 'Permit fee increase: AC +$20k.'
        break
      case 'site_access_constraint':
        evApplied = Math.min(evApplied, 60_000)
        outcomeNote = 'Site access constraint: EV capped at $60k this week.'
        break
      case 'training_investment':
        acApplied = acApplied + 20_000
        setNextWeekMod(prev => ({ ...prev, evBonus: prev.evBonus + 30_000 }))
        outcomeNote = 'Training investment: AC +$20k; next week EV +$30k.'
        break
      case 'sub_no_show':
        if (optExpediteNoShow) {
          acApplied = acApplied + 40_000
          outcomeNote = 'Subcontractor no-show: Expedited +$40k; EV normal.'
        } else {
          evApplied = 0
          outcomeNote = 'Subcontractor no-show: EV=0 (no expedite).'
        }
        break
      case 'fx_favorable':
        acApplied = Math.max(0, acApplied - 15_000)
        outcomeNote = 'Favorable exchange rate: AC −$15k.'
        break
      case 'donation_materials':
        evApplied = evApplied + 25_000
        outcomeNote = 'Donation of materials: +$25k EV at no cost.'
        break
      case 'storm_damage':
        evApplied = evApplied - 20_000
        acApplied = acApplied + 10_000
        outcomeNote = 'Storm damage: EV −$20k; AC +$10k cleanup.'
        break
      case 'productivity_surge':
        evApplied = Math.round(evApplied * 1.5)
        outcomeNote = 'Productivity surge: EV +50% this week.'
        break
      case 'scope_clarification':
        setNextWeekMod(prev => ({ ...prev, ignoreEvCap: true }))
        outcomeNote = 'Scope clarification: Next week ignore any EV cap.'
        break
      case 'funding_hold':
        acApplied = Math.min(acApplied, 50_000)
        outcomeNote = 'Funding hold: AC capped at $50k this week.'
        break
      case 'logistics_optimization':
        // Conditional: handled after AC known (>=80k)
        outcomeNote = 'Logistics optimization: If AC ≥ $80k, AC −$10k and EV +$10k.'
        break
      case 'extra_qa_cycle':
        evApplied = Math.min(evApplied, 40_000)
        acApplied = acApplied + 10_000
        outcomeNote = 'Extra QA cycle: EV cap $40k; AC +$10k.'
        break
      case 'none':
      default:
        outcomeNote = 'Normal week.'
        break
    }

    // Conditional post-processing for specific cards (based on final AC)
    if (selectedCard === 'supply_discount' && acApplied >= 120_000) {
      evApplied += 20_000
      outcomeNote = [outcomeNote, '+$20k EV (bulk discount)'].join(' ')
    }
    if (selectedCard === 'weather_window' && acApplied >= planAC) {
      evApplied += 25_000
      outcomeNote = [outcomeNote, '+$25k EV (weather window)'].join(' ')
    }
    if (selectedCard === 'logistics_optimization' && acApplied >= 80_000) {
      acApplied = Math.max(0, acApplied - 10_000)
      evApplied += 10_000
      outcomeNote = [outcomeNote, 'Rebate −$10k AC and +$10k EV (logistics)'].join(' ')
    }
    setWeeks(prev => {
      const next = [...prev]
      next[currentWeek] = { ...next[currentWeek], evWeek: Math.max(0, Math.round(evApplied)), acWeek: Math.max(0, Math.round(acApplied)), note: [next[currentWeek].note, outcomeNote].filter(Boolean).join(' | ') }
      return next
    })
    setLastOutcome({ week: currentWeek + 1, prod: { label: selectedCard, mult: 1 }, cost: { label: selectedCard, mult: 1 }, evApplied: Math.max(0, Math.round(evApplied)), acApplied: Math.max(0, Math.round(acApplied)) })
    if (currentWeek < weeks.length - 1) setCurrentWeek(currentWeek + 1)
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8 font-sans">
      <header className="mb-6 md:mb-8">
        <div className="card p-5 md:p-6 bg-gradient-to-r from-emerald-600 to-cyan-700 text-white shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Earned Value Game Tracker</h1>
              <p className="text-sm/6 opacity-95 mt-1">Enter weekly EV and AC. PV is linear by default. Review CPI and SPI across 10 weeks.</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-xl p-1">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm ${view==='game' ? 'bg-white/80 text-emerald-700' : 'text-white/90 hover:bg-white/20'}`}
                  onClick={() => setView('game')}
                >Game</button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm ${view==='resources' ? 'bg-white/80 text-emerald-700' : 'text-white/90 hover:bg-white/20'}`}
                  onClick={() => setView('resources')}
                >Resources</button>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center justify-end gap-2">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isDark
                      const root = document.documentElement
                      if (next) root.classList.add('dark'); else root.classList.remove('dark')
                      localStorage.setItem('theme', next ? 'dark' : 'light')
                      setIsDark(next)
                    }}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition"
                    aria-label="Toggle dark mode"
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDark ? (
                      // Clean outline sun icon
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2M22 12h-2M4 12H2m15.364-7.364-1.414 1.414M8.05 16.95l-1.414 1.414m0-13.657 1.414 1.414M16.95 16.95l1.414 1.414" />
                      </svg>
                    ) : (
                      // Clean outline moon icon
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </button>
                  <div className="pointer-events-none absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                    <div className="rounded-md bg-black/80 text-white text-xs px-2 py-1 shadow">Toggle theme</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs opacity-90 mr-2">BAC</label>
                <input
                  className="input w-36 text-right"
                  value={formatNum(bac)}
                  onChange={(e) => setBac((parseNum(e.target.value) || 0) as number)}
                />
              </div>
              <div>
                <label className="text-xs opacity-90 mr-2">PV / week</label>
                <input
                  className="input w-36 text-right"
                  value={formatNum(pvPerWeek)}
                  onChange={(e) => setPvPerWeek((parseNum(e.target.value) || 0) as number)}
                />
              </div>
              <button className="btn mt-2" onClick={resetAll}>Reset</button>
            </div>
          </div>
        </div>
      </header>

      {/* Resources View */}
      {view === 'resources' ? (
        <section className="space-y-6">
          <div className="card p-5 md:p-8 mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Project Charter</h2>
            <div className="text-[15px] leading-7">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-semibold mt-6 mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-5 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="my-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 my-2 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-2 space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="marker:text-gray-500" {...props} />,
                  hr: ({node, ...props}) => <hr className="my-6 border-black/10 dark:border-white/10" {...props} />,
                }}
              >{CharterMd}</ReactMarkdown>
            </div>
          </div>
          <div className="card p-5 md:p-8 mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Random Event Cards</h2>
            <div className="text-[15px] leading-7">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-semibold mt-6 mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-5 mb-2" {...props} />,
                  p: ({node, ...props}) => <p className="my-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 my-2 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-2 space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="marker:text-gray-500" {...props} />,
                  hr: ({node, ...props}) => <hr className="my-6 border-black/10 dark:border-white/10" {...props} />,
                }}
              >{EventsMd}</ReactMarkdown>
            </div>
          </div>
        </section>
      ) : (
      <>
      {/* EVM legend / help (pinned open) */}
      <details className="mb-3 text-sm" open>
        <summary className="cursor-pointer select-none font-medium">EVM column definitions</summary>
        <div className="mt-2 space-y-1 opacity-90">
          <div><strong>PV (Planned Value)</strong> — Budgeted value of planned work. Here: PV_cum = PV/week × week#.</div>
          <div><strong>EV (Earned Value)</strong> — Budgeted value of work actually completed. EV_cum = Σ EV_week.</div>
          <div><strong>AC (Actual Cost)</strong> — Actual money spent. AC_cum = Σ AC_week.</div>
          <div><strong>CV</strong> = EV_cum − AC_cum &nbsp; • &nbsp; <strong>SV</strong> = EV_cum − PV_cum</div>
          <div><strong>CPI</strong> = EV_cum / AC_cum (≥ 1 indicates under/at budget). Consider BAC at completion.</div>
          <div><strong>SPI</strong> = EV_cum / PV_cum (≥ 1 indicates on/ ahead of schedule). BAC informs target EV at completion.</div>
        </div>
      </details>

      {/* Resolution controls */}
      <section className="mb-3 card p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm opacity-80">Current week: <span className="font-mono">{Math.min(currentWeek + 1, weeks.length)}</span> / {weeks.length}</div>
          <div className="ml-auto flex items-center gap-3">
            <label className="text-sm">Event card
              <select className="input ml-2" value={selectedCard} onChange={(e) => setSelectedCard(e.target.value as CardId)} title="Choose the event to apply this week">
                <option value="none">None (Normal week)</option>
                <option value="supplier_delay">Supplier delay (EV capped at 50% of plan)</option>
                <option value="weather_shutdown">Weather shutdown (EV=0, AC +$50k)</option>
                <option value="staff_overtime">Staff overtime (EV +$50k, AC +$30k)</option>
                <option value="scope_change">Scope change (BAC +$100k; adjust PV/week for remaining)</option>
                <option value="lucky_break">Lucky break (EV +$40k)</option>
                <option value="permit_slip">Permit review slippage (EV capped at $30k)</option>
                <option value="equipment_failure">Equipment failure (EV −$40k, AC +$25k)</option>
                <option value="skilled_crew">Skilled crew available (option: +$90k EV for +$60k AC)</option>
                <option value="supply_discount">Supply bulk discount (if AC ≥ $120k, +$20k EV)</option>
                <option value="engagement_boost">Community engagement boost (next week EV +$20k)</option>
                <option value="grid_study_delay">Grid interconnection study delay (EV cap $20k)</option>
                <option value="design_optimization">Design optimization (AC −$20k for same EV)</option>
                <option value="safety_standdown">Safety stand-down (EV=0; AC +$30k)</option>
                <option value="vendor_substitution">Vendor substitution (pay +$15k to avoid next-week cap)</option>
                <option value="inspection_pass">Inspection pass (EV +$30k at no cost)</option>
                <option value="rework_required">Rework required (EV −$35k cumulatively)</option>
                <option value="weather_window">Weather window (if AC ≥ plan AC, +$25k EV)</option>
                <option value="price_inflation">Price inflation (AC ×1.15)</option>
                <option value="permit_fee_increase">Permit fee increase (AC +$20k)</option>
                <option value="site_access_constraint">Site access constraint (EV cap $60k)</option>
                <option value="training_investment">Training investment (AC +$20k; next week EV +$30k)</option>
                <option value="sub_no_show">Subcontractor no-show (option: pay +$40k to proceed)</option>
                <option value="fx_favorable">Favorable exchange rate (AC −$15k)</option>
                <option value="donation_materials">Donation of materials (EV +$25k)</option>
                <option value="storm_damage">Storm damage (EV −$20k; AC +$10k)</option>
                <option value="productivity_surge">Productivity surge (EV +50%)</option>
                <option value="scope_clarification">Scope clarification (next week ignore EV cap)</option>
                <option value="funding_hold">Funding hold (AC cap $50k this week)</option>
                <option value="logistics_optimization">Logistics optimization (if AC ≥ $80k, −$10k AC and +$10k EV)</option>
                <option value="extra_qa_cycle">Extra QA cycle (EV cap $40k; AC +$10k)</option>
              </select>
            </label>
            {selectedCard === 'skilled_crew' && (
              <label className="text-sm inline-flex items-center gap-2" title="If checked, you pay +$60k AC and gain +$90k EV this week">
                <input type="checkbox" checked={optHireSkilledCrew} onChange={(e) => setOptHireSkilledCrew(e.target.checked)} /> Hire contractor
              </label>
            )}
            {selectedCard === 'vendor_substitution' && (
              <label className="text-sm inline-flex items-center gap-2" title="Pay +$15k this week to avoid next week's EV cap (otherwise next week EV is capped at $40k)">
                <input type="checkbox" checked={optVendorPay} onChange={(e) => setOptVendorPay(e.target.checked)} /> Pay +$15k to avoid cap
              </label>
            )}
            {selectedCard === 'sub_no_show' && (
              <label className="text-sm inline-flex items-center gap-2" title="If checked, pay +$40k to proceed normally; if not, EV=0 this week">
                <input type="checkbox" checked={optExpediteNoShow} onChange={(e) => setOptExpediteNoShow(e.target.checked)} /> Expedite (+$40k)
              </label>
            )}
            <button className="btn" onClick={resolveCurrentWeek} title="Applies the selected event card to this week's planned EV/AC">Resolve week</button>
          </div>
        </div>
        {lastOutcome && (
          <div className="mt-3 text-sm opacity-90">
            Resolved Week {lastOutcome.week}: EV = {lastOutcome.evApplied.toLocaleString()} • AC = {lastOutcome.acApplied.toLocaleString()} — Event: {selectedCard}
          </div>
        )}
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-black/10">
              <th className="py-2 pr-2">Week</th>
              <th className="py-2 pr-2">Event / Notes</th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Planned EV for this week (team decision before resolution).">Plan EV</abbr>
                <span className="ml-1 opacity-60" title="Planned EV for this week (team decision)." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Planned AC for this week (team decision before resolution).">Plan AC</abbr>
                <span className="ml-1 opacity-60" title="Planned AC for this week (team decision)." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Planned Value (Cumulative). PV is the budgeted value of planned work. In this tracker: PV_cum = PV/week × week#">PV (Cum)</abbr>
                <span className="ml-1 opacity-60" title="Planned Value (Cumulative). PV_cum = PV/week × week#" aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Earned Value (This Week). EV_week is the budgeted value of work actually completed this week.">EV (Week)</abbr>
                <span className="ml-1 opacity-60" title="Earned Value this week (budgeted value of work actually completed)." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Earned Value (Cumulative). EV_cum = Σ EV_week through this week.">EV (Cum)</abbr>
                <span className="ml-1 opacity-60" title="Earned Value cumulative. EV_cum = Σ EV_week." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Actual Cost (This Week). AC_week is actual money spent this week.">AC (Week)</abbr>
                <span className="ml-1 opacity-60" title="Actual Cost this week (money spent)." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Actual Cost (Cumulative). AC_cum = Σ AC_week through this week.">AC (Cum)</abbr>
                <span className="ml-1 opacity-60" title="Actual Cost cumulative. AC_cum = Σ AC_week." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Cost Variance. CV = EV_cum − AC_cum">CV</abbr>
                <span className="ml-1 opacity-60" title="Cost Variance. CV = EV_cum − AC_cum." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Schedule Variance. SV = EV_cum − PV_cum">SV</abbr>
                <span className="ml-1 opacity-60" title="Schedule Variance. SV = EV_cum − PV_cum." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Cost Performance Index. CPI = EV_cum / AC_cum. At completion, compare EV_cum to BAC; CPI ≥ 1 suggests under/at budget.">CPI</abbr>
                <span className="ml-1 opacity-60" title="CPI = EV_cum / AC_cum. Compare EV_cum to BAC at completion; CPI ≥ 1 is favorable." aria-label="Info">ⓘ</span>
              </th>
              <th className="py-2 pr-2 text-right">
                <abbr title="Schedule Performance Index. SPI = EV_cum / PV_cum. BAC informs target EV at completion; SPI ≥ 1 suggests on/ahead of schedule.">SPI</abbr>
                <span className="ml-1 opacity-60" title="SPI = EV_cum / PV_cum. Consider BAC when evaluating final EV; SPI ≥ 1 is favorable." aria-label="Info">ⓘ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const pv = pvCum[i] ?? 0
              const evC = evCum[i] ?? 0
              const acC = acCum[i] ?? 0
              const cv = evC - acC
              const sv = evC - pv
              const cpi = acC === 0 ? '' : (evC / acC).toFixed(2)
              const spi = pv === 0 ? '' : (evC / pv).toFixed(2)
              return (
                <tr key={i} className="border-b border-black/5">
                  <td className="py-2 pr-2 font-mono">{i + 1}</td>
                  <td className="py-2 pr-2 min-w-56">
                    <input
                      className="input w-full"
                      placeholder="Event or decision notes"
                      value={w.note}
                      onChange={(e) => setWeekValue(i, 'note', e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      className="input w-28 text-right"
                      placeholder="0"
                      title="Planned EV (budgeted $) you aim to earn this week."
                      value={formatNum(w.planEvWeek)}
                      onChange={(e) => setWeekValue(i, 'planEvWeek', e.target.value)}
                      disabled={i !== currentWeek}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      className="input w-28 text-right"
                      placeholder="0"
                      title="Planned AC ($) you expect to spend this week."
                      value={formatNum(w.planAcWeek)}
                      onChange={(e) => setWeekValue(i, 'planAcWeek', e.target.value)}
                      disabled={i !== currentWeek}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{pv.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums" title="EV (This Week): Earned Value earned this week (computed by event resolution).">
                    {typeof w.evWeek === 'number' ? w.evWeek.toLocaleString() : ''}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{evC.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums" title="AC (This Week): Actual Cost spent this week (computed by event resolution).">
                    {typeof w.acWeek === 'number' ? w.acWeek.toLocaleString() : ''}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{acC.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{cv.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{sv.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{cpi}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{spi}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Charts: Cumulative EV vs AC */}
      <section className="mt-8 card p-4 md:p-6">
        <h3 className="text-lg font-semibold">Cumulative EV vs AC</h3>
        <p className="text-sm opacity-80 mb-3">Tracks progress and spending over time. Aim for EV to keep pace with PV and AC.</p>
        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 700 260" className="w-full max-w-[900px]">
            {/* Axes */}
            <line x1="12" y1="248" x2="688" y2="248" stroke="currentColor" strokeOpacity="0.2" />
            <line x1="12" y1="12" x2="12" y2="248" stroke="currentColor" strokeOpacity="0.2" />
            {/* Grid (quarter points) */}
            {Array.from({ length: 3 }).map((_, i) => (
              <line key={i} x1="12" y1={12 + ((i + 1) * (236 / 4))} x2="688" y2={12 + ((i + 1) * (236 / 4))} stroke="currentColor" strokeOpacity="0.08" />
            ))}
            {/* Paths */}
            {(() => {
              const maxHint = Math.max(...pvCum, ...evCum, ...acCum, bac)
              const evPath = buildPath(evCum, 700, 260, maxHint)
              const acPath = buildPath(acCum, 700, 260, maxHint)
              const pvPath = buildPath(pvCum, 700, 260, maxHint)
              return (
                <g>
                  {/* PV path */}
                  <path d={pvPath} fill="none" stroke="#7c9cff" strokeWidth="2" />
                  {/* EV path */}
                  <path d={evPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
                  {/* AC path */}
                  <path d={acPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                </g>
              )
            })()}
            {/* X ticks (weeks) */}
            {weeks.map((_, i) => (
              <g key={i}>
                <line x1={12 + (i * ((700 - 24) / Math.max(1, weeks.length - 1)))} y1={248} x2={12 + (i * ((700 - 24) / Math.max(1, weeks.length - 1)))} y2={252} stroke="currentColor" strokeOpacity="0.4" />
                <text x={12 + (i * ((700 - 24) / Math.max(1, weeks.length - 1)))} y={256} fontSize="10" textAnchor="middle" fill="currentColor" opacity="0.7">{i + 1}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-1.5 rounded bg-[#7c9cff]" /> PV (Cum)</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-1.5 rounded bg-[#10b981]" /> EV (Cum)</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-1.5 rounded bg-[#f59e0b]" /> AC (Cum)</span>
        </div>
      </section>

      <section className="mt-6 text-sm opacity-80 space-y-1">
        <div className="font-medium">Reference</div>
        <div>CV = EV – AC, SV = EV – PV</div>
        <div>CPI = EV / AC, SPI = EV / PV</div>
        <div>Target: CPI ≥ 1 and SPI ≥ 1 at finish; BAC can change if scope changes.</div>
      </section>

      <footer className="mt-8 text-xs opacity-60">
        <p>Use the Random Event Cards to drive uncertainty; adjust EV/AC accordingly. For scope changes, update BAC and, if needed, PV/week for remaining weeks.</p>
      </footer>
      </>
      )}
    </div>
  )
}
