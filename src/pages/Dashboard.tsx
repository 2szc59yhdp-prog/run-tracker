import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Award, MapPin, Calendar, Hash, User, Clock, CheckCircle, XCircle, Image, Search, X, Building2, Trophy } from 'lucide-react';
import Card, { StatCard } from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { useApp } from '../context/AppContext';
import { fetchAllUsers } from '../services/api';
import type { RunStatus, RegisteredUser } from '../types';

// All stations in specified order
const ALL_STATIONS = [
  'SPSR',
  'Gdh.Atoll Police',
  'SPSR RR&HV',
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

  // Calculate station performance from runner stats
  const stationPerformance = useMemo(() => {
    const stationMap = new Map<string, { distance: number; runners: number; runCount: number }>();
    
    runnerStats.forEach(runner => {
      const existing = stationMap.get(runner.station) || { distance: 0, runners: 0, runCount: 0 };
      stationMap.set(runner.station, {
        distance: existing.distance + runner.totalDistance,
        runners: existing.runners + 1,
        runCount: existing.runCount + runner.runCount,
      });
    });

    // Convert to array and sort by total distance
    return Array.from(stationMap.entries())
      .map(([station, data]) => ({
        station,
        totalDistance: data.distance,
        runners: data.runners,
        runCount: data.runCount,
        // Target: 100km per runner
        targetDistance: data.runners * 100,
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance);
  }, [runnerStats]);


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
          <Button onClick={refreshData} variant="secondary">
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
              <div className="space-y-3">
                {runnerStats.map((runner, index) => (
                  <div
                    key={runner.serviceNumber}
                    className={`
                      flex items-center gap-4 p-4 rounded-xl transition-all
                      ${index === 0 ? 'bg-gradient-to-r from-warning-500/20 to-warning-500/5 border border-warning-500/30' : 
                        index === 1 ? 'bg-primary-700/30 border border-primary-600/30' :
                        index === 2 ? 'bg-primary-700/20 border border-primary-600/20' :
                        'bg-primary-800/30'}
                    `}
                  >
                    {/* Rank */}
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg
                      ${index === 0 ? 'bg-warning-500 text-primary-900' :
                        index === 1 ? 'bg-primary-400 text-primary-900' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-primary-700 text-primary-300'}
                    `}>
                      {index + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {runner.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-primary-400">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {runner.serviceNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {runner.station}
                        </span>
                      </div>
                    </div>

                    {/* Distance & Progress */}
                    <div className="text-right min-w-[100px]">
                      <p className="font-display font-bold text-white text-lg">
                        {runner.totalDistance.toFixed(1)}
                        <span className="text-sm text-primary-400">/ 100 km</span>
                      </p>
                      <p className="text-xs text-primary-500 mb-1">
                        {runner.runCount} run{runner.runCount !== 1 ? 's' : ''} • {(100 - runner.totalDistance).toFixed(1)} km left
                      </p>
                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-primary-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            runner.totalDistance >= 100 
                              ? 'bg-success-500' 
                              : index === 0 
                                ? 'bg-warning-500' 
                                : 'bg-accent-500'
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
            <div className="space-y-3">
              {stationPerformance.map((station, index) => {
                const progressPercent = (station.totalDistance / station.targetDistance) * 100;
                const isLeader = index === 0;
                
                return (
                  <div
                    key={station.station}
                    className={`
                      flex items-center gap-4 p-4 rounded-xl transition-all
                      ${isLeader 
                        ? 'bg-gradient-to-r from-accent-500/20 to-purple-500/10 border border-accent-500/30' 
                        : index === 1 ? 'bg-primary-700/30 border border-primary-600/30' :
                          index === 2 ? 'bg-primary-700/20 border border-primary-600/20' :
                          'bg-primary-800/30'}
                    `}
                  >
                    {/* Rank */}
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg flex-shrink-0
                      ${isLeader 
                        ? 'bg-gradient-to-br from-accent-400 to-purple-500 text-white' 
                        : index === 1 ? 'bg-primary-400 text-primary-900' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-primary-700 text-primary-300'}
                    `}>
                      {isLeader ? <Trophy className="w-5 h-5" /> : index + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${isLeader ? 'text-accent-400' : 'text-white'}`}>
                        {station.station}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-primary-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {station.runners} runner{station.runners !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {station.runCount} run{station.runCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Distance & Progress */}
                    <div className="text-right min-w-[120px]">
                      <p className="font-display font-bold text-white text-lg">
                        {station.totalDistance.toFixed(1)}
                        <span className="text-sm text-primary-400">/ {station.targetDistance} km</span>
                      </p>
                      <p className="text-xs text-primary-500 mb-1">
                        {progressPercent.toFixed(0)}% complete
                      </p>
                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-primary-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            progressPercent >= 100 
                              ? 'bg-success-500' 
                              : isLeader 
                                ? 'bg-gradient-to-r from-accent-500 to-purple-500' 
                                : 'bg-accent-500'
                          }`}
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
