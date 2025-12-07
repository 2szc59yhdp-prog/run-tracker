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
      }
    >();

    STATION_ORDER.forEach((s) =>
      map.set(s, { totalDistance: 0, runners: 0, runCount: 0 })
    );

    // Aggregate by station
    leaderboard.forEach((lb) => {
      const mapped = STATION_MAP[lb.station];
      if (!mapped) return;

      const entry = map.get(mapped)!;
      entry.totalDistance += lb.totalDistance;
      entry.runners += lb.totalDistance > 0 ? 1 : 0;
      entry.runCount += lb.approvedRuns + lb.rejectedRuns;
    });

    return Array.from(map.entries()).map(([station, stats]) => ({
      station,
      ...stats,
    }));
  }, [leaderboard]);

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
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [794, 1123], // exact A4 px mapping
      });

      // Capture Page 1
      if (pdfPage1Ref.current) {
        const canvas = await html2canvas(pdfPage1Ref.current, {
          scale: 2,
          backgroundColor: "#0a0a0a", // dark mode base
        });
        const img = canvas.toDataURL("image/png");
        pdf.addImage(img, "PNG", 0, 0, 794, 1123);
      }

      pdf.addPage();

      // Capture Page 2
      if (pdfPage2Ref.current) {
        const canvas = await html2canvas(pdfPage2Ref.current, {
          scale: 2,
          backgroundColor: "#0a0a0a",
        });
        const img = canvas.toDataURL("image/png");
        pdf.addImage(img, "PNG", 0, 0, 794, 1123);
      }

      pdf.save(`Madaveli_Weekly_Report_${startDate}_to_${endDate}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  // -----------------------------
  //  HIDDEN PDF PAGES
  // -----------------------------
  const pdfPageStyle: React.CSSProperties = {
    width: "794px",
    height: "1123px",
    background: "#0a0a0a",
    color: "white",
    padding: "32px",
    position: "absolute",
    left: "-9999px",
    top: "0",
  };

  // -----------------------------
  //  UI START (UNCHANGED)
  // -----------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ------------------ PDF PAGE 1 ------------------ */}
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
          style={{ width: "100%", tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: "40px" }} />
            <col style={{ width: "220px" }} />
            <col style={{ width: "160px" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "80px" }} />
          </colgroup>

          <thead>
            <tr className="text-primary-400 border-b border-primary-700">
              <th className="text-left py-2">#</th>
              <th className="text-left">Name</th>
              <th className="text-left">Station</th>
              <th className="text-center">Approved</th>
              <th className="text-center">Rejected</th>
              <th className="text-center">KM</th>
            </tr>
          </thead>

          <tbody>
            {leaderboard.map((p) => (
              <tr key={p.serviceNumber} className="border-b border-primary-700">
                <td className="py-1">{p.position}</td>
                <td className="truncate">{p.name}</td>
                <td>{STATION_MAP[p.station] || p.station}</td>
                <td className="text-center">{p.approvedRuns}</td>
                <td className="text-center">{p.rejectedRuns}</td>
                <td className="text-center">{p.totalDistance.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-primary-500 text-xs mt-6">
          This document is electronically generated and does not require a
          signature.
        </p>
      </div>

      {/* ------------------ PDF PAGE 2 ------------------ */}
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
          style={{ width: "100%", tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: "240px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "100px" }} />
          </colgroup>

          <thead>
            <tr className="text-primary-400 border-b border-primary-700">
              <th className="text-left py-2">Station</th>
              <th className="text-center">Runners</th>
              <th className="text-center">Runs</th>
              <th className="text-center">KM</th>
              <th className="text-center">%</th>
            </tr>
          </thead>

          <tbody>
            {stationBoard.map((s) => (
              <tr key={s.station} className="border-b border-primary-700">
                <td className="py-1">{s.station}</td>
                <td className="text-center">{s.runners}</td>
                <td className="text-center">{s.runCount}</td>
                <td className="text-center">
                  {s.totalDistance.toFixed(1)}
                </td>
                <td className="text-center">
                  {((s.totalDistance / 500) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-primary-500 text-xs mt-6">
          This document is electronically generated and does not require a
          signature.
        </p>
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

      {/* — your original mobile + desktop UI continues untouched — */}

    </div>
  );
}
