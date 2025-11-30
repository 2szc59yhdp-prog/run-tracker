import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Award, MapPin, Calendar, Hash, User, Clock, CheckCircle, XCircle, Image, Search, X, Building2, Trophy, Footprints } from 'lucide-react';
import Card, { StatCard } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { useApp } from '../context/AppContext';
import { fetchAllUsers } from '../services/api';
import type { RunStatus, RegisteredUser } from '../types';

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
  const { dashboardStats, runnerStats, recentRuns, isLoading, error, refreshData } = useApp();
  const [serviceFilter, setServiceFilter] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);

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

  // Calculate station performance from runner stats
  // A "finisher" must: reach 100km AND have 40+ active days
  // Live progress = average of each runner's progress (min of distance% and days%)
  const stationPerformance = useMemo(() => {
    const stationMap = new Map<string, { 
      distance: number; 
      runners: number; 
      runCount: number;
      finishers: number;
      participants: number;
      totalProgress: number; // Sum of all runners' progress percentages
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
        totalProgress: 0
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
          totalProgress: 0
        });
      }
    });
    
    // Process runner stats (from approved runs)
    runnerStats.forEach(runner => {
      if (!runner.station) return;
      
      // If station doesn't exist in map, add it
      if (!stationMap.has(runner.station)) {
        stationMap.set(runner.station, {
          distance: 0,
          runners: 0,
          runCount: 0,
          finishers: 0,
          participants: participantCounts.get(runner.station) || 0,
          totalProgress: 0
        });
      }
      
      const existing = stationMap.get(runner.station)!;
      
      // Calculate individual runner's progress
      // Progress is the MINIMUM of distance% and days% (since both are required)
      const distanceProgress = Math.min((runner.totalDistance / MIN_DISTANCE_KM) * 100, 100);
      const daysProgress = Math.min((runner.runCount / MIN_ACTIVE_DAYS) * 100, 100);
      const runnerProgress = Math.min(distanceProgress, daysProgress);
      
      // Check if this runner qualifies as a finisher (100% on both)
      const isFinisher = runner.totalDistance >= MIN_DISTANCE_KM && runner.runCount >= MIN_ACTIVE_DAYS;
      
      stationMap.set(runner.station, {
        distance: existing.distance + runner.totalDistance,
        runners: existing.runners + 1,
        runCount: existing.runCount + runner.runCount,
        finishers: existing.finishers + (isFinisher ? 1 : 0),
        participants: existing.participants,
        totalProgress: existing.totalProgress + runnerProgress,
      });
    });

    // Stations to exclude from the performance board
    const excludedStations = ['General Admin', 'Gdh.Atoll Police', 'SPSR', 'SPSR RR&HV'];
    
    // Convert to array and sort by average progress (then by total distance as tiebreaker)
    // Show all stations in ALL_STATIONS even if they have 0 participants
    return Array.from(stationMap.entries())
      .filter(([station]) => !excludedStations.includes(station) && ALL_STATIONS.includes(station))
      .map(([station, data]) => {
        // Average progress = total progress of active runners / total participants
        // This gives credit for runners who are making progress
        const avgProgress = data.participants > 0 ? data.totalProgress / data.participants : 0;
        
        return {
          station,
          totalDistance: data.distance,
          runners: data.runners,
          runCount: data.runCount,
          finishers: data.finishers,
          participants: data.participants,
          // Live performance = average progress of all participants toward finishing
          performancePercent: avgProgress,
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
  }, [runnerStats, registeredUsers]);


  // Filter recent runs by service number
  const filteredRuns = serviceFilter.trim()
    ? recentRuns.filter(run => 
        run.serviceNumber.toLowerCase().includes(serviceFilter.toLowerCase()) ||
        run.name.toLowerCase().includes(serviceFilter.toLowerCase())
      )
    : recentRuns;

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-primary-400">
          Team statistics and leaderboard
        </p>
      </div>

      {/* Stats Grid - Only counts APPROVED runs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in stagger-1">
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Total Distance"
          value={dashboardStats.totalDistance.toFixed(1)}
          suffix="km"
          colorClass="text-accent-400"
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Unique Runners"
          value={dashboardStats.uniqueRunners}
          colorClass="text-success-500"
        />
        <StatCard
          icon={<Award className="w-6 h-6" />}
          label="Approved Runs"
          value={dashboardStats.totalRuns}
          colorClass="text-warning-500"
        />
      </div>

      {/* Participants by Station - Compact List */}
      <div className="mb-6 animate-fade-in stagger-2">
        <Card className="!p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success-500/20 text-success-500">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                Participants
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-500">Total:</span>
              <span className="font-display text-xl font-bold text-success-400">{totalParticipants}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
            {participantsByStation.map((item) => (
              <div
                key={item.station}
                className="flex items-center justify-between py-1.5 border-b border-primary-700/30 last:border-0"
              >
                <span className="text-sm text-primary-300 truncate mr-2">{item.station}</span>
                <span className={`flex-shrink-0 text-sm font-display font-bold ${
                  item.count > 0 
                    ? 'text-success-400' 
                    : 'text-primary-600'
                }`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Leaderboard - Only APPROVED runs */}
        <div className="animate-fade-in stagger-3">
          <Card>
            <div className="flex items-center gap-3 mb-6">
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

            {runnerStats.length === 0 ? (
              <p className="text-primary-400 text-center py-8">
                No approved runs yet. Be the first!
              </p>
            ) : (
              <div className="space-y-1">
                {runnerStats.map((runner, index) => (
                  <div
                    key={runner.serviceNumber}
                    className={`
                      flex items-center gap-3 py-2 px-3 rounded-lg transition-all
                      ${index === 0 ? 'bg-gradient-to-r from-warning-500/20 to-warning-500/5' : 
                        index === 1 ? 'bg-primary-700/20' :
                        index === 2 ? 'bg-primary-700/10' :
                        'hover:bg-primary-800/20'}
                    `}
                  >
                    {/* Rank */}
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0
                      ${index === 0 ? 'bg-warning-500 text-primary-900' :
                        index === 1 ? 'bg-primary-400 text-primary-900' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-primary-700 text-primary-300'}
                    `}>
                      {index + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm truncate">
                          {runner.name}
                        </p>
                        <span className="text-xs text-primary-500">#{runner.serviceNumber}</span>
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

                    {/* Distance & Progress */}
                    <div className="text-right flex-shrink-0 min-w-[90px]">
                      <p className="font-display font-bold text-white text-sm">
                        {runner.totalDistance.toFixed(1)}
                        <span className="text-xs text-primary-500 font-normal">/ 100 km</span>
                      </p>
                      <p className="text-xs text-primary-500">
                        {(100 - runner.totalDistance).toFixed(1)} km left
                      </p>
                      <div className="w-full h-1 bg-primary-700 rounded-full overflow-hidden mt-0.5">
                        <div 
                          className={`h-full rounded-full ${
                            runner.totalDistance >= 100 ? 'bg-success-500' : index === 0 ? 'bg-warning-500' : 'bg-accent-500'
                          }`}
                          style={{ width: `${Math.min((runner.totalDistance / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Station Performance Board */}
        <div className="animate-fade-in stagger-4">
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
            <p className="text-primary-400 text-center py-8">
              No station data available yet.
            </p>
          ) : (
            <>
              {/* Legend */}
              <div className="mb-4 p-3 bg-primary-800/30 rounded-lg text-xs text-primary-400">
                <p className="font-medium text-primary-300 mb-1">Finisher Criteria (both required):</p>
                <p>• Reach at least <span className="text-accent-400 font-medium">{MIN_DISTANCE_KM} km</span> total distance</p>
                <p>• Have at least <span className="text-accent-400 font-medium">{MIN_ACTIVE_DAYS} active days</span></p>
                <p className="mt-2 text-primary-500 italic">Progress shows average completion toward both goals</p>
              </div>
              
              <div className="space-y-1">
                {stationPerformance.map((station, index) => {
                  const isLeader = index === 0 && station.performancePercent > 0;
                  
                  return (
                    <div
                      key={station.station}
                      className={`
                        flex items-center gap-3 py-2 px-3 rounded-lg transition-all
                        ${isLeader 
                          ? 'bg-gradient-to-r from-accent-500/20 to-purple-500/10' 
                          : index === 1 ? 'bg-primary-700/20' :
                            index === 2 ? 'bg-primary-700/10' :
                            'hover:bg-primary-800/20'}
                      `}
                    >
                      {/* Rank */}
                      <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0
                        ${isLeader 
                          ? 'bg-gradient-to-br from-accent-400 to-purple-500 text-white' 
                          : index === 1 ? 'bg-primary-400 text-primary-900' :
                            index === 2 ? 'bg-orange-600 text-white' :
                            'bg-primary-700 text-primary-300'}
                      `}>
                        {isLeader ? <Trophy className="w-4 h-4" /> : index + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${isLeader ? 'text-accent-400' : 'text-white'}`}>
                          {station.station}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-primary-400">
                          <span>{station.participants} participants</span>
                          <span className="text-success-400">{station.finishers} finished</span>
                          <span className="text-accent-400">{station.totalDistance.toFixed(1)} km</span>
                        </div>
                      </div>

                      {/* Performance */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-display font-bold text-white">
                          {station.performancePercent.toFixed(1)}%
                        </p>
                        <div className="w-16 h-1 bg-primary-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              station.performancePercent >= 100 ? 'bg-success-500' : isLeader ? 'bg-accent-500' : 'bg-accent-500'
                            }`}
                            style={{ width: `${Math.min(station.performancePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Distance Note */}
              <div className="mt-4 pt-4 border-t border-primary-700/50 text-xs text-primary-500 text-center">
                Total team distance: <span className="text-white font-medium">{stationPerformance.reduce((sum, s) => sum + s.totalDistance, 0).toFixed(1)} km</span>
              </div>
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
              <div className="overflow-x-auto">
                {/* Results count */}
                {serviceFilter && (
                  <p className="text-xs text-primary-500 mb-3">
                    Showing {filteredRuns.length} of {recentRuns.length} runs
                  </p>
                )}
                
                {/* Desktop Table */}
                <table className="w-full hidden sm:table">
                  <thead>
                    <tr className="border-b border-primary-700">
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Date</th>
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Name</th>
                      <th className="text-left py-3 px-2 text-primary-400 font-medium text-sm">Station</th>
                      <th className="text-right py-3 px-2 text-primary-400 font-medium text-sm">Distance</th>
                      <th className="text-center py-3 px-2 text-primary-400 font-medium text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((run) => (
                      <tr key={run.id} className="border-b border-primary-700/50 hover:bg-primary-700/20">
                        <td className="py-3 px-2 text-primary-300 text-sm">
                          {formatDate(run.date)}
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
                          {run.distanceKm.toFixed(1)} km
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
                  {filteredRuns.map((run) => (
                    <div
                      key={run.id}
                      className="p-4 rounded-xl bg-primary-700/20 border border-primary-700/30"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {run.photoUrl && (
                            <a 
                              href={run.photoUrl.replace('thumbnail', 'uc').replace('&sz=w400', '')} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-accent-400 hover:text-accent-300"
                            >
                              <Image className="w-4 h-4" />
                            </a>
                          )}
                          <User className="w-4 h-4 text-primary-400" />
                          <span className="font-medium text-white">{run.name}</span>
                        </div>
                        <span className="font-display font-bold text-accent-400">
                          {run.distanceKm.toFixed(1)} km
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary-400 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(run.date)}
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
    </div>
  );
}
