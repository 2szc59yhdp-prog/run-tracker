import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Activity, Users, Star, ThumbsUp } from 'lucide-react';
import { fetchAllRuns, fetchAllUsers } from '../../services/api';
import type { RegisteredUser } from '../../types';

interface UserStats {
  user: RegisteredUser;
  totalDistance: number;
  runCount: number;
  rejectedCount: number;
  firstRunDate: Date | null;
  activeDays: Set<string>;
}

interface StationStats {
  name: string;
  totalDistance: number;
  userCount: number;
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
        
        // Initialize stats for all users
        allUsers.forEach(u => {
          statsMap.set(u.serviceNumber, {
            user: u,
            totalDistance: 0,
            runCount: 0,
            rejectedCount: 0,
            firstRunDate: null,
            activeDays: new Set()
          });
        });

        // Initialize station map
        const stations = Array.from(new Set(allUsers.map(u => u.station))).filter(Boolean);
        stations.forEach(s => {
          stationMap.set(s, {
            name: s,
            totalDistance: 0,
            userCount: allUsers.filter(u => u.station === s).length,
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
          }
          
          stats.runCount++;
          if (run.status === 'rejected') {
            stats.rejectedCount++;
          }
        });

        setChallengeStartDate(minDate);
        setChallengeEndDate(maxDate);

        const calculatedUserStats = Array.from(statsMap.values());
        setUserStats(calculatedUserStats);

        // Calculate Station Stats
        calculatedUserStats.forEach(stat => {
          const station = stationMap.get(stat.user.station);
          if (station) {
            station.totalDistance += stat.totalDistance;
            station.totalActiveDays += stat.activeDays.size;
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

  if (loading) return <div className="p-8 text-center">Loading awards data...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  // --- Award Calculations ---

  // 1. 100K Finishers
  const finishers100k = userStats.filter(s => s.totalDistance >= 100).sort((a, b) => b.totalDistance - a.totalDistance);

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
  const consistentStation = [...stationStats]
    .filter(s => s.userCount > 0)
    .map(s => ({
      ...s,
      avgActiveDays: s.totalActiveDays / s.userCount
    }))
    .sort((a, b) => b.avgActiveDays - a.avgActiveDays)[0];


  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          Challenge Awards & Winners
        </h1>
        <p className="text-gray-600">Automated calculations based on run data.</p>
      </div>

      {/* Individual Awards Section */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Individual Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        
        {/* Highest Total Distance */}
        <AwardCard 
          title="Highest Total Distance" 
          icon={<Activity className="w-6 h-6 text-blue-500" />}
          description="Most KM logged by the end of the challenge"
        >
          {highestDistance ? (
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{highestDistance.user.name}</div>
              <div className="text-sm text-gray-500 mb-2">#{highestDistance.user.serviceNumber} • {highestDistance.user.station}</div>
              <div className="text-3xl font-bold text-blue-600">{highestDistance.totalDistance.toFixed(2)} km</div>
            </div>
          ) : <p className="text-gray-500 text-center">No data</p>}
        </AwardCard>

        {/* 100K Finisher Medal */}
        <AwardCard 
          title="100K Finishers" 
          icon={<Medal className="w-6 h-6 text-yellow-500" />}
          description="Everyone who completed 100K"
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{finishers100k.length}</div>
            <p className="text-gray-600 mb-3">Athletes Completed</p>
            <div className="max-h-32 overflow-y-auto text-sm text-left bg-gray-50 p-2 rounded">
              {finishers100k.map(f => (
                <div key={f.user.serviceNumber} className="flex justify-between py-1 border-b last:border-0">
                  <span>{f.user.name}</span>
                  <span className="font-mono">{f.totalDistance.toFixed(0)}km</span>
                </div>
              ))}
            </div>
          </div>
        </AwardCard>

        {/* Comeback Award */}
        <AwardCard 
          title="Comeback Award" 
          icon={<Activity className="w-6 h-6 text-purple-500" />}
          description="Started late (2nd half) but finished Strong"
        >
          {comebackWinner ? (
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{comebackWinner.user.name}</div>
              <div className="text-sm text-gray-500 mb-2">#{comebackWinner.user.serviceNumber}</div>
              <div className="grid grid-cols-2 gap-2 text-sm bg-purple-50 p-2 rounded">
                <div>
                  <div className="text-gray-500">Started</div>
                  <div className="font-semibold">{comebackWinner.firstRunDate?.toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Distance</div>
                  <div className="font-semibold">{comebackWinner.totalDistance.toFixed(1)} km</div>
                </div>
              </div>
            </div>
          ) : <p className="text-gray-500 text-center">No eligible candidates</p>}
        </AwardCard>

        {/* Fair Play Award */}
        <AwardCard 
          title="Fair Play Award" 
          icon={<Star className="w-6 h-6 text-green-500" />}
          description="Zero Rejected Runs (Min 5 runs submitted)"
        >
          {fairPlayCandidates.length > 0 ? (
             <div className="text-center">
             <div className="text-xl font-bold text-gray-900">{fairPlayCandidates[0].user.name}</div>
             <div className="text-sm text-gray-500 mb-2">#{fairPlayCandidates[0].user.serviceNumber}</div>
             <div className="text-2xl font-bold text-green-600">{fairPlayCandidates[0].runCount} Runs</div>
             <div className="text-xs text-gray-500">100% Approval Rate</div>
             {fairPlayCandidates.length > 1 && (
               <div className="mt-2 text-xs text-gray-400">
                 + {fairPlayCandidates.length - 1} other candidates
               </div>
             )}
           </div>
          ) : <p className="text-gray-500 text-center">No eligible candidates</p>}
        </AwardCard>

        {/* Silent Grinder Award */}
        <AwardCard 
          title="Silent Grinder Award" 
          icon={<Activity className="w-6 h-6 text-gray-700" />}
          description="Most Consistent (Highest Active Days)"
        >
          {silentGrinder ? (
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{silentGrinder.user.name}</div>
              <div className="text-sm text-gray-500 mb-2">#{silentGrinder.user.serviceNumber}</div>
              <div className="text-3xl font-bold text-gray-800">{silentGrinder.activeDays.size} <span className="text-lg font-normal text-gray-500">days active</span></div>
            </div>
          ) : <p className="text-gray-500 text-center">No data</p>}
        </AwardCard>

        {/* Inspiring Award (Manual) */}
        <AwardCard 
          title="Inspiring Award" 
          icon={<ThumbsUp className="w-6 h-6 text-pink-500" />}
          description="For Motivating Others"
          manual
        >
          <div className="text-center py-4 bg-gray-50 border border-dashed border-gray-300 rounded">
            <span className="text-gray-500 italic">To be decided manually</span>
          </div>
        </AwardCard>
      </div>

      {/* Station Awards Section */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Station / Team Awards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Best Performing Station */}
        <AwardCard 
          title="Best Performing Station" 
          icon={<Trophy className="w-6 h-6 text-yellow-600" />}
          description="Highest Total Distance"
        >
          {bestStation ? (
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{bestStation.name}</div>
              <div className="text-sm text-gray-500 mb-2">{bestStation.userCount} Participants</div>
              <div className="text-3xl font-bold text-yellow-700">{bestStation.totalDistance.toFixed(0)} km</div>
            </div>
          ) : <p className="text-gray-500 text-center">No data</p>}
        </AwardCard>

        {/* Most Consistent Station */}
        <AwardCard 
          title="Most Consistent Station" 
          icon={<Users className="w-6 h-6 text-indigo-500" />}
          description="Highest average active days per participant"
        >
          {consistentStation ? (
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{consistentStation.name}</div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div className="bg-indigo-50 p-2 rounded">
                  <div className="text-gray-500 text-xs">Total Active Days</div>
                  <div className="font-bold text-indigo-700">{consistentStation.totalActiveDays}</div>
                </div>
                <div className="bg-indigo-50 p-2 rounded">
                  <div className="text-gray-500 text-xs">Avg / User</div>
                  {/* @ts-ignore */}
                  <div className="font-bold text-indigo-700">{consistentStation.avgActiveDays.toFixed(1)} days</div>
                </div>
              </div>
            </div>
          ) : <p className="text-gray-500 text-center">No data</p>}
        </AwardCard>

         {/* Best Team Spirit (Manual) */}
         <AwardCard 
          title="Best Team Spirit" 
          icon={<Award className="w-6 h-6 text-orange-500" />}
          description="Motivation, Encouragement, Participant Vibe"
          manual
        >
          <div className="text-center py-4 bg-gray-50 border border-dashed border-gray-300 rounded">
            <span className="text-gray-500 italic">To be decided manually</span>
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
  <div className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full ${manual ? 'border-dashed border-gray-300' : 'border-gray-100'}`}>
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
    </div>
    <div className="flex-grow flex flex-col justify-center">
      {children}
    </div>
  </div>
);

export default Awards;
