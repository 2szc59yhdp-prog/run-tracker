/**
 * Configuration for the Run Tracker app
 * 
 * IMPORTANT: After deploying your Google Apps Script Web App,
 * replace the APPS_SCRIPT_URL below with your actual deployment URL.
 * 
 * Steps to get your URL:
 * 1. Go to your Google Apps Script project
 * 2. Click "Deploy" > "Manage deployments"
 * 3. Copy the "Web app URL"
 * 4. Paste it below
 */

// Google Apps Script Web App URL
export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxReBmxHeL5dCaLhcwpbOQIxCkzr7xHXSn-V2hZ3xOe1-ee9YLYPDjuqudFlNQd4GmZ/exec';

// Admin password - Must match the ADMIN_PASSWORD in your Apps Script properties
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'RunTracker2025!';

// Local storage keys
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'run_tracker_admin_token',
} as const;

// App constants
export const APP_CONFIG = {
  APP_NAME: 'Madaveli Police 100K Run Challenge',
  APP_DESCRIPTION: 'Track your runs and compete on the leaderboard!',
  RECENT_RUNS_LIMIT: 20,
  DATE_FORMAT: 'YYYY-MM-DD',
} as const;

