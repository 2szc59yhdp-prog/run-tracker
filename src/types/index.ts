// Core data types for the Run Tracker app

export type RunStatus = 'pending' | 'approved' | 'rejected';

export const REJECTION_REASONS = [
  'Run Data does not match the uploaded Screenshot',
  'Other',
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];

export interface Run {
  id: string;           // Unique identifier (row number or generated ID)
  date: string;         // ISO date string (YYYY-MM-DD)
  serviceNumber: string;
  name: string;
  station: string;
  distanceKm: number;
  distanceDisplay?: string;
  photoId?: string;     // Google Drive file ID
  photoUrl?: string;    // Photo thumbnail URL
  status: RunStatus;    // Approval status
  rejectionReason?: string; // Reason for rejection (if rejected)
  approvedBy?: string;      // Service number of admin who approved/rejected
  approvedByName?: string;  // Name of admin who approved/rejected
  approvedAt?: string;      // Timestamp of approval/rejection
  submittedAt?: string;     // Timestamp when run was submitted (YYYY-MM-DD HH:MM:SS)
  duplicateOf?: string;     // Info about original run if screenshot is duplicate (e.g., "2025-11-28 | John Doe (#1234)")
}

export interface RegisteredUser {
  id: string;
  serviceNumber: string;
  name: string;
  rank: string;
  email: string;
  phone: string;
  station: string;
  createdAt?: string;
  isAdmin?: boolean;        // Whether user has admin privileges
  adminPassword?: string;   // Admin password (only for admins)
  pin?: string;             // Permanent participant PIN (admin-managed)
}

export interface AddUserPayload {
  serviceNumber: string;
  name: string;
  rank: string;
  email: string;
  phone: string;
  station: string;
}

export interface UpdateUserPayload extends AddUserPayload {
  id: string;
}

export interface RunnerStats {
  serviceNumber: string;
  name: string;
  station: string;
  totalDistance: number;
  runCount: number;
}

export interface DashboardStats {
  totalDistance: number;
  uniqueRunners: number;
  totalRuns: number;
}

export interface PhotoPayload {
  base64: string;       // Base64 encoded image data (without data URL prefix)
  mimeType: string;     // e.g., 'image/jpeg', 'image/png'
  hash?: string;        // SHA-256 hash for duplicate detection (calculated on frontend)
}

export interface AddRunPayload {
  date: string;
  serviceNumber: string;
  name: string;
  station: string;
  distanceKm: number;
  distanceDisplay?: string;
  photo?: PhotoPayload; // Optional photo upload
}

export interface UpdateRunPayload extends AddRunPayload {
  id: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Admin authentication state
export interface AdminState {
  isAdmin: boolean;
  adminUser: AdminUser | null;
  login: (serviceNumber: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Logged in admin user info
export interface AdminUser {
  serviceNumber: string;
  name: string;
}
