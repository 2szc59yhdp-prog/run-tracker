import { useMemo, useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, X, Medal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchAllUsers } from '../services/api';
import type { RegisteredUser } from '../types';

export default function FinishersList() {
  const navigate = useNavigate();
  const { runs, isLoading: isLoadingRuns, isAdmin } = useApp();
  const [filter, setFilter] = useState('');
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  // Fetch users on mount
  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetchAllUsers();
        if (response.success && response.data) {
          setUsers(response.data);
        }
      } catch (error) {
        console.error('Failed to load users', error);
      } finally {
        setIsLoadingUsers(false);
      }
    }
    loadUsers();
  }, []);

  const finishersData = useMemo(() => {
    if (users.length === 0 || runs.length === 0) return [];

    // 1. Filter approved runs
    const approvedRuns = runs.filter(run => run.status === 'approved');

    // 2. Group runs by user
    const runsByUser = new Map<string, typeof approvedRuns>();
    approvedRuns.forEach(run => {
      if (!runsByUser.has(run.serviceNumber)) {
        runsByUser.set(run.serviceNumber, []);
      }
      runsByUser.get(run.serviceNumber)?.push(run);
    });

    const finishers: {
      rank: number;
      serviceNumber: string;
      name: string;
      station: string;
      daysToComplete: number;
      completionDate: Date;
      activeDays: number;
    }[] = [];

    // 3. Process each user
    users.forEach(user => {
      const userRuns = runsByUser.get(user.serviceNumber) || [];
      
      // Sort runs by date ascending
      userRuns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let totalDistance = 0;
      let completionDate: Date | null = null;
      let firstRunDate: Date | null = null;
      const activeDates = new Set<string>();

      for (const run of userRuns) {
        if (!firstRunDate) {
          firstRunDate = new Date(run.date);
        }
        
        activeDates.add(run.date);
        totalDistance += run.distanceKm;

        if (totalDistance >= 100 && !completionDate) {
          completionDate = new Date(run.date);
          break; // Stop counting days/runs once 100k is reached
        }
      }

      if (completionDate && firstRunDate) {
        finishers.push({
          rank: 0, // Will assign later
          serviceNumber: user.serviceNumber,
          name: user.name,
          station: user.station,
          daysToComplete: activeDates.size, // User requested active days count
          completionDate: completionDate,
          activeDays: activeDates.size
        });
      }
    });

    // 4. Sort by completion date
    finishers.sort((a, b) => a.completionDate.getTime() - b.completionDate.getTime());

    // 5. Assign ranks
    finishers.forEach((f, index) => {
      f.rank = index + 1;
    });

    return finishers;
  }, [runs, users]);

  // Filter logic
  const filteredFinishers = useMemo(() => {
    if (!filter.trim()) return finishersData;
    const lowerFilter = filter.toLowerCase();
    return finishersData.filter(item => 
      item.name.toLowerCase().includes(lowerFilter) || 
      item.serviceNumber.includes(lowerFilter) ||
      item.station.toLowerCase().includes(lowerFilter)
    );
  }, [finishersData, filter]);

  const downloadCSV = () => {
    const headers = ['Rank', 'Service Number', 'Name', 'Station', 'Days to Complete', 'Active Days'];
    const rows = filteredFinishers.map(row => [
      row.rank,
      row.serviceNumber,
      row.name,
      row.station,
      row.daysToComplete,
      row.activeDays
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', '100k_finishers_list.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return (
        <span title="1st Place">
          <Medal className="w-4 h-4 text-yellow-400 drop-shadow-sm ml-1.5 shrink-0" fill="currentColor" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span title="2nd Place">
          <Medal className="w-4 h-4 text-gray-300 drop-shadow-sm ml-1.5 shrink-0" fill="currentColor" />
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span title="3rd Place">
          <Medal className="w-4 h-4 text-amber-600 drop-shadow-sm ml-1.5 shrink-0" fill="currentColor" />
        </span>
      );
    }
    return null;
  };

  if (isLoadingRuns || isLoadingUsers) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <LoadingSpinner size="lg" message="Loading finishers data..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="mb-4 text-primary-400 hover:text-white pl-0 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
              100K Finishers List
            </h1>
            <p className="text-primary-400">
              Participants who have completed 100km, ordered by completion time.
            </p>
          </div>
          
          <Button onClick={downloadCSV} icon={<Download className="w-4 h-4" />}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 relative animate-fade-in stagger-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500" />
        <input
          type="text"
          placeholder="Search by name, service number, or station..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-primary-800/50 border border-primary-700 rounded-xl text-white placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-accent-500 transition-all"
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <Card className="animate-fade-in stagger-2 overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary-800/50 border-b border-primary-700">
                <th className="py-3 px-2 sm:px-4 text-xs font-bold text-primary-400 uppercase tracking-wider w-12 text-center">#</th>
                <th className="py-3 px-2 sm:px-4 text-xs font-bold text-primary-400 uppercase tracking-wider w-24">SN</th>
                <th className="py-3 px-2 sm:px-4 text-xs font-bold text-primary-400 uppercase tracking-wider">Name</th>
                <th className="py-3 px-2 sm:px-4 text-xs font-bold text-primary-400 uppercase tracking-wider w-24 sm:w-32 hidden sm:table-cell">Station</th>
                <th className="py-3 px-2 sm:px-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-center w-24">Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-700/50">
              {filteredFinishers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-primary-400">
                    No finishers found yet.
                  </td>
                </tr>
              ) : (
                filteredFinishers.map((row) => (
                  <tr key={row.serviceNumber} className="hover:bg-primary-800/30 transition-colors">
                    <td className="py-3 px-2 sm:px-4 text-primary-500 font-mono text-sm text-center">
                      {row.rank}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-primary-300 text-sm font-mono">
                      {row.serviceNumber}
                    </td>
                    <td className="py-3 px-2 sm:px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="text-white font-medium text-sm truncate max-w-[120px] sm:max-w-none">{row.name}</span>
                          {getRankIcon(row.rank)}
                        </div>
                        <span className="text-xs text-primary-500 sm:hidden">{row.station}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-primary-300 text-sm hidden sm:table-cell">
                      {row.station}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-500/10 text-accent-400 border border-accent-500/20 whitespace-nowrap">
                        {row.daysToComplete}d
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
