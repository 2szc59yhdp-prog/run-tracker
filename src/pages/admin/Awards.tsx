import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Activity, Users, Star, ThumbsUp } from 'lucide-react';
import { fetchAllRuns, fetchAllUsers } from '../../services/api';
import type { RegisteredUser, Run } from '../../types';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [stationStats, setStationStats] = useState<StationStats[]>([]);
  const [challengeStartDate, setChallengeStartDate] = useState<Date | null>(null);
  const [challengeEndDate, setChallengeEndDate] = useState<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [runsRes, usersRes] = await Promise.all([
          fetchAllRuns(),
          fetchAllUsers()
        ]);

        if (!runsRes.success || !runsRes.data) {
          throw new Error(runsRes.error || 'Failed to load runs');
        }
        if (!usersRes.success || !usersRes.data) {
          throw new Error(usersRes.error || 'Failed to load users');
        }

        const runs = runsRes.data;
        const allUsers = usersRes.data;

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
          const stats = statsMap.get(run.serviceNumber);
          if (!stats) return;

          const runDate = new Date(run.date);
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
        setChallengeEndDate(maxDate);

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
  const highestDistance = [...userStats].sort((a, b) => b.totalDistance - a.totalDistance)[0];

  // 3. Comeback Award (Started in 2nd half, highest distance among them)
  let comebackWinner = null;
  if (challengeStartDate && challengeEndDate) {
    const duration = challengeEndDate.getTime() - challengeStartDate.getTime();
    const midPoint = new Date(challengeStartDate.getTime() + (duration / 2));
    
    const lateStarters = userStats.filter(s => s.firstRunDate && s.firstRunDate > midPoint);
    comebackWinner = lateStarters.sort((a, b) => b.totalDistance - a.totalDistance)[0];
  }

  // 4. Fair Play (Zero rejected runs, min 5 runs)
  const fairPlayCandidates = userStats
    .filter(s => s.runCount >= 5 && s.rejectedCount === 0)
    .sort((a, b) => b.runCount - a.runCount) // Sort by most runs without rejection
    .slice(0, 10); // Top 10

  // 5. Silent Grinder (Most consistent / Active Days)
  const silentGrinder = [...userStats].sort((a, b) => b.activeDays.size - a.activeDays.size)[0];

  // Station Awards
  // 1. Best Performing Station (Total Distance)
  const bestStation = [...stationStats].sort((a, b) => b.totalDistance - a.totalDistance)[0];

  // 2. Most Consistent Station (Avg active days per user)
  // Only compare with Stations with 5 or more Active runners
  const consistentStation = [...stationStats]
    .filter(s => s.activeUserCount >= 5)
    .map(s => ({
      ...s,
      avgActiveDays: s.totalActiveDays / s.activeUserCount // Calculate based on active users
    }))
    .sort((a, b) => b.avgActiveDays - a.avgActiveDays)[0];


  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-warning-400" />
          Challenge Awards & Winners
        </h1>
        <p className="text-primary-300">Automated calculations based on run data.</p>
      </div>

      {/* 1. Individual Awards Section */}
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-primary-700/50 pb-2">1. Individual Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        
        {/* Highest Total Distance */}
        <AwardCard 
          title="Highest Total Distance" 
          icon={<Activity className="w-6 h-6 text-accent-400" />}
          description="Most KM logged by the end of the challenge"
        >
          {highestDistance ? (
            <div className="text-center">
              <div className="text-xl font-bold text-white">{highestDistance.user.name}</div>
              <div className="text-sm text-primary-400 mb-2">#{highestDistance.user.serviceNumber} • {highestDistance.user.station}</div>
              <div className="text-3xl font-bold text-accent-400">{highestDistance.totalDistance.toFixed(2)} km</div>
            </div>
          ) : <p className="text-primary-500 text-center">No data</p>}
        </AwardCard>

        {/* Comeback Award */}
        <AwardCard 
          title="Comeback Award" 
          icon={<Activity className="w-6 h-6 text-purple-400" />}
          description="Started late (2nd half) but finished Strong"
        >
          {comebackWinner ? (
            <div className="text-center">
              <div className="text-xl font-bold text-white">{comebackWinner.user.name}</div>
              <div className="text-sm text-primary-400 mb-2">#{comebackWinner.user.serviceNumber}</div>
              <div className="grid grid-cols-2 gap-2 text-sm bg-purple-500/10 border border-purple-500/20 p-2 rounded">
                <div>
                  <div className="text-primary-400">Started</div>
                  <div className="font-semibold text-purple-300">{comebackWinner.firstRunDate?.toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-primary-400">Distance</div>
                  <div className="font-semibold text-purple-300">{comebackWinner.totalDistance.toFixed(1)} km</div>
                </div>
              </div>
            </div>
          ) : <p className="text-primary-500 text-center">No eligible candidates</p>}
        </AwardCard>

        {/* Fair Play Award */}
        <AwardCard 
          title="Fair Play Award" 
          icon={<Star className="w-6 h-6 text-success-400" />}
          description="Zero Rejected Runs (Min 5 runs submitted)"
        >
          {fairPlayCandidates.length > 0 ? (
             <div className="text-center">
             <div className="text-xl font-bold text-white">{fairPlayCandidates[0].user.name}</div>
             <div className="text-sm text-primary-400 mb-2">#{fairPlayCandidates[0].user.serviceNumber}</div>
             <div className="text-2xl font-bold text-success-400">{fairPlayCandidates[0].runCount} Runs</div>
             <div className="text-xs text-primary-500">100% Approval Rate</div>
             {fairPlayCandidates.length > 1 && (
               <div className="mt-2 text-xs text-primary-600">
                 + {fairPlayCandidates.length - 1} other candidates
               </div>
             )}
           </div>
          ) : <p className="text-primary-500 text-center">No eligible candidates</p>}
        </AwardCard>

        {/* Silent Grinder Award */}
        <AwardCard 
          title="Silent Grinder Award" 
          icon={<Activity className="w-6 h-6 text-primary-400" />}
          description="Most Consistent (Highest Active Days)"
        >
          {silentGrinder ? (
            <div className="text-center">
              <div className="text-xl font-bold text-white">{silentGrinder.user.name}</div>
              <div className="text-sm text-primary-400 mb-2">#{silentGrinder.user.serviceNumber}</div>
              <div className="text-3xl font-bold text-primary-200">{silentGrinder.activeDays.size} <span className="text-lg font-normal text-primary-500">days active</span></div>
            </div>
          ) : <p className="text-primary-500 text-center">No data</p>}
        </AwardCard>
        
        {/* 100K Finisher Medal - Spans full width */}
        <div className="md:col-span-2 lg:col-span-3">
            <AwardCard 
            title="100K Finishers" 
            icon={<Medal className="w-6 h-6 text-warning-400" />}
            description="Ordered by time of completion"
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
        >
          {bestStation ? (
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{bestStation.name}</div>
              <div className="text-sm text-primary-400 mb-2">{bestStation.userCount} Participants</div>
              <div className="text-3xl font-bold text-warning-500">{bestStation.totalDistance.toFixed(0)} km</div>
            </div>
          ) : <p className="text-primary-500 text-center">No data</p>}
        </AwardCard>

        {/* Most Consistent Station */}
        <AwardCard 
          title="Most Consistent Station" 
          icon={<Users className="w-6 h-6 text-indigo-400" />}
          description="Highest average active days per active participant"
        >
          {consistentStation ? (
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{consistentStation.name}</div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded">
                  <div className="text-primary-400 text-xs">Total Active Days</div>
                  <div className="font-bold text-indigo-400">{consistentStation.totalActiveDays}</div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-2 rounded">
                  <div className="text-primary-400 text-xs">Avg / Active User</div>
                  {/* @ts-ignore */}
                  <div className="font-bold text-indigo-400">{consistentStation.avgActiveDays.toFixed(1)} days</div>
                  <div className="text-[10px] text-primary-500 mt-1">({consistentStation.activeUserCount} active runners)</div>
                </div>
              </div>
            </div>
          ) : <p className="text-primary-500 text-center">No stations with 5+ active runners</p>}
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
        >
          <div className="text-center py-4 bg-primary-800/30 border border-dashed border-primary-700 rounded">
            <span className="text-primary-500 italic">To be decided manually</span>
          </div>
        </AwardCard>

         {/* Best Team Spirit (Manual) */}
         <AwardCard 
          title="Best Team Spirit" 
          icon={<Award className="w-6 h-6 text-orange-400" />}
          description="Motivation, Encouragement, Participant Vibe"
          manual
        >
          <div className="text-center py-4 bg-primary-800/30 border border-dashed border-primary-700 rounded">
            <span className="text-primary-500 italic">To be decided manually</span>
          </div>
        </AwardCard>
        
      </div>
    </div>
  );
};

interface AwardCardProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  manual?: boolean;
}

const AwardCard: React.FC<AwardCardProps> = ({ title, icon, description, children, manual }) => (
  <div className={`bg-primary-800/50 backdrop-blur-sm rounded-xl shadow-lg border p-6 flex flex-col h-full ${manual ? 'border-dashed border-primary-600/50' : 'border-primary-700/50 hover:border-primary-600 transition-colors'}`}>
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-bold text-lg text-white">{title}</h3>
        <p className="text-xs text-primary-400 mt-1">{description}</p>
      </div>
      <div className="p-2 bg-primary-900/50 rounded-lg border border-primary-700/50">{icon}</div>
    </div>
    <div className="flex-grow flex flex-col justify-center">
      {children}
    </div>
  </div>
);

export default Awards;
