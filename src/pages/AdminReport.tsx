import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";
import { useApp } from "../context/AppContext";
import { fetchAllUsers } from "../services/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { RegisteredUser } from "../types";

// -----------------------
//   CONSTANTS
// -----------------------

const STATION_ORDER = [
  "Thinadhoo City",
  "Madaveli",
  "Rathafandhoo",
  "Nadella",
  "Fiyoari",
  "Gadhdhoo",
  "Vaadhoo",
  "Faresmaathoda",
] as const;

const STATION_MAP: Record<string, (typeof STATION_ORDER)[number]> = {
  "Thinadhoo City Police": "Thinadhoo City",
  "Gdh.Madaveli Police Station": "Madaveli",
  "Gdh.Rathafandhoo Police Station": "Rathafandhoo",
  "Gdh.Nadella Police Station": "Nadella",
  "Gdh.Fiyoari Police Station": "Fiyoari",
  "Gdh.Gadhdhoo Police Station": "Gadhdhoo",
  "Gdh.Vaadhoo Police Station": "Vaadhoo",
  "Gdh.Faresmaathoda Police Station": "Faresmaathoda",
};

// -----------------------
//   COMPONENT START
// -----------------------

export default function AdminReport() {
  const { runs, isAdmin } = useApp();
  const navigate = useNavigate();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [startDate, setStartDate] = useState("2025-12-01");
  const [endDate, setEndDate] = useState("2026-01-31");
  const [generating, setGenerating] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const MIN_DISTANCE_KM = 100;
  const MIN_ACTIVE_DAYS = 40;

  // PDF page refs
  const pdfPage1Ref = useRef<HTMLDivElement>(null);
  const pdfPage2Ref = useRef<HTMLDivElement>(null);

  // -----------------------------
  //  SECURITY & AUTH
  // -----------------------------
  useEffect(() => {
    if (!isAdmin) {
      navigate("/admin-login");
      return;
    }

    (async () => {
      const res = await fetchAllUsers();
      if (res.success && res.data) setUsers(res.data);
    })();
  }, [isAdmin, navigate]);

  // -----------------------------
  //  FILTERED RUNS (BY DATE)
  // -----------------------------
  const filteredApproved = useMemo(() => {
    return runs.filter(
      (r) =>
        r.status === "approved" &&
        r.date >= startDate &&
        r.date <= endDate &&
        r.station !== "General Admin"
    );
  }, [runs, startDate, endDate]);

  const filteredRejected = useMemo(() => {
    return runs.filter(
      (r) =>
        r.status === "rejected" &&
        r.date >= startDate &&
        r.date <= endDate &&
        r.station !== "General Admin"
    );
  }, [runs, startDate, endDate]);

  // -----------------------------
  //  LEADERBOARD CALCULATION
  // -----------------------------
  const leaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        serviceNumber: string;
        name: string;
        station: string;
        totalDistance: number;
        approvedRuns: number;
        rejectedRuns: number;
      }
    >();

    // aggregate approved
    filteredApproved.forEach((r) => {
      const key = r.serviceNumber;
      const prev =
        map.get(key) || {
          serviceNumber: r.serviceNumber,
          name: r.name,
          station: r.station,
          totalDistance: 0,
          approvedRuns: 0,
          rejectedRuns: 0,
        };
      prev.totalDistance += Number(r.distanceKm || 0);
      prev.approvedRuns += 1;
      map.set(key, prev);
    });

    // aggregate rejected
    filteredRejected.forEach((r) => {
      const key = r.serviceNumber;
      const prev =
        map.get(key) || {
          serviceNumber: r.serviceNumber,
          name: r.name,
          station: r.station,
          totalDistance: 0,
          approvedRuns: 0,
          rejectedRuns: 0,
        };
      prev.rejectedRuns += 1;
      map.set(key, prev);
    });

    // ensure all users appear
    users.forEach((u) => {
      if (u.station !== "General Admin" && !map.has(u.serviceNumber)) {
        map.set(u.serviceNumber, {
          serviceNumber: u.serviceNumber,
          name: u.name,
          station: u.station,
          totalDistance: 0,
          approvedRuns: 0,
          rejectedRuns: 0,
        });
      }
    });

    // Sort by distance desc, then name
    const arr = Array.from(map.values()).sort(
      (a, b) =>
        b.totalDistance - a.totalDistance || a.name.localeCompare(b.name)
    );

    // Ranking logic
    let lastDistance = -1;
    let lastRank = 0;
    const positions = new Map<string, number>();

    arr.forEach((entry, idx) => {
      if (entry.totalDistance !== lastDistance) {
        lastDistance = entry.totalDistance;
        lastRank = idx + 1;
      }
      positions.set(entry.serviceNumber, lastRank);
    });

    return arr.map((e) => ({
      ...e,
      position: positions.get(e.serviceNumber)!,
    }));
  }, [filteredApproved, filteredRejected, users]);

  // -----------------------------
  //  STATION PERFORMANCE
  // -----------------------------
  const stationBoard = useMemo(() => {
    const map = new Map<
      (typeof STATION_ORDER)[number],
      {
        totalDistance: number;
        runners: number;
        runCount: number;
        participants: number;
        runnerProgresses: number[];
        performancePercent: number;
        finishers: number;
      }
    >();

    STATION_ORDER.forEach((s) =>
      map.set(s, { totalDistance: 0, runners: 0, runCount: 0, participants: 0, runnerProgresses: [], performancePercent: 0, finishers: 0 })
    );

    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDays: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      allDays.push(cursor.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' }));
      cursor.setDate(cursor.getDate() + 1);
    }
    const challengeDayCount = allDays.length;

    const datesByUser = new Map<string, Set<string>>();
    filteredApproved.forEach((r) => {
      const set = datesByUser.get(r.serviceNumber) || new Set<string>();
      set.add(r.date);
      datesByUser.set(r.serviceNumber, set);
    });

    const distanceByUser = new Map<string, number>();
    filteredApproved.forEach((r) => {
      distanceByUser.set(r.serviceNumber, (distanceByUser.get(r.serviceNumber) || 0) + Number(r.distanceKm || 0));
    });

    const participants = users.filter((u) => u.station !== 'General Admin');
    const participantsCountByStation = new Map<string, number>();
    participants.forEach((u) => {
      const mapped = STATION_MAP[u.station];
      if (!mapped) return;
      participantsCountByStation.set(mapped, (participantsCountByStation.get(mapped) || 0) + 1);
    });

    participants.forEach((u) => {
      const mapped = STATION_MAP[u.station];
      if (!mapped) return;
      const set = datesByUser.get(u.serviceNumber) || new Set<string>();
      let coveredDays = 0;
      for (const d of allDays) {
        if (set.has(d)) coveredDays += 1;
      }
      const totalDistanceForUser = distanceByUser.get(u.serviceNumber) || 0;
      const distanceProgress = Math.min((totalDistanceForUser / MIN_DISTANCE_KM) * 100, 100);
      const daysProgress = Math.min((coveredDays / MIN_ACTIVE_DAYS) * 100, 100);
      let runnerProgress = Math.min(distanceProgress, daysProgress);
      const dailyActive = challengeDayCount > 0 && coveredDays === challengeDayCount;
      if (dailyActive) {
        runnerProgress = Math.min(runnerProgress * 1.15, 100);
      }
      const finisher = totalDistanceForUser >= MIN_DISTANCE_KM && coveredDays >= MIN_ACTIVE_DAYS;

      const entry = map.get(mapped)!;
      entry.totalDistance += totalDistanceForUser;
      entry.runners += totalDistanceForUser > 0 ? 1 : 0;
      entry.runCount += (set.size || 0); // approximate run days
      entry.participants = participantsCountByStation.get(mapped) || 0;
      entry.runnerProgresses.push(runnerProgress);
      entry.finishers += finisher ? 1 : 0;
    });

    const result = Array.from(map.entries()).map(([station, stats]) => {
      const sorted = [...stats.runnerProgresses].sort((a, b) => b - a);
      const slots = 5;
      let sumTop = 0;
      for (let i = 0; i < slots; i++) {
        sumTop += sorted[i] ?? 0;
      }
      const performancePercent = sumTop / slots;
      return {
        station,
        totalDistance: stats.totalDistance,
        runners: stats.runners,
        runCount: stats.runCount,
        participants: stats.participants,
        runnerProgresses: stats.runnerProgresses,
        performancePercent,
        finishers: stats.finishers,
      };
    });

    return result.sort((a, b) => {
      if (b.performancePercent !== a.performancePercent) {
        return b.performancePercent - a.performancePercent;
      }
      return b.totalDistance - a.totalDistance;
    });
  }, [filteredApproved, users, startDate, endDate]);

  // -----------------------------
  //  TOTALS
  // -----------------------------
  const totalDistance = useMemo(
    () => filteredApproved.reduce((s, r) => s + Number(r.distanceKm || 0), 0),
    [filteredApproved]
  );
  const totalApprovedRuns = filteredApproved.length;
  const totalRejectedRuns = filteredRejected.length;

  // -----------------------------
  //  PDF GENERATOR (FIXED)
  // -----------------------------
  const generatePdf = async () => {
    setGenerating(true);

    try {
      if ((document as any).fonts && (document as any).fonts.ready) {
        await (document as any).fonts.ready;
      }
      setPdfMode(true);
      await new Promise((r) => requestAnimationFrame(r));
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [794, 1123], // exact A4 px mapping
      });

      // Capture Page 1
      if (pdfPage1Ref.current) {
        const canvas = await html2canvas(pdfPage1Ref.current, {
          scale: 2,
          backgroundColor: "#102a43",
          useCORS: true,
        });
        const img = canvas.toDataURL("image/png");
        pdf.addImage(img, "PNG", 0, 0, 794, 1123);
      }

      pdf.addPage();

      // Capture Page 2
      if (pdfPage2Ref.current) {
        const canvas = await html2canvas(pdfPage2Ref.current, {
          scale: 2,
          backgroundColor: "#102a43",
          useCORS: true,
        });
        const img = canvas.toDataURL("image/png");
        pdf.addImage(img, "PNG", 0, 0, 794, 1123);
      }

      pdf.save(`Madaveli_Weekly_Report_${startDate}_to_${endDate}.pdf`);
    } finally {
      setPdfMode(false);
      setGenerating(false);
    }
  };

  // -----------------------------
  //  HIDDEN PDF PAGES
  // -----------------------------
  const pdfPageStyle: React.CSSProperties = {
    width: "794px",
    height: "1123px",
    background: "#102a43",
    color: "#ffffff",
    padding: "32px",
    position: "absolute",
    top: "0",
    left: "0",
    opacity: pdfMode ? 1 : 0,
    visibility: pdfMode ? "visible" : "hidden",
    pointerEvents: "none",
    zIndex: pdfMode ? 9999 : -1,
  };

  // -----------------------------
  //  UI START (UNCHANGED)
  // -----------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ------------------ PDF PAGES (CAPTURE-ONLY) ------------------ */}
      <div className="pdf-capture" id="pdf-container">
      <div ref={pdfPage1Ref} style={pdfPageStyle}>
        <h2 className="text-xl font-bold text-accent-400 mb-1">
          Madaveli Police
        </h2>
        <h1 className="text-2xl font-bold">100K Run Challenge Report</h1>
        <p className="text-primary-300 text-sm mb-6">
          Range: {startDate} → {endDate}
        </p>

        {/* SUMMARY */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 border border-primary-700 rounded">
            <p className="text-primary-300 text-sm">Total Distance</p>
            <p className="text-2xl font-bold text-white">
              {totalDistance.toFixed(1)} km
            </p>
          </div>

          <div className="p-3 border border-primary-700 rounded">
            <p className="text-primary-300 text-sm">Approved Runs</p>
            <p className="text-2xl font-bold text-white">{totalApprovedRuns}</p>
          </div>

          <div className="p-3 border border-primary-700 rounded">
            <p className="text-primary-300 text-sm">Rejected Runs</p>
            <p className="text-2xl font-bold text-white">{totalRejectedRuns}</p>
          </div>
        </div>

        {/* LEADERBOARD */}
        <h3 className="text-lg font-bold text-accent-400 mb-2">Leaderboard</h3>
        <table
          className="text-sm"
          style={{ width: "754px", tableLayout: "fixed", fontVariantNumeric: "tabular-nums" }}
        >
          <colgroup>
            <col style={{ width: "48px" }} />
            <col style={{ width: "290px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "76px" }} />
          </colgroup>

          <thead>
            <tr className="text-primary-400 border-b border-primary-700">
              <th className="text-center py-2">#</th>
              <th className="text-center">Name</th>
              <th className="text-center">Station</th>
              <th className="text-center">Approved</th>
              <th className="text-center">Rejected</th>
              <th className="text-center">KM</th>
            </tr>
          </thead>

          <tbody>
            {leaderboard.map((p) => {
              const rowClass =
                p.totalDistance <= 0
                  ? 'bg-danger-500/10'
                  : p.position === 1
                  ? 'bg-yellow-500/10'
                  : p.position === 2
                  ? 'bg-gray-300/10'
                  : p.position === 3
                  ? 'bg-orange-600/10'
                  : '';
              return (
              <tr key={p.serviceNumber} className={`border-b border-primary-700 ${rowClass}`}>
                <td className="pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{p.position}</td>
                <td className="pdf-nowrap pdf-fix px-2 text-white text-center" style={{ lineHeight: "22px" }}>{p.name}</td>
                <td className="pdf-nowrap pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{STATION_MAP[p.station] || p.station}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{p.approvedRuns}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{p.rejectedRuns}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-accent-400 text-center font-bold" style={{ lineHeight: "22px" }}>{p.totalDistance.toFixed(1)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-center text-primary-500 text-xs mt-6">
          This document is electronically generated and does not require a
          signature.
        </p>
      </div>

      <div ref={pdfPage2Ref} style={pdfPageStyle}>
        <h2 className="text-xl font-bold text-accent-400 mb-1">
          Madaveli Police
        </h2>
        <h1 className="text-2xl font-bold">Station Performance</h1>
        <p className="text-primary-300 text-sm mb-6">
          Range: {startDate} → {endDate}
        </p>

        <table
          className="text-sm"
          style={{ width: "754px", tableLayout: "fixed", fontVariantNumeric: "tabular-nums" }}
        >
          <colgroup>
            <col style={{ width: "270px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "164px" }} />
          </colgroup>

          <thead>
            <tr className="text-primary-400 border-b border-primary-700">
              <th className="text-center py-2">Station</th>
              <th className="text-center">Runners</th>
              <th className="text-center">Runs</th>
              <th className="text-center">KM</th>
              <th className="text-center">%</th>
            </tr>
          </thead>

          <tbody>
            {stationBoard.map((s) => (
              <tr key={s.station} className="border-b border-primary-700">
                <td className="pdf-nowrap pdf-fix px-2 text-white text-center" style={{ lineHeight: "22px" }}>{s.station}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{s.runners}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-primary-300 text-center" style={{ lineHeight: "22px" }}>{s.runCount}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-success-400 text-center font-bold" style={{ lineHeight: "22px" }}>{s.totalDistance.toFixed(1)}</td>
                <td className="pdf-numeric pdf-nowrap pdf-fix px-2 text-accent-400 text-center font-bold" style={{ lineHeight: "22px" }}>{s.performancePercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-primary-500 text-xs mt-6">
          This document is electronically generated and does not require a
          signature.
        </p>
      </div>
      </div>

      {/* ------------------ ORIGINAL SCREEN UI (UNCHANGED) ------------------ */}

      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent-500/20 text-accent-400">
            <FileText className="w-5 h-5" />
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-white tracking-tight">
            100K Run Challenge Weekly Statistic Report
          </h1>
        </div>
        <Button
          onClick={generatePdf}
          disabled={generating}
          icon={<FileText className="w-4 h-4" />}
        >
          Download PDF
        </Button>
      </div>

      <Card className="mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div className="flex items-end">
            <Button variant="secondary" className="w-full" disabled>
              {filteredApproved.length + filteredRejected.length} runs in range
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-accent-500/20 text-accent-400">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl font-semibold text-white">Report Preview</h2>
        </div>
        <div className="space-y-6 overflow-x-auto">
          <div className="inline-block border border-primary-700 rounded-xl shadow-md" style={{ background: '#102a43' }}>
            <div style={{ width: 794, minHeight: 1123, padding: 32, color: '#ffffff' }}>
              <h2 className="text-xl font-bold text-accent-400 mb-1">Madaveli Police</h2>
              <h1 className="text-2xl font-bold">100K Run Challenge Report</h1>
              <p className="text-primary-300 text-sm mb-6">Range: {startDate} → {endDate}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-3 border border-primary-700 rounded">
                  <p className="text-primary-300 text-sm">Total Distance</p>
                  <p className="text-2xl font-bold text-white">{totalDistance.toFixed(1)} km</p>
                </div>
                <div className="p-3 border border-primary-700 rounded">
                  <p className="text-primary-300 text-sm">Approved Runs</p>
                  <p className="text-2xl font-bold text-white">{totalApprovedRuns}</p>
                </div>
                <div className="p-3 border border-primary-700 rounded">
                  <p className="text-primary-300 text-sm">Rejected Runs</p>
                  <p className="text-2xl font-bold text-white">{totalRejectedRuns}</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-accent-400 mb-2">Leaderboard</h3>
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
                <colgroup>
                  <col style={{ width: 48 }} />
                  <col style={{ width: 290 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 76 }} />
                </colgroup>
                <thead>
                  <tr className="text-primary-400 border-b border-primary-700">
                    <th className="text-center py-2">#</th>
                    <th className="text-center">Name</th>
                    <th className="text-center">Station</th>
                    <th className="text-center">Approved</th>
                    <th className="text-center">Rejected</th>
                    <th className="text-center">KM</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p) => {
                    const rowClass =
                      p.totalDistance <= 0
                        ? 'bg-danger-500/10'
                        : p.position === 1
                        ? 'bg-yellow-500/10'
                        : p.position === 2
                        ? 'bg-gray-300/10'
                        : p.position === 3
                        ? 'bg-orange-600/10'
                        : '';
                    return (
                      <tr key={p.serviceNumber} className={`border-b border-primary-700 ${rowClass}`}>
                        <td className="px-2 text-primary-300 text-center">{p.position}</td>
                        <td className="px-2 text-white text-center">{p.name}</td>
                        <td className="px-2 text-primary-300 text-center">{STATION_MAP[p.station] || p.station}</td>
                        <td className="px-2 text-primary-300 text-center">{p.approvedRuns}</td>
                        <td className="px-2 text-primary-300 text-center">{p.rejectedRuns}</td>
                        <td className="px-2 text-accent-400 text-center font-bold">{p.totalDistance.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="inline-block border border-primary-700 rounded-xl shadow-md" style={{ background: '#102a43' }}>
            <div style={{ width: 794, minHeight: 1123, padding: 32, color: '#ffffff' }}>
              <h2 className="text-xl font-bold text-accent-400 mb-1">Madaveli Police</h2>
              <h1 className="text-2xl font-bold">Station Performance</h1>
              <p className="text-primary-300 text-sm mb-6">Range: {startDate} → {endDate}</p>

              <table className="w-full text-sm" style={{ tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
                <colgroup>
                  <col style={{ width: 270 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 164 }} />
                </colgroup>
                <thead>
                  <tr className="text-primary-400 border-b border-primary-700">
                    <th className="text-center py-2">Station</th>
                    <th className="text-center">Runners</th>
                    <th className="text-center">Runs</th>
                    <th className="text-center">KM</th>
                    <th className="text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {stationBoard.map((s) => (
                    <tr key={s.station} className="border-b border-primary-700">
                      <td className="px-2 text-white text-center">{s.station}</td>
                      <td className="px-2 text-primary-300 text-center">{s.runners}</td>
                      <td className="px-2 text-primary-300 text-center">{s.runCount}</td>
                      <td className="px-2 text-success-400 text-center font-bold">{s.totalDistance.toFixed(1)}</td>
                      <td className="px-2 text-accent-400 text-center font-bold">{s.performancePercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* — your original mobile + desktop UI continues untouched — */}

    </div>
  );
}
