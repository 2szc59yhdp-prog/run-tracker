import { useState, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, X, Download } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApp } from '../context/AppContext';
import { fetchAllUsers } from '../services/api';
import type { RegisteredUser } from '../types';

export default function ActiveDays() {
  const navigate = useNavigate();
  const location = useLocation();
  const { runs, isAdmin, isLoading: isRunsLoading } = useApp();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [filter, setFilter] = useState('');

  const isAdminView = location.pathname.startsWith('/admin');

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

  // Calculate active days
  const activeDaysData = useMemo(() => {
    // 1. Map approved runs to users
    const userActiveDates = new Map<string, Set<string>>();

    runs.forEach(run => {
      // Only count approved runs
      if ((run.status || 'pending').toLowerCase() === 'approved') {
        const sn = run.serviceNumber;
        if (!userActiveDates.has(sn)) {
          userActiveDates.set(sn, new Set());
        }
        // Add date to set (ensures uniqueness per day)
        userActiveDates.get(sn)?.add(run.date);
      }
    });

    // 2. Combine with all registered users
    const data = users
      .filter(user => user.station !== 'General Admin') // Exclude General Admin
      .map(user => {
        const activeDates = userActiveDates.get(user.serviceNumber) || new Set();
        return {
          serviceNumber: user.serviceNumber,
          name: user.name,
          station: user.station,
          activeDays: activeDates.size,
          dates: Array.from(activeDates).sort() // Keep dates if needed for debugging or details
        };
      });

    // 3. Sort by active days (descending)
    return data.sort((a, b) => b.activeDays - a.activeDays);
  }, [runs, users]);

  // Filter logic
  const filteredData = useMemo(() => {
    if (!filter.trim()) return activeDaysData;
    const lowerFilter = filter.toLowerCase();
    return activeDaysData.filter(item => 
      item.name.toLowerCase().includes(lowerFilter) || 
      item.serviceNumber.includes(lowerFilter) ||
      item.station.toLowerCase().includes(lowerFilter)
    );
  }, [activeDaysData, filter]);

  // Group by station
  const groupedData = useMemo(() => {
    const groups = new Map<string, typeof filteredData>();
    
    filteredData.forEach(user => {
      if (!groups.has(user.station)) {
        groups.set(user.station, []);
      }
      groups.get(user.station)?.push(user);
    });

    // Sort stations alphabetically
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([station, users]) => ({
        station,
        users: users.sort((a, b) => b.activeDays - a.activeDays) // Ensure users are sorted by active days within station
      }));
  }, [filteredData]);

  // Redirect if not admin and trying to access admin view (must be after hooks)
  if (isAdminView && !isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  const downloadCSV = () => {
    const headers = ['Station', 'Rank', 'Service Number', 'Name', 'Active Days', 'Remaining Days'];
    
    // Create rows based on the grouped structure to match the view
    const rows: (string | number)[][] = [];
    
    groupedData.forEach(({ station, users }) => {
      users.forEach((row, index) => {
        const remainingDays = Math.max(0, 40 - row.activeDays);
        rows.push([
          station,
          index + 1,
          row.serviceNumber,
          row.name,
          row.activeDays,
          remainingDays
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'active_days_report.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isRunsLoading || isLoadingUsers) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <LoadingSpinner size="lg" message="Loading active days data..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <Button 
          variant="ghost" 
          onClick={() => navigate(isAdminView ? '/admin' : '/dashboard')}
          className="mb-4 text-primary-400 hover:text-white pl-0 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAdminView ? 'Back to Admin' : 'Back to Dashboard'}
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
              Active Days
            </h1>
            <p className="text-primary-400">
              Track participant consistency (Approved runs only, 1 count per day)
            </p>
          </div>
          
          {isAdminView && (
            <Button onClick={downloadCSV} icon={<Download className="w-4 h-4" />}>
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="mb-8 relative animate-fade-in stagger-1">
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

      {/* Station Cards */}
      <div className="space-y-8 animate-fade-in stagger-2">
        {groupedData.length === 0 ? (
          <div className="text-center py-12 bg-primary-800/30 rounded-2xl border border-primary-700/50">
            <p className="text-primary-400">No participants found matching your criteria.</p>
          </div>
        ) : (
          groupedData.map(({ station, users }) => (
            <Card key={station} className="overflow-hidden !p-0 border-primary-700/50">
              {/* Card Header */}
              <div className="px-6 py-4 bg-primary-800/80 border-b border-primary-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  {station}
                  <span className="px-2 py-0.5 rounded-full bg-primary-700 text-xs font-medium text-primary-300">
                    {users.length}
                  </span>
                </h2>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary-800/30 border-b border-primary-700/50">
                      <th className="py-3 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider w-16">#</th>
                      <th className="py-3 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider w-32">SN</th>
                      <th className="py-3 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider">Name</th>
                      <th className="py-3 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider text-center w-40">Active Days</th>
                      <th className="py-3 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider text-center w-32">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-700/30">
                    {users.map((row, index) => {
                      const isQualified = row.activeDays >= 40;
                      const remainingDays = Math.max(0, 40 - row.activeDays);
                      
                      return (
                        <tr key={row.serviceNumber} className="hover:bg-primary-800/30 transition-colors">
                          <td className="py-3 px-6 text-primary-500 font-mono text-sm">
                            {index + 1}
                          </td>
                          <td className="py-3 px-6 text-primary-300 text-sm font-mono">
                            {row.serviceNumber}
                          </td>
                          <td className="py-3 px-6">
                            <span className="text-white font-medium text-sm">{row.name}</span>
                          </td>
                          <td className="py-3 px-6 text-center">
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                              isQualified 
                                ? 'bg-success-500/20 text-success-400 border border-success-500/30' 
                                : 'bg-primary-700/50 text-white'
                            }`}>
                              {row.activeDays} <span className="text-[10px] font-normal opacity-70 ml-1">/ 40</span>
                            </span>
                          </td>
                          <td className="py-3 px-6 text-center">
                            <span className={`text-sm font-medium ${
                              remainingDays === 0 ? 'text-success-400' : 'text-primary-400'
                            }`}>
                              {remainingDays}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
