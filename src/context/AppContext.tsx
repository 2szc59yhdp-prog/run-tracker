import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Run, RunnerStats, DashboardStats, AdminUser, RegisteredUser } from '../types';
import { fetchAllRuns, validateAdminLogin, validateAdminPassword, getUserByServiceNumber, logParticipantLogin } from '../services/api';
import { STORAGE_KEYS } from '../config';

// Cache configuration
const CACHE_KEY = 'run_tracker_runs_cache';
const CACHE_TIMESTAMP_KEY = 'run_tracker_cache_timestamp';

// Helper to get cached data from localStorage
function getCachedRuns(): Run[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (cached && timestamp) {
      const data = JSON.parse(cached) as Run[];
      return data;
    }
  } catch {
    // Invalid cache, ignore
  }
  return null;
}

// Helper to save runs to cache
function setCachedRuns(runs: Run[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(runs));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch {
    // Storage full or unavailable, ignore
  }
}

interface AppContextType {
  // Data
  runs: Run[];
  runnerStats: RunnerStats[];
  dashboardStats: DashboardStats;
  recentRuns: Run[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean; // New: true when fetching in background
  error: string | null;
  
  // Admin state
  isAdmin: boolean;
  adminToken: string | null;
  adminUser: AdminUser | null;
  // Participant state
  isParticipant: boolean;
  participantUser: RegisteredUser | null;
  
  // Actions
  refreshData: (silent?: boolean) => Promise<void>;
  loginAdmin: (serviceNumber: string, password: string) => Promise<boolean>;
  loginAdminLegacy: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  loginParticipant: (serviceNumber: string, pin: string) => Promise<boolean>;
  logoutParticipant: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // Try to load cached data immediately for instant display
  const [runs, setRuns] = useState<Run[]>(() => getCachedRuns() || []);
  const [isLoading, setIsLoading] = useState(() => !getCachedRuns()); // Only show loading if no cache
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [participantUser, setParticipantUser] = useState<RegisteredUser | null>(null);
  
  // Track if initial fetch is done
  const initialFetchDone = useRef(false);

  // Filter only APPROVED runs for leaderboard calculations
  const approvedRuns = runs.filter(run => (run.status || 'pending').toLowerCase().trim() === 'approved');

  // Filter out General Admin from participant counts (they are admins, not participants)
  const participantRuns = approvedRuns.filter(run => run.station !== 'General Admin');

  // Calculate runner statistics from APPROVED runs only (excluding General Admin)
  const runnerStats: RunnerStats[] = (() => {
    const statsMap = new Map<string, RunnerStats>();
    
    // Only count approved runs for the leaderboard (excluding General Admin)
    participantRuns.forEach(run => {
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

  // Calculate dashboard statistics from APPROVED runs only (excluding General Admin)
  const dashboardStats: DashboardStats = {
    totalDistance: participantRuns.reduce((sum, run) => sum + run.distanceKm, 0),
    uniqueRunners: runnerStats.length,
    totalRuns: participantRuns.length,
  };

  // Get recent runs (last 20, sorted by date descending) - shows ALL runs with status
  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  // Fetch data from API with stale-while-revalidate caching
  // silent = true: background refresh, no loading spinner
  // If we have cached data, show it immediately and fetch fresh data in background
  const refreshData = useCallback(async (silent = false) => {
    const hasCachedData = runs.length > 0;
    
    // Only show full loading spinner if no cached data AND not silent
    if (!silent && !hasCachedData) {
      setIsLoading(true);
    }
    
    // Show subtle refresh indicator when we have cached data
    if (hasCachedData) {
      setIsRefreshing(true);
    }
    
    setError(null);
    
    try {
      const response = await fetchAllRuns();
      
      if (response.success && response.data) {
        // Ensure all runs have a status (default to 'pending' for backwards compatibility)
        const runsWithStatus = response.data.map(run => ({
          ...run,
          status: (run.status || 'pending').toLowerCase().trim(),
        })) as Run[];
        
        setRuns(runsWithStatus);
        
        // Cache the fresh data
        setCachedRuns(runsWithStatus);
      } else if (!silent && !hasCachedData) {
        // Only show error if we have no cached data to display
        setError(response.error || 'Failed to load data');
      }
    } catch (err) {
      if (!silent && !hasCachedData) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      initialFetchDone.current = true;
    }
  }, [runs.length]);

  // Admin login with service number and password
  const loginAdmin = useCallback(async (serviceNumber: string, password: string): Promise<boolean> => {
    try {
      const response = await validateAdminLogin(serviceNumber, password);
      
      if (response.success && response.data?.token && response.data?.admin) {
        setIsAdmin(true);
        setAdminToken(response.data.token);
        setAdminUser(response.data.admin);
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.admin));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Legacy admin login (for backwards compatibility)
  const loginAdminLegacy = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await validateAdminPassword(password);
      
      if (response.success && response.data?.token) {
        setIsAdmin(true);
        setAdminToken(response.data.token);
        setAdminUser({ serviceNumber: 'SYSTEM', name: 'System Admin' });
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
    setAdminUser(null);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem('adminUser');
  }, []);

  // Participant login with service number + PIN (placeholder: last 4 digits of phone)
  const loginParticipant = useCallback(async (serviceNumber: string, pin: string): Promise<boolean> => {
    try {
      const res = await getUserByServiceNumber(serviceNumber.trim());
      if (res.success && res.data) {
        const user = res.data;
        const expectedPin = (user.pin || '').trim() || (() => {
          const phone = (user.phone || '').replace(/\D/g, '');
          return phone ? phone.slice(-4) : '1234';
        })();
        if (pin === expectedPin) {
          setIsParticipant(true);
          setParticipantUser(user);
          localStorage.setItem(STORAGE_KEYS.PARTICIPANT_SN, user.serviceNumber);
          localStorage.setItem(STORAGE_KEYS.PARTICIPANT_NAME, user.name);
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const lang = typeof navigator !== 'undefined' ? navigator.language : '';
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const platform = typeof navigator !== 'undefined' ? (navigator as any).platform || '' : '';
          logParticipantLogin({
            serviceNumber: user.serviceNumber,
            name: user.name,
            station: user.station || '',
            userAgent: ua,
            language: lang,
            timezone: tz,
            platform,
          }).catch(() => {});
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logoutParticipant = useCallback(() => {
    setIsParticipant(false);
    setParticipantUser(null);
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_SN);
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_NAME);
  }, []);

  // Initialize - check for existing admin session and load data
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    const storedAdminUser = localStorage.getItem('adminUser');
    
    if (storedToken) {
      setIsAdmin(true);
      setAdminToken(storedToken);
      
      if (storedAdminUser) {
        try {
          setAdminUser(JSON.parse(storedAdminUser));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
    const participantSN = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_SN);
    if (participantSN) {
      // Best-effort fetch of participant details
      getUserByServiceNumber(participantSN).then((res) => {
        if (res.success && res.data) {
          setIsParticipant(true);
          setParticipantUser(res.data);
        } else {
          // stale session
          localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_SN);
          localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_NAME);
        }
      });
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
        isRefreshing,
        error,
        isAdmin,
        adminToken,
        adminUser,
        isParticipant,
        participantUser,
        refreshData,
        loginAdmin,
        loginAdminLegacy,
        logoutAdmin,
        loginParticipant,
        logoutParticipant,
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
