/**
 * API Service for Google Sheets integration
 * 
 * This module handles all communication with the Google Apps Script Web App
 * that serves as our serverless backend for Google Sheets operations.
 */

import { APPS_SCRIPT_URL } from '../config';
import type { Run, AddRunPayload, UpdateRunPayload, ApiResponse, RegisteredUser, AddUserPayload, UpdateUserPayload } from '../types';

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
 * Checks if a run already exists for a given service number and date
 */
export async function checkDuplicateRun(
  serviceNumber: string,
  date: string
): Promise<ApiResponse<{ exists: boolean }>> {
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
 * Validates admin password with the backend
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

