/**
 * API Service for Google Sheets integration
 * 
 * This module handles all communication with the Google Apps Script Web App
 * that serves as our serverless backend for Google Sheets operations.
 */

import { APPS_SCRIPT_URL } from '../config';
import type { Run, AddRunPayload, UpdateRunPayload, ApiResponse, RegisteredUser, AddUserPayload, UpdateUserPayload, AdminUser } from '../types';

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

