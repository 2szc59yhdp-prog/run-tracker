import { useState, useMemo, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Award, MapPin, Calendar, Hash, User, Clock, CheckCircle, XCircle, Image, Search, X, Building2, Trophy, Footprints, RefreshCw, Timer, Camera, ExternalLink, Medal, Plus, Info } from 'lucide-react';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { fetchAllUsers, addTshirtAdmission, getUserByServiceNumber, fetchTshirtAdmissions } from '../services/api';
import type { RunStatus, RegisteredUser } from '../types';

// Challenge dates
const CHALLENGE_START = new Date('2025-12-01T00:00:00');
const CHALLENGE_END = new Date('2026-01-31T23:59:59');

// All stations for Station Performance Board (police stations only)
const ALL_STATIONS = [
  'Thinadhoo City Police',
  'Gdh.Madaveli Police Station',
  'Gdh.Nadella Police Station',
  'Gdh.Rathafandhoo Police Station',
  'Gdh.Fiyoari Police Station',
  'Gdh.Faresmaathoda Police Station',
  'Gdh.Vaadhoo Police Station',
  'Gdh.Gadhdhoo Police Station',
];

// Status badge component (public view - no approver info shown)
function StatusBadge({ status, rejectionReason }: { 
  status: RunStatus; 
  rejectionReason?: string;
}) {
  const config = {
    pending: {
      icon: Clock,
      text: 'Pending',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    approved: {
      icon: CheckCircle,
      text: 'Approved',
      className: 'bg-success-500/20 text-success-400 border-success-500/30',
    },
    rejected: {
      icon: XCircle,
      text: 'Rejected',
      className: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
    },
  };

  const { icon: Icon, text, className } = config[status] || config.pending;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${className}`}>
        <Icon className="w-3 h-3" />
        {text}
      </span>
      {status === 'rejected' && rejectionReason && (
        <span className="text-xs text-danger-400/80 italic max-w-[200px] leading-tight">
          "{rejectionReason}"
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { runs, dashboardStats, runnerStats, recentRuns, isLoading, isRefreshing, error, refreshData, isParticipant, isAdmin } = useApp();
  const [serviceFilter, setServiceFilter] = useState('');
  const [leaderboardFilter, setLeaderboardFilter] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'before' as 'before' | 'active' | 'ended' });
  const [showParticipants, setShowParticipants] = useState(false);
  const [showTshirtModal, setShowTshirtModal] = useState(false);
  const [tshirtServiceNumber, setTshirtServiceNumber] = useState('');
  const [tshirtSize, setTshirtSize] = useState('M');
  const [tshirtSleeve, setTshirtSleeve] = useState<'Longsleeve' | 'Short Sleeve'>('Short Sleeve');
  const [tshirtSubmitting, setTshirtSubmitting] = useState(false);
  const [tshirtMessage, setTshirtMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedJourneyRunner, setSelectedJourneyRunner] = useState<{
    name: string;
    runs: { date: string; distance: number; cumulative: number }[];
    totalDistance: number;
    activeDays: number;
  } | null>(null);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      
      if (now < CHALLENGE_START) {
        // Before challenge starts - countdown to start
        const diff = CHALLENGE_START.getTime() - now.getTime();
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
          status: 'before'
        });
      } else if (now <= CHALLENGE_END) {
        // Challenge is active - countdown to end
        const diff = CHALLENGE_END.getTime() - now.getTime();
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
          status: 'active'
        });
      } else {
        // Challenge ended
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, status: 'ended' });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh data every 5 seconds (silent - no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData(true); // silent refresh
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Fetch registered users on mount and refresh every 5 seconds
  useEffect(() => {
    async function loadUsers() {
      const response = await fetchAllUsers();
      if (response.success && response.data) {
        setRegisteredUsers(response.data);
      }
    }
    loadUsers();

    // Also refresh users every 5 seconds
    const interval = setInterval(loadUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate participants by station from registered users (excluding General Admin)
  const participantsByStation = useMemo(() => {
    const counts = new Map<string, number>();
    
    // Initialize all stations with 0
    ALL_STATIONS.forEach(station => counts.set(station, 0));
    
    // Count registered users by station (exclude General Admin)
    registeredUsers.forEach(user => {
      if (user.station !== 'General Admin') {
        const current = counts.get(user.station) || 0;
        counts.set(user.station, current + 1);
      }
    });
    
    // Return in the specified order
    return ALL_STATIONS.map(station => ({
      station,
      count: counts.get(station) || 0,
    }));
  }, [registeredUsers]);

  // Total participants (excluding General Admin)
  const totalParticipants = useMemo(() => {
    return registeredUsers.filter(user => user.station !== 'General Admin').length;
  }, [registeredUsers]);

  // Constants for finisher criteria
  const MIN_DISTANCE_KM = 100; // Must reach 100km
  const MIN_ACTIVE_DAYS = 40;  // Must have at least 40 active days

  const TODAY_STR = new Date().toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' });

  const eliteRunners = useMemo(() => {
    return runnerStats.filter(r => r.totalDistance >= 100);
  }, [runnerStats]);

  const leaderboardRunners = useMemo(() => {
    return runnerStats.filter(r => r.totalDistance < 100);
  }, [runnerStats]);



  // Calculate station performance from runner stats
  // A "finisher" must: reach 100km AND have 40+ active days
  // Live progress = average of each runner's progress (min of distance% and days%)
  const openJourney = (runner: typeof eliteRunners[0]) => {
    // Filter approved runs for this runner
    const relevantRuns = runs
      .filter(r => r.serviceNumber === runner.serviceNumber && r.status === 'approved')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalDistance = 0;
    const activeDates = new Set<string>();
    const journeyRuns = [];
    
    for (const run of relevantRuns) {
      const distance = Number(run.distanceKm || 0);
      totalDistance += distance;
      // Precision fix
      totalDistance = Math.round(totalDistance * 100) / 100;
      activeDates.add(run.date);
      
      journeyRuns.push({
        date: run.date,
        distance: distance,
        cumulative: totalDistance
      });
      
      if (totalDistance >= 100) break;
    }

    setSelectedJourneyRunner({
      name: runner.name,
      runs: journeyRuns,
      totalDistance,
      activeDays: activeDates.size
    });
  };

  const stationPerformance = useMemo(() => {
    const stationMap = new Map<string, {
      distance: number;
      runners: number;
      runCount: number;
      finishers: number;
      participants: number;
      totalProgress: number;
      runnerProgresses: number[];
    }>();
    
    // Get participant count per station from registered users
    const participantCounts = new Map<string, number>();
    registeredUsers.forEach(user => {
      if (user.station && user.station !== 'General Admin') {
        participantCounts.set(user.station, (participantCounts.get(user.station) || 0) + 1);
      }
    });
    
    // Initialize all known stations
    ALL_STATIONS.forEach(station => {
      stationMap.set(station, {
        distance: 0,
        runners: 0,
        runCount: 0,
        finishers: 0,
        participants: participantCounts.get(station) || 0,
        totalProgress: 0,
        runnerProgresses: [],
      });
    });
    
    // Also add any stations from participant counts that aren't in ALL_STATIONS
    participantCounts.forEach((count, station) => {
      if (!stationMap.has(station)) {
        stationMap.set(station, {
          distance: 0,
          runners: 0,
          runCount: 0,
          finishers: 0,
          participants: count,
          totalProgress: 0,
          runnerProgresses: [],
        });
      }
    });
    
    const now = new Date();
    const endDate = now <= CHALLENGE_END ? now : CHALLENGE_END;
    const challengeDayCount = Math.floor((endDate.getTime() - CHALLENGE_START.getTime()) / 86400000) + 1;
    const startStr = CHALLENGE_START.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' });
    const endStr = endDate.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' });

    const runsByUser = new Map<string, { totalDistance: number; dates: Set<string>; runCount: number; station?: string }>();
    runs.forEach(run => {
      if (run.status !== 'approved' || !run.serviceNumber) return;
      const entry = runsByUser.get(run.serviceNumber) || { totalDistance: 0, dates: new Set<string>(), runCount: 0, station: run.station };
      entry.totalDistance += Number(run.distanceKm || 0);
      entry.dates.add(run.date);
      entry.runCount += 1;
      entry.station = run.station || entry.station;
      runsByUser.set(run.serviceNumber, entry);
    });

    const participants = registeredUsers.filter(u => u.station && u.station !== 'General Admin');
    participants.forEach(u => {
      const station = u.station;
      if (!station) return;
      if (!stationMap.has(station)) {
        stationMap.set(station, {
          distance: 0,
          runners: 0,
          runCount: 0,
          finishers: 0,
          participants: participantCounts.get(station) || 0,
          totalProgress: 0,
          runnerProgresses: [],
        });
      }
      const existing = stationMap.get(station)!;
      const entry = runsByUser.get(u.serviceNumber) || { totalDistance: 0, dates: new Set<string>(), runCount: 0, station };
      let coveredDays = 0;
      entry.dates.forEach(d => { if (d >= startStr && d <= endStr) coveredDays += 1; });
      const activeDays = coveredDays;
      const distanceProgress = Math.min((entry.totalDistance / MIN_DISTANCE_KM) * 100, 100);
      const daysProgress = Math.min((activeDays / MIN_ACTIVE_DAYS) * 100, 100);
      let runnerProgress = Math.min(distanceProgress, daysProgress);
      const dailyActive = challengeDayCount > 0 && coveredDays === challengeDayCount;
      if (dailyActive) {
        runnerProgress = Math.min(runnerProgress * 1.15, 100);
      }
      const isFinisher = entry.totalDistance >= MIN_DISTANCE_KM && activeDays >= MIN_ACTIVE_DAYS;
      const next = {
        distance: existing.distance + entry.totalDistance,
        runners: existing.runners + (entry.totalDistance > 0 ? 1 : 0),
        runCount: existing.runCount + entry.runCount,
        finishers: existing.finishers + (isFinisher ? 1 : 0),
        participants: existing.participants,
        totalProgress: existing.totalProgress + runnerProgress,
        runnerProgresses: [...existing.runnerProgresses, runnerProgress],
      };
      stationMap.set(station, next);
    });

    const todayApprovedActiveUsersByStation = new Map<string, Set<string>>();
    runs.forEach(run => {
      if (run.status === 'approved' && run.date === TODAY_STR && run.station && run.station !== 'General Admin') {
        const set = todayApprovedActiveUsersByStation.get(run.station) || new Set<string>();
        set.add(run.serviceNumber);
        todayApprovedActiveUsersByStation.set(run.station, set);
      }
    });

    // Stations to exclude from the performance board
    const excludedStations = ['General Admin', 'Gdh.Atoll Police', 'SPSR', 'SPSR RR&HV'];
    
    // Convert to array and sort by average progress (then by total distance as tiebreaker)
    // Show all stations in ALL_STATIONS even if they have 0 participants
    return Array.from(stationMap.entries())
      .filter(([station]) => !excludedStations.includes(station) && ALL_STATIONS.includes(station))
      .map(([station, data]) => {
        const sorted = [...data.runnerProgresses].sort((a, b) => b - a);
        const slots = 5;
        let sumTop = 0;
        for (let i = 0; i < slots; i++) {
          sumTop += sorted[i] ?? 0;
        }
        const performancePercent = sumTop / slots;
        return {
          station,
          totalDistance: data.distance,
          runners: data.runners,
          runCount: data.runCount,
          finishers: data.finishers,
          participants: data.participants,
          performancePercent,
          activeRunnersToday: (todayApprovedActiveUsersByStation.get(station)?.size || 0),
          runnerProgresses: data.runnerProgresses,
        };
      })
      .sort((a, b) => {
        // Sort by performance percentage first
        if (b.performancePercent !== a.performancePercent) {
          return b.performancePercent - a.performancePercent;
        }
        // Tiebreaker: total distance
        return b.totalDistance - a.totalDistance;
      });
  }, [runnerStats, registeredUsers, runs]);

  const consistentRunners = useMemo(() => {
    const now = new Date();
    const endDate = now <= CHALLENGE_END ? now : CHALLENGE_END;

    const allDays: string[] = [];
    const dayCursor = new Date(CHALLENGE_START);
    while (dayCursor <= endDate) {
      allDays.push(dayCursor.toLocaleDateString('sv-SE', { timeZone: 'Indian/Maldives' }));
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const datesByUser = new Map<string, Set<string>>();
    runs.forEach(run => {
      if (run.status !== 'approved' || !run.serviceNumber || run.station === 'General Admin') return;
      const set = datesByUser.get(run.serviceNumber) || new Set<string>();
      set.add(run.date);
      datesByUser.set(run.serviceNumber, set);
    });

    const participants = registeredUsers.filter(u => u.station !== 'General Admin');
    const result = participants.map(u => {
      const set = datesByUser.get(u.serviceNumber) || new Set<string>();
      let inactiveDays = 0;
      for (const d of allDays) {
        if (!set.has(d)) inactiveDays += 1;
      }
      let streak = 0;
      for (let i = allDays.length - 1; i >= 0; i--) {
        if (set.has(allDays[i])) streak += 1; else break;
      }
      const isDaily = inactiveDays === 0 && allDays.length > 0;
      const isConsistent = streak >= 5 || isDaily;
      return { serviceNumber: u.serviceNumber, name: u.name, station: u.station, streak, inactiveDays, isDaily, isConsistent };
    });

    return result.sort((a, b) => {
      if (a.isDaily !== b.isDaily) return a.isDaily ? -1 : 1;
      if (a.isConsistent !== b.isConsistent) return a.isConsistent ? -1 : 1;
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (a.inactiveDays !== b.inactiveDays) return a.inactiveDays - b.inactiveDays;
      return a.name.localeCompare(b.name);
    });
  }, [runs, registeredUsers]);


  // Show only today's runs (Maldives timezone) and then apply service filter
  const todayRuns = recentRuns.filter(run => run.date === TODAY_STR);
  const filteredRuns = serviceFilter.trim()
    ? todayRuns.filter(run => 
        run.serviceNumber.toLowerCase().includes(serviceFilter.toLowerCase()) ||
        run.name.toLowerCase().includes(serviceFilter.toLowerCase())
      )
    : todayRuns;

  // Process runs to add run labels (Run 1, Run 2) for same-day submissions
  // and sort to group same user's daily runs together
  const processedRuns = useMemo(() => {
    // First, count runs per user per day to assign labels
    const runCounts = new Map<string, number>();
    const runLabels = new Map<string, number>();
    
    // Sort by date desc, then by submittedAt asc (to get Run 1 before Run 2)
    const sortedRuns = [...filteredRuns].sort((a, b) => {
      // First sort by date descending
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // Then by service number to group same user's runs
      if (a.serviceNumber !== b.serviceNumber) {
        return a.serviceNumber.localeCompare(b.serviceNumber);
      }
      
      // Then by submittedAt ascending (Run 1 first)
      const aTime = a.submittedAt ? new Date(a.submittedAt.replace(' ', 'T')).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt.replace(' ', 'T')).getTime() : 0;
      return aTime - bTime;
    });
    
    // Assign run labels
    sortedRuns.forEach(run => {
      const key = `${run.serviceNumber}-${run.date}`;
      const currentCount = runCounts.get(key) || 0;
      runCounts.set(key, currentCount + 1);
      runLabels.set(run.id, currentCount + 1);
    });
    
    // Return runs with their labels
    return sortedRuns.map(run => ({
      ...run,
      runLabel: runLabels.get(run.id) || 1,
      totalRunsToday: runCounts.get(`${run.serviceNumber}-${run.date}`) || 1
    }));
  }, [filteredRuns]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <LoadingSpinner size="lg" message="Loading dashboard data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <Card className="text-center py-12">
          <p className="text-danger-500 text-lg mb-4">{error}</p>
          <Button onClick={() => refreshData()} variant="secondary">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format submission time (e.g., "10:30 AM")
  const formatTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr.replace(' ', 'T')); // Convert "YYYY-MM-DD HH:MM:SS" to ISO format
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Require login (participant or admin)
  if (!isParticipant && !isAdmin) {
    return <Navigate to="/participant-login" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
            Dashboard
          </h1>
          {isRefreshing && (
            <RefreshCw className="w-5 h-5 text-accent-400 animate-spin" />
          )}
          <div className="ml-auto">
            <Button onClick={() => setShowTshirtModal(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Tshirt
            </Button>
          </div>
        </div>
        <p className="text-primary-400">
          Team statistics and leaderboard
        </p>
      </div>

      {/* Countdown Timer */}
      <div className="mb-8 animate-fade-in">
        <Card className={`overflow-hidden ${countdown.status === 'active' ? 'border-success-500/30' : countdown.status === 'ended' ? 'border-primary-600' : 'border-accent-500/30'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Icon & Title - Icon hidden on mobile */}
            <div className="flex items-center gap-3">
              <div className={`hidden sm:flex p-3 rounded-xl ${countdown.status === 'active' ? 'bg-success-500/20' : countdown.status === 'ended' ? 'bg-primary-700' : 'bg-accent-500/20'}`}>
                <Timer className={`w-6 h-6 ${countdown.status === 'active' ? 'text-success-400' : countdown.status === 'ended' ? 'text-primary-400' : 'text-accent-400'}`} />
              </div>
              <div className="text-center">
                <p className={`font-display font-bold text-xl sm:text-lg ${countdown.status === 'active' ? 'text-success-400' : countdown.status === 'ended' ? 'text-primary-400' : 'text-accent-400'}`}>
                  {countdown.status === 'before' && <><span className="hidden sm:inline">🚀 </span>Challenge Starts In</>}
                  {countdown.status === 'active' && <><span className="hidden sm:inline">🏃 </span>Time Remaining</>}
                  {countdown.status === 'ended' && <><span className="hidden sm:inline">🏁 </span>Challenge Completed!</>}
                </p>
                <p className="text-sm sm:text-xs text-primary-500">
                  {countdown.status === 'before' && 'Dec 1, 2025 - Jan 31, 2026'}
                  {countdown.status === 'active' && 'Keep running until Jan 31, 2026!'}
                  {countdown.status === 'ended' && 'Thank you for participating!'}
                </p>
              </div>
            </div>

            {/* Countdown Numbers */}
            {countdown.status !== 'ended' && (
              <div className="flex gap-2 sm:gap-4 sm:ml-auto">
                <div className="flex flex-col items-center">
                  <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-xl flex items-center justify-center font-display text-2xl sm:text-3xl font-bold ${countdown.status === 'active' ? 'bg-success-500/20 text-success-400' : 'bg-accent-500/20 text-accent-400'}`}>
                    {String(countdown.days).padStart(2, '0')}
                  </div>
                  <span className="text-xs text-primary-500 mt-1">Days</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-xl flex items-center justify-center font-display text-2xl sm:text-3xl font-bold ${countdown.status === 'active' ? 'bg-success-500/20 text-success-400' : 'bg-accent-500/20 text-accent-400'}`}>
                    {String(countdown.hours).padStart(2, '0')}
                  </div>
                  <span className="text-xs text-primary-500 mt-1">Hours</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-xl flex items-center justify-center font-display text-2xl sm:text-3xl font-bold ${countdown.status === 'active' ? 'bg-success-500/20 text-success-400' : 'bg-accent-500/20 text-accent-400'}`}>
                    {String(countdown.minutes).padStart(2, '0')}
                  </div>
                  <span className="text-xs text-primary-500 mt-1">Mins</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-14 sm:w-16 h-14 sm:h-16 rounded-xl flex items-center justify-center font-display text-2xl sm:text-3xl font-bold ${countdown.status === 'active' ? 'bg-success-500/20 text-success-400' : 'bg-accent-500/20 text-accent-400'}`}>
                    {String(countdown.seconds).padStart(2, '0')}
                  </div>
                  <span className="text-xs text-primary-500 mt-1">Secs</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      

      {/* Photo Upload Button - Links to PhotoCircle */}
      <div className="mb-8 animate-fade-in">
        <a
          href="https://join.photocircleapp.com/R5W9BW072Z"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-bold rounded-xl shadow-lg shadow-accent-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] border border-accent-400/30"
        >
          <Camera className="w-6 h-6" />
          <span className="text-lg">Share Your Run Photos</span>
          <ExternalLink className="w-4 h-4 opacity-70" />
        </a>
        <p className="text-center text-primary-500 text-xs mt-2">
          Join our PhotoCircle to share your run memories!
        </p>
      </div>

      <div className="mb-8 animate-fade-in stagger-1">
        <Card className="!p-3 sm:!p-4">
          <div className="flex items-stretch gap-2 sm:gap-4">
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 sm:gap-2">
              <div className="p-1.5 sm:p-2 rounded-lg bg-accent-500/20 text-accent-400">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 text-center">
                <p className="text-[11px] sm:text-xs text-primary-500">Total Distance</p>
                <div className="font-display text-lg sm:text-xl font-bold text-white flex items-baseline justify-center gap-1">
                  <span>{dashboardStats.totalDistance.toFixed(1)}</span>
                  <span className="text-[11px] sm:text-xs text-primary-500">km</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 sm:gap-2">
              <div className="p-1.5 sm:p-2 rounded-lg bg-success-500/20 text-success-400">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 text-center">
                <p className="text-[11px] sm:text-xs text-primary-500">Unique Runners</p>
                <div className="font-display text-lg sm:text-xl font-bold text-white flex items-baseline justify-center">
                  <span>{dashboardStats.uniqueRunners}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 sm:gap-2">
              <div className="p-1.5 sm:p-2 rounded-lg bg-warning-500/20 text-warning-400">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 text-center">
                <p className="text-[11px] sm:text-xs text-primary-500">Approved Runs</p>
                <div className="font-display text-lg sm:text-xl font-bold text-white flex items-baseline justify-center">
                  <span>{dashboardStats.totalRuns}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {showTshirtModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">Add Tshirt</h2>
              <button onClick={() => { setShowTshirtModal(false); setTshirtMessage(null); }} className="text-primary-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {tshirtMessage && (
              <div className={`p-3 rounded-lg mb-4 ${tshirtMessage.type === 'success' ? 'bg-success-500/10 border border-success-500/30 text-success-400' : 'bg-danger-500/10 border border-danger-500/30 text-danger-400'}`}>
                {tshirtMessage.text}
              </div>
            )}
            <div className="space-y-4">
              <Input
                label="Service Number"
                value={tshirtServiceNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTshirtServiceNumber(e.target.value)}
                placeholder="e.g., 5568"
              />
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-1">Tshirt Size</label>
                <select
                  value={tshirtSize}
                  onChange={(e) => setTshirtSize(e.target.value)}
                  className="w-full bg-primary-900 border border-primary-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                  <option value="XXXL">XXXL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-1">Sleeve Type</label>
                <select
                  value={tshirtSleeve}
                  onChange={(e) => setTshirtSleeve(e.target.value as 'Longsleeve' | 'Short Sleeve')}
                  className="w-full bg-primary-900 border border-primary-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="Short Sleeve">Short Sleeve</option>
                  <option value="Longsleeve">Longsleeve</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => { setShowTshirtModal(false); setTshirtMessage(null); }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setTshirtMessage(null);
                    const sn = tshirtServiceNumber.trim();
                    if (!sn) {
                      setTshirtMessage({ type: 'error', text: 'Service number is required' });
                      return;
                    }
                    setTshirtSubmitting(true);
                    try {
                      const userRes = await getUserByServiceNumber(sn);
                      if (!userRes.success || !userRes.data) {
                        setTshirtMessage({ type: 'error', text: 'Service number is not registered' });
                        setTshirtSubmitting(false);
                        return;
                      }
                      const existingRes = await fetchTshirtAdmissions();
                      if (existingRes.success && existingRes.data && existingRes.data.some(a => a.serviceNumber === sn)) {
                        setTshirtMessage({ type: 'error', text: 'You have already submitted a Tshirt request' });
                        setTshirtSubmitting(false);
                        return;
                      }
                      const res = await addTshirtAdmission({ serviceNumber: sn, size: tshirtSize, sleeveType: tshirtSleeve });
                      if (res.success) {
                        setTshirtServiceNumber('');
                        setTshirtSize('M');
                        setTshirtSleeve('Short Sleeve');
                        setShowTshirtModal(false);
                      } else {
                        setTshirtMessage({ type: 'error', text: res.error || 'Failed to submit' });
                      }
                    } catch {
                      setTshirtMessage({ type: 'error', text: 'An error occurred' });
                    } finally {
                      setTshirtSubmitting(false);
                    }
                  }}
                  loading={tshirtSubmitting}
                >
                  Submit
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowParticipants((v) => !v)}
          icon={<Users className="w-4 h-4" />}
          aria-pressed={showParticipants}
          className={`w-full py-4 px-6 from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-600/25 focus:ring-warning-500 ${showParticipants ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-primary-900' : ''}`}
        >
          {showParticipants ? 'Hide Participants' : 'Participants'}
        </Button>
      </div>

      <div
        aria-hidden={!showParticipants}
        className={`mb-6 transition-all duration-300 ${showParticipants ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0'} overflow-hidden`}
      >
        <Card className="!p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success-500/20 text-success-500">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="font-display text-lg font-semibold text-white">Participants</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-500">Total:</span>
              <span className="font-display text-xl font-bold text-success-400">{totalParticipants}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
            {participantsByStation.map((item) => (
              <div key={item.station} className="flex items-center justify-between py-1.5 border-b border-primary-700/30 last:border-0">
                <span className="text-sm text-primary-300 truncate mr-2">{item.station}</span>
                <span className={`flex-shrink-0 text-sm font-display font-bold ${item.count > 0 ? 'text-success-400' : 'text-primary-600'}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="animate-fade-in stagger-3">
          <div className="relative">
            <style>{`@keyframes pulseGlow{0%,100%{opacity:.25;filter:drop-shadow(0 0 6px rgba(34,197,94,.35))}50%{opacity:.8;filter:drop-shadow(0 0 16px rgba(34,197,94,.7))}}`}</style>
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                padding: '2px',
                background: 'linear-gradient(0deg, rgba(34,197,94,0.9), rgba(34,197,94,0.9))',
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'pulseGlow 4s ease-in-out infinite'
              }}
            />
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success-500/20 text-success-400">
                  <Medal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-white">Elite Runners</h2>
                  <p className="text-xs text-primary-500">Completed 100K distance</p>
                </div>
              </div>

              {eliteRunners.length === 0 ? (
                <p className="text-primary-400 text-center py-8">No elite runners yet.</p>
              ) : (
                <div className="space-y-1">
                  <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {eliteRunners.map((runner, index) => (
                      <div
                        key={runner.serviceNumber}
                        className={`
                          flex items-center gap-3 py-2 px-3 rounded-lg transition-all
                          ${index === 0 ? 'bg-gradient-to-r from-success-500/20 to-success-500/5' : index === 1 ? 'bg-primary-700/20' : index === 2 ? 'bg-primary-700/10' : 'hover:bg-primary-800/20'}
                        `}
                      >
                        <div className={`
                          w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0
                          ${index === 0 ? 'bg-success-500 text-primary-900' : index === 1 ? 'bg-primary-400 text-primary-900' : index === 2 ? 'bg-orange-600 text-white' : 'bg-primary-700 text-primary-300'}
                        `}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white text-sm truncate">{runner.name}</p>
                            <span className="text-xs text-primary-500">#{runner.serviceNumber}</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-500/20 text-success-400 border border-success-500/30">
                              <Medal className="w-3 h-3" /> 100K
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-primary-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-[150px]">{runner.station}</span>
                            </span>
                            <span className="text-accent-400 flex items-center gap-0.5 flex-shrink-0">
                              <Footprints className="w-3 h-3" />
                              {runner.runCount} run{runner.runCount !== 1 ? 's' : ''}
                            </span>
                            <span className="text-success-400 flex items-center gap-0.5 flex-shrink-0">
                              <TrendingUp className="w-3 h-3" />
                              {runner.totalDistance.toFixed(1)} km
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => openJourney(runner)}
                          variant="secondary"
                          size="sm"
                          className="hidden sm:flex ml-2 !py-1 !px-2 !text-xs whitespace-nowrap"
                        >
                          Run Info
                        </Button>
                        <button
                          onClick={() => openJourney(runner)}
                          className="sm:hidden p-2 text-primary-400 hover:text-white transition-colors"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Leaderboard - Only APPROVED runs */}
        <div className="animate-fade-in stagger-4">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning-500/20 text-warning-500">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-white">
                    Leaderboard
                  </h2>
                  <p className="text-xs text-primary-500">Based on approved runs only</p>
                </div>
              </div>
              
              {leaderboardRunners.length > 0 && (
                <div className="sm:ml-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" />
                    <input
                      type="text"
                      placeholder="Search name or #"
                      value={leaderboardFilter}
                      onChange={(e) => setLeaderboardFilter(e.target.value)}
                      className="w-full sm:w-44 pl-9 pr-8 py-2 bg-primary-800/50 border border-primary-700 rounded-lg text-white text-sm placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-warning-500/50 transition-all"
                    />
                    {leaderboardFilter && (
                      <button
                        onClick={() => setLeaderboardFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-500 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {leaderboardRunners.length === 0 ? (
              <p className="text-primary-400 text-center py-8">
                No approved runs yet. Be the first!
              </p>
            ) : (() => {
              const filteredRunners = leaderboardFilter
                ? leaderboardRunners.filter(runner => 
                    runner.name.toLowerCase().includes(leaderboardFilter.toLowerCase()) ||
                    runner.serviceNumber.toLowerCase().includes(leaderboardFilter.toLowerCase()) ||
                    runner.station.toLowerCase().includes(leaderboardFilter.toLowerCase())
                  )
                : leaderboardRunners;
              
              if (filteredRunners.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-primary-400 mb-2">No runners found for "{leaderboardFilter}"</p>
                    <button
                      onClick={() => setLeaderboardFilter('')}
                      className="text-warning-400 hover:text-warning-300 text-sm underline"
                    >
                      Clear filter
                    </button>
                  </div>
                );
              }
              
              return (
              <div className="space-y-1">
                {leaderboardFilter && (
                  <p className="text-xs text-primary-500 mb-3">
                    Showing {filteredRunners.length} of {leaderboardRunners.length} runners
                  </p>
                )}
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                {filteredRunners.map((runner) => {
                  const originalRank = leaderboardRunners.findIndex(r => r.serviceNumber === runner.serviceNumber);
                  return (
                  <div
                    key={runner.serviceNumber}
                    className={`
                      flex items-center gap-3 py-2 px-3 rounded-lg transition-all
                      ${originalRank === 0 ? 'bg-gradient-to-r from-warning-500/20 to-warning-500/5' : 
                        originalRank === 1 ? 'bg-primary-700/20' :
                        originalRank === 2 ? 'bg-primary-700/10' :
                        'hover:bg-primary-800/20'}
                    `}
                  >
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0
                      ${originalRank === 0 ? 'bg-warning-500 text-primary-900' :
                        originalRank === 1 ? 'bg-primary-400 text-primary-900' :
                        originalRank === 2 ? 'bg-orange-600 text-white' :
                        'bg-primary-700 text-primary-300'}
                    `}>
                      {originalRank + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm truncate">
                          {runner.name}
                        </p>
                        <span className="text-xs text-primary-500">#{runner.serviceNumber}</span>
                        {runner.totalDistance >= 100 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-500/20 text-success-400 border border-success-500/30">
                            <Medal className="w-3 h-3" /> 100K
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-primary-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-[150px]">{runner.station}</span>
                        </span>
                        <span className="text-accent-400 flex items-center gap-0.5 flex-shrink-0">
                          <Footprints className="w-3 h-3" />
                          {runner.runCount} run{runner.runCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 min-w-[90px]">
                      <p className="font-display font-bold text-white text-sm">
                        {runner.totalDistance.toFixed(2)}
                        <span className="text-xs text-primary-500 font-normal">/ 100 km</span>
                      </p>
                      <p className="text-xs text-primary-500">
                        {(100 - runner.totalDistance).toFixed(2)} km left
                      </p>
                      <div className="w-full h-1 bg-primary-700 rounded-full overflow-hidden mt-0.5">
                        <div 
                          className={`h-full rounded-full ${
                            runner.totalDistance >= 100 ? 'bg-success-500' : originalRank === 0 ? 'bg-warning-500' : 'bg-accent-500'
                          }`}
                          style={{ width: `${Math.min((runner.totalDistance / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
              );
            })()}
          </Card>
        </div>

        <div className="animate-fade-in stagger-4">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success-500/20 text-success-400">
                  <Footprints className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-white">
                    Consistent Runners
                  </h2>
                  <p className="text-xs text-primary-500">Consistency status for all participants</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/active-days')} 
                size="sm" 
                variant="secondary" 
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Active Days</span>
              </Button>
            </div>

            <div className="mb-4 p-3 bg-primary-800/30 rounded-lg text-xs text-primary-400">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-60 blur-[1px] animate-pulse"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.85)] animate-pulse"></span>
                  </span>
                  <span className="text-primary-300">- Daily Runners since beginning of challenge</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-warning-400 opacity-60 blur-[1px] animate-pulse"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.85)] animate-pulse"></span>
                  </span>
                  <span className="text-primary-300">- Previously In-active, now reclassified as active after five active days</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-60 blur-[1px] animate-pulse"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger-500 shadow-[0_0_8px_rgba(239,68,68,0.85)] animate-pulse"></span>
                  </span>
                  <span className="text-primary-300">- In-active</span>
                </div>
              </div>
            </div>

            {consistentRunners.length === 0 ? (
              <p className="text-primary-400 text-center py-8">No consistent runners yet.</p>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-primary-700">
                          <th className="text-left py-3 px-3 text-primary-400 font-medium text-sm">Name</th>
                          <th className="text-left py-3 px-3 text-primary-400 font-medium text-sm">Service #</th>
                          <th className="text-left py-3 px-3 text-primary-400 font-medium text-sm">Station</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Streak</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consistentRunners.map((r) => (
                          <tr key={r.serviceNumber} className="border-b border-primary-700/50">
                            <td className="py-3 px-3 text-white text-sm">{r.name}</td>
                            <td className="py-3 px-3 text-primary-400 text-sm">#{r.serviceNumber}</td>
                            <td className="py-3 px-3 text-primary-300 text-sm">{r.station}</td>
                            <td className="py-3 px-3 text-center text-white font-display font-semibold">{r.streak}</td>
                            <td className="py-3 px-3 text-center">
                              {(() => {
                                const daily = r.isDaily;
                                const consistent = r.isConsistent && !daily;
                                const textClass = daily
                                  ? 'text-success-400'
                                  : consistent
                                    ? 'text-yellow-400'
                                    : 'text-danger-400';
                                return (
                                  <span className={`${textClass} text-sm font-medium`}>
                                    {daily ? 'Daily' : consistent ? 'Consistent' : `In-active ${r.inactiveDays}`}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="sm:hidden space-y-1">
                  {consistentRunners.map((r) => (
                    <div key={r.serviceNumber} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-primary-800/20">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white text-sm truncate">{r.name}</p>
                          <span className="text-xs text-primary-500">#{r.serviceNumber}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-primary-400">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[180px] sm:max-w-[220px]">{r.station}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(() => {
                          const daily = r.isDaily;
                          const consistent = r.isConsistent && !daily;
                          const pingClass = daily ? 'bg-success-400' : consistent ? 'bg-warning-400' : 'bg-danger-400';
                          const dotClass = daily ? 'bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.85)]' : consistent ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.85)]' : 'bg-danger-500 shadow-[0_0_8px_rgba(239,68,68,0.85)]';
                          const textClass = daily ? 'text-success-400' : consistent ? 'text-yellow-400' : 'text-danger-400';
                          return (
                            <>
                              <span className="relative flex h-2.5 w-2.5">
                                <span className={`absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-60 blur-[1px] animate-pulse`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass} animate-pulse`}></span>
                              </span>
                              <span className={`${textClass} text-xs font-medium`}>
                                {daily ? 'Daily' : consistent ? 'Consistent' : `In-active ${r.inactiveDays} day${r.inactiveDays !== 1 ? 's' : ''}`}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="animate-fade-in stagger-5">
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-accent-500/20 to-purple-500/20 text-accent-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-white">
                  Station Performance Board
                </h2>
                <p className="text-xs text-primary-500">Compare progress across all stations</p>
              </div>
            </div>

            {stationPerformance.length === 0 ? (
              <p className="text-primary-400 text-center py-8">No station data available yet.</p>
            ) : (
              <>
                <div className="mb-4 p-3 bg-primary-800/30 rounded-lg text-xs text-primary-400">
                  <p className="font-medium text-primary-300 mb-1">Performance % Criteria:</p>
                  <p>• Calculated using the top 5 runners from each station</p>
                  <p>• Missing slots count as zero</p>
                  <p>• Based only on approved runs</p>
                  <p>• Runner progress is measured by completing <span className="text-accent-400 font-medium">{MIN_DISTANCE_KM} KM</span> and achieving <span className="text-accent-400 font-medium">{MIN_ACTIVE_DAYS} active days</span></p>
                </div>
                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-primary-700">
                          <th className="text-left py-3 px-3 text-primary-400 font-medium text-sm">Rank</th>
                          <th className="text-left py-3 px-3 text-primary-400 font-medium text-sm">Station</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Participants</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Active Today</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Finishers</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Total Distance</th>
                          <th className="text-center py-3 px-3 text-primary-400 font-medium text-sm">Performance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stationPerformance.map((station, index) => (
                          <tr key={station.station} className="border-b border-primary-700/50">
                            <td className="py-3 px-3 text-white text-sm">{index + 1}</td>
                            <td className="py-3 px-3 text-white text-sm">{station.station}</td>
                            <td className="py-3 px-3 text-center text-primary-300 text-sm">{station.participants}</td>
                            <td className="py-3 px-3 text-center text-warning-400 text-sm">{station.activeRunnersToday}</td>
                            <td className="py-3 px-3 text-center text-success-400 text-sm">{station.finishers}</td>
                            <td className="py-3 px-3 text-center text-accent-400 text-sm">{station.totalDistance.toFixed(1)} km</td>
                            <td className="py-3 px-3 text-center text-white font-display font-semibold">{station.performancePercent.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="sm:hidden space-y-1">
                  {stationPerformance.map((station, index) => {
                    const isLeader = index === 0 && station.performancePercent > 0;
                    return (
                      <div key={station.station} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all ${isLeader ? 'bg-gradient-to-r from-accent-500/20 to-purple-500/10' : index === 1 ? 'bg-primary-700/20' : index === 2 ? 'bg-primary-700/10' : 'hover:bg-primary-800/20'}`}>
                        <div className={`${isLeader ? 'bg-gradient-to-br from-accent-400 to-purple-500 text-white' : index === 1 ? 'bg-primary-400 text-primary-900' : index === 2 ? 'bg-orange-600 text-white' : 'bg-primary-700 text-primary-300'} w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0`}>{isLeader ? <Trophy className="w-4 h-4" /> : index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isLeader ? 'text-accent-400' : 'text-white'}`}>{station.station}</p>
                          <div className="flex items-center gap-2 text-xs text-primary-400">
                            <span>{station.participants} participants</span>
                            <span className="text-warning-400">{station.activeRunnersToday} active today</span>
                            {station.finishers > 0 && <span className="text-success-400">{station.finishers} finished</span>}
                            <span className="text-accent-400">{station.totalDistance.toFixed(1)} km</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-display font-bold text-white">{station.performancePercent.toFixed(1)}%</p>
                          <div className="w-16 h-1 bg-primary-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${station.performancePercent >= 100 ? 'bg-success-500' : isLeader ? 'bg-accent-500' : 'bg-accent-500'}`} style={{ width: `${Math.min(station.performancePercent, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-primary-700/50 text-xs text-primary-500 text-center">Total team distance: <span className="text-white font-medium">{stationPerformance.reduce((sum, s) => sum + s.totalDistance, 0).toFixed(1)} km</span></div>
              </>
            )}
          </Card>
        </div>

        {/* Recent Runs - Shows ALL runs with status */}
        <div className="animate-fade-in stagger-5">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent-600/20 text-accent-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-white">
                    Recent Runs
                  </h2>
                  <p className="text-xs text-primary-500">All submissions with approval status</p>
                </div>
              </div>
              
              {/* Filter Input */}
              <div className="sm:ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" />
                  <input
                    type="text"
                    placeholder="Filter by service # or name"
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="w-full sm:w-56 pl-9 pr-8 py-2 bg-primary-800/50 border border-primary-700 rounded-lg text-white text-sm placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500 transition-all"
                  />
                  {serviceFilter && (
                    <button
                      onClick={() => setServiceFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {recentRuns.length === 0 ? (
              <p className="text-primary-400 text-center py-8">
                No runs recorded yet.
              </p>
            ) : filteredRuns.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-primary-400 mb-2">No runs found for "{serviceFilter}"</p>
                <button
                  onClick={() => setServiceFilter('')}
                  className="text-accent-400 hover:text-accent-300 text-sm underline"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
                {/* Results count */}
                {serviceFilter && (
                  <p className="text-xs text-primary-500 mb-3">
                    Showing {processedRuns.length} of {todayRuns.length} runs
                  </p>
                )}
                
                {/* Desktop Table */}
                <table className="w-full hidden sm:table">
                  <thead>
                    <tr className="border-b border-primary-700">
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Submitted</th>
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Name</th>
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Station</th>
                      <th className="text-right py-3 px-2 text-primary-400 font-medium text-sm">Distance</th>
                      <th className="text-center py-3 px-2 text-primary-400 font-medium text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRuns.map((run) => (
                      <tr key={run.id} className={`border-b border-primary-700/50 hover:bg-primary-700/20 ${run.runLabel === 2 ? 'bg-primary-800/30' : ''}`}>
                        <td className="py-3 px-2 text-sm">
                          <div>
                            <p className="text-primary-300">{formatDate(run.date)}</p>
                            <div className="flex items-center gap-2">
                              {run.submittedAt && (
                                <span className="text-primary-500 text-xs">{formatTime(run.submittedAt)}</span>
                              )}
                              {run.totalRunsToday > 1 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  run.runLabel === 1 ? 'bg-accent-500/20 text-accent-400' : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  Run {run.runLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {run.photoUrl && (
                              <a 
                                href={run.photoUrl.replace('thumbnail', 'uc').replace('&sz=w400', '')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-accent-400 hover:text-accent-300"
                                title="View proof"
                              >
                                <Image className="w-4 h-4" />
                              </a>
                            )}
                            <div>
                              <p className="text-white font-medium text-sm">{run.name}</p>
                              <p className="text-primary-500 text-xs">#{run.serviceNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-primary-300 text-sm">{run.station}</td>
                        <td className="py-3 px-2 text-right font-display font-semibold text-white">
                          {(run.distanceDisplay && run.distanceDisplay.trim() !== '' ? run.distanceDisplay : run.distanceKm.toFixed(2))} km
                        </td>
                        <td className="py-3 px-2 text-center">
                          <StatusBadge 
                            status={run.status || 'pending'} 
                            rejectionReason={run.rejectionReason}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3">
                  {processedRuns.map((run) => (
                    <div
                      key={run.id}
                      className={`p-4 rounded-xl border ${run.runLabel === 2 ? 'bg-primary-800/40 border-purple-500/30' : 'bg-primary-700/20 border-primary-700/30'}`}
                    >
                      {/* Run Label - shown at top if multiple runs */}
                      {run.totalRunsToday > 1 && (
                        <div className="mb-2">
                          <span className={`text-xs px-2 py-1 rounded font-bold ${
                            run.runLabel === 1 ? 'bg-accent-500/20 text-accent-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            RUN {run.runLabel} of {run.totalRunsToday}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {run.photoUrl && (
                            <a 
                              href={run.photoUrl.replace('thumbnail', 'uc').replace('&sz=w400', '')} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-accent-400 hover:text-accent-300 flex-shrink-0"
                            >
                              <Image className="w-4 h-4" />
                            </a>
                          )}
                          <User className="w-4 h-4 text-primary-400 flex-shrink-0" />
                          <span className="font-medium text-white truncate">{run.name}</span>
                        </div>
                        <span className="font-display font-bold text-accent-400 flex-shrink-0">
                          {(run.distanceDisplay && run.distanceDisplay.trim() !== '' ? run.distanceDisplay : run.distanceKm.toFixed(2))} km
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary-400 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(run.date)}
                          {run.submittedAt && (
                            <span className="text-primary-500">• {formatTime(run.submittedAt)}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {run.serviceNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {run.station}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-primary-700/50">
                        <StatusBadge 
                          status={run.status || 'pending'} 
                          rejectionReason={run.rejectionReason}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* The Journey Modal */}
      {selectedJourneyRunner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999] overflow-y-auto">
          <div className="bg-primary-900 border border-primary-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in relative z-[100000] my-8 flex flex-col max-h-[90vh]">
            {/* Header with decorative background */}
            <div className="relative p-6 sm:p-8 bg-gradient-to-br from-primary-800 to-primary-900 border-b border-primary-700 shrink-0">
              <div className="absolute top-0 right-0 p-4">
                <button
                  onClick={() => setSelectedJourneyRunner(null)}
                  className="p-2 bg-primary-800/50 hover:bg-primary-700 text-primary-400 hover:text-white rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="p-3 sm:p-4 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                  <Award className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
                    The Journey
                  </h2>
                  <p className="text-primary-300 text-sm sm:text-base leading-relaxed max-w-xl">
                    Every step tells a story of discipline, consistency, and self-growth. This is more than distance, it’s the journey of becoming stronger, fitter, and more accountable.
                  </p>
                </div>
              </div>

              {/* Runner Stats Summary */}
              <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-primary-700/50">
                <div>
                  <p className="text-xs text-primary-500 uppercase tracking-wider mb-1">Runner</p>
                  <p className="text-white font-semibold">{selectedJourneyRunner.name}</p>
                </div>
                <div className="w-px h-10 bg-primary-700/50 hidden sm:block"></div>
                <div>
                  <p className="text-xs text-primary-500 uppercase tracking-wider mb-1">Total Distance</p>
                  <p className="text-accent-400 font-display font-bold text-lg">{selectedJourneyRunner.totalDistance} km</p>
                </div>
                <div className="w-px h-10 bg-primary-700/50 hidden sm:block"></div>
                <div>
                  <p className="text-xs text-primary-500 uppercase tracking-wider mb-1">Active Days</p>
                  <p className="text-warning-400 font-display font-bold text-lg">{selectedJourneyRunner.activeDays}</p>
                </div>
              </div>
            </div>

            {/* Run History List */}
            <div className="flex-1 overflow-y-auto bg-primary-900/50 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-primary-800/50 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 sm:px-6 text-xs font-semibold text-primary-400 uppercase tracking-wider border-b border-primary-700">Date</th>
                    <th className="py-3 px-4 sm:px-6 text-xs font-semibold text-primary-400 uppercase tracking-wider border-b border-primary-700 text-right">Distance</th>
                    <th className="py-3 px-4 sm:px-6 text-xs font-semibold text-primary-400 uppercase tracking-wider border-b border-primary-700 text-right">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-800/50">
                  {selectedJourneyRunner.runs.map((run, idx) => (
                    <tr 
                      key={idx}
                      className="hover:bg-primary-800/30 transition-colors group"
                    >
                      <td className="py-3 px-4 sm:px-6 text-sm text-primary-300">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary-800 flex items-center justify-center text-[10px] text-primary-500 font-mono">
                            {idx + 1}
                          </span>
                          {formatDate(run.date)}
                        </div>
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-sm text-white font-medium text-right">
                        {run.distance} km
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-xs text-primary-500 font-mono w-16">
                            {run.cumulative.toFixed(2)} km
                          </span>
                          <div className="w-24 h-1.5 bg-primary-800 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className="h-full bg-accent-500 rounded-full transition-all duration-500 group-hover:bg-accent-400"
                              style={{ width: `${Math.min((run.cumulative / 100) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 bg-primary-800/30 border-t border-primary-700 text-center shrink-0">
              <p className="text-xs text-primary-500">
                Challenge completed on {formatDate(selectedJourneyRunner.runs[selectedJourneyRunner.runs.length - 1].date)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
