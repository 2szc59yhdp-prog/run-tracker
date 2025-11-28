import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Run, RunnerStats, DashboardStats } from '../types';
import { fetchAllRuns, validateAdminPassword } from '../services/api';
import { STORAGE_KEYS } from '../config';

interface AppContextType {
  // Data
  runs: Run[];
  runnerStats: RunnerStats[];
  dashboardStats: DashboardStats;
  recentRuns: Run[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Admin state
  isAdmin: boolean;
  adminToken: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  loginAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Filter only APPROVED runs for leaderboard calculations
  const approvedRuns = runs.filter(run => run.status === 'approved');

  // Calculate runner statistics from APPROVED runs only
  const runnerStats: RunnerStats[] = (() => {
    const statsMap = new Map<string, RunnerStats>();
    
    // Only count approved runs for the leaderboard
    approvedRuns.forEach(run => {
      const existing = statsMap.get(run.serviceNumber);
      if (existing) {
        existing.totalDistance += run.distanceKm;
        existing.runCount += 1;
      } else {
        statsMap.set(run.serviceNumber, {
          serviceNumber: run.serviceNumber,
          name: run.name,
          station: run.station,
          totalDistance: run.distanceKm,
          runCount: 1,
        });
      }
    });
    
    return Array.from(statsMap.values())
      .sort((a, b) => b.totalDistance - a.totalDistance);
  })();

  // Calculate dashboard statistics from APPROVED runs only
  const dashboardStats: DashboardStats = {
    totalDistance: approvedRuns.reduce((sum, run) => sum + run.distanceKm, 0),
    uniqueRunners: runnerStats.length,
    totalRuns: approvedRuns.length,
  };

  // Get recent runs (last 20, sorted by date descending) - shows ALL runs with status
  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Fetch data from API
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchAllRuns();
      
      if (response.success && response.data) {
        // Ensure all runs have a status (default to 'pending' for backwards compatibility)
        const runsWithStatus = response.data.map(run => ({
          ...run,
          status: run.status || 'pending',
        }));
        setRuns(runsWithStatus as Run[]);
      } else {
        setError(response.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Admin login
  const loginAdmin = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await validateAdminPassword(password);
      
      if (response.success && response.data?.token) {
        setIsAdmin(true);
        setAdminToken(response.data.token);
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, response.data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Admin logout
  const logoutAdmin = useCallback(() => {
    setIsAdmin(false);
    setAdminToken(null);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  }, []);

  // Initialize - check for existing admin session and load data
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (storedToken) {
      setIsAdmin(true);
      setAdminToken(storedToken);
    }
    
    refreshData();
  }, [refreshData]);

  return (
    <AppContext.Provider
      value={{
        runs,
        runnerStats,
        dashboardStats,
        recentRuns,
        isLoading,
        error,
        isAdmin,
        adminToken,
        refreshData,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
