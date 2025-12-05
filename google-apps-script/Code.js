/**
 * Run Tracker - Google Apps Script Backend
 * 
 * This script serves as the serverless backend for the Run Tracker application.
 * It handles all CRUD operations for run data stored in Google Sheets.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 
 * 1. Create a new Google Sheet
 *    - Go to https://sheets.google.com and create a new spreadsheet
 *    - Name it "Run Tracker Data" (or any name you prefer)
 *    - Rename the first sheet to "Runs"
 *    - Add the following headers in row 1:
 *      A1: ID | B1: Date | C1: ServiceNumber | D1: Name | E1: Station | F1: DistanceKm
 * 
 * 2. Create the Apps Script project
 *    - In your Google Sheet, go to Extensions > Apps Script
 *    - Delete any existing code and paste this entire file
 *    - Save the project (Ctrl/Cmd + S)
 * 
 * 3. Configure the Script Properties
 *    - In Apps Script, go to Project Settings (gear icon)
 *    - Scroll down to "Script Properties"
 *    - Add the following properties:
 *      - SPREADSHEET_ID: The ID from your Google Sheet URL
 *        (e.g., if URL is https://docs.google.com/spreadsheets/d/ABC123/edit, the ID is ABC123)
 *      - ADMIN_PASSWORD: Your chosen admin password
 *      - ADMIN_TOKEN: A random string for admin session validation (e.g., generate a UUID)
 * 
 * 4. Deploy as Web App
 *    - Click "Deploy" > "New deployment"
 *    - Select type: "Web app"
 *    - Set "Execute as": "Me"
 *    - Set "Who has access": "Anyone"
 *    - Click "Deploy"
 *    - Authorize the app when prompted
 *    - Copy the Web App URL and use it in your frontend .env file
 * 
 * 5. Update the Web App
 *    - After making changes, go to "Deploy" > "Manage deployments"
 *    - Click the edit (pencil) icon on your deployment
 *    - Select "New version" and click "Deploy"
 */

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Gets script properties for configuration
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    adminPassword: props.getProperty('ADMIN_PASSWORD') || 'admin123',
    adminToken: props.getProperty('ADMIN_TOKEN') || 'default-admin-token-change-me',
    sheetName: 'Runs'
  };
}

/**
 * Gets the Runs sheet
 */
function getRunsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return spreadsheet.getSheetByName(config.sheetName);
}

/**
 * Gets the Users sheet
 */
function getUsersSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return spreadsheet.getSheetByName('Users');
}

function getSponsorsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('Sponsors');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Sponsors');
    sheet.getRange(1, 1, 1, 8).setValues([[
      'ID', 'BusinessName', 'Details', 'AmountSponsored', 'ContactName', 'ContactPhone', 'ContactEmail', 'CreatedAt'
    ]]);
  }
  return sheet;
}

function getFundUsageSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('FundUsage');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('FundUsage');
    sheet.getRange(1, 1, 1, 6).setValues([[
      'ID', 'Purpose', 'AmountUsed', 'ServiceNumber', 'SponsorId', 'Date'
    ]]);
  }
  return sheet;
}

function getOutstandingsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('Outstanding');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Outstanding');
    sheet.getRange(1, 1, 1, 7).setValues([[
      'ID', 'ServiceNumber', 'Name', 'Station', 'Reason', 'AddedByServiceNumber', 'Date'
    ]]);
  }
  return sheet;
}

/**
 * Gets or creates the Run Photos folder in Google Drive
 * @returns {Folder} The photos folder
 */
function getPhotosFolder() {
  const folderName = 'Run Tracker Photos';
  const folders = DriveApp.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Create the folder if it doesn't exist
  return DriveApp.createFolder(folderName);
}

/**
 * Uploads a photo to Google Drive
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} fileName - Name for the file
 * @param {string} mimeType - MIME type of the image
 * @returns {Object} Object with file ID and URL
 */
function uploadPhotoToDrive(base64Data, fileName, mimeType) {
  try {
    const folder = getPhotosFolder();
    
    // Decode base64 data
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, fileName);
    
    // Create file in Drive
    const file = folder.createFile(blob);
    
    // Make file publicly accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400'
    };
  } catch (error) {
    Logger.log('Error uploading photo: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deletes a photo from Google Drive
 * @param {string} fileId - The file ID to delete
 */
function deletePhotoFromDrive(fileId) {
  try {
    if (fileId) {
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
    }
    return { success: true };
  } catch (error) {
    Logger.log('Error deleting photo: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Calculates MD5 hash of base64 image data
 * @param {string} base64Data - Base64 encoded image data
 * @returns {string} MD5 hash as hex string
 */
function calculatePhotoHash(base64Data) {
  try {
    const decodedData = Utilities.base64Decode(base64Data);
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, decodedData);
    // Convert byte array to hex string
    return digest.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
  } catch (error) {
    Logger.log('Error calculating photo hash: ' + error.message);
    return null;
  }
}

/**
 * Checks if a photo hash already exists in the database
 * @param {string} photoHash - The MD5 hash to check
 * @returns {Object} Object with exists boolean and original run info if found
 */
function checkDuplicatePhoto(photoHash) {
  if (!photoHash) {
    return { exists: false };
  }
  
  const sheet = getRunsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices by name (not assuming fixed positions)
  const photoHashColIndex = headers.indexOf('PhotoHash');
  const dateColIndex = headers.indexOf('Date');
  const serviceNumberColIndex = headers.indexOf('ServiceNumber');
  const nameColIndex = headers.indexOf('Name');
  
  if (photoHashColIndex === -1) {
    // Column doesn't exist yet, no duplicates possible
    return { exists: false };
  }
  
  // Search for matching hash
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const existingHash = row[photoHashColIndex] ? row[photoHashColIndex].toString() : '';
    
    if (existingHash && existingHash === photoHash) {
      // Found a duplicate - return info about the original run
      const originalDate = dateColIndex >= 0 ? formatDate(row[dateColIndex]) : 'Unknown date';
      const originalServiceNumber = serviceNumberColIndex >= 0 ? row[serviceNumberColIndex].toString() : '?';
      const originalName = nameColIndex >= 0 ? row[nameColIndex].toString() : 'Unknown';
      
      return {
        exists: true,
        originalRun: {
          date: originalDate,
          serviceNumber: originalServiceNumber,
          name: originalName
        }
      };
    }
  }
  
  return { exists: false };
}

// ============================================================
// HTTP HANDLERS
// ============================================================

/**
 * Handles GET requests
 * @param {Object} e - Event object containing query parameters
 */
function doGet(e) {
  const action = e.parameter.action || 'getRuns';
  
  let result;
  
  try {
    switch (action) {
      case 'ping':
        // Lightweight warmup endpoint - just returns success immediately
        result = { success: true, message: 'pong' };
        break;
      case 'getRuns':
        result = getAllRuns();
        break;
      case 'checkDuplicate':
        result = checkDuplicateRun(
          e.parameter.serviceNumber,
          e.parameter.date
        );
        break;
      case 'getUsers':
        result = getAllUsers();
        break;
      case 'getSponsors':
        result = getAllSponsors();
        break;
      case 'getFundUsages':
        result = getAllFundUsages();
        break;
      case 'getOutstandings':
        result = getAllOutstandings();
        break;
      case 'getUserByServiceNumber':
        result = getUserByServiceNumber(e.parameter.serviceNumber);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  return createJsonResponse(result);
}

/**
 * Handles POST requests
 * @param {Object} e - Event object containing POST data
 */
function doPost(e) {
  let result;
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'addRun':
        result = addRun(data);
        break;
      case 'updateRun':
        result = updateRun(data);
        break;
      case 'updateRunStatus':
        result = updateRunStatus(data);
        break;
      case 'deleteRun':
        result = deleteRun(data);
        break;
      case 'validateAdmin':
        result = validateAdmin(data.password);
        break;
      case 'validateAdminLogin':
        result = validateAdminLogin(data.serviceNumber, data.password);
        break;
      case 'addUser':
        result = addUser(data);
        break;
      case 'updateUserAdminStatus':
        result = updateUserAdminStatus(data);
        break;
      case 'updateUser':
        result = updateUser(data);
        break;
      case 'deleteUser':
        result = deleteUser(data);
        break;
      case 'addSponsor':
        result = addSponsor(data);
        break;
      case 'addFundUsage':
        result = addFundUsage(data);
        break;
      case 'addOutstanding':
        result = addOutstanding(data);
        break;
      case 'clearOutstanding':
        result = clearOutstanding(data);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  return createJsonResponse(result);
}

/**
 * Creates a JSON response with proper CORS headers
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// DATA OPERATIONS
// ============================================================

/**
 * Gets all runs from the sheet
 * @returns {Object} Response with runs array
 */
function getAllRuns() {
  const sheet = getRunsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const statusColIndex = headers.indexOf('Status');
  const photoIdColIndex = headers.indexOf('PhotoId');
  const photoUrlColIndex = headers.indexOf('PhotoUrl');
  const rejectionReasonColIndex = headers.indexOf('RejectionReason');
  const approvedByColIndex = headers.indexOf('ApprovedBy');
  const approvedByNameColIndex = headers.indexOf('ApprovedByName');
  const approvedAtColIndex = headers.indexOf('ApprovedAt');
  const submittedAtColIndex = headers.indexOf('SubmittedAt');
  const duplicateOfColIndex = headers.indexOf('DuplicateOf');
  const distanceDisplayColIndex = headers.indexOf('DistanceDisplay');
  
  // Skip header row
  const runs = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // Check if ID exists
      runs.push({
        id: row[0].toString(),
        date: formatDate(row[1]),
        serviceNumber: row[2].toString(),
        name: row[3].toString(),
        station: row[4].toString(),
        distanceKm: parseFloat(row[5]) || 0,
        distanceDisplay: distanceDisplayColIndex >= 0 && row[distanceDisplayColIndex] ? row[distanceDisplayColIndex].toString() : '',
        photoId: photoIdColIndex >= 0 && row[photoIdColIndex] ? row[photoIdColIndex].toString() : '',
        photoUrl: photoUrlColIndex >= 0 && row[photoUrlColIndex] ? row[photoUrlColIndex].toString() : '',
        status: statusColIndex >= 0 && row[statusColIndex] ? row[statusColIndex].toString() : 'pending',
        rejectionReason: rejectionReasonColIndex >= 0 && row[rejectionReasonColIndex] ? row[rejectionReasonColIndex].toString() : '',
        approvedBy: approvedByColIndex >= 0 && row[approvedByColIndex] ? row[approvedByColIndex].toString() : '',
        approvedByName: approvedByNameColIndex >= 0 && row[approvedByNameColIndex] ? row[approvedByNameColIndex].toString() : '',
        approvedAt: approvedAtColIndex >= 0 && row[approvedAtColIndex] ? formatDate(row[approvedAtColIndex]) : '',
        submittedAt: submittedAtColIndex >= 0 && row[submittedAtColIndex] ? formatDateTime(row[submittedAtColIndex]) : '',
        duplicateOf: duplicateOfColIndex >= 0 && row[duplicateOfColIndex] ? row[duplicateOfColIndex].toString() : ''
      });
    }
  }
  
  return { success: true, data: runs };
}

function getAllSponsors() {
  const sheet = getSponsorsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      list.push({
        id: row[headers.indexOf('ID')] ? row[headers.indexOf('ID')].toString() : '',
        businessName: headers.indexOf('BusinessName') >= 0 && row[headers.indexOf('BusinessName')] ? row[headers.indexOf('BusinessName')].toString() : '',
        details: headers.indexOf('Details') >= 0 && row[headers.indexOf('Details')] ? row[headers.indexOf('Details')].toString() : '',
        amountSponsored: headers.indexOf('AmountSponsored') >= 0 ? (parseFloat(row[headers.indexOf('AmountSponsored')]) || 0) : 0,
        contactName: headers.indexOf('ContactName') >= 0 && row[headers.indexOf('ContactName')] ? row[headers.indexOf('ContactName')].toString() : '',
        contactPhone: headers.indexOf('ContactPhone') >= 0 && row[headers.indexOf('ContactPhone')] ? row[headers.indexOf('ContactPhone')].toString() : '',
        contactEmail: headers.indexOf('ContactEmail') >= 0 && row[headers.indexOf('ContactEmail')] ? row[headers.indexOf('ContactEmail')].toString() : '',
        createdAt: headers.indexOf('CreatedAt') >= 0 && row[headers.indexOf('CreatedAt')] ? formatDateTime(row[headers.indexOf('CreatedAt')]) : ''
      });
    }
  }
  return { success: true, data: list };
}

function addSponsor(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.businessName || data.amountSponsored == null || !data.contactName) {
    return { success: false, error: 'Missing required fields' };
  }
  const sheet = getSponsorsSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = new Array(sheet.getLastColumn()).fill('');
  const id = generateId();
  const createdAt = new Date();
  const col = {
    id: headers.indexOf('ID'),
    businessName: headers.indexOf('BusinessName'),
    details: headers.indexOf('Details'),
    amountSponsored: headers.indexOf('AmountSponsored'),
    contactName: headers.indexOf('ContactName'),
    contactPhone: headers.indexOf('ContactPhone'),
    contactEmail: headers.indexOf('ContactEmail'),
    createdAt: headers.indexOf('CreatedAt'),
  };
  if (col.id >= 0) newRow[col.id] = id;
  if (col.businessName >= 0) newRow[col.businessName] = data.businessName.toString().trim();
  if (col.details >= 0) newRow[col.details] = (data.details || '').toString().trim();
  if (col.amountSponsored >= 0) newRow[col.amountSponsored] = parseFloat(data.amountSponsored);
  if (col.contactName >= 0) newRow[col.contactName] = data.contactName.toString().trim();
  if (col.contactPhone >= 0) newRow[col.contactPhone] = (data.contactPhone || '').toString().trim();
  if (col.contactEmail >= 0) newRow[col.contactEmail] = (data.contactEmail || '').toString().trim();
  if (col.createdAt >= 0) newRow[col.createdAt] = createdAt;
  sheet.appendRow(newRow);
  return { success: true, data: { id: id } };
}

function getAllFundUsages() {
  const sheet = getFundUsageSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      list.push({
        id: row[headers.indexOf('ID')] ? row[headers.indexOf('ID')].toString() : '',
        purpose: headers.indexOf('Purpose') >= 0 && row[headers.indexOf('Purpose')] ? row[headers.indexOf('Purpose')].toString() : '',
        amountUsed: headers.indexOf('AmountUsed') >= 0 ? (parseFloat(row[headers.indexOf('AmountUsed')]) || 0) : 0,
        serviceNumber: headers.indexOf('ServiceNumber') >= 0 && row[headers.indexOf('ServiceNumber')] ? row[headers.indexOf('ServiceNumber')].toString() : '',
        sponsorId: headers.indexOf('SponsorId') >= 0 && row[headers.indexOf('SponsorId')] ? row[headers.indexOf('SponsorId')].toString() : '',
        date: headers.indexOf('Date') >= 0 && row[headers.indexOf('Date')] ? formatDateTime(row[headers.indexOf('Date')]) : ''
      });
    }
  }
  return { success: true, data: list };
}

function addFundUsage(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.purpose || data.amountUsed == null || !data.serviceNumber) {
    return { success: false, error: 'Missing required fields' };
  }
  const sheet = getFundUsageSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = new Array(sheet.getLastColumn()).fill('');
  const id = generateId();
  const date = new Date();
  const col = {
    id: headers.indexOf('ID'),
    purpose: headers.indexOf('Purpose'),
    amountUsed: headers.indexOf('AmountUsed'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    sponsorId: headers.indexOf('SponsorId'),
    date: headers.indexOf('Date'),
  };
  if (col.id >= 0) newRow[col.id] = id;
  if (col.purpose >= 0) newRow[col.purpose] = data.purpose.toString().trim();
  if (col.amountUsed >= 0) newRow[col.amountUsed] = parseFloat(data.amountUsed);
  if (col.serviceNumber >= 0) newRow[col.serviceNumber] = data.serviceNumber.toString().trim();
  if (col.sponsorId >= 0) newRow[col.sponsorId] = (data.sponsorId || '').toString().trim();
  if (col.date >= 0) newRow[col.date] = date;
  sheet.appendRow(newRow);
  return { success: true, data: { id: id } };
}

function getAllOutstandings() {
  const sheet = getOutstandingsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      list.push({
        id: row[headers.indexOf('ID')] ? row[headers.indexOf('ID')].toString() : '',
        serviceNumber: headers.indexOf('ServiceNumber') >= 0 && row[headers.indexOf('ServiceNumber')] ? row[headers.indexOf('ServiceNumber')].toString() : '',
        name: headers.indexOf('Name') >= 0 && row[headers.indexOf('Name')] ? row[headers.indexOf('Name')].toString() : '',
        station: headers.indexOf('Station') >= 0 && row[headers.indexOf('Station')] ? row[headers.indexOf('Station')].toString() : '',
        reason: headers.indexOf('Reason') >= 0 && row[headers.indexOf('Reason')] ? row[headers.indexOf('Reason')].toString() : '',
        addedByServiceNumber: headers.indexOf('AddedByServiceNumber') >= 0 && row[headers.indexOf('AddedByServiceNumber')] ? row[headers.indexOf('AddedByServiceNumber')].toString() : '',
        date: headers.indexOf('Date') >= 0 && row[headers.indexOf('Date')] ? formatDateTime(row[headers.indexOf('Date')]) : ''
      });
    }
  }
  return { success: true, data: list };
}

function addOutstanding(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.serviceNumber || !data.name || !data.reason || !data.addedByServiceNumber) {
    return { success: false, error: 'Missing required fields' };
  }
  const sheet = getOutstandingsSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = new Array(sheet.getLastColumn()).fill('');
  const id = generateId();
  const date = new Date();
  const col = {
    id: headers.indexOf('ID'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    name: headers.indexOf('Name'),
    station: headers.indexOf('Station'),
    reason: headers.indexOf('Reason'),
    addedByServiceNumber: headers.indexOf('AddedByServiceNumber'),
    date: headers.indexOf('Date'),
  };
  if (col.id >= 0) newRow[col.id] = id;
  if (col.serviceNumber >= 0) newRow[col.serviceNumber] = data.serviceNumber.toString().trim();
  if (col.name >= 0) newRow[col.name] = data.name.toString().trim();
  if (col.station >= 0) newRow[col.station] = (data.station || '').toString().trim();
  if (col.reason >= 0) newRow[col.reason] = data.reason.toString().trim();
  if (col.addedByServiceNumber >= 0) newRow[col.addedByServiceNumber] = data.addedByServiceNumber.toString().trim();
  if (col.date >= 0) newRow[col.date] = date;
  sheet.appendRow(newRow);
  return { success: true, data: { id: id } };
}

function clearOutstanding(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  // Only service number 5568 can clear outstanding entries
  if (!data.actorServiceNumber || data.actorServiceNumber.toString() !== '5568') {
    return { success: false, error: 'Only service number 5568 can clear outstanding entries' };
  }
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }
  const sheet = getOutstandingsSheet();
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] && values[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) {
    return { success: false, error: 'Entry not found' };
  }
  sheet.deleteRow(rowIndex);
  return { success: true };
}

/**
 * Checks runs for a given service number and date
 * Returns count, total distance, and whether limits are reached
 * @param {string} serviceNumber - The service number to check
 * @param {string} date - The date to check (YYYY-MM-DD)
 * @returns {Object} Response with count and total distance for that day
 */
function checkDuplicateRun(serviceNumber, date) {
  const sheet = getRunsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const MAX_RUNS_PER_DAY = 2;
  const MAX_DISTANCE_PER_DAY = 10; // 10km max per day
  
  const serviceNumberColIndex = headers.indexOf('ServiceNumber');
  const dateColIndex = headers.indexOf('Date');
  const distanceColIndex = headers.indexOf('DistanceKm');
  const statusColIndex = headers.indexOf('Status');
  
  let runCount = 0;
  let totalDistance = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowServiceNumber = serviceNumberColIndex >= 0 ? row[serviceNumberColIndex].toString() : '';
    const rowDate = dateColIndex >= 0 ? formatDate(row[dateColIndex]) : '';
    const rowStatus = statusColIndex >= 0 ? row[statusColIndex].toString().toLowerCase().trim() : 'pending';
    
    if (rowServiceNumber === serviceNumber && rowDate === date && rowStatus !== 'rejected') {
      runCount++;
      totalDistance += parseFloat(distanceColIndex >= 0 ? row[distanceColIndex] : 0) || 0;
    }
  }
  
  const remainingDistance = Math.max(0, MAX_DISTANCE_PER_DAY - totalDistance);
  
  return { 
    success: true, 
    data: { 
      exists: runCount >= MAX_RUNS_PER_DAY,
      count: runCount,
      totalDistance: totalDistance,
      remainingDistance: remainingDistance,
      maxRunsReached: runCount >= MAX_RUNS_PER_DAY,
      maxDistanceReached: totalDistance >= MAX_DISTANCE_PER_DAY
    } 
  };
}

/**
 * Adds a new run to the sheet
 * @param {Object} data - Run data
 * @returns {Object} Response with created run
 */
function addRun(data) {
  // Validate required fields
  if (!data.serviceNumber || !data.name || !data.station || !data.date || !data.distanceKm) {
    return { success: false, error: 'All fields are required' };
  }
  
  // Validate that date is today only (no backdates or future dates)
  // Using Maldives timezone (UTC+5)
  const MALDIVES_TIMEZONE = 'Indian/Maldives';
  const today = new Date();
  const todayStr = Utilities.formatDate(today, MALDIVES_TIMEZONE, 'yyyy-MM-dd');
  if (data.date !== todayStr) {
    return { success: false, error: 'You can only log runs for today' };
  }
  
  // Validate distance
  const distance = parseFloat(data.distanceKm);
  if (isNaN(distance) || distance <= 0) {
    return { success: false, error: 'Distance must be a positive number' };
  }
  
  // Check daily limits (2 runs max, 10km total max per day)
  const dailyCheck = checkDuplicateRun(data.serviceNumber, data.date);
  
  // Check if max runs reached (2 runs per day)
  if (dailyCheck.data && dailyCheck.data.maxRunsReached) {
    return { 
      success: false, 
      error: 'You have already logged 2 runs for today. Maximum 2 runs per day allowed.' 
    };
  }
  
  // Check if adding this run would exceed 10km daily limit
  const newTotalDistance = (dailyCheck.data?.totalDistance || 0) + distance;
  if (newTotalDistance > 10) {
    const remaining = dailyCheck.data?.remainingDistance || 0;
    if (remaining <= 0) {
      return { 
        success: false, 
        error: 'You have already reached your 10 km daily limit.' 
      };
    }
    return { 
      success: false, 
      error: `This run would exceed your 10 km daily limit. You can only add up to ${remaining.toFixed(1)} km more today.` 
    };
  }
  
  const sheet = getRunsSheet();
  const id = generateId();
  
  // Handle photo upload if provided
  let photoId = '';
  let photoUrl = '';
  let photoHash = '';
  let duplicateOf = ''; // Store info about original if duplicate detected
  
  if (data.photo && data.photo.base64 && data.photo.mimeType) {
    // Calculate photo hash to check for duplicates
    photoHash = calculatePhotoHash(data.photo.base64);
    
    if (photoHash) {
      // Check if this exact screenshot has been used before
      const duplicatePhotoCheck = checkDuplicatePhoto(photoHash);
      
      if (duplicatePhotoCheck.exists) {
        // Flag as duplicate but allow upload - admin will review
        const original = duplicatePhotoCheck.originalRun;
        duplicateOf = `${original.date} | ${original.name} (#${original.serviceNumber})`;
        Logger.log('Duplicate photo detected: ' + duplicateOf);
      }
    }
    
    // Proceed with upload (even if duplicate - admin will review)
    const timestamp = new Date().getTime();
    const extension = data.photo.mimeType.split('/')[1] || 'jpg';
    const fileName = `run_${data.serviceNumber}_${data.date}_${timestamp}.${extension}`;
    
    const uploadResult = uploadPhotoToDrive(data.photo.base64, fileName, data.photo.mimeType);
    
    if (uploadResult.success) {
      photoId = uploadResult.fileId;
      photoUrl = uploadResult.thumbnailUrl;
    } else {
      Logger.log('Photo upload failed: ' + uploadResult.error);
      // Continue without photo - don't fail the entire run submission
    }
  }
  
  // Default status is 'pending' - admin must approve
  const status = 'pending';
  const submittedAt = new Date(); // Current timestamp when run is submitted
  
  // Get headers to find correct column positions
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Ensure DistanceDisplay column exists
  let distanceDisplayColIndex = headers.indexOf('DistanceDisplay');
  if (distanceDisplayColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('DistanceDisplay');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    distanceDisplayColIndex = headers.indexOf('DistanceDisplay');
  }
  
  // Find column indices (0-based for array, add 1 for sheet column)
  const colIndex = {
    id: headers.indexOf('ID'),
    date: headers.indexOf('Date'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    name: headers.indexOf('Name'),
    station: headers.indexOf('Station'),
    distanceKm: headers.indexOf('DistanceKm'),
    distanceDisplay: headers.indexOf('DistanceDisplay'),
    photoId: headers.indexOf('PhotoId'),
    photoUrl: headers.indexOf('PhotoUrl'),
    status: headers.indexOf('Status'),
    rejectionReason: headers.indexOf('RejectionReason'),
    approvedBy: headers.indexOf('ApprovedBy'),
    approvedByName: headers.indexOf('ApprovedByName'),
    approvedAt: headers.indexOf('ApprovedAt'),
    submittedAt: headers.indexOf('SubmittedAt'),
    photoHash: headers.indexOf('PhotoHash'),
    duplicateOf: headers.indexOf('DuplicateOf')
  };
  
  // Create row array with correct number of columns
  const newRow = new Array(sheet.getLastColumn()).fill('');
  
  // Set values at correct positions
  if (colIndex.id >= 0) newRow[colIndex.id] = id;
  if (colIndex.date >= 0) newRow[colIndex.date] = new Date(data.date);
  if (colIndex.serviceNumber >= 0) newRow[colIndex.serviceNumber] = data.serviceNumber.toString().trim();
  if (colIndex.name >= 0) newRow[colIndex.name] = data.name.toString().trim();
  if (colIndex.station >= 0) newRow[colIndex.station] = data.station.toString().trim();
  if (colIndex.distanceKm >= 0) newRow[colIndex.distanceKm] = distance;
  if (colIndex.distanceDisplay >= 0) newRow[colIndex.distanceDisplay] = (data.distanceDisplay && typeof data.distanceDisplay === 'string') ? data.distanceDisplay : distance.toFixed(2);
  if (colIndex.photoId >= 0) newRow[colIndex.photoId] = photoId;
  if (colIndex.photoUrl >= 0) newRow[colIndex.photoUrl] = photoUrl;
  if (colIndex.status >= 0) newRow[colIndex.status] = status;
  if (colIndex.submittedAt >= 0) newRow[colIndex.submittedAt] = submittedAt;
  if (colIndex.photoHash >= 0) newRow[colIndex.photoHash] = photoHash;
  if (colIndex.duplicateOf >= 0) newRow[colIndex.duplicateOf] = duplicateOf;
  
  // Append the row
  sheet.appendRow(newRow);
  
  // Send email notification to all admins
  try {
    sendNewRunNotification({
      name: data.name,
      serviceNumber: data.serviceNumber,
      station: data.station,
      date: data.date,
      distanceKm: distance,
      distanceDisplay: (data.distanceDisplay && typeof data.distanceDisplay === 'string') ? data.distanceDisplay : distance.toFixed(2)
    });
  } catch (e) {
    Logger.log('Failed to send email notification: ' + e.message);
    // Don't fail the run submission if email fails
  }
  
  return {
    success: true,
    data: {
      id: id,
      date: data.date,
      serviceNumber: data.serviceNumber,
      name: data.name,
      station: data.station,
      distanceKm: distance,
      photoId: photoId,
      photoUrl: photoUrl,
      status: status
    }
  };
}

/**
 * Updates an existing run (Admin only)
 * @param {Object} data - Run data with id
 * @returns {Object} Response with updated run
 */
function updateRun(data) {
  // Validate admin token
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'Run ID is required' };
  }
  
  const sheet = getRunsSheet();
  const dataRange = sheet.getDataRange().getValues();
  
  // Find the row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1; // +1 because sheet rows are 1-indexed
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Run not found' };
  }
  
  // Update the row using headers
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = {
    date: headers.indexOf('Date'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    name: headers.indexOf('Name'),
    station: headers.indexOf('Station'),
    distanceKm: headers.indexOf('DistanceKm'),
    distanceDisplay: headers.indexOf('DistanceDisplay')
  };

  const distance = parseFloat(data.distanceKm) || 0;
  if (idx.date >= 0) sheet.getRange(rowIndex, idx.date + 1).setValue(new Date(data.date));
  if (idx.serviceNumber >= 0) sheet.getRange(rowIndex, idx.serviceNumber + 1).setValue(data.serviceNumber.toString().trim());
  if (idx.name >= 0) sheet.getRange(rowIndex, idx.name + 1).setValue(data.name.toString().trim());
  if (idx.station >= 0) sheet.getRange(rowIndex, idx.station + 1).setValue(data.station.toString().trim());
  if (idx.distanceKm >= 0) sheet.getRange(rowIndex, idx.distanceKm + 1).setValue(distance);
  if (idx.distanceDisplay >= 0) sheet.getRange(rowIndex, idx.distanceDisplay + 1).setValue((data.distanceDisplay && typeof data.distanceDisplay === 'string') ? data.distanceDisplay : distance.toFixed(2));
  
  return {
    success: true,
    data: {
      id: data.id,
      date: data.date,
      serviceNumber: data.serviceNumber,
      name: data.name,
      station: data.station,
      distanceKm: distance
    }
  };
}

/**
 * Updates a run's approval status (Admin only)
 * @param {Object} data - Object containing run ID, status, admin token, approvedBy, approvedByName, and optional rejectionReason
 * @returns {Object} Response with updated run
 */
function updateRunStatus(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'Run ID is required' };
  }
  
  if (!data.status || !['pending', 'approved', 'rejected'].includes(data.status)) {
    return { success: false, error: 'Valid status is required (pending, approved, or rejected)' };
  }
  
  const sheet = getRunsSheet();
  const dataRange = sheet.getDataRange().getValues();
  const headers = dataRange[0];
  
  // Find Status column index (create if doesn't exist)
  let statusColIndex = headers.indexOf('Status');
  if (statusColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('Status');
    statusColIndex = lastCol;
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const statusRange = sheet.getRange(2, lastCol + 1, lastRow - 1, 1);
      const defaultStatuses = Array(lastRow - 1).fill(['pending']);
      statusRange.setValues(defaultStatuses);
    }
  }
  
  // Find RejectionReason column index (create if doesn't exist)
  let rejectionReasonColIndex = headers.indexOf('RejectionReason');
  if (rejectionReasonColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('RejectionReason');
    rejectionReasonColIndex = lastCol;
  }
  
  // Find ApprovedBy column index (create if doesn't exist)
  let approvedByColIndex = headers.indexOf('ApprovedBy');
  if (approvedByColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('ApprovedBy');
    approvedByColIndex = lastCol;
  }
  
  // Find ApprovedByName column index (create if doesn't exist)
  let approvedByNameColIndex = headers.indexOf('ApprovedByName');
  if (approvedByNameColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('ApprovedByName');
    approvedByNameColIndex = lastCol;
  }
  
  // Find ApprovedAt column index (create if doesn't exist)
  let approvedAtColIndex = headers.indexOf('ApprovedAt');
  if (approvedAtColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('ApprovedAt');
    approvedAtColIndex = lastCol;
  }
  
  // Find the row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1; // Sheet rows are 1-indexed
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Run not found' };
  }
  
  // Update the status
  sheet.getRange(rowIndex, statusColIndex + 1).setValue(data.status);
  
  // Update rejection reason (clear if not rejected)
  const rejectionReason = data.status === 'rejected' ? (data.rejectionReason || '') : '';
  sheet.getRange(rowIndex, rejectionReasonColIndex + 1).setValue(rejectionReason);
  
  // Update approver info (only for approved/rejected status)
  const approvedBy = (data.status === 'approved' || data.status === 'rejected') ? (data.approvedBy || '') : '';
  const approvedByName = (data.status === 'approved' || data.status === 'rejected') ? (data.approvedByName || '') : '';
  const approvedAt = (data.status === 'approved' || data.status === 'rejected') ? new Date() : '';
  
  sheet.getRange(rowIndex, approvedByColIndex + 1).setValue(approvedBy);
  sheet.getRange(rowIndex, approvedByNameColIndex + 1).setValue(approvedByName);
  sheet.getRange(rowIndex, approvedAtColIndex + 1).setValue(approvedAt);
  
  return {
    success: true,
    data: {
      id: data.id,
      status: data.status,
      rejectionReason: rejectionReason,
      approvedBy: approvedBy,
      approvedByName: approvedByName,
      approvedAt: approvedAt ? formatDate(approvedAt) : ''
    }
  };
}

/**
 * Deletes a run (Admin only)
 * @param {Object} data - Object containing run ID and admin token
 * @returns {Object} Response indicating success or failure
 */
function deleteRun(data) {
  // Validate admin token
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'Run ID is required' };
  }
  
  const sheet = getRunsSheet();
  const dataRange = sheet.getDataRange().getValues();
  
  // Find the row with matching ID
  let rowIndex = -1;
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1; // +1 because sheet rows are 1-indexed
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Run not found' };
  }
  
  // Delete the row
  sheet.deleteRow(rowIndex);
  
  return { success: true };
}

// ============================================================
// USER OPERATIONS
// ============================================================

/**
 * Gets all registered users from the Users sheet
 * @returns {Object} Response with users array
 */
function getAllUsers() {
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found. Run setupUsersSheet() first.' };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find admin column indices
  const isAdminColIndex = headers.indexOf('IsAdmin');
  
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      users.push({
        id: row[0].toString(),
        serviceNumber: row[1].toString(),
        name: row[2].toString(),
        rank: row[3].toString(),
        email: row[4].toString(),
        phone: row[5].toString(),
        station: row[6].toString(),
        createdAt: formatDate(row[7]),
        isAdmin: isAdminColIndex >= 0 ? (row[isAdminColIndex] === true || row[isAdminColIndex] === 'TRUE' || row[isAdminColIndex] === 'true') : false
      });
    }
  }
  
  return { success: true, data: users };
}

/**
 * Gets a user by their service number
 * @param {string} serviceNumber - The service number to search for
 * @returns {Object} Response with user data or not found
 */
function getUserByServiceNumber(serviceNumber) {
  if (!serviceNumber) {
    return { success: false, error: 'Service number is required' };
  }
  
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: true, data: null };
  }
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1].toString() === serviceNumber.toString()) {
      return {
        success: true,
        data: {
          id: row[0].toString(),
          serviceNumber: row[1].toString(),
          name: row[2].toString(),
          rank: row[3].toString(),
          email: row[4].toString(),
          phone: row[5].toString(),
          station: row[6].toString(),
          createdAt: formatDate(row[7])
        }
      };
    }
  }
  
  return { success: true, data: null };
}

/**
 * Adds a new registered user (Admin only)
 * @param {Object} data - User data
 * @returns {Object} Response with created user
 */
function addUser(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.serviceNumber || !data.name || !data.station) {
    return { success: false, error: 'Service number, name, and station are required' };
  }
  
  // Check if service number already exists
  const existing = getUserByServiceNumber(data.serviceNumber);
  if (existing.data) {
    return { success: false, error: 'A user with this service number already exists' };
  }
  
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found. Run setupUsersSheet() first.' };
  }
  
  const id = generateId();
  const createdAt = new Date();
  
  sheet.appendRow([
    id,
    data.serviceNumber.toString().trim(),
    data.name.toString().trim(),
    (data.rank || '').toString().trim(),
    (data.email || '').toString().trim(),
    (data.phone || '').toString().trim(),
    data.station.toString().trim(),
    createdAt
  ]);
  
  return {
    success: true,
    data: {
      id: id,
      serviceNumber: data.serviceNumber,
      name: data.name,
      rank: data.rank || '',
      email: data.email || '',
      phone: data.phone || '',
      station: data.station,
      createdAt: formatDate(createdAt)
    }
  };
}

/**
 * Updates an existing user (Admin only)
 * @param {Object} data - User data with id
 * @returns {Object} Response with updated user
 */
function updateUser(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'User ID is required' };
  }
  
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found' };
  }
  
  const dataRange = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'User not found' };
  }
  
  // Check if new service number conflicts with another user
  if (data.serviceNumber) {
    const existing = getUserByServiceNumber(data.serviceNumber);
    if (existing.data && existing.data.id !== data.id) {
      return { success: false, error: 'Another user with this service number already exists' };
    }
  }
  
  sheet.getRange(rowIndex, 2, 1, 6).setValues([[
    data.serviceNumber.toString().trim(),
    data.name.toString().trim(),
    (data.rank || '').toString().trim(),
    (data.email || '').toString().trim(),
    (data.phone || '').toString().trim(),
    data.station.toString().trim()
  ]]);
  
  return {
    success: true,
    data: {
      id: data.id,
      serviceNumber: data.serviceNumber,
      name: data.name,
      rank: data.rank || '',
      email: data.email || '',
      phone: data.phone || '',
      station: data.station
    }
  };
}

/**
 * Deletes a user (Admin only)
 * @param {Object} data - Object containing user ID and admin token
 * @returns {Object} Response indicating success or failure
 */
function deleteUser(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'User ID is required' };
  }
  
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found' };
  }
  
  const dataRange = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'User not found' };
  }
  
  sheet.deleteRow(rowIndex);
  
  return { success: true };
}

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

/**
 * Validates admin password and returns token (legacy method)
 * @param {string} password - The password to validate
 * @returns {Object} Response with token if valid
 */
function validateAdmin(password) {
  // DEPRECATED: This function is no longer used
  // All admin logins must go through validateAdminLogin with service number
  return { success: false, error: 'Please use service number and password to login' };
}

/**
 * Validates admin login with service number and individual password
 * @param {string} serviceNumber - The admin's service number
 * @param {string} password - The admin's individual password
 * @returns {Object} Response with token and admin info if valid
 */
function validateAdminLogin(serviceNumber, password) {
  if (!serviceNumber || !password) {
    return { success: false, error: 'Service number and password are required' };
  }
  
  const config = getConfig();
  const sheet = getUsersSheet();
  
  // Super admin service number (only this user can use master password)
  const SUPER_ADMIN = '5568';
  
  if (!sheet) {
    // Fall back to legacy admin authentication - ONLY for super admin
    if (serviceNumber.toString() === SUPER_ADMIN && password === config.adminPassword) {
      return {
        success: true,
        data: { 
          token: config.adminToken,
          admin: { serviceNumber: SUPER_ADMIN, name: 'Super Admin' }
        }
      };
    }
    return { success: false, error: 'Invalid credentials' };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const isAdminColIndex = headers.indexOf('IsAdmin');
  const adminPasswordColIndex = headers.indexOf('AdminPassword');
  
  // Search for the user
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1].toString() === serviceNumber.toString()) {
      // Found the user, check if they're an admin
      const isAdmin = isAdminColIndex >= 0 && (row[isAdminColIndex] === true || row[isAdminColIndex] === 'TRUE' || row[isAdminColIndex] === 'true');
      
      if (!isAdmin) {
        return { success: false, error: 'User does not have admin privileges' };
      }
      
      // Check their individual password
      const storedPassword = adminPasswordColIndex >= 0 ? row[adminPasswordColIndex].toString() : '';
      
      if (storedPassword && password === storedPassword) {
        return {
          success: true,
          data: {
            token: config.adminToken,
            admin: {
              serviceNumber: row[1].toString(),
              name: row[2].toString()
            }
          }
        };
      }
      
      // Only super admin can use the master password as fallback
      if (serviceNumber.toString() === SUPER_ADMIN && password === config.adminPassword) {
        return {
          success: true,
          data: {
            token: config.adminToken,
            admin: {
              serviceNumber: row[1].toString(),
              name: row[2].toString()
            }
          }
        };
      }
      
      // If admin has no password set, show helpful error
      if (!storedPassword) {
        return { success: false, error: 'No password set. Contact super admin to set your password.' };
      }
      
      return { success: false, error: 'Invalid password' };
    }
  }
  
  // User not found - only super admin can use legacy authentication
  if (serviceNumber.toString() === SUPER_ADMIN && password === config.adminPassword) {
    return {
      success: true,
      data: { 
        token: config.adminToken,
        admin: { serviceNumber: serviceNumber, name: 'Super Admin' }
      }
    };
  }
  
  return { success: false, error: 'Invalid credentials' };
}

/**
 * Updates a user's admin status and password (Admin only)
 * @param {Object} data - Object containing user ID, isAdmin, adminPassword, and admin token
 * @returns {Object} Response with updated user
 */
function updateUserAdminStatus(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  
  if (!data.id) {
    return { success: false, error: 'User ID is required' };
  }
  
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found' };
  }
  
  const dataRange = sheet.getDataRange().getValues();
  const headers = dataRange[0];
  
  // Find or create IsAdmin column
  let isAdminColIndex = headers.indexOf('IsAdmin');
  if (isAdminColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('IsAdmin');
    isAdminColIndex = lastCol;
  }
  
  // Find or create AdminPassword column
  let adminPasswordColIndex = headers.indexOf('AdminPassword');
  if (adminPasswordColIndex === -1) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('AdminPassword');
    adminPasswordColIndex = lastCol;
  }
  
  // Find the row with matching ID
  let rowIndex = -1;
  let userName = '';
  let userServiceNumber = '';
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1;
      userServiceNumber = dataRange[i][1].toString();
      userName = dataRange[i][2].toString();
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'User not found' };
  }
  
  // Update admin status
  sheet.getRange(rowIndex, isAdminColIndex + 1).setValue(data.isAdmin ? 'TRUE' : 'FALSE');
  
  // Update admin password (only if setting as admin and password provided)
  if (data.isAdmin && data.adminPassword) {
    sheet.getRange(rowIndex, adminPasswordColIndex + 1).setValue(data.adminPassword);
  } else if (!data.isAdmin) {
    // Clear password when removing admin status
    sheet.getRange(rowIndex, adminPasswordColIndex + 1).setValue('');
  }
  
  return {
    success: true,
    data: {
      id: data.id,
      serviceNumber: userServiceNumber,
      name: userName,
      isAdmin: data.isAdmin
    }
  };
}

/**
 * Validates an admin token
 * @param {string} token - The token to validate
 * @returns {boolean} True if token is valid
 */
function validateAdminToken(token) {
  const config = getConfig();
  return token === config.adminToken;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generates a unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * Formats a date to YYYY-MM-DD string in Maldives timezone
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    return Utilities.formatDate(d, 'Indian/Maldives', 'yyyy-MM-dd');
  } catch (e) {
    Logger.log('formatDate error: ' + e.message);
    return '';
  }
}

/**
 * Formats a date object to ISO datetime string with time in Maldives timezone
 * @param {Date} date - The date to format
 * @returns {string} Formatted datetime string (YYYY-MM-DD HH:MM:SS)
 */
function formatDateTime(date) {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    return Utilities.formatDate(d, 'Indian/Maldives', 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    Logger.log('formatDateTime error: ' + e.message);
    return '';
  }
}

// ============================================================
// EMAIL NOTIFICATIONS
// ============================================================

/**
 * Sends email notification to all admins when a new run is submitted
 * @param {Object} runData - The run data (name, serviceNumber, station, date, distanceKm)
 */
function sendNewRunNotification(runData) {
  const adminEmails = getAdminEmails();
  
  if (adminEmails.length === 0) {
    Logger.log('No admin emails found for notification');
    return;
  }
  
  const subject = '🏃 New Run Submission - ' + runData.name;
  
  const formattedDate = formatDate(runData.date);
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🏃 New Run Submission</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin: 0 0 15px; color: #333;">A new run has been submitted and is waiting for your review:</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666; width: 40%;">Name</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333; font-weight: bold;">${runData.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Service Number</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333; font-weight: bold;">#${runData.serviceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Station</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333;">${runData.station}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Date</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #666;">Distance</td>
            <td style="padding: 10px; color: #2186eb; font-weight: bold; font-size: 18px;">${runData.distanceDisplay || runData.distanceKm} km</td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; text-align: center;">
          <a href="https://run.huvadhoofulusclub.events/admin" 
             style="display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Review Now →
          </a>
        </div>
        
        <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">
          This is an automated notification from the 100K Run Challenge system.
        </p>
      </div>
    </div>
  `;
  
  const plainBody = `
New Run Submission

Name: ${runData.name}
Service Number: #${runData.serviceNumber}
Station: ${runData.station}
Date: ${formattedDate}
Distance: ${runData.distanceDisplay || runData.distanceKm} km

Review at: https://run.huvadhoofulusclub.events/admin
  `;
  
  // Send to all admins
  adminEmails.forEach(email => {
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody
      });
      Logger.log('Notification sent to: ' + email);
    } catch (e) {
      Logger.log('Failed to send to ' + email + ': ' + e.message);
    }
  });
}

/**
 * Gets email addresses of all admin users
 * @returns {string[]} Array of admin email addresses
 */
function getAdminEmails() {
  const sheet = getUsersSheet();
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const emailColIndex = headers.indexOf('Email');
  const isAdminColIndex = headers.indexOf('IsAdmin');
  
  if (emailColIndex === -1) {
    return [];
  }
  
  const adminEmails = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isAdmin = isAdminColIndex >= 0 && (row[isAdminColIndex] === true || row[isAdminColIndex] === 'TRUE' || row[isAdminColIndex] === 'true');
    const email = row[emailColIndex] ? row[emailColIndex].toString().trim() : '';
    
    if (isAdmin && email && email.includes('@')) {
      adminEmails.push(email);
    }
  }
  
  return adminEmails;
}

/**
 * Test function to verify email notifications work
 * Run this manually from Apps Script to test
 */
function testEmailNotification() {
  sendNewRunNotification({
    name: 'Test Runner',
    serviceNumber: '1234',
    station: 'Test Station',
    date: new Date().toISOString().split('T')[0],
    distanceKm: 5.5
  });
  Logger.log('Test notification sent!');
}

// ============================================================
// SETUP FUNCTIONS
// ============================================================

/**
 * Initial setup function - run this once to create the sheet structure
 * Go to Apps Script, select this function and click Run
 */
function setupSheet() {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    throw new Error('SPREADSHEET_ID not set in Script Properties. Please add it first.');
  }
  
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(config.sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(config.sheetName);
  }
  
  // Set up headers (includes Photo, Status, PhotoHash, and DuplicateOf columns)
  const headers = ['ID', 'Date', 'ServiceNumber', 'Name', 'Station', 'DistanceKm', 'PhotoId', 'PhotoUrl', 'Status', 'RejectionReason', 'ApprovedBy', 'ApprovedByName', 'ApprovedAt', 'SubmittedAt', 'PhotoHash', 'DuplicateOf'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#102a43');
  headerRange.setFontColor('#ffffff');
  
  // Set column widths
  sheet.setColumnWidth(1, 300);  // ID
  sheet.setColumnWidth(2, 120);  // Date
  sheet.setColumnWidth(3, 120);  // ServiceNumber
  sheet.setColumnWidth(4, 180);  // Name
  sheet.setColumnWidth(5, 150);  // Station
  sheet.setColumnWidth(6, 100);  // DistanceKm
  sheet.setColumnWidth(7, 300);  // PhotoId
  sheet.setColumnWidth(8, 400);  // PhotoUrl
  sheet.setColumnWidth(9, 100);  // Status
  sheet.setColumnWidth(10, 200); // RejectionReason
  sheet.setColumnWidth(11, 120); // ApprovedBy
  sheet.setColumnWidth(12, 150); // ApprovedByName
  sheet.setColumnWidth(13, 150); // ApprovedAt
  sheet.setColumnWidth(14, 150); // SubmittedAt
  sheet.setColumnWidth(15, 280); // PhotoHash
  sheet.setColumnWidth(16, 300); // DuplicateOf
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  Logger.log('Sheet setup complete!');
}

/**
 * Adds PhotoId, PhotoUrl, and Status columns to existing Runs sheet
 * Run this once to update your existing sheet structure
 */
function addNewColumnsToSheet() {
  const sheet = getRunsSheet();
  if (!sheet) {
    throw new Error('Runs sheet not found');
  }
  
  // Check if columns already exist
  const headers = sheet.getRange(1, 1, 1, 15).getValues()[0];
  const hasPhotoId = headers.includes('PhotoId');
  const hasPhotoUrl = headers.includes('PhotoUrl');
  const hasStatus = headers.includes('Status');
  
  if (!hasPhotoId) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('PhotoId');
    sheet.setColumnWidth(lastCol + 1, 300);
    Logger.log('Added PhotoId column');
  }
  
  if (!hasPhotoUrl) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('PhotoUrl');
    sheet.setColumnWidth(lastCol + 1, 400);
    Logger.log('Added PhotoUrl column');
  }
  
  if (!hasStatus) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('Status');
    sheet.setColumnWidth(lastCol + 1, 100);
    
    // Set default status 'pending' for all existing rows
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const statusRange = sheet.getRange(2, lastCol + 1, lastRow - 1, 1);
      const defaultStatuses = Array(lastRow - 1).fill(['pending']);
      statusRange.setValues(defaultStatuses);
      Logger.log('Set default pending status for ' + (lastRow - 1) + ' existing rows');
    }
    Logger.log('Added Status column');
  }
  
  Logger.log('Column update complete!');
}

/**
 * Adds PhotoHash column for duplicate screenshot detection
 * Run this once to update your existing sheet structure
 */
function addPhotoHashColumn() {
  const sheet = getRunsSheet();
  if (!sheet) {
    throw new Error('Runs sheet not found');
  }
  
  // Check if column already exists
  const headers = sheet.getRange(1, 1, 1, 20).getValues()[0];
  const hasPhotoHash = headers.includes('PhotoHash');
  
  if (!hasPhotoHash) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('PhotoHash');
    sheet.setColumnWidth(lastCol + 1, 280);
    Logger.log('Added PhotoHash column for duplicate detection');
  } else {
    Logger.log('PhotoHash column already exists');
  }
  
  Logger.log('PhotoHash column setup complete!');
}

/**
 * Adds DuplicateOf column for flagging duplicate screenshots
 * Run this once to update your existing sheet structure
 */
function addDuplicateOfColumn() {
  const sheet = getRunsSheet();
  if (!sheet) {
    throw new Error('Runs sheet not found');
  }
  
  // Check if column already exists
  const headers = sheet.getRange(1, 1, 1, 20).getValues()[0];
  const hasDuplicateOf = headers.includes('DuplicateOf');
  
  if (!hasDuplicateOf) {
    const lastCol = sheet.getLastColumn();
    sheet.getRange(1, lastCol + 1).setValue('DuplicateOf');
    sheet.setColumnWidth(lastCol + 1, 300);
    Logger.log('Added DuplicateOf column for duplicate flagging');
  } else {
    Logger.log('DuplicateOf column already exists');
  }
  
  Logger.log('DuplicateOf column setup complete!');
}

/**
 * Setup the Users sheet - run this once to create the Users sheet structure
 */
function setupUsersSheet() {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    throw new Error('SPREADSHEET_ID not set in Script Properties.');
  }
  
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('Users');
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Users');
  }
  
  // Set up headers
  const headers = ['ID', 'ServiceNumber', 'Name', 'Rank', 'Email', 'Phone', 'Station', 'CreatedAt'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1e3a5f');
  headerRange.setFontColor('#ffffff');
  
  // Set column widths
  sheet.setColumnWidth(1, 300); // ID
  sheet.setColumnWidth(2, 120); // ServiceNumber
  sheet.setColumnWidth(3, 200); // Name
  sheet.setColumnWidth(4, 120); // Rank
  sheet.setColumnWidth(5, 200); // Email
  sheet.setColumnWidth(6, 140); // Phone
  sheet.setColumnWidth(7, 180); // Station
  sheet.setColumnWidth(8, 150); // CreatedAt
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  Logger.log('Users sheet setup complete!');
}

/**
 * Test function to verify the setup
 * Run this to check if everything is configured correctly
 */
function testSetup() {
  const config = getConfig();
  
  Logger.log('Configuration:');
  Logger.log('- Spreadsheet ID: ' + (config.spreadsheetId ? 'Set' : 'NOT SET'));
  Logger.log('- Admin Password: ' + (config.adminPassword ? 'Set' : 'NOT SET'));
  Logger.log('- Admin Token: ' + (config.adminToken ? 'Set' : 'NOT SET'));
  
  if (config.spreadsheetId) {
    try {
      const sheet = getRunsSheet();
      Logger.log('- Sheet access: SUCCESS');
      Logger.log('- Sheet name: ' + sheet.getName());
      Logger.log('- Row count: ' + sheet.getLastRow());
    } catch (e) {
      Logger.log('- Sheet access: FAILED - ' + e.message);
    }
  }
  
  // Test getAllRuns
  try {
    const result = getAllRuns();
    Logger.log('- getAllRuns: SUCCESS - ' + result.data.length + ' runs found');
  } catch (e) {
    Logger.log('- getAllRuns: FAILED - ' + e.message);
  }
}

/**
 * Add sample data for testing
 */
function addSampleData() {
  const sampleRuns = [
    { serviceNumber: '12345', name: 'John Smith', station: 'Central Station', date: '2024-01-15', distanceKm: 5.5 },
    { serviceNumber: '12346', name: 'Jane Doe', station: 'North Station', date: '2024-01-15', distanceKm: 7.2 },
    { serviceNumber: '12347', name: 'Bob Johnson', station: 'East Station', date: '2024-01-14', distanceKm: 3.8 },
    { serviceNumber: '12345', name: 'John Smith', station: 'Central Station', date: '2024-01-14', distanceKm: 6.0 },
    { serviceNumber: '12348', name: 'Alice Brown', station: 'West Station', date: '2024-01-13', distanceKm: 10.5 },
  ];
  
  sampleRuns.forEach(run => {
    const result = addRun(run);
    Logger.log('Added run for ' + run.name + ': ' + (result.success ? 'SUCCESS' : 'FAILED - ' + result.error));
  });
}

/**
 * Debug function - run this to test getAllRuns step by step
 */
function debugGetAllRuns() {
  try {
    Logger.log('Step 1: Getting sheet...');
    const config = getConfig();
    Logger.log('Spreadsheet ID: ' + config.spreadsheetId);
    
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName('Runs');
    
    if (!sheet) {
      Logger.log('ERROR: Runs sheet not found!');
      return;
    }
    
    Logger.log('Step 2: Getting data...');
    const data = sheet.getDataRange().getValues();
    Logger.log('Total rows: ' + data.length);
    Logger.log('Headers: ' + JSON.stringify(data[0]));
    
    if (data.length > 1) {
      Logger.log('Step 3: First data row (raw): ' + JSON.stringify(data[1]));
      
      Logger.log('Step 4: Testing formatDate...');
      const testDate = formatDate(data[1][1]);
      Logger.log('Formatted date: ' + testDate);
    }
    
    Logger.log('Step 5: Calling getAllRuns...');
    const result = getAllRuns();
    Logger.log('Success: ' + result.success);
    Logger.log('Number of runs: ' + (result.data ? result.data.length : 0));
    
    if (result.data && result.data.length > 0) {
      Logger.log('First run: ' + JSON.stringify(result.data[0]));
    }
    
    if (result.error) {
      Logger.log('Error: ' + result.error);
    }
    
  } catch (e) {
    Logger.log('CAUGHT ERROR: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }
}
