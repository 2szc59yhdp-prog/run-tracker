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

function getTshirtsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('TshirtAdmissions');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('TshirtAdmissions');
    sheet.getRange(1, 1, 1, 5).setValues([[
      'ID',
      'Timestamp',
      'ServiceNumber',
      'Size',
      'SleeveType'
    ]]);
  }
  return sheet;
}

function getSponsorsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('Sponsors');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Sponsors');
    sheet.getRange(1, 1, 1, 8).setValues([[
      'ID',
      'BusinessName',
      'Details',
      'AmountSponsored',
      'ContactName',
      'ContactPhone',
      'ContactEmail',
      'CreatedAt'
    ]]);
  }
  return sheet;
}

function getFundUsagesSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('FundUsages');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('FundUsages');
    sheet.getRange(1, 1, 1, 6).setValues([[
      'ID',
      'Purpose',
      'AmountUsed',
      'ServiceNumber',
      'SponsorId',
      'Date'
    ]]);
  }
  return sheet;
}

function getManualAwardsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('ManualAwards');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('ManualAwards');
    sheet.getRange(1, 1, 1, 6).setValues([[
      'AwardKey',
      'WinnerIdentifier',
      'WinnerName',
      'UpdatedAt',
      'UpdatedBy',
      'Notes'
    ]]);
  }
  return sheet;
}

function getUserLoginsSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('UserLogins');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('UserLogins');
    sheet.getRange(1, 1, 1, 10).setValues([[
      'Timestamp',
      'ServiceNumber',
      'Name',
      'Station',
      'UserAgent',
      'Language',
      'Timezone',
      'Platform',
      'IP',
      'Origin'
    ]]);
  }
  return sheet;
}

// PINs access control
const SUPER_ADMIN_SERVICE_NUMBER = '5568';
const PIN_ADMINS = ['5568', '4059', '6149'];

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
      case 'getUserByServiceNumber':
        result = getUserByServiceNumber(e.parameter.serviceNumber);
        break;
      case 'getTshirtAdmissions':
        result = getTshirtAdmissions();
        break;
      case 'getSponsors':
        result = getSponsors();
        break;
      case 'getFundUsages':
        result = getFundUsages();
        break;
      case 'getManualAwards':
        result = getManualAwards();
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
      case 'logUserLogin':
        result = logUserLogin(data);
        break;
      case 'updateUserPin':
        result = updateUserPin(data);
        break;
      case 'getUsersWithPins':
        result = getUsersWithPins(data);
        break;
      case 'sendPinEmails':
        result = sendPinEmails(data);
        break;
      case 'sendPinEmailsList':
        result = sendPinEmailsList(data);
        break;
      case 'enqueuePinEmailsList':
        result = enqueuePinEmailsList(data);
        break;
      case 'getPinEmailQueueStatus':
        result = getPinEmailQueueStatus(data);
        break;
      case 'getEmailQuota':
        result = { success: true, data: { remaining: MailApp.getRemainingDailyQuota() } };
        break;
      case 'addTshirtAdmission':
        result = addTshirtAdmission(data);
        break;
      case 'updateTshirtAdmission':
        result = updateTshirtAdmission(data);
        break;
      case 'addSponsor':
        result = addSponsor(data);
        break;
      case 'updateSponsor':
        result = updateSponsor(data);
        break;
      case 'deleteSponsor':
        result = deleteSponsor(data);
        break;
      case 'addFundUsage':
        result = addFundUsage(data);
        break;
      case 'updateFundUsage':
        result = updateFundUsage(data);
        break;
      case 'deleteFundUsage':
        result = deleteFundUsage(data);
        break;
      case 'sendCountdownEmailsManual':
        result = sendCountdownReminders(true); // Force send
        break;
      case 'sendTestCountdownEmails':
        result = sendTestCountdownEmails(data.email || 'aly.shanyyz@gmail.com');
        break;
      case 'saveManualAward':
        result = saveManualAward(data);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  return createJsonResponse(result);
}

function addTshirtAdmission(data) {
  if (!data.serviceNumber || !data.size || !data.sleeveType) {
    return { success: false, error: 'All fields are required' };
  }
  // Validate service number exists in Users and is a participant (not General Admin)
  var usersSheet = getUsersSheet();
  if (!usersSheet) {
    return { success: false, error: 'Users sheet not found' };
  }
  var usersData = usersSheet.getDataRange().getValues();
  var uHeaders = usersData[0] || [];
  var uSNIdx = uHeaders.indexOf('ServiceNumber');
  var uStationIdx = uHeaders.indexOf('Station');
  var isRegistered = false;
  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var sn = (uSNIdx >= 0 ? String(row[uSNIdx]) : '').trim();
    if (sn && sn === String(data.serviceNumber).trim()) {
      isRegistered = true;
      break;
    }
  }
  if (!isRegistered) {
    return { success: false, error: 'Service number is not registered' };
  }
  // Enforce single submission per service number
  var tshirtSheet = getTshirtsSheet();
  var tshirtData = tshirtSheet.getDataRange().getValues();
  var exists = false;
  for (var j = 1; j < tshirtData.length; j++) {
    var r = tshirtData[j];
    var snExisting = r[2] ? String(r[2]).trim() : '';
    if (snExisting && snExisting === String(data.serviceNumber).trim()) {
      exists = true;
      break;
    }
  }
  if (exists) {
    return { success: false, error: 'A Tshirt admission already exists for this service number' };
  }
  const sheet = getTshirtsSheet();
  const id = generateId();
  const timestamp = formatDateTime(new Date());
  sheet.appendRow([id, timestamp, String(data.serviceNumber), String(data.size), String(data.sleeveType)]);
  return {
    success: true,
    data: {
      id: id,
      timestamp: timestamp,
      serviceNumber: String(data.serviceNumber),
      size: String(data.size),
      sleeveType: String(data.sleeveType)
    }
  };
}

function getTshirtAdmissions() {
  const sheet = getTshirtsSheet();
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0]) {
      result.push({
        id: String(row[0]),
        timestamp: formatDateTime(row[1]),
        serviceNumber: String(row[2]),
        size: String(row[3]),
        sleeveType: String(row[4])
      });
    }
  }
  return { success: true, data: result };
}

function updateTshirtAdmission(data) {
  if (!data.adminToken || !validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }
  var sheet = getTshirtsSheet();
  var range = sheet.getDataRange();
  var values = range.getValues();
  var headers = values[0] || [];
  var idIdx = headers.indexOf('ID');
  var sizeIdx = headers.indexOf('Size');
  var sleeveIdx = headers.indexOf('SleeveType');
  var foundRow = -1;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (idIdx >= 0 && String(row[idIdx]).trim() === String(data.id).trim()) {
      foundRow = i + 1; // sheet rows are 1-based
      break;
    }
  }
  if (foundRow === -1) {
    return { success: false, error: 'Record not found' };
  }
  if (typeof data.size === 'string') {
    sheet.getRange(foundRow, sizeIdx + 1).setValue(String(data.size));
  }
  if (typeof data.sleeveType === 'string') {
    sheet.getRange(foundRow, sleeveIdx + 1).setValue(String(data.sleeveType));
  }
  var updated = sheet.getRange(foundRow, 1, 1, headers.length).getValues()[0];
  return {
    success: true,
    data: {
      id: String(updated[idIdx]),
      timestamp: String(updated[headers.indexOf('Timestamp')]),
      serviceNumber: String(updated[headers.indexOf('ServiceNumber')]),
      size: String(updated[sizeIdx]),
      sleeveType: String(updated[sleeveIdx])
    }
  };
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

/**
 * Checks runs for a given service number and date
 * Returns count, total distance, and whether limits are reached
 * NOTE: Only counts approved + pending runs (rejected runs don't count toward limit)
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
  
  // Find column indices
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
  
  // Find the row with matching ID and get run details for email
  let rowIndex = -1;
  let runDetails = null;
  
  // Find column indices for run details
  const dateColIndex = headers.indexOf('Date');
  const serviceNumberColIndex = headers.indexOf('ServiceNumber');
  const nameColIndex = headers.indexOf('Name');
  const distanceColIndex = headers.indexOf('DistanceKm');
  
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1; // Sheet rows are 1-indexed
      // Store run details for email notification
      runDetails = {
        date: dateColIndex >= 0 ? formatDate(dataRange[i][dateColIndex]) : '',
        serviceNumber: serviceNumberColIndex >= 0 ? dataRange[i][serviceNumberColIndex].toString() : '',
        name: nameColIndex >= 0 ? dataRange[i][nameColIndex].toString() : '',
        distanceKm: distanceColIndex >= 0 ? parseFloat(dataRange[i][distanceColIndex]) || 0 : 0
      };
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
  
  // Send email notification to user about approval/rejection
  if (runDetails && (data.status === 'approved' || data.status === 'rejected')) {
    try {
      sendRunStatusNotification({
        name: runDetails.name,
        serviceNumber: runDetails.serviceNumber,
        date: runDetails.date,
        distanceKm: runDetails.distanceKm,
        status: data.status,
        rejectionReason: rejectionReason
      });
      
      // Check for 100K completion on approval
      if (data.status === 'approved') {
        checkAndSendCompletionEmail(runDetails.serviceNumber, runDetails.distanceKm);
      }
      
    } catch (e) {
      Logger.log('Failed to send status notification: ' + e.message);
      // Don't fail the status update if email fails
    }
  }
  
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
  const pinColIndex = headers.indexOf('Pin');
  
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
  const headers = data[0];
  const pinColIndex = headers.indexOf('Pin');
  
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
          createdAt: formatDate(row[7]),
          pin: pinColIndex >= 0 ? (row[pinColIndex] || '').toString() : ''
        }
      };
    }
  }
  
  return { success: true, data: null };
}

/**
 * Admin-only: Get all users including PINs
 */
function getUsersWithPins(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || PIN_ADMINS.indexOf(data.actorServiceNumber.toString().trim()) === -1) {
    return { success: false, error: 'Forbidden: Only PIN admins can access PINs' };
  }
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, error: 'Users sheet not found. Run setupUsersSheet() first.' };
  const dataRange = sheet.getDataRange().getValues();
  const headers = dataRange[0];
  const isAdminColIndex = headers.indexOf('IsAdmin');
  const pinColIndex = headers.indexOf('Pin');
  const users = [];
  for (let i = 1; i < dataRange.length; i++) {
    const row = dataRange[i];
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
        isAdmin: isAdminColIndex >= 0 ? (row[isAdminColIndex] === true || row[isAdminColIndex] === 'TRUE' || row[isAdminColIndex] === 'true') : false,
        pin: pinColIndex >= 0 ? (row[pinColIndex] || '').toString() : ''
      });
    }
  }
  return { success: true, data: users };
}

/**
 * Admin-only: Update a user's PIN (writes to Users sheet 'Pin' column)
 */
function updateUserPin(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || data.actorServiceNumber.toString() !== SUPER_ADMIN_SERVICE_NUMBER) {
    return { success: false, error: 'Forbidden: Only 5568 can assign PINs' };
  }
  if (!data.id || !data.pin) {
    return { success: false, error: 'User ID and PIN are required' };
  }
  const sheet = getUsersSheet();
  if (!sheet) return { success: false, error: 'Users sheet not found' };
  const dataRange = sheet.getDataRange().getValues();
  const headers = dataRange[0];
  const pinColIndex = headers.indexOf('Pin');
  // Create Pin column if missing
  if (pinColIndex === -1) {
    sheet.insertColumnAfter(headers.length);
    sheet.getRange(1, headers.length + 1).setValue('Pin');
  }
  const latestData = sheet.getDataRange().getValues();
  const latestHeaders = latestData[0];
  const latestPinColIndex = latestHeaders.indexOf('Pin');
  let rowIndex = -1;
  for (let i = 1; i < latestData.length; i++) {
    if (latestData[i][0].toString() === data.id.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, error: 'User not found' };
  sheet.getRange(rowIndex, latestPinColIndex + 1).setValue(data.pin.toString());
  return { success: true, data: { id: data.id, pin: data.pin } };
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

/**
 * Gets a user's email by their service number
 * @param {string} serviceNumber - The service number to look up
 * @returns {string|null} The user's email or null if not found
 */
function getUserEmail(serviceNumber) {
  const sheet = getUsersSheet();
  if (!sheet) {
    return null;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const serviceNumberColIndex = headers.indexOf('ServiceNumber');
  const emailColIndex = headers.indexOf('Email');
  
  if (serviceNumberColIndex === -1 || emailColIndex === -1) {
    return null;
  }
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[serviceNumberColIndex].toString() === serviceNumber.toString()) {
      const email = row[emailColIndex] ? row[emailColIndex].toString().trim() : '';
      return email && email.includes('@') ? email : null;
    }
  }
  
  return null;
}

function sendPinEmails(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || data.actorServiceNumber.toString() !== SUPER_ADMIN_SERVICE_NUMBER) {
    return { success: false, error: 'Forbidden: Only 5568 can send PINs' };
  }
  const sheet = getUsersSheet();
  if (!sheet) {
    return { success: false, error: 'Users sheet not found. Run setupUsersSheet() first.' };
  }
  const dataRange = sheet.getDataRange().getValues();
  const headers = dataRange[0];
  const emailColIndex = headers.indexOf('Email');
  let pinColIndex = headers.indexOf('Pin');
  const nameColIndex = headers.indexOf('Name');
  const serviceNumberColIndex = headers.indexOf('ServiceNumber');
  const stationColIndex = headers.indexOf('Station');
  if (emailColIndex === -1 || nameColIndex === -1 || serviceNumberColIndex === -1 || stationColIndex === -1) {
    return { success: false, error: 'Required columns missing in Users sheet' };
  }
  if (pinColIndex === -1) {
    sheet.insertColumnAfter(headers.length);
    sheet.getRange(1, headers.length + 1).setValue('Pin');
    const latestData = sheet.getDataRange().getValues();
    const latestHeaders = latestData[0];
    pinColIndex = latestHeaders.indexOf('Pin');
  }
  let sent = 0;
  let skipped = 0;
  let missingEmail = 0;
  let excludedAdmin = 0;
  let autoAssigned = 0;
  const failed = [];
  const succeeded = [];
  for (let i = 1; i < dataRange.length; i++) {
    const row = dataRange[i];
    const station = row[stationColIndex] ? row[stationColIndex].toString() : '';
    if (!station || station === 'General Admin') {
      excludedAdmin++;
      continue;
    }
    const email = row[emailColIndex] ? row[emailColIndex].toString().trim() : '';
    let pin = pinColIndex >= 0 ? (row[pinColIndex] || '').toString().trim() : '';
    const name = row[nameColIndex] ? row[nameColIndex].toString() : '';
    const serviceNumber = row[serviceNumberColIndex] ? row[serviceNumberColIndex].toString() : '';
    if (!email || !email.includes('@')) {
      skipped++;
      missingEmail++;
      continue;
    }
    if (!pin || pin.length !== 4 || pin.charAt(0) === '0') {
      const base = serviceNumber + '|' + (email || '') + '|pins-v1';
      let h = 0;
      for (let j = 0; j < base.length; j++) {
        h = (h * 31 + base.charCodeAt(j)) >>> 0;
      }
      const n = (h % 9000) + 1000;
      pin = n.toString();
      sheet.getRange(i + 1, pinColIndex + 1).setValue(pin);
      autoAssigned++;
    }
    const subject = 'Your Assigned PIN - 100K Run Challenge';
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #2186eb; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Your Assigned PIN</h1>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
          <p style="margin: 0 0 15px; color: #333;">Hi ${name},</p>
          <p style="margin: 0 0 15px; color: #333;">Your assigned PIN for the 100K Run Challenge is:</p>
          <div style="text-align: center; margin: 16px 0;">
            <div style="display: inline-block; background: #fff; border: 2px dashed #2186eb; border-radius: 10px; padding: 14px 22px; font-size: 24px; color: #2186eb; font-weight: bold; letter-spacing: 2px;">${pin}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 10px; color: #666;">Station</td>
              <td style="padding: 10px; color: #333;">${station}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="https://run.huvadhoofulusclub.events/participant-login" style="display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login</a>
          </div>
          <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">Use this PIN to log in and submit your runs.</p>
        </div>
      </div>
    `;
    const plainBody = `
Hi ${name},

Your assigned PIN for the 100K Run Challenge is ${pin}.

Station: ${station}

Login: https://run.huvadhoofulusclub.events/participant-login
`;
    try {
      MailApp.sendEmail({ to: email, subject: subject, body: plainBody, htmlBody: htmlBody });
      sent++;
      succeeded.push({ email: email, name: name });
    } catch (e) {
      Logger.log('Failed to send PIN to ' + email + ': ' + e.message);
      skipped++;
      failed.push({ email: email, name: name, error: e && e.message ? e.message : 'unknown error' });
    }
    Utilities.sleep(200);
  }
  return { success: true, data: { sent: sent, skipped: skipped, missingEmail: missingEmail, excludedAdmin: excludedAdmin, autoAssigned: autoAssigned, failed: failed, succeeded: succeeded } };
}

function sendPinEmailsList(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || data.actorServiceNumber.toString() !== SUPER_ADMIN_SERVICE_NUMBER) {
    return { success: false, error: 'Forbidden: Only 5568 can send PINs' };
  }
  const entries = Array.isArray(data.entries) ? data.entries : [];
  let sent = 0;
  let skipped = 0;
  const failed = [];
  const succeeded = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] || {};
    const email = (entry.email || '').toString().trim();
    const name = (entry.name || '').toString();
    const serviceNumber = (entry.serviceNumber || '').toString();
    const station = (entry.station || '').toString();
    const pin = (entry.pin || '').toString();
    if (!email || !email.includes('@') || !pin) {
      skipped++;
      continue;
    }
    const subject = 'Your Assigned PIN - 100K Run Challenge';
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #2186eb; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Your Assigned PIN</h1>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
          <p style="margin: 0 0 15px; color: #333;">Hi ${name},</p>
          <p style="margin: 0 0 15px; color: #333;">Your assigned PIN for the 100K Run Challenge is:</p>
          <div style="text-align: center; margin: 16px 0;">
            <div style="display: inline-block; background: #fff; border: 2px dashed #2186eb; border-radius: 10px; padding: 14px 22px; font-size: 24px; color: #2186eb; font-weight: bold; letter-spacing: 2px;">${pin}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 10px; color: #666;">Station</td>
              <td style="padding: 10px; color: #333;">${station}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="https://run.huvadhoofulusclub.events/participant-login" style="display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login</a>
          </div>
          <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">Use this PIN to log in and submit your runs.</p>
        </div>
      </div>
    `;
    const plainBody = `
Hi ${name},

Your assigned PIN for the 100K Run Challenge is ${pin}.

Station: ${station}

Login: https://run.huvadhoofulusclub.events/participant-login
`;
    try {
      MailApp.sendEmail({ to: email, subject: subject, body: plainBody, htmlBody: htmlBody });
      sent++;
      succeeded.push({ email: email, name: name });
    } catch (e) {
      skipped++;
      failed.push({ email: email, name: name, error: e && e.message ? e.message : 'unknown error' });
    }
    Utilities.sleep(200);
  }
  return { success: true, data: { sent: sent, skipped: skipped, failed: failed, succeeded: succeeded } };
}

function getPinEmailQueueSheet() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = spreadsheet.getSheetByName('PinEmailQueue');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('PinEmailQueue');
    const headers = ['Email', 'Name', 'ServiceNumber', 'Station', 'Pin', 'Status', 'LastError', 'EnqueuedAt', 'SentAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function enqueuePinEmailsList(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || data.actorServiceNumber.toString() !== SUPER_ADMIN_SERVICE_NUMBER) {
    return { success: false, error: 'Forbidden: Only 5568 can enqueue PINs' };
  }
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const sheet = getPinEmailQueueSheet();
  const now = new Date();
  const rows = [];
  entries.forEach(e => {
    const email = (e.email || '').toString().trim();
    const pin = (e.pin || '').toString().trim();
    if (!email || !email.includes('@') || !pin) return;
    rows.push([
      email,
      (e.name || '').toString(),
      (e.serviceNumber || '').toString(),
      (e.station || '').toString(),
      pin,
      'pending',
      '',
      now,
      ''
    ]);
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  const remaining = MailApp.getRemainingDailyQuota();
  return { success: true, data: { queued: rows.length, remaining: remaining } };
}

function processPinEmailQueue() {
  const sheet = getPinEmailQueueSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('Status');
  const lastErrorCol = headers.indexOf('LastError');
  const emailCol = headers.indexOf('Email');
  const nameCol = headers.indexOf('Name');
  const snCol = headers.indexOf('ServiceNumber');
  const stationCol = headers.indexOf('Station');
  const pinCol = headers.indexOf('Pin');
  const sentAtCol = headers.indexOf('SentAt');
  let remaining = MailApp.getRemainingDailyQuota();
  for (let i = 1; i < data.length; i++) {
    if (remaining <= 0) break;
    const row = data[i];
    if ((row[statusCol] || '').toString() !== 'pending') continue;
    const email = (row[emailCol] || '').toString().trim();
    const name = (row[nameCol] || '').toString();
    const serviceNumber = (row[snCol] || '').toString();
    const station = (row[stationCol] || '').toString();
    const pin = (row[pinCol] || '').toString();
    if (!email || !email.includes('@') || !pin) {
      sheet.getRange(i + 1, statusCol + 1).setValue('error');
      sheet.getRange(i + 1, lastErrorCol + 1).setValue('Invalid email or pin');
      continue;
    }
    const subject = 'Your Assigned PIN - 100K Run Challenge';
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #2186eb; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Your Assigned PIN</h1>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
          <p style="margin: 0 0 15px; color: #333;">Hi ${name},</p>
          <p style="margin: 0 0 15px; color: #333;">Your assigned PIN for the 100K Run Challenge is:</p>
          <div style="text-align: center; margin: 16px 0;">
            <div style="display: inline-block; background: #fff; border: 2px dashed #2186eb; border-radius: 10px; padding: 14px 22px; font-size: 24px; color: #2186eb; font-weight: bold; letter-spacing: 2px;">${pin}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 10px; color: #666;">Station</td>
              <td style="padding: 10px; color: #333;">${station}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="https://run.huvadhoofulusclub.events/participant-login" style="display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login</a>
          </div>
          <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">Use this PIN to log in and submit your runs.</p>
        </div>
      </div>
    `;
    const plainBody = `
Hi ${name},

Your assigned PIN for the 100K Run Challenge is ${pin}.

Station: ${station}

Login: https://run.huvadhoofulusclub.events/participant-login
`;
    try {
      MailApp.sendEmail({ to: email, subject: subject, body: plainBody, htmlBody: htmlBody });
      sheet.getRange(i + 1, statusCol + 1).setValue('sent');
      sheet.getRange(i + 1, lastErrorCol + 1).setValue('');
      sheet.getRange(i + 1, sentAtCol + 1).setValue(new Date());
      remaining--;
    } catch (e) {
      sheet.getRange(i + 1, statusCol + 1).setValue('error');
      sheet.getRange(i + 1, lastErrorCol + 1).setValue(e && e.message ? e.message : 'unknown error');
    }
    Utilities.sleep(300);
  }
  return { success: true, data: { remaining: remaining } };
}

function setupPinEmailQueueTrigger() {
  ScriptApp.newTrigger('processPinEmailQueue').timeBased().everyHours(1).create();
  return { success: true };
}

function getPinEmailQueueStatus(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized: Invalid admin token' };
  }
  if (!data.actorServiceNumber || PIN_ADMINS.indexOf(data.actorServiceNumber.toString().trim()) === -1) {
    return { success: false, error: 'Forbidden: Only PIN admins can view PIN email queue' };
  }
  const sheet = getPinEmailQueueSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const statusCol = headers.indexOf('Status');
  const emailCol = headers.indexOf('Email');
  const nameCol = headers.indexOf('Name');
  const lastErrorCol = headers.indexOf('LastError');
  const sentAtCol = headers.indexOf('SentAt');
  const sent = [];
  const failed = [];
  const pending = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = (row[statusCol] || '').toString();
    const email = (row[emailCol] || '').toString();
    const name = (row[nameCol] || '').toString();
    if (status === 'sent') {
      sent.push({ email: email, name: name, sentAt: row[sentAtCol] ? formatDateTime(row[sentAtCol]) : '' });
    } else if (status === 'error') {
      failed.push({ email: email, name: name, error: (row[lastErrorCol] || '').toString() });
    } else if (status === 'pending') {
      pending.push({ email: email, name: name });
    }
  }
  return {
    success: true,
    data: {
      sent: sent,
      failed: failed,
      pending: pending,
      counts: { sent: sent.length, failed: failed.length, pending: pending.length },
      remaining: MailApp.getRemainingDailyQuota()
    }
  };
}
/**
 * Sends email notification to user when their run is approved or rejected
 * @param {Object} runData - Run details (name, serviceNumber, date, distanceKm, status, rejectionReason)
 */
function sendRunStatusNotification(runData) {
  const userEmail = getUserEmail(runData.serviceNumber);
  
  if (!userEmail) {
    Logger.log('No email found for user: ' + runData.serviceNumber);
    return;
  }
  
  const isApproved = runData.status === 'approved';
  const statusEmoji = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  const statusColor = isApproved ? '#27ae60' : '#e74c3c';
  
  const subject = `${statusEmoji} Your Run Has Been ${statusText} - 100K Run Challenge`;
  
  const formattedDate = runData.date;
  
  let rejectionSection = '';
  if (!isApproved && runData.rejectionReason) {
    rejectionSection = `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Reason</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #e74c3c; font-weight: bold;">${runData.rejectionReason}</td>
      </tr>
    `;
  }
  
  let actionMessage = '';
  if (isApproved) {
    actionMessage = '<p style="color: #27ae60; font-weight: bold;">Great job! Your run has been verified and added to your total.</p>';
  } else {
    actionMessage = '<p style="color: #e74c3c;">Please review the reason above and submit a new run with the correct screenshot.</p>';
  }
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${statusEmoji} Run ${statusText}</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
        <p style="margin: 0 0 15px; color: #333;">Hi ${runData.name},</p>
        
        <p style="margin: 0 0 15px; color: #333;">Your run submission has been reviewed:</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666; width: 40%;">Date</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333; font-weight: bold;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Distance</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #333; font-weight: bold;">${runData.distanceDisplay || runData.distanceKm} km</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: #666;">Status</td>
            <td style="padding: 10px; border-bottom: 1px solid #e9ecef; color: ${statusColor}; font-weight: bold;">${statusText}</td>
          </tr>
          ${rejectionSection}
        </table>
        
        <div style="margin-top: 20px;">
          ${actionMessage}
        </div>
        
        <div style="margin-top: 20px; text-align: center;">
          <a href="https://run.huvadhoofulusclub.events/dashboard" 
             style="display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            View Dashboard →
          </a>
        </div>
        
        <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">
          This is an automated notification from the 100K Run Challenge system.
        </p>
      </div>
    </div>
  `;
  
  const plainBody = `
Run ${statusText}

Hi ${runData.name},

Your run submission has been reviewed:

Date: ${formattedDate}
    Distance: ${runData.distanceDisplay || runData.distanceKm} km
Status: ${statusText}
${!isApproved && runData.rejectionReason ? 'Reason: ' + runData.rejectionReason : ''}

${isApproved ? 'Great job! Your run has been verified and added to your total.' : 'Please review the reason and submit a new run with the correct screenshot.'}

View Dashboard: https://run.huvadhoofulusclub.events/dashboard
  `;
  
  try {
    MailApp.sendEmail({
      to: userEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody
    });
    Logger.log('Status notification sent to: ' + userEmail);
  } catch (e) {
    Logger.log('Failed to send status notification to ' + userEmail + ': ' + e.message);
  }
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
function logUserLogin(data) {
  const sheet = getUserLoginsSheet();
  const now = new Date();
  const row = [
    now,
    (data.serviceNumber || '').toString(),
    (data.name || '').toString(),
    (data.station || '').toString(),
    (data.userAgent || '').toString(),
    (data.language || '').toString(),
    (data.timezone || '').toString(),
    (data.platform || '').toString(),
    (data.ip || '').toString(),
    (data.origin || '').toString()
  ];
  sheet.appendRow(row);
  return { success: true };
}

function getSponsors() {
  const sheet = getSponsorsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sponsors = [];
  
  // Find column indices
  const idCol = headers.indexOf('ID');
  const businessNameCol = headers.indexOf('BusinessName');
  const detailsCol = headers.indexOf('Details');
  const amountSponsoredCol = headers.indexOf('AmountSponsored');
  const contactNameCol = headers.indexOf('ContactName');
  const contactPhoneCol = headers.indexOf('ContactPhone');
  const contactEmailCol = headers.indexOf('ContactEmail');
  const createdAtCol = headers.indexOf('CreatedAt');
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idCol]) {
      sponsors.push({
        id: row[idCol].toString(),
        businessName: businessNameCol >= 0 ? row[businessNameCol].toString() : '',
        details: detailsCol >= 0 ? row[detailsCol].toString() : '',
        amountSponsored: amountSponsoredCol >= 0 ? parseFloat(row[amountSponsoredCol]) || 0 : 0,
        contactName: contactNameCol >= 0 ? row[contactNameCol].toString() : '',
        contactPhone: contactPhoneCol >= 0 ? row[contactPhoneCol].toString() : '',
        contactEmail: contactEmailCol >= 0 ? row[contactEmailCol].toString() : '',
        createdAt: createdAtCol >= 0 ? formatDateTime(row[createdAtCol]) : ''
      });
    }
  }
  return { success: true, data: sponsors };
}

function addSponsor(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.businessName || !data.amountSponsored || !data.contactName) {
    return { success: false, error: 'Business Name, Amount, and Contact Name are required' };
  }
  
  const sheet = getSponsorsSheet();
  const id = generateId();
  // Use Maldives timezone for consistency
  const createdAt = Utilities.formatDate(new Date(), 'Indian/Maldives', 'yyyy-MM-dd HH:mm:ss');
  
  // Get headers to match columns dynamically
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIndex = {
    id: headers.indexOf('ID'),
    businessName: headers.indexOf('BusinessName'),
    details: headers.indexOf('Details'),
    amountSponsored: headers.indexOf('AmountSponsored'),
    contactName: headers.indexOf('ContactName'),
    contactPhone: headers.indexOf('ContactPhone'),
    contactEmail: headers.indexOf('ContactEmail'),
    createdAt: headers.indexOf('CreatedAt')
  };
  
  const newRow = new Array(sheet.getLastColumn()).fill('');
  
  if (colIndex.id >= 0) newRow[colIndex.id] = id;
  if (colIndex.businessName >= 0) newRow[colIndex.businessName] = data.businessName.toString().trim();
  if (colIndex.details >= 0) newRow[colIndex.details] = (data.details || '').toString().trim();
  if (colIndex.amountSponsored >= 0) newRow[colIndex.amountSponsored] = parseFloat(data.amountSponsored);
  if (colIndex.contactName >= 0) newRow[colIndex.contactName] = data.contactName.toString().trim();
  if (colIndex.contactPhone >= 0) newRow[colIndex.contactPhone] = (data.contactPhone || '').toString().trim();
  if (colIndex.contactEmail >= 0) newRow[colIndex.contactEmail] = (data.contactEmail || '').toString().trim();
  if (colIndex.createdAt >= 0) newRow[colIndex.createdAt] = createdAt;
  
  sheet.appendRow(newRow);
  
  return {
    success: true,
    data: {
      id: id,
      businessName: data.businessName,
      details: data.details,
      amountSponsored: parseFloat(data.amountSponsored),
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      createdAt: formatDateTime(createdAt)
    }
  };
}

function getFundUsages() {
  const sheet = getFundUsagesSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usages = [];
  
  const idCol = headers.indexOf('ID');
  const purposeCol = headers.indexOf('Purpose');
  const amountUsedCol = headers.indexOf('AmountUsed');
  const serviceNumberCol = headers.indexOf('ServiceNumber');
  const sponsorIdCol = headers.indexOf('SponsorId');
  const dateCol = headers.indexOf('Date');
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idCol]) {
      usages.push({
        id: row[idCol].toString(),
        purpose: purposeCol >= 0 ? row[purposeCol].toString() : '',
        amountUsed: amountUsedCol >= 0 ? parseFloat(row[amountUsedCol]) || 0 : 0,
        serviceNumber: serviceNumberCol >= 0 ? row[serviceNumberCol].toString() : '',
        sponsorId: sponsorIdCol >= 0 ? row[sponsorIdCol].toString() : '',
        date: dateCol >= 0 ? formatDate(row[dateCol]) : ''
      });
    }
  }
  return { success: true, data: usages };
}

function addFundUsage(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.purpose || !data.amountUsed || !data.serviceNumber) {
    return { success: false, error: 'Purpose, Amount, and Service Number are required' };
  }
  
  const sheet = getFundUsagesSheet();
  const id = generateId();
  // Use Maldives timezone
  const date = Utilities.formatDate(new Date(), 'Indian/Maldives', 'yyyy-MM-dd HH:mm:ss');
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIndex = {
    id: headers.indexOf('ID'),
    purpose: headers.indexOf('Purpose'),
    amountUsed: headers.indexOf('AmountUsed'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    sponsorId: headers.indexOf('SponsorId'),
    date: headers.indexOf('Date')
  };
  
  const newRow = new Array(sheet.getLastColumn()).fill('');
  
  if (colIndex.id >= 0) newRow[colIndex.id] = id;
  if (colIndex.purpose >= 0) newRow[colIndex.purpose] = data.purpose.toString().trim();
  if (colIndex.amountUsed >= 0) newRow[colIndex.amountUsed] = parseFloat(data.amountUsed);
  if (colIndex.serviceNumber >= 0) newRow[colIndex.serviceNumber] = data.serviceNumber.toString().trim();
  if (colIndex.sponsorId >= 0) newRow[colIndex.sponsorId] = (data.sponsorId || '').toString().trim();
  if (colIndex.date >= 0) newRow[colIndex.date] = date;
  
  sheet.appendRow(newRow);
  
  return {
    success: true,
    data: {
      id: id,
      purpose: data.purpose,
      amountUsed: parseFloat(data.amountUsed),
      serviceNumber: data.serviceNumber,
      sponsorId: data.sponsorId,
      date: formatDate(date)
    }
  };
}

function updateSponsor(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }

  const sheet = getSponsorsSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const idCol = headers.indexOf('ID');
  
  if (idCol === -1) return { success: false, error: 'ID column not found' };
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == data.id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Sponsor not found' };
  }
  
  const colIndex = {
    businessName: headers.indexOf('BusinessName'),
    details: headers.indexOf('Details'),
    amountSponsored: headers.indexOf('AmountSponsored'),
    contactName: headers.indexOf('ContactName'),
    contactPhone: headers.indexOf('ContactPhone'),
    contactEmail: headers.indexOf('ContactEmail')
  };
  
  // Only update fields that are provided
  if (data.businessName && colIndex.businessName >= 0) sheet.getRange(rowIndex, colIndex.businessName + 1).setValue(data.businessName.toString().trim());
  if (data.details !== undefined && colIndex.details >= 0) sheet.getRange(rowIndex, colIndex.details + 1).setValue(data.details.toString().trim());
  if (data.amountSponsored && colIndex.amountSponsored >= 0) sheet.getRange(rowIndex, colIndex.amountSponsored + 1).setValue(parseFloat(data.amountSponsored));
  if (data.contactName && colIndex.contactName >= 0) sheet.getRange(rowIndex, colIndex.contactName + 1).setValue(data.contactName.toString().trim());
  if (data.contactPhone !== undefined && colIndex.contactPhone >= 0) sheet.getRange(rowIndex, colIndex.contactPhone + 1).setValue(data.contactPhone.toString().trim());
  if (data.contactEmail !== undefined && colIndex.contactEmail >= 0) sheet.getRange(rowIndex, colIndex.contactEmail + 1).setValue(data.contactEmail.toString().trim());
  
  return { success: true };
}

function deleteSponsor(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }
  
  const sheet = getSponsorsSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const idCol = headers.indexOf('ID');
  
  if (idCol === -1) return { success: false, error: 'ID column not found' };
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == data.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Sponsor not found' };
}

function updateFundUsage(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }

  const sheet = getFundUsagesSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const idCol = headers.indexOf('ID');
  
  if (idCol === -1) return { success: false, error: 'ID column not found' };
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == data.id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Fund usage not found' };
  }
  
  const colIndex = {
    purpose: headers.indexOf('Purpose'),
    amountUsed: headers.indexOf('AmountUsed'),
    serviceNumber: headers.indexOf('ServiceNumber'),
    sponsorId: headers.indexOf('SponsorId')
  };
  
  if (data.purpose && colIndex.purpose >= 0) sheet.getRange(rowIndex, colIndex.purpose + 1).setValue(data.purpose.toString().trim());
  if (data.amountUsed && colIndex.amountUsed >= 0) sheet.getRange(rowIndex, colIndex.amountUsed + 1).setValue(parseFloat(data.amountUsed));
  if (data.serviceNumber && colIndex.serviceNumber >= 0) sheet.getRange(rowIndex, colIndex.serviceNumber + 1).setValue(data.serviceNumber.toString().trim());
  if (data.sponsorId !== undefined && colIndex.sponsorId >= 0) sheet.getRange(rowIndex, colIndex.sponsorId + 1).setValue(data.sponsorId.toString().trim());
  
  return { success: true };
}

function deleteFundUsage(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (!data.id) {
    return { success: false, error: 'ID is required' };
  }
  
  const sheet = getFundUsagesSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const idCol = headers.indexOf('ID');
  
  if (idCol === -1) return { success: false, error: 'ID column not found' };
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] == data.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Fund usage not found' };
}

function getManualAwards() {
  const sheet = getManualAwardsSheet();
  const data = sheet.getDataRange().getValues();
  const result = {};
  // Skip header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      result[row[0]] = {
        awardKey: row[0].toString(),
        winnerIdentifier: row[1].toString(),
        winnerName: row[2].toString(),
        updatedAt: row[3],
        updatedBy: row[4].toString(),
        notes: row[5] ? row[5].toString() : ''
      };
    }
  }
  return { success: true, data: result };
}

function saveManualAward(data) {
  if (!validateAdminToken(data.adminToken)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  const sheet = getManualAwardsSheet();
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.awardKey) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const timestamp = new Date();
  // We can't easily get the admin name without passing it, but we have the token.
  // We'll just say "Admin" for now or use what's passed.
  const updatedBy = data.updatedBy || 'Admin';
  
  if (rowIndex > 0) {
    // Update
    sheet.getRange(rowIndex, 2).setValue(data.winnerIdentifier);
    sheet.getRange(rowIndex, 3).setValue(data.winnerName);
    sheet.getRange(rowIndex, 4).setValue(timestamp);
    sheet.getRange(rowIndex, 5).setValue(updatedBy);
    if (data.notes !== undefined) {
      sheet.getRange(rowIndex, 6).setValue(data.notes);
    }
  } else {
    // Insert
    sheet.appendRow([
      data.awardKey,
      data.winnerIdentifier,
      data.winnerName,
      timestamp,
      updatedBy,
      data.notes || ''
    ]);
  }
  
  return { success: true };
}

// ============================================================
// COUNTDOWN EMAIL REMINDERS
// ============================================================

/**
 * Calculates days remaining until Jan 31, 2026
 */
function getDaysRemaining() {
  const endDate = new Date('2026-01-31T23:59:59');
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Sends countdown reminder emails
 * @param {boolean} force - If true, sends email regardless of date trigger
 */
function sendCountdownReminders(force) {
  const days = getDaysRemaining();
  // Triggers: 30 days (start of warning), 15 days (urgent), 10 days (final countdown)
  const isTriggerDay = (days === 30 || days === 15 || days === 10);
  
  if (!isTriggerDay && !force) {
    Logger.log('Not a reminder day. Days remaining: ' + days);
    return { success: true, message: 'Not a reminder day' };
  }
  
  const usersResponse = getAllUsers();
  if (!usersResponse.success) return usersResponse;
  const users = usersResponse.data;
  
  const runsResponse = getAllRuns();
  if (!runsResponse.success) return runsResponse;
  const runs = runsResponse.data;
  
  // Calculate total approved distance per user
  const userDistances = {};
  runs.forEach(run => {
    if (run.status === 'approved') {
      const sn = run.serviceNumber;
      if (!userDistances[sn]) userDistances[sn] = 0;
      userDistances[sn] += run.distanceKm;
    }
  });
  
  let sentCount = 0;
  let errorCount = 0;
  
  users.forEach(user => {
    if (!user.email || !user.email.includes('@')) return;
    
    const totalDistance = userDistances[user.serviceNumber] || 0;
    
    const content = getCountdownEmailContent(user.name, days, totalDistance);
    
    try {
      MailApp.sendEmail({
        to: user.email,
        subject: content.subject,
        htmlBody: content.htmlBody,
        body: content.plainBody
      });
      sentCount++;
    } catch (e) {
      Logger.log(`Failed to send email to ${user.email}: ${e.message}`);
      errorCount++;
    }
    
    // Avoid hitting rate limits
    if (sentCount % 10 === 0) {
      Utilities.sleep(1000);
    }
  });
  
  Logger.log(`Sent ${sentCount} countdown emails. Errors: ${errorCount}`);
  return { success: true, sent: sentCount, errors: errorCount };
}

/**
 * Generates email content for countdown reminders
 */
function getCountdownEmailContent(name, days, totalDistance) {
  const isCompleted = totalDistance >= 100;
  
  // Common styles
  const containerStyle = 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;';
  const headerStyle = 'background: #102a43; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;';
  const contentStyle = 'background: #f0f4f8; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #d9e2ec;';
  const buttonStyle = 'display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;';
  
  let subject, htmlBody, plainBody;

  if (isCompleted) {
    subject = `🎉 You are a 100K Finisher! ${days} Days Left in the Challenge`;
    htmlBody = `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <h1 style="margin:0;">Congratulations Finisher! 🏅</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #102a43;">You've Conquered the 100K!</h2>
          <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
            ${name}, you have proven that discipline and consistency yield results. 
            We applaud your achievement!
          </p>
          <div style="background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin:0; font-weight: bold; color: #27ae60; font-size: 18px;">Total Distance: ${totalDistance.toFixed(2)} km</p>
          </div>
          <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
            <strong>Keep the streak alive!</strong> There are still ${days} days remaining in the challenge event. 
            Continue running and inspire others with your 40-day streak of dedication!
          </p>
          <div style="text-align: center;">
            <a href="https://run.huvadhoofulusclub.events/dashboard" style="${buttonStyle}">View Leaderboard</a>
          </div>
        </div>
      </div>
    `;
    plainBody = `Congratulations ${name}!\n\nYou have completed the 100K Challenge with ${totalDistance.toFixed(2)} km.\n\nKeep the streak alive! There are ${days} days remaining. Continue running and inspire others with your 40-day streak of dedication!\n\nView Leaderboard: https://run.huvadhoofulusclub.events/dashboard`;
  } else {
    const remainingDist = Math.max(0, 100 - totalDistance).toFixed(2);
    subject = `🏃 ${days} Days Left: Keep Pushing for 100K!`;
    htmlBody = `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <h1 style="margin:0;">The Clock is Ticking! ⏳</h1>
        </div>
        <div style="${contentStyle}">
          <h2 style="color: #102a43;">You Can Do This!</h2>
          <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
            ${name}, the finish line is in sight. You have <strong>${days} days</strong> remaining to complete your 100K journey.
          </p>
          <div style="background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px; color: #486581;">Current Progress: <strong>${totalDistance.toFixed(2)} km</strong></p>
            <p style="margin: 0; color: #e74c3c; font-weight: bold; font-size: 18px;">Remaining: ${remainingDist} km</p>
          </div>
          <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
            Don't give up now. Consistency is key. Push through for the remaining 40-day streak and claim your victory!
          </p>
          <div style="text-align: center;">
            <a href="https://run.huvadhoofulusclub.events/participant-login" style="${buttonStyle}">Submit a Run</a>
          </div>
        </div>
      </div>
    `;
    plainBody = `Hi ${name},\n\nYou have ${days} days remaining to complete the 100K Challenge.\n\nCurrent Progress: ${totalDistance.toFixed(2)} km\nRemaining: ${remainingDist} km\n\nDon't give up! Push through for the remaining 40-day streak and claim your victory!\n\nSubmit a run: https://run.huvadhoofulusclub.events/participant-login`;
  }

  return { subject, htmlBody, plainBody };
}

/**
 * Sends test emails for all countdown scenarios
 */
function sendTestCountdownEmails(targetEmail) {
  if (!targetEmail) targetEmail = 'aly.shanyyz@gmail.com';
  
  const scenarios = [
    { days: 30, distance: 102.5, type: 'Finisher (30 Days Left)' },
    { days: 30, distance: 45.0, type: 'Participant (30 Days Left)' },
    { days: 15, distance: 105.2, type: 'Finisher (15 Days Left)' },
    { days: 15, distance: 85.5, type: 'Participant (15 Days Left)' },
    { days: 10, distance: 110.0, type: 'Finisher (10 Days Left)' },
    { days: 10, distance: 92.0, type: 'Participant (10 Days Left)' }
  ];

  let sent = 0;
  let errors = 0;

  scenarios.forEach(s => {
    const content = getCountdownEmailContent('Test User', s.days, s.distance);
    try {
      MailApp.sendEmail({
        to: targetEmail,
        subject: `[TEST: ${s.type}] ${content.subject}`,
        htmlBody: content.htmlBody,
        body: content.plainBody
      });
      sent++;
      Utilities.sleep(1000); // Prevent rate limiting
    } catch (e) {
      Logger.log(`Failed to send test email: ${e.message}`);
      errors++;
    }
  });

  return { success: true, sent: sent, errors: errors };
}

/**
 * Setup daily trigger for countdown emails
 * Run this once manually
 */
function setupCountdownTrigger() {
  // Check if trigger already exists
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendCountdownReminders') {
      return { success: true, message: 'Trigger already exists' };
    }
  }
  
  // Create daily trigger at 9 AM
  ScriptApp.newTrigger('sendCountdownReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  return { success: true, message: 'Trigger created' };
}

// ============================================================
// COMPLETION EMAIL LOGIC
// ============================================================

/**
 * Checks if a user has just crossed the 100K mark and sends a completion email
 */
function checkAndSendCompletionEmail(serviceNumber, currentRunDistance) {
  try {
    const runsSheet = getRunsSheet();
    const data = runsSheet.getDataRange().getValues();
    const headers = data[0];
    const snIndex = headers.indexOf('ServiceNumber');
    const distIndex = headers.indexOf('DistanceKm');
    const statusIndex = headers.indexOf('Status');
    
    let totalDistance = 0;
    
    // Calculate total approved distance
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[snIndex].toString() === serviceNumber.toString() && row[statusIndex] === 'approved') {
        totalDistance += (parseFloat(row[distIndex]) || 0);
      }
    }
    
    // Check if this run was the one that crossed the 100K threshold
    const previousDistance = totalDistance - currentRunDistance;
    
    // Use 99.99 to account for minor floating point issues, but strict 100 is usually fine
    // Trigger if they were below 100 before, and are >= 100 now
    if (totalDistance >= 100 && previousDistance < 100) {
      const userResult = getUserByServiceNumber(serviceNumber);
      if (userResult.success && userResult.data && userResult.data.email) {
        sendCompletionEmail(userResult.data.email, userResult.data.name, totalDistance);
      }
    }
  } catch (e) {
    Logger.log('Error in checkAndSendCompletionEmail: ' + e.message);
  }
}

/**
 * Sends the 100K completion email
 */
function sendCompletionEmail(email, name, totalDistance) {
  const daysRemaining = getDaysRemaining();
  
  const subject = `🎉 CHALLENGE COMPLETE: You are a 100K Finisher!`;
  
  // Common styles
  const containerStyle = 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;';
  const headerStyle = 'background: #102a43; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;';
  const contentStyle = 'background: #f0f4f8; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #d9e2ec;';
  const buttonStyle = 'display: inline-block; background: #2186eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;';
  
  const htmlBody = `
    <div style="${containerStyle}">
      <div style="${headerStyle}">
        <h1 style="margin:0;">MISSION ACCOMPLISHED! 🏅</h1>
      </div>
      <div style="${contentStyle}">
        <h2 style="color: #102a43;">Welcome to the 100K Club!</h2>
        <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
          ${name}, you did it! You have successfully completed the 100K Run Challenge.
        </p>
        <div style="background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin:0; font-weight: bold; color: #27ae60; font-size: 24px;">100 KM UNLOCKED</p>
          <p style="margin:5px 0 0; color: #486581;">Total Distance: ${totalDistance.toFixed(2)} km</p>
        </div>
        <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
          Your dedication and persistence have paid off. This is a massive achievement!
        </p>
        <p style="font-size: 16px; color: #334e68; line-height: 1.5;">
          <strong>What's Next?</strong> There are still ${daysRemaining} days left in the event. 
          Keep running to improve your rank and maintain your streak!
        </p>
        <div style="text-align: center;">
          <a href="https://run.huvadhoofulusclub.events/dashboard" style="${buttonStyle}">View Your Finisher Status</a>
        </div>
      </div>
    </div>
  `;
  
  const plainBody = `CONGRATULATIONS ${name}!\n\nYou have successfully completed the 100K Run Challenge!\n\nTotal Distance: ${totalDistance.toFixed(2)} km\n\nYour dedication and persistence have paid off. This is a massive achievement!\n\nThere are still ${daysRemaining} days left in the event. Keep running to improve your rank!\n\nView Dashboard: https://run.huvadhoofulusclub.events/dashboard`;
  
  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody
    });
    Logger.log(`Sent completion email to ${email}`);
  } catch (e) {
    Logger.log(`Failed to send completion email to ${email}: ${e.message}`);
  }
}
