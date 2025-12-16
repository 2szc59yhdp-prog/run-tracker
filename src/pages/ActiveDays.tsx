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

  // Redirect if not admin and trying to access admin view (must be after hooks)
  if (isAdminView && !isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  const downloadCSV = () => {
    const headers = ['Rank', 'Service Number', 'Name', 'Station', 'Active Days'];
    const rows = filteredData.map((row, index) => [
      index + 1,
      row.serviceNumber,
      row.name,
      row.station,
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
                <th className="py-4 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider">Rank</th>
                <th className="py-4 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider">Participant</th>
                <th className="py-4 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider">Station</th>
                <th className="py-4 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider text-center">Active Days</th>
                <th className="py-4 px-6 text-xs font-bold text-primary-400 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-700/50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-primary-400">
                    No participants found.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => {
                  const isQualified = row.activeDays >= 40;
                  return (
                    <tr key={row.serviceNumber} className="hover:bg-primary-800/30 transition-colors">
                      <td className="py-4 px-6 text-primary-500 font-mono text-sm">
                        {index + 1}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-white font-medium">{row.name}</span>
                          <span className="text-xs text-primary-500">#{row.serviceNumber}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-primary-300 text-sm">
                        {row.station}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${
                          isQualified 
                            ? 'bg-success-500/20 text-success-400 border border-success-500/30' 
                            : 'bg-primary-700/50 text-white'
                        }`}>
                          {row.activeDays}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isQualified ? (
                          <span className="text-xs font-bold text-success-400 uppercase tracking-wider">Qualified</span>
                        ) : (
                          <span className="text-xs text-primary-500">In Progress</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
