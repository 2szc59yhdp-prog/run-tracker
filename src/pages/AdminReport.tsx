import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileText, Trophy, Users, Building2 } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import { useApp } from '../context/AppContext'
import { fetchAllUsers } from '../services/api'
import type { RegisteredUser } from '../types'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const STATION_ORDER = [
  'Thinadhoo City',
  'Madaveli',
  'Rathafandhoo',
  'Nadella',
  'Fiyoari',
  'Gadhdhoo',
  'Vaadhoo',
  'Faresmaathoda',
] as const

const STATION_MAP: Record<string, (typeof STATION_ORDER)[number]> = {
  'Thinadhoo City Police': 'Thinadhoo City',
  'Gdh.Madaveli Police Station': 'Madaveli',
  'Gdh.Rathafandhoo Police Station': 'Rathafandhoo',
  'Gdh.Nadella Police Station': 'Nadella',
  'Gdh.Fiyoari Police Station': 'Fiyoari',
  'Gdh.Gadhdhoo Police Station': 'Gadhdhoo',
  'Gdh.Vaadhoo Police Station': 'Vaadhoo',
  'Gdh.Faresmaathoda Police Station': 'Faresmaathoda',
}

export default function AdminReport() {
  const { runs, isAdmin } = useApp()
  const navigate = useNavigate()
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [startDate, setStartDate] = useState<string>('2025-12-01')
  const [endDate, setEndDate] = useState<string>('2026-01-31')
  const [generating, setGenerating] = useState(false)
  const [scale, setScale] = useState<number>(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const page1Ref = useRef<HTMLDivElement>(null)
  const page2Ref = useRef<HTMLDivElement>(null)
  const PAGE1_ROWS = 40
  const MIN_DISTANCE_KM = 100
  const MIN_ACTIVE_DAYS = 40
  const CHALLENGE_START = new Date('2025-12-01T00:00:00')
  const CHALLENGE_END = new Date('2026-01-31T23:59:59')

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin-login')
      return
    }
    (async () => {
      const res = await fetchAllUsers()
      if (res.success && res.data) setUsers(res.data)
    })()
  }, [isAdmin, navigate])

  const filteredApproved = useMemo(() => {
    const s = startDate
    const e = endDate
    return runs.filter(
      (r) => r.status === 'approved' && r.date >= s && r.date <= e && r.station !== 'General Admin'
    )
  }, [runs, startDate, endDate])

  const filteredRejected = useMemo(() => {
    const s = startDate
    const e = endDate
    return runs.filter(
      (r) => r.status === 'rejected' && r.date >= s && r.date <= e && r.station !== 'General Admin'
    )
  }, [runs, startDate, endDate])

  const leaderboard = useMemo(() => {
    const map = new Map<string, { serviceNumber: string; name: string; station: string; totalDistance: number; approvedRuns: number; rejectedRuns: number }>()
    filteredApproved.forEach((r) => {
      const key = r.serviceNumber
      const prev = map.get(key) || { serviceNumber: r.serviceNumber, name: r.name, station: r.station, totalDistance: 0, approvedRuns: 0, rejectedRuns: 0 }
      prev.totalDistance += Number(r.distanceKm || 0)
      prev.approvedRuns += 1
      map.set(key, prev)
    })
    filteredRejected.forEach((r) => {
      const key = r.serviceNumber
      const prev = map.get(key) || { serviceNumber: r.serviceNumber, name: r.name, station: r.station, totalDistance: 0, approvedRuns: 0, rejectedRuns: 0 }
      prev.rejectedRuns += 1
      map.set(key, prev)
    })
    users.forEach((u) => {
      if (u.station !== 'General Admin' && !map.has(u.serviceNumber)) {
        map.set(u.serviceNumber, { serviceNumber: u.serviceNumber, name: u.name, station: u.station, totalDistance: 0, approvedRuns: 0, rejectedRuns: 0 })
      }
    })
    const arr = Array.from(map.values()).sort((a, b) => b.totalDistance - a.totalDistance || a.name.localeCompare(b.name))
    const positions = new Map<string, number>()
    let lastDistance = -1
    let lastRank = 0
    arr.forEach((entry, idx) => {
      if (entry.totalDistance !== lastDistance) {
        lastDistance = entry.totalDistance
        lastRank = idx + 1
      }
      positions.set(entry.serviceNumber, lastRank)
    })
    return arr.map((e) => ({ ...e, position: positions.get(e.serviceNumber)! }))
  }, [filteredApproved, filteredRejected, users])

  const stationBoard = useMemo(() => {
    const endDate = new Date() <= CHALLENGE_END ? new Date() : CHALLENGE_END
    const challengeDayCount = Math.floor((endDate.getTime() - CHALLENGE_START.getTime()) / 86400000) + 1
    const startStr = CHALLENGE_START.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' })
    const endStr = endDate.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' })

    const agg = new Map<(typeof STATION_ORDER)[number], { totalDistance: number; runners: number; runCount: number; runnerProgresses: number[] }>()
    STATION_ORDER.forEach((s) => agg.set(s, { totalDistance: 0, runners: 0, runCount: 0, runnerProgresses: [] }))

    const runsByUser = new Map<string, { totalDistance: number; dates: Set<string>; station: (typeof STATION_ORDER)[number] | null }>()
    runs.forEach((run) => {
      if (run.status !== 'approved' || !run.serviceNumber) return
      const mappedStation = STATION_MAP[run.station] as (typeof STATION_ORDER)[number] | undefined
      if (!mappedStation) return
      const entry = runsByUser.get(run.serviceNumber) || { totalDistance: 0, dates: new Set<string>(), station: mappedStation ?? null }
      entry.totalDistance += Number(run.distanceKm || 0)
      entry.dates.add(run.date)
      entry.station = mappedStation ?? entry.station
      runsByUser.set(run.serviceNumber, entry)
    })

    users.forEach((u) => {
      const mappedStation = STATION_MAP[u.station]
      if (!mappedStation || u.station === 'General Admin') return
      const entry = runsByUser.get(u.serviceNumber) || { totalDistance: 0, dates: new Set<string>(), station: mappedStation }
      runsByUser.set(u.serviceNumber, entry)
    })

    runsByUser.forEach((u) => {
      const station = u.station
      if (!station) return
      const coveredDays = Array.from(u.dates).filter((d) => d >= startStr && d <= endStr).length
      const distanceProgress = Math.min((u.totalDistance / MIN_DISTANCE_KM) * 100, 100)
      const daysProgress = Math.min((coveredDays / MIN_ACTIVE_DAYS) * 100, 100)
      let runnerProgress = Math.min(distanceProgress, daysProgress)
      const dailyActive = challengeDayCount > 0 && coveredDays === challengeDayCount
      if (dailyActive) runnerProgress = Math.min(runnerProgress * 1.15, 100)
      const cur = agg.get(station)!
      cur.totalDistance += u.totalDistance
      cur.runCount += u.dates.size
      cur.runners += u.totalDistance > 0 ? 1 : 0
      cur.runnerProgresses.push(runnerProgress)
      agg.set(station, cur)
    })

    const result = STATION_ORDER.map((station) => {
      const data = agg.get(station) || { totalDistance: 0, runners: 0, runCount: 0, runnerProgresses: [] }
      const sorted = [...data.runnerProgresses].sort((a, b) => b - a)
      const slots = 5
      let sumTop = 0
      for (let i = 0; i < slots; i++) sumTop += sorted[i] ?? 0
      const performancePercent = sumTop / slots
      return { station, totalDistance: data.totalDistance, runners: data.runners, runCount: data.runCount, performancePercent }
    })

    return result.sort((a, b) => b.performancePercent - a.performancePercent)
  }, [runs, users])

  const generatePdf = async () => {
    setGenerating(true)
    try {
      const PAGE_WIDTH = 794
      const PAGE_HEIGHT = 1123
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_WIDTH, PAGE_HEIGHT] })
      if ((document as any).fonts && (document as any).fonts.ready) {
        await (document as any).fonts.ready
      }
      const scale = 2

      const options = {
        scale,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc: Document) => {
          const container = doc.querySelector('[data-report-container="true"]') as HTMLElement | null
          const p1 = doc.querySelector('[data-report-page="1"]') as HTMLElement | null
          const p2 = doc.querySelector('[data-report-page="2"]') as HTMLElement | null
          if (container) { container.style.display = 'block'; container.classList.add('pdf-capture') }
          ;[p1, p2].forEach((p) => {
            if (p) {
              p.style.transform = 'scale(1)'
              p.style.display = 'block'
            }
          })
        },
      } as const

      if (page1Ref.current) {
        await new Promise((r) => requestAnimationFrame(r))
        const canvas1 = await html2canvas(page1Ref.current, options as any)
        const imgData1 = canvas1.toDataURL('image/png')
        const imgWidth1 = PAGE_WIDTH
        const imgHeight1 = (canvas1.height * imgWidth1) / canvas1.width
        pdf.addImage(imgData1, 'PNG', 0, 0, imgWidth1, imgHeight1)
      }
      pdf.addPage()
      if (page2Ref.current) {
        const canvas2 = await html2canvas(page2Ref.current, options as any)
        const imgData2 = canvas2.toDataURL('image/png')
        const imgWidth2 = PAGE_WIDTH
        const imgHeight2 = (canvas2.height * imgWidth2) / canvas2.width
        pdf.addImage(imgData2, 'PNG', 0, 0, imgWidth2, imgHeight2)
      }
      pdf.save(`Madaveli_Weekly_Report_${startDate}_to_${endDate}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    const updateScale = () => {
      const w = Math.max(320, window.innerWidth - 16)
      const s = Math.min(1, w / 794)
      setScale(s)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [])

  const totalDistance = useMemo(() => filteredApproved.reduce((s, r) => s + Number(r.distanceKm || 0), 0), [filteredApproved])
  const totalApprovedRuns = filteredApproved.length
  const totalRejectedRuns = filteredRejected.length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent-500/20 text-accent-400"><FileText className="w-5 h-5" /></div>
          <h1 className="font-heading text-3xl font-extrabold text-white tracking-tight">100K Run Challenge Weekly Statistic Report</h1>
        </div>
        <Button onClick={generatePdf} disabled={generating} icon={<FileText className="w-4 h-4" />}>Download PDF</Button>
      </div>

      <Card className="mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div className="flex items-end"><Button onClick={() => null} variant="secondary" className="w-full" disabled>{filteredApproved.length + filteredRejected.length} runs in range</Button></div>
        </div>
      </Card>

      {/* Mobile responsive view */}
      <div className="sm:hidden space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
            <div className="flex items-center gap-2 text-primary-300"><Trophy className="w-4 h-4 text-accent-400" /><span className="text-sm">Total Distance</span></div>
            <p className="font-display text-xl font-bold text-white">{totalDistance.toFixed(1)} km</p>
          </div>
          <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
            <div className="flex items-center gap-2 text-primary-300"><Users className="w-4 h-4 text-success-400" /><span className="text-sm">Approved Runs</span></div>
            <p className="font-display text-xl font-bold text-white">{totalApprovedRuns}</p>
          </div>
          <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
            <div className="flex items-center gap-2 text-primary-300"><Calendar className="w-4 h-4 text-warning-400" /><span className="text-sm">Rejected Runs</span></div>
            <p className="font-display text-xl font-bold text-white">{totalRejectedRuns}</p>
          </div>
        </div>

        <div className="rounded-xl border border-primary-700 bg-primary-800/40">
          <div className="px-3 py-2 border-b border-primary-700 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent-400" /><span className="text-primary-300 text-sm font-medium">Leaderboard</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs table-fixed min-w-[720px]" style={{ tableLayout: 'fixed', minWidth: 720 }}>
              <colgroup>
                <col style={{ width: '48px' }} />
                <col style={{ width: '290px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '76px' }} />
              </colgroup>
              <thead>
                <tr className="text-primary-500">
                  <th className="text-left px-2 py-1">Pos</th>
                  <th className="text-left px-2 py-1">Name</th>
                  <th className="text-left px-2 py-1">Station</th>
                  <th className="text-center px-2 py-1">Approved</th>
                  <th className="text-center px-2 py-1">Dist</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r) => {
                  const zero = r.approvedRuns === 0
                  const posStyle = r.position === 1 ? { color: '#FFD700' } : r.position === 2 ? { color: '#C0C0C0' } : r.position === 3 ? { color: '#CD7F32' } : undefined
                  const rowBg = r.position === 1 ? 'bg-[#FFD700]/15' : r.position === 2 ? 'bg-[#C0C0C0]/15' : r.position === 3 ? 'bg-[#CD7F32]/15' : (zero ? 'bg-danger-500/10' : '')
                  return (
                    <tr key={r.serviceNumber} className={`border-t border-primary-700 ${rowBg}`}>
                      <td style={posStyle} className={`px-2 py-1 ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.position}</td>
                      <td className={`px-2 py-1 ${zero ? 'text-danger-400' : 'text-white'} whitespace-normal break-words`}>{r.name}</td>
                      <td className={`px-2 py-1 ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{STATION_MAP[r.station] || r.station}</td>
                      <td className={`px-2 py-1 text-center pdf-numeric ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.approvedRuns}</td>
                      <td className={`px-2 py-1 text-center pdf-numeric ${zero ? 'text-danger-400' : 'text-accent-400'} font-medium`}>{r.totalDistance.toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-primary-700 bg-primary-800/40">
          <div className="px-3 py-2 border-b border-primary-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-success-400" /><span className="text-primary-300 text-sm font-medium">Stations</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]" style={{ minWidth: 720 }}>
              <thead>
                <tr className="text-primary-500">
                  <th className="text-left px-3 py-2">Station</th>
                  <th className="text-center px-3 py-2">Runners</th>
                  <th className="text-center px-3 py-2">Runs</th>
                  <th className="text-center px-3 py-2">Distance</th>
                  <th className="text-center px-3 py-2">Performance %</th>
                </tr>
              </thead>
              <tbody>
                {stationBoard.map((s) => (
                  <tr key={s.station} className="border-t border-primary-700">
                    <td className="px-3 py-1 text-white">{s.station}</td>
                    <td className="px-3 py-1 text-center text-primary-300">{s.runners}</td>
                    <td className="px-3 py-1 text-center text-primary-300">{s.runCount}</td>
                    <td className="px-3 py-1 text-center text-success-400 font-medium">{s.totalDistance.toFixed(1)}</td>
                    <td className="px-3 py-1 text-center text-accent-400 font-medium">{s.performancePercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-2 text-center text-[11px] text-primary-500">This document is electronically generated and does not require a signature.</div>
      </div>

      <div ref={containerRef} data-report-container="true" className="hidden sm:flex mx-auto w-full sm:w-auto px-2 sm:px-0 flex-col items-center">
        <div ref={page1Ref} data-report-page="1" className="mx-auto bg-primary-900 overflow-hidden border border-primary-700" style={{ width: 794, height: 1123, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
          <div className="p-5">
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-accent-400 tracking-widest uppercase">Madaveli Police</p>
              <h2 className="font-display text-2xl font-bold text-white">100K Run Challenge Weekly Statistic Report</h2>
              <p className="text-primary-400 text-xs">Range: {startDate} → {endDate}</p>
            </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
              <div className="flex items-center gap-2 text-primary-300"><Trophy className="w-4 h-4 text-accent-400" /><span className="text-sm">Total Distance</span></div>
              <p className="font-display text-xl font-bold text-white">{totalDistance.toFixed(1)} km</p>
            </div>
            <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
              <div className="flex items-center gap-2 text-primary-300"><Users className="w-4 h-4 text-success-400" /><span className="text-sm">Approved Runs</span></div>
              <p className="font-display text-xl font-bold text-white">{totalApprovedRuns}</p>
            </div>
            <div className="p-3 rounded-xl bg-primary-800/50 border border-primary-700">
              <div className="flex items-center gap-2 text-primary-300"><Calendar className="w-4 h-4 text-warning-400" /><span className="text-sm">Rejected Runs</span></div>
              <p className="font-display text-xl font-bold text-white">{totalRejectedRuns}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl border border-primary-700 bg-primary-800/40">
              <div className="px-3 py-2 border-b border-primary-700 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent-400" /><span className="text-primary-300 text-sm font-medium">Leaderboard</span></div>
              <table className="text-xs table-fixed border-collapse" style={{ width: 754, tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '290px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '76px' }} />
                </colgroup>
                <thead>
                  <tr className="text-primary-500">
                    <th className="text-left px-2 py-1 align-middle">Pos</th>
                    <th className="text-left px-2 py-1 align-middle">Name</th>
                    <th className="text-left px-2 py-1 align-middle">Station</th>
                    <th className="text-center px-2 py-1 align-middle">Approved Runs</th>
                    <th className="text-center px-2 py-1 align-middle">Rejected Runs</th>
                    <th className="text-center px-2 py-1 align-middle">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, PAGE1_ROWS).map((r) => {
                    const zero = r.approvedRuns === 0
                    const posStyle = r.position === 1 ? { color: '#FFD700' } : r.position === 2 ? { color: '#C0C0C0' } : r.position === 3 ? { color: '#CD7F32' } : undefined
                    const rowBg = r.position === 1 ? 'bg-[#FFD700]/15' : r.position === 2 ? 'bg-[#C0C0C0]/15' : r.position === 3 ? 'bg-[#CD7F32]/15' : (zero ? 'bg-danger-500/10' : '')
                    return (
                      <tr key={r.serviceNumber} className={`border-t border-primary-700 ${rowBg}`}>
                        <td style={posStyle} className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.position}</td>
                        <td className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-white'} whitespace-normal break-words`}>{r.name}</td>
                        <td className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{STATION_MAP[r.station] || r.station}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.approvedRuns}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${r.rejectedRuns > 0 ? 'text-warning-400' : 'text-primary-300'}`}>{r.rejectedRuns}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${zero ? 'text-danger-400' : 'text-accent-400'} font-medium`}>{r.totalDistance.toFixed(1)}</td>
                  </tr>
                    )
                  })}
                </tbody>
              </table>
              {leaderboard.length > PAGE1_ROWS && (
                <div className="px-3 py-2 text-xs text-primary-500">Continued on Page 2</div>
              )}
            </div>
          </div>

            <div className="mt-4 text-center text-[11px] text-primary-500">
              This document is electronically generated and does not require a signature.
            </div>
          </div>
        </div>
        <div ref={page2Ref} data-report-page="2" className="mx-auto bg-primary-900 overflow-hidden border border-primary-700 mt-6" style={{ width: 794, height: 1123, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <div className="p-5">
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-accent-400 tracking-widest uppercase">Madaveli Police</p>
            <h2 className="font-display text-2xl font-bold text-white">Station Performance Statistics</h2>
            <p className="text-primary-400 text-xs">Range: {startDate} → {endDate}</p>
          </div>
          {/* Leaderboard continued on page 2 (compact) */}
          {leaderboard.length > PAGE1_ROWS && (
            <div className="rounded-xl border border-primary-700 bg-primary-800/40 mb-4">
              <div className="px-3 py-2 border-b border-primary-700 flex items-center gap-2"><Trophy className="w-4 h-4 text-accent-400" /><span className="text-primary-300 text-sm font-medium">Leaderboard (continued)</span></div>
              <table className="text-xs table-fixed border-collapse" style={{ width: 754, tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '290px' }} />
                  <col style={{ width: '170px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '76px' }} />
                </colgroup>
                <thead>
                  <tr className="text-primary-500">
                    <th className="text-left px-2 py-1 align-middle">Pos</th>
                    <th className="text-left px-2 py-1 align-middle">Name</th>
                    <th className="text-left px-2 py-1 align-middle">Station</th>
                    <th className="text-center px-2 py-1 align-middle">Approved Runs</th>
                    <th className="text-center px-2 py-1 align-middle">Rejected Runs</th>
                    <th className="text-center px-2 py-1 align-middle">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(PAGE1_ROWS).map((r) => {
                    const zero = r.approvedRuns === 0
                    const posStyle = r.position === 1 ? { color: '#FFD700' } : r.position === 2 ? { color: '#C0C0C0' } : r.position === 3 ? { color: '#CD7F32' } : undefined
                    const rowBg = r.position === 1 ? 'bg-[#FFD700]/15' : r.position === 2 ? 'bg-[#C0C0C0]/15' : r.position === 3 ? 'bg-[#CD7F32]/15' : (zero ? 'bg-danger-500/10' : '')
                    return (
                      <tr key={r.serviceNumber} className={`border-t border-primary-700 ${rowBg}`}>
                        <td style={posStyle} className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.position}</td>
                        <td className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-white'} whitespace-normal break-words`}>{r.name}</td>
                        <td className={`px-2 py-1 align-middle ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{STATION_MAP[r.station] || r.station}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${zero ? 'text-danger-400' : 'text-primary-300'}`}>{r.approvedRuns}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${r.rejectedRuns > 0 ? 'text-warning-400' : 'text-primary-300'}`}>{r.rejectedRuns}</td>
                        <td className={`px-2 py-1 text-center align-middle whitespace-nowrap pdf-numeric ${zero ? 'text-danger-400' : 'text-accent-400'} font-medium`}>{r.totalDistance.toFixed(1)}</td>
                  </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-xl border border-primary-700 bg-primary-800/40">
            <div className="px-3 py-2 border-b border-primary-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-success-400" /><span className="text-primary-300 text-sm font-medium">Stations</span></div>
            <table className="text-sm table-fixed border-collapse" style={{ tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums', width: 754 }}>
              <colgroup>
                <col style={{ width: '270px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '164px' }} />
              </colgroup>
              <thead>
                <tr className="text-primary-500">
                  <th className="text-left px-3 py-2 align-middle">Station</th>
                  <th className="text-center px-3 py-2 align-middle">Runners</th>
                  <th className="text-center px-3 py-2 align-middle">Runs</th>
                  <th className="text-center px-3 py-2 align-middle">Distance</th>
                  <th className="text-center px-3 py-2 align-middle">Performance %</th>
                </tr>
              </thead>
              <tbody>
                {stationBoard.map((s) => (
                  <tr key={s.station} className="border-t border-primary-700">
                    <td className="px-3 py-1 align-middle text-white">{s.station}</td>
                    <td className="px-3 py-1 align-middle text-center text-primary-300 whitespace-nowrap pdf-numeric">{s.runners}</td>
                    <td className="px-3 py-1 align-middle text-center text-primary-300 whitespace-nowrap pdf-numeric">{s.runCount}</td>
                    <td className="px-3 py-1 align-middle text-center text-success-400 font-medium whitespace-nowrap pdf-numeric">{s.totalDistance.toFixed(1)}</td>
                    <td className="px-3 py-1 align-middle text-center text-accent-400 font-medium whitespace-nowrap pdf-numeric">{s.performancePercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center text-[11px] text-primary-500">This document is electronically generated and does not require a signature.</div>
          </div>
        </div>
        </div>
    </div>
  )
}
