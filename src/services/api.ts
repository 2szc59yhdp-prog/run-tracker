/**
 * API Service for Google Sheets integration
 * 
 * This module handles all communication with the Google Apps Script Web App
 * that serves as our serverless backend for Google Sheets operations.
 */

import { APPS_SCRIPT_URL } from '../config';
import type { Run, AddRunPayload, UpdateRunPayload, ApiResponse, RegisteredUser, AddUserPayload, UpdateUserPayload, AdminUser } from '../types';

export interface Sponsor {
  id: string;
  businessName: string;
  details?: string;
  amountSponsored: number;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt?: string;
}

export interface FundUsageEntry {
  id: string;
  purpose: string;
  amountUsed: number;
  serviceNumber: string;
  sponsorId?: string;
  date: string;
}

export interface OutstandingEntry {
  id: string;
  serviceNumber: string;
  name: string;
  station?: string;
  reason: string;
  addedByServiceNumber: string;
  date: string;
}

/**
 * Pre-warms the Google Apps Script API to reduce cold start delay
 * This makes a lightweight request to wake up the serverless function
 */
export async function warmupApi(): Promise<void> {
  try {
    // Use a simple GET request with a ping action
    // This wakes up the Google Apps Script without doing heavy work
    fetch(`${APPS_SCRIPT_URL}?action=ping`, {
      method: 'GET',
    }).catch(() => {
      // Silently ignore errors - this is just a warmup
    });
  } catch {
    // Silently ignore errors
  }
}

/**
 * Fetches all runs from the Google Sheet
 */
export async function fetchAllRuns(): Promise<ApiResponse<Run[]>> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getRuns`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching runs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch runs',
    };
  }
}

/**
 * Checks daily run limits for a given service number and date
 * Returns count, total distance, and remaining allowance
 */
export async function checkDuplicateRun(
  serviceNumber: string,
  date: string
): Promise<ApiResponse<{ 
  exists: boolean; 
  count: number; 
  totalDistance: number;
  remainingDistance: number;
  maxRunsReached: boolean;
  maxDistanceReached: boolean;
}>> {
  try {
    const params = new URLSearchParams({
      action: 'checkDuplicate',
      serviceNumber,
      date,
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check for duplicate',
    };
  }
}

/**
 * Adds a new run to the Google Sheet
 */
export async function addRun(payload: AddRunPayload): Promise<ApiResponse<Run>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addRun',
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error adding run:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add run',
    };
  }
}

export async function logParticipantLogin(payload: {
  serviceNumber: string;
  name: string;
  station: string;
  userAgent?: string;
  language?: string;
  timezone?: string;
  platform?: string;
  ip?: string;
}): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'logUserLogin', ...payload }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to log login' };
  }
}

/**
 * Updates an existing run (Admin only)
 */
export async function updateRun(
  payload: UpdateRunPayload,
  adminToken: string
): Promise<ApiResponse<Run>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateRun',
        adminToken,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating run:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update run',
    };
  }
}

/**
 * Deletes a run (Admin only)
 */
export async function deleteRun(
  runId: string,
  adminToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteRun',
        id: runId,
        adminToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting run:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete run',
    };
  }
}

/**
 * Updates a run's approval status (Admin only)
 */
export async function updateRunStatus(
  runId: string,
  status: 'pending' | 'approved' | 'rejected',
  adminToken: string,
  adminUser?: AdminUser,
  rejectionReason?: string
): Promise<ApiResponse<Run>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateRunStatus',
        id: runId,
        status,
        adminToken,
        approvedBy: adminUser?.serviceNumber || '',
        approvedByName: adminUser?.name || '',
        rejectionReason: rejectionReason || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating run status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    };
  }
}

/**
 * Validates admin credentials (service number + password)
 */
export async function validateAdminLogin(
  serviceNumber: string,
  password: string
): Promise<ApiResponse<{ token: string; admin: AdminUser }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'validateAdminLogin',
        serviceNumber,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error validating admin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate admin',
    };
  }
}

/**
 * Legacy: Validates admin password with the backend (keeping for backwards compatibility)
 */
export async function validateAdminPassword(
  password: string
): Promise<ApiResponse<{ token: string }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'validateAdmin',
        password,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error validating admin:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate admin',
    };
  }
}

// ============================================================
// USER API FUNCTIONS
// ============================================================

/**
 * Fetches all registered users
 */
export async function fetchAllUsers(): Promise<ApiResponse<RegisteredUser[]>> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getUsers`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users',
    };
  }
}

/**
 * Secure: Fetches all registered users WITH pins (Admin only, 5568)
 */
export async function fetchAllUsersWithPins(adminToken: string, actorServiceNumber: string): Promise<ApiResponse<RegisteredUser[]>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'getUsersWithPins',
        adminToken,
        actorServiceNumber,
      }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users with pins:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch users with pins' };
  }
}

/**
 * Secure: Updates a user's PIN (Admin only, 5568)
 */
export async function updateUserPin(userId: string, pin: string, adminToken: string, actorServiceNumber: string): Promise<ApiResponse<RegisteredUser>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateUserPin', id: userId, pin, adminToken, actorServiceNumber }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user pin:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update user pin' };
  }
}

export async function sendPinEmails(adminToken: string, actorServiceNumber: string): Promise<ApiResponse<{ sent: number; skipped: number; missingEmail?: number; excludedAdmin?: number; autoAssigned?: number; failed?: Array<{ email: string; name: string; error?: string }>; succeeded?: Array<{ email: string; name: string }> }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'sendPinEmails', adminToken, actorServiceNumber }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending PIN emails:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send PIN emails' };
  }
}

export async function sendPinEmailsList(entries: Array<{ name: string; serviceNumber: string; station: string; email: string; pin: string }>, adminToken: string, actorServiceNumber: string): Promise<ApiResponse<{ sent: number; skipped: number; failed?: Array<{ email: string; name: string; error?: string }>; succeeded?: Array<{ email: string; name: string }> }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'enqueuePinEmailsList', entries, adminToken, actorServiceNumber }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending PIN emails from list:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send PIN emails from list' };
  }
}

export async function getEmailQuota(adminToken: string): Promise<ApiResponse<{ remaining: number }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getEmailQuota', adminToken }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get email quota' };
  }
}

export async function getPinEmailQueueStatus(adminToken: string, actorServiceNumber: string): Promise<ApiResponse<{ sent: Array<{ email: string; name: string; sentAt?: string }>; failed: Array<{ email: string; name: string; error?: string }>; pending: Array<{ email: string; name: string }>; counts: { sent: number; failed: number; pending: number }; remaining: number }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getPinEmailQueueStatus', adminToken, actorServiceNumber }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get PIN email queue status' };
  }
}

/**
 * Gets a user by service number (for auto-fill)
 */
export async function getUserByServiceNumber(
  serviceNumber: string
): Promise<ApiResponse<RegisteredUser | null>> {
  try {
    const params = new URLSearchParams({
      action: 'getUserByServiceNumber',
      serviceNumber,
    });

    const response = await fetch(`${APPS_SCRIPT_URL}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user',
    };
  }
}

/**
 * Adds a new registered user (Admin only)
 */
export async function addUser(
  payload: AddUserPayload,
  adminToken: string
): Promise<ApiResponse<RegisteredUser>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addUser',
        adminToken,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error adding user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add user',
    };
  }
}

/**
 * Updates an existing user (Admin only)
 */
export async function updateUser(
  payload: UpdateUserPayload,
  adminToken: string
): Promise<ApiResponse<RegisteredUser>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateUser',
        adminToken,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user',
    };
  }
}

/**
 * Deletes a user (Admin only)
 */
export async function deleteUser(
  userId: string,
  adminToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteUser',
        id: userId,
        adminToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user',
    };
  }
}

/**
 * Updates a user's admin status and password (Admin only)
 */
export async function updateUserAdminStatus(
  userId: string,
  isAdmin: boolean,
  adminPassword: string | null,
  adminToken: string
): Promise<ApiResponse<RegisteredUser>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateUserAdminStatus',
        id: userId,
        isAdmin,
        adminPassword: adminPassword || '',
        adminToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user admin status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update admin status',
    };
  }
}

export async function fetchSponsors(): Promise<ApiResponse<Sponsor[]>> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSponsors`, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch sponsors' };
  }
}

export async function addSponsorApi(payload: Omit<Sponsor, 'id' | 'createdAt'>, adminToken: string): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'addSponsor', adminToken, ...payload }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add sponsor' };
  }
}

export async function fetchFundUsages(): Promise<ApiResponse<FundUsageEntry[]>> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getFundUsages`, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch fund usages' };
  }
}

export async function addFundUsageApi(payload: Omit<FundUsageEntry, 'id' | 'date'>, adminToken: string): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'addFundUsage', adminToken, ...payload }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add fund usage' };
  }
}

export async function fetchOutstandings(): Promise<ApiResponse<OutstandingEntry[]>> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getOutstandings`, { method: 'GET' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch outstandings' };
  }
}

export async function addOutstandingApi(payload: Omit<OutstandingEntry, 'id' | 'date'>, adminToken: string): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'addOutstanding', adminToken, ...payload }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add outstanding' };
  }
}

export async function clearOutstandingApi(id: string, adminToken: string, actorServiceNumber: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'clearOutstanding', id, adminToken, actorServiceNumber }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to clear outstanding' };
  }
}

