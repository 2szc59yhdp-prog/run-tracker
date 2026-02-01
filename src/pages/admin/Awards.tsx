import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Activity, Users, Star, ThumbsUp, Edit2, X, Save } from 'lucide-react';
import { fetchAllRuns, fetchAllUsers, fetchManualAwards, saveManualAward } from '../../services/api';
import type { RegisteredUser, Run, ManualAward, SaveManualAwardPayload } from '../../types';
import { useApp } from '../../context/AppContext';

interface UserStats {
  user: RegisteredUser;
  totalDistance: number;
  runCount: number;
  rejectedCount: number;
  firstRunDate: Date | null;
  activeDays: Set<string>;
  finish100kDate: Date | null;
}

interface StationStats {
  name: string;
  totalDistance: number;
  userCount: number;
  activeUserCount: number;
  totalActiveDays: number;
}

const Awards: React.FC = () => {
  const { isAdmin, adminToken } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [stationStats, setStationStats] = useState<StationStats[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [manualAwards, setManualAwards] = useState<Record<string, ManualAward>>({});
  const [challengeStartDate, setChallengeStartDate] = useState<Date | null>(null);
  const [challengeEndDate, setChallengeEndDate] = useState<Date | null>(null);

  // Edit State
  const [editingAwardKey, setEditingAwardKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SaveManualAwardPayload>({
    awardKey: '',
    winnerIdentifier: '',
    winnerName: '',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Constants
  // Challenge ends at the end of Jan 31st 2026 (i.e., start of Feb 1st)
  const CHALLENGE_END_DATE = new Date('2026-02-01T00:00:00Z');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [runsRes, usersRes, manualAwardsRes] = await Promise.all([
          fetchAllRuns(),
          fetchAllUsers(),
          fetchManualAwards()
        ]);

        if (!runsRes.success || !runsRes.data) {
          throw new Error(runsRes.error || 'Failed to load runs');
        }
        if (!usersRes.success || !usersRes.data) {
          throw new Error(usersRes.error || 'Failed to load users');
        }

        const runs = runsRes.data;
        const allUsers = usersRes.data;
        setUsers(allUsers);

        if (manualAwardsRes.success && manualAwardsRes.data) {
          setManualAwards(manualAwardsRes.data);
        }

        // Process Data
        const statsMap = new Map<string, UserStats>();
        const stationMap = new Map<string, StationStats>();
        const userRunsMap = new Map<string, Run[]>();
        
        // Initialize stats for all users
        allUsers.forEach(u => {
          statsMap.set(u.serviceNumber, {
            user: u,
            totalDistance: 0,
            runCount: 0,
            rejectedCount: 0,
            firstRunDate: null,
            activeDays: new Set(),
            finish100kDate: null
          });
          userRunsMap.set(u.serviceNumber, []);
        });

        // Initialize station map
        const stations = Array.from(new Set(allUsers.map(u => u.station))).filter(Boolean);
        stations.forEach(s => {
          stationMap.set(s, {
            name: s,
            totalDistance: 0,
            userCount: allUsers.filter(u => u.station === s).length,
            activeUserCount: 0,
            totalActiveDays: 0
          });
        });

        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        runs.forEach(run => {
          const runDate = new Date(run.date);
          
          // Filter out runs after the challenge end date
          if (runDate > CHALLENGE_END_DATE) return;

          const stats = statsMap.get(run.serviceNumber);
          if (!stats) return;

          if (!minDate || runDate < minDate) minDate = runDate;
          if (!maxDate || runDate > maxDate) maxDate = runDate;

          // Track first run date
          if (!stats.firstRunDate || runDate < stats.firstRunDate) {
            stats.firstRunDate = runDate;
          }

          if (run.status === 'approved') {
            stats.totalDistance += run.distanceKm;
            stats.activeDays.add(run.date);
            
            // Store approved runs to calculate 100k date later
            const userRuns = userRunsMap.get(run.serviceNumber);
            if (userRuns) {
                userRuns.push(run);
            }
          }
          
          stats.runCount++;
          if (run.status === 'rejected') {
            stats.rejectedCount++;
          }
        });

        setChallengeStartDate(minDate);
        setChallengeEndDate(CHALLENGE_END_DATE); // Use fixed end date for calculations

        // Calculate 100k finish date for each user
        statsMap.forEach((stats, serviceNumber) => {
            if (stats.totalDistance >= 100) {
                const userRuns = userRunsMap.get(serviceNumber) || [];
                // Sort by date ascending
                userRuns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                let runningTotal = 0;
                for (const run of userRuns) {
                    runningTotal += run.distanceKm;
                    if (runningTotal >= 100) {
                        stats.finish100kDate = new Date(run.date);
                        break;
                    }
                }
                // Fallback if loop finishes but rounding errors caused it to not hit exact 100 (unlikely with >= check)
                if (!stats.finish100kDate && userRuns.length > 0) {
                     stats.finish100kDate = new Date(userRuns[userRuns.length - 1].date);
                }
            }
        });

        const calculatedUserStats = Array.from(statsMap.values());
        setUserStats(calculatedUserStats);

        // Calculate Station Stats
        calculatedUserStats.forEach(stat => {
          const station = stationMap.get(stat.user.station);
          if (station) {
            station.totalDistance += stat.totalDistance;
            station.totalActiveDays += stat.activeDays.size;
            if (stat.totalDistance > 0) {
                station.activeUserCount++;
            }
          }
        });

        setStationStats(Array.from(stationMap.values()));

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleEditManualAward = (key: string) => {
    const existing = manualAwards[key];
    setEditForm({
      awardKey: key,
      winnerIdentifier: existing?.winnerIdentifier || '',
      winnerName: existing?.winnerName || '',
      notes: existing?.notes || ''
    });
    setEditingAwardKey(key);
  };

  const handleSaveEdit = async () => {
    if (!adminToken || !editingAwardKey) return;
    setIsSaving(true);
    try {
      const payload: SaveManualAwardPayload = {
        awardKey: editingAwardKey,
        winnerIdentifier: editForm.winnerIdentifier,
        winnerName: editForm.winnerName,
        notes: editForm.notes
      };

      const res = await saveManualAward(payload, adminToken);
      if (res.success) {
        // Update local state
        setManualAwards(prev => ({
          ...prev,
          [editingAwardKey]: {
            ...prev[editingAwardKey],
            awardKey: editingAwardKey,
            winnerIdentifier: editForm.winnerIdentifier,
            winnerName: editForm.winnerName,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin', // In a real app we'd get this from context
            notes: editForm.notes
          }
        }));
        setEditingAwardKey(null);
      } else {
        alert('Failed to save award: ' + res.error);
      }
    } catch (err) {
      alert('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceNumber = e.target.value;
    const user = users.find(u => u.serviceNumber === serviceNumber);
    if (user) {
      setEditForm(prev => ({
        ...prev,
        winnerIdentifier: user.serviceNumber,
        winnerName: user.name
      }));
    } else if (serviceNumber === '') {
        setEditForm(prev => ({
            ...prev,
            winnerIdentifier: '',
            winnerName: ''
        }));
    }
  };

  if (loading) return <div className="p-8 text-center text-primary-300">Loading awards data...</div>;
  if (error) return <div className="p-8 text-center text-danger-500">{error}</div>;

  // --- Award Calculations ---

  // 1. 100K Finishers (Sorted by date finished)
  const finishers100k = userStats
    .filter(s => s.totalDistance >= 100 && s.finish100kDate)
    .sort((a, b) => {
        if (!a.finish100kDate || !b.finish100kDate) return 0;
        return a.finish100kDate.getTime() - b.finish100kDate.getTime();
    });

  // 2. Highest Total Distance
  const highestDistanceTop3 = [...userStats].sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 3);

  // 3. Comeback Award (Started in 2nd half, highest distance among them)
  let comebackTop3: UserStats[] = [];
  if (challengeStartDate && challengeEndDate) {
    const duration = challengeEndDate.getTime() - challengeStartDate.getTime();
    const midPoint = new Date(challengeStartDate.getTime() + (duration / 2));
    
    const lateStarters = userStats.filter(s => s.firstRunDate && s.firstRunDate > midPoint);
    comebackTop3 = lateStarters.sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 3);
  }

  // 4. Fair Play (Zero rejected runs, min 5 runs)
  const fairPlayCandidates = userStats
    .filter(s => s.runCount >= 5 && s.rejectedCount === 0)
    .sort((a, b) => b.runCount - a.runCount); // Sort by most runs without rejection
  
  const fairPlayTop3 = fairPlayCandidates.slice(0, 3);

  // 5. Silent Grinder (Most consistent / Active Days)
  const silentGrinderTop3 = [...userStats].sort((a, b) => b.activeDays.size - a.activeDays.size).slice(0, 3);

  // Station Awards
  // 1. Best Performing Station (Total Distance)
  const bestStationTop3 = [...stationStats].sort((a, b) => b.totalDistance - a.totalDistance).slice(0, 3);

  // 2. Most Consistent Station (Avg active days per user)
  // Only compare with Stations with 5 or more Active runners
  const consistentStationTop3 = [...stationStats]
    .filter(s => s.activeUserCount >= 5)
    .map(s => ({
      ...s,
      avgActiveDays: s.totalActiveDays / s.activeUserCount // Calculate based on active users
    }))
    .sort((a, b) => b.avgActiveDays - a.avgActiveDays)
    .slice(0, 3);


  return (
    <div className="max-w-6xl mx-auto p-6 relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-warning-400" />
          Challenge Awards & Winners
        </h1>
        <p className="text-primary-300">Automated calculations based on run data. Top 3 contenders shown.</p>
      </div>

      {/* 1. Individual Awards Section */}
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-primary-700/50 pb-2">1. Individual Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        
        {/* Highest Total Distance */}
        <AwardCard 
          title="Highest Total Distance" 
          icon={<Activity className="w-6 h-6 text-accent-400" />}
          description="Most KM logged by the end of the challenge"
          criteria="The runner with the highest total distance approved by the end of the challenge."
        >
          <PodiumList items={highestDistanceTop3} renderItem={(stat) => (
            <div className="text-center">
                <div className="font-bold text-white">{stat.user.name}</div>
                <div className="text-xs text-primary-400">#{stat.user.serviceNumber} • {stat.user.station}</div>
                <div className="text-lg font-bold text-accent-400">{stat.totalDistance.toFixed(2)} km</div>
            </div>
          )} />
        </AwardCard>

        {/* Comeback Award */}
        <AwardCard 
          title="Comeback Award" 
          icon={<Activity className="w-6 h-6 text-purple-400" />}
          description="Started late (2nd half) but finished Strong"
          criteria="Started running in the second half of the challenge and achieved the highest distance among late starters."
        >
          <PodiumList items={comebackTop3} emptyMessage="No eligible candidates" renderItem={(stat) => (
             <div className="text-center">
                <div className="font-bold text-white">{stat.user.name}</div>
                <div className="text-xs text-primary-400 mb-1">#{stat.user.serviceNumber}</div>
                <div className="grid grid-cols-2 gap-2 text-xs bg-purple-500/10 border border-purple-500/20 p-1 rounded">
                <div>
                    <div className="text-primary-400 text-[10px]">Started</div>
                    <div className="font-semibold text-purple-300">{stat.firstRunDate?.toLocaleDateString()}</div>
                </div>
                <div>
                    <div className="text-primary-400 text-[10px]">Distance</div>
                    <div className="font-semibold text-purple-300">{stat.totalDistance.toFixed(1)} km</div>
                </div>
                </div>
            </div>
          )} />
        </AwardCard>

        {/* Fair Play Award */}
        <AwardCard 
          title="Fair Play Award" 
          icon={<Star className="w-6 h-6 text-success-400" />}
          description="Zero Rejected Runs (Min 5 runs submitted)"
          criteria="Runners with at least 5 runs submitted and 0 rejected runs. Tie-breaker: Most runs submitted."
        >
           <PodiumList items={fairPlayTop3} emptyMessage="No eligible candidates" renderItem={(stat) => (
             <div className="text-center">
                <div className="font-bold text-white">{stat.user.name}</div>
                <div className="text-xs text-primary-400 mb-1">#{stat.user.serviceNumber}</div>
                <div className="text-lg font-bold text-success-400">{stat.runCount} Runs</div>
                <div className="text-[10px] text-primary-500">100% Approval Rate</div>
            </div>
           )} />
        </AwardCard>

        {/* Silent Grinder Award */}
        <AwardCard 
          title="Silent Grinder Award" 
          icon={<Activity className="w-6 h-6 text-primary-400" />}
          description="Most Consistent (Highest Active Days)"
          criteria="The runner with the highest number of active days (days with at least one approved run)."
        >
          <PodiumList items={silentGrinderTop3} renderItem={(stat) => (
            <div className="text-center">
              <div className="font-bold text-white">{stat.user.name}</div>
              <div className="text-xs text-primary-400 mb-1">#{stat.user.serviceNumber}</div>
              <div className="text-xl font-bold text-primary-200">{stat.activeDays.size} <span className="text-sm font-normal text-primary-500">days</span></div>
            </div>
          )} />
        </AwardCard>
        
        {/* 100K Finisher Medal - Spans full width */}
        <div className="md:col-span-2 lg:col-span-3">
            <AwardCard 
            title="100K Finishers" 
            icon={<Medal className="w-6 h-6 text-warning-400" />}
            description="Ordered by time of completion"
            criteria="Runners who have completed 100km total distance. Ordered by the date/time they crossed the 100km mark."
            >
            <div className="text-center">
                <div className="text-3xl font-bold text-warning-400 mb-2">{finishers100k.length}</div>
                <p className="text-primary-300 mb-3">Athletes Completed</p>
                <div className="max-h-60 overflow-y-auto text-sm text-left bg-primary-800/50 p-2 rounded border border-primary-700/50 scrollbar-thin scrollbar-thumb-primary-600 scrollbar-track-transparent">
                    <div className="grid grid-cols-12 gap-2 font-bold text-primary-400 border-b border-primary-700/50 pb-2 mb-2 px-2">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Name</div>
                        <div className="col-span-3">Date Finished</div>
                        <div className="col-span-3 text-right">Total Dist</div>
                    </div>
                {finishers100k.map((f, index) => (
                    <div key={f.user.serviceNumber} className="grid grid-cols-12 gap-2 py-1 border-b border-primary-700/50 last:border-0 text-primary-200 px-2 hover:bg-primary-700/20">
                        <div className="col-span-1 text-primary-500">{index + 1}</div>
                        <div className="col-span-5 truncate" title={f.user.name}>{f.user.name}</div>
                        <div className="col-span-3 text-xs flex items-center text-primary-400">
                            {f.finish100kDate?.toLocaleDateString()}
                        </div>
                        <div className="col-span-3 font-mono text-accent-400 text-right">{f.totalDistance.toFixed(0)}km</div>
                    </div>
                ))}
                </div>
            </div>
            </AwardCard>
        </div>

      </div>

      {/* 2. Team Awards Section */}
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-primary-700/50 pb-2">2. Team Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        
        {/* Best Performing Station */}
        <AwardCard 
          title="Best Performing Station" 
          icon={<Trophy className="w-6 h-6 text-warning-500" />}
          description="Highest Total Distance"
          criteria="The station with the highest aggregated total distance of all its participants."
        >
          <PodiumList items={bestStationTop3} renderItem={(station) => (
            <div className="text-center">
              <div className="font-bold text-white">{station.name}</div>
              <div className="text-xs text-primary-400 mb-1">{station.userCount} Participants</div>
              <div className="text-lg font-bold text-warning-500">{station.totalDistance.toFixed(0)} km</div>
            </div>
          )} />
        </AwardCard>

        {/* Most Consistent Station */}
        <AwardCard 
          title="Most Consistent Station" 
          icon={<Users className="w-6 h-6 text-indigo-400" />}
          description="Highest average active days per active participant"
          criteria="The station with the highest average active days per runner. Only stations with at least 5 active runners are eligible."
        >
          <PodiumList items={consistentStationTop3} emptyMessage="No stations with 5+ active runners" renderItem={(station) => (
            <div className="text-center">
              <div className="font-bold text-white">{station.name}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-1 rounded">
                  <div className="text-primary-400 text-[10px]">Total Days</div>
                  <div className="font-bold text-indigo-400">{station.totalActiveDays}</div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-1 rounded">
                  <div className="text-primary-400 text-[10px]">Avg / User</div>
                  {/* @ts-ignore */}
                  <div className="font-bold text-indigo-400">{station.avgActiveDays.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )} />
        </AwardCard>

      </div>

      {/* 3. Manual Selecting Awards Section */}
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-primary-700/50 pb-2">3. Manual Selecting Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Inspiring Award (Manual) */}
        <AwardCard 
          title="Inspiring Award" 
          icon={<ThumbsUp className="w-6 h-6 text-pink-400" />}
          description="For Motivating Others"
          manual
          criteria="Awarded to the runner who has shown exceptional spirit in motivating others. Selected manually."
          onEdit={isAdmin ? () => handleEditManualAward('inspiring_award') : undefined}
        >
          {manualAwards['inspiring_award'] ? (
             <div className="text-center">
             <div className="text-xl font-bold text-white">{manualAwards['inspiring_award'].winnerName}</div>
             <div className="text-sm text-primary-400 mb-2">#{manualAwards['inspiring_award'].winnerIdentifier}</div>
             {manualAwards['inspiring_award'].notes && (
                 <div className="text-xs text-primary-400 italic mt-2">"{manualAwards['inspiring_award'].notes}"</div>
             )}
           </div>
          ) : (
            <div className="text-center py-4 bg-primary-800/30 border border-dashed border-primary-700 rounded">
                <span className="text-primary-500 italic">To be decided manually</span>
            </div>
          )}
        </AwardCard>

         {/* Best Team Spirit (Manual) */}
         <AwardCard 
          title="Best Team Spirit" 
          icon={<Award className="w-6 h-6 text-orange-400" />}
          description="Motivation, Encouragement, Participant Vibe"
          manual
          criteria="Awarded to the runner or group that best exemplifies team spirit. Selected manually."
          onEdit={isAdmin ? () => handleEditManualAward('team_spirit') : undefined}
        >
          {manualAwards['team_spirit'] ? (
             <div className="text-center">
             <div className="text-xl font-bold text-white">{manualAwards['team_spirit'].winnerName}</div>
             <div className="text-sm text-primary-400 mb-2">#{manualAwards['team_spirit'].winnerIdentifier}</div>
             {manualAwards['team_spirit'].notes && (
                 <div className="text-xs text-primary-400 italic mt-2">"{manualAwards['team_spirit'].notes}"</div>
             )}
           </div>
          ) : (
            <div className="text-center py-4 bg-primary-800/30 border border-dashed border-primary-700 rounded">
                <span className="text-primary-500 italic">To be decided manually</span>
            </div>
          )}
        </AwardCard>
        
      </div>

      {/* Edit Modal */}
      {editingAwardKey && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-primary-900 border border-primary-700 rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Edit Award Winner</h3>
                    <button 
                        onClick={() => setEditingAwardKey(null)}
                        className="text-primary-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-primary-300 mb-1">Select Winner</label>
                        <select
                            value={editForm.winnerIdentifier}
                            onChange={handleUserSelect}
                            className="w-full bg-primary-800 border border-primary-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
                        >
                            <option value="">-- Select a User --</option>
                            {users.sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                                <option key={user.serviceNumber} value={user.serviceNumber}>
                                    {user.name} ({user.serviceNumber})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary-300 mb-1">Winner Name (Override)</label>
                        <input
                            type="text"
                            value={editForm.winnerName}
                            onChange={(e) => setEditForm({...editForm, winnerName: e.target.value})}
                            className="w-full bg-primary-800 border border-primary-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none"
                            placeholder="Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary-300 mb-1">Notes / Reason</label>
                        <textarea
                            value={editForm.notes}
                            onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                            className="w-full bg-primary-800 border border-primary-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none h-24 resize-none"
                            placeholder="Why did they win?"
                        />
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => setEditingAwardKey(null)}
                            className="flex-1 px-4 py-2 bg-primary-800 hover:bg-primary-700 text-primary-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isSaving ? 'Saving...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Winner
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

interface AwardCardProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  manual?: boolean;
  criteria?: string;
  onEdit?: () => void;
}

const AwardCard: React.FC<AwardCardProps> = ({ title, icon, description, children, manual, criteria, onEdit }) => (
  <div className={`bg-primary-800/50 backdrop-blur-sm rounded-xl shadow-lg border p-6 flex flex-col h-full relative group ${manual ? 'border-dashed border-primary-600/50' : 'border-primary-700/50 hover:border-primary-600 transition-colors'}`}>
    {onEdit && (
        <button 
            onClick={onEdit}
            className="absolute top-4 right-4 p-2 bg-primary-700/80 hover:bg-accent-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
            title="Edit Winner"
        >
            <Edit2 className="w-4 h-4" />
        </button>
    )}
    
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-bold text-lg text-white">{title}</h3>
        <p className="text-xs text-primary-400 mt-1">{description}</p>
      </div>
      <div className="p-2 bg-primary-900/50 rounded-lg border border-primary-700/50">{icon}</div>
    </div>
    
    <div className="flex-grow flex flex-col justify-center mb-4">
      {children}
    </div>

    {criteria && (
        <div className="mt-auto pt-4 border-t border-primary-700/30">
            <p className="text-[10px] uppercase tracking-wider text-primary-500 font-semibold mb-1">Criteria</p>
            <p className="text-xs text-primary-400 leading-relaxed">{criteria}</p>
        </div>
    )}
  </div>
);

const PodiumList = ({ 
    items, 
    renderItem, 
    emptyMessage = "No data" 
}: { 
    items: any[], 
    renderItem: (item: any, index: number) => React.ReactNode, 
    emptyMessage?: string 
}) => {
    if (items.length === 0) return <p className="text-primary-500 text-center">{emptyMessage}</p>;
    
    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={index} className={`relative p-2 rounded-lg border ${
                    index === 0 ? 'bg-warning-500/10 border-warning-500/30' : 
                    index === 1 ? 'bg-primary-600/20 border-primary-500/20' : 
                    'bg-primary-800/20 border-primary-700/20'
                }`}>
                    <div className={`absolute top-1 right-2 text-[10px] font-bold uppercase tracking-wider ${
                        index === 0 ? 'text-warning-400' : 
                        index === 1 ? 'text-primary-300' : 
                        'text-primary-500'
                    }`}>
                        {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
                    </div>
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
    );
};

export default Awards;
