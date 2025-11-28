# 🏃 Run Tracker

A modern web application for tracking and logging daily runs for police staff. Built with React, TypeScript, and Google Sheets as the backend.

![Run Tracker](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **📊 Dashboard** - View team statistics, leaderboard rankings, and recent runs
- **➕ Add Run** - Log daily runs with validation (one run per person per day)
- **🔐 Admin Mode** - Edit or delete entries with password protection
- **📱 Mobile Responsive** - Works great on phones and desktops
- **☁️ Serverless** - No backend server required, uses Google Sheets + Apps Script

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Google account
- A modern web browser

### 1. Install Dependencies

```bash
cd run-tracker
npm install
```

### 2. Set Up Google Sheets Backend

Follow these steps to set up your Google Sheets backend:

#### A. Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Run Tracker Data"
4. Rename the first sheet tab to "Runs"
5. **Note the Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` part

#### B. Create the Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `google-apps-script/Code.gs` and paste it
4. Save the project (Ctrl/Cmd + S)
5. Name the project "Run Tracker Backend"

#### C. Configure Script Properties

1. In Apps Script, click the **gear icon** (Project Settings)
2. Scroll down to **Script Properties**
3. Click **Add script property** and add:

| Property | Value | Description |
|----------|-------|-------------|
| `SPREADSHEET_ID` | Your spreadsheet ID | From step A.5 |
| `ADMIN_PASSWORD` | Your chosen password | e.g., `SecurePass123!` |
| `ADMIN_TOKEN` | Random string | Generate a UUID or random string |

4. Click **Save script properties**

#### D. Initialize the Sheet

1. In Apps Script, select the `setupSheet` function from the dropdown
2. Click **Run**
3. Authorize the script when prompted:
   - Click "Review permissions"
   - Select your Google account
   - Click "Advanced" > "Go to Run Tracker Backend"
   - Click "Allow"

#### E. Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "Run Tracker API v1"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Copy the Web App URL** (you'll need this!)

### 3. Configure the Frontend

1. Copy the environment example file:

```bash
cp .env.example .env
```

2. Edit `.env` with your values:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_ADMIN_PASSWORD=your_admin_password
```

### 4. Run the Application

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:5173`

## 📖 Usage Guide

### For Staff Members

1. **Home Page** - Overview and quick access to features
2. **Add Run** - Fill in your details and log your daily run
   - Service Number (your ID)
   - Name
   - Station
   - Date (defaults to today)
   - Distance in kilometers
3. **Dashboard** - View your ranking and team statistics

### For Administrators

1. Click **Admin** in the navigation
2. Enter the admin password
3. In Admin mode, you can:
   - Edit any run entry
   - Delete incorrect entries
   - View all historical data

## 🏗️ Project Structure

```
run-tracker/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Layout.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── Navbar.tsx
│   ├── context/         # React context for state management
│   │   └── AppContext.tsx
│   ├── pages/           # Page components
│   │   ├── AddRun.tsx
│   │   ├── Admin.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── Dashboard.tsx
│   │   └── Home.tsx
│   ├── services/        # API service layer
│   │   └── api.ts
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx          # Main app with routing
│   ├── config.ts        # Configuration
│   ├── index.css        # Global styles
│   └── main.tsx         # Entry point
├── google-apps-script/  # Backend code
│   └── Code.gs
├── public/              # Static assets
├── .env.example         # Environment template
├── package.json
├── tailwind.config.js
└── README.md
```

## 🔧 Google Apps Script API Reference

### Endpoints

All requests go to your deployed Web App URL.

#### GET Requests

| Action | Parameters | Description |
|--------|------------|-------------|
| `getRuns` | None | Get all runs |
| `checkDuplicate` | `serviceNumber`, `date` | Check if run exists |

#### POST Requests

| Action | Body Parameters | Description |
|--------|-----------------|-------------|
| `addRun` | `serviceNumber`, `name`, `station`, `date`, `distanceKm` | Add new run |
| `updateRun` | `adminToken`, `id`, + run fields | Update run (admin) |
| `deleteRun` | `adminToken`, `id` | Delete run (admin) |
| `validateAdmin` | `password` | Validate admin password |

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "error": "Error message if success is false"
}
```

## 🚀 Deployment

### Deploy to Vercel

```bash
npm run build
# Then deploy the `dist` folder to Vercel
```

### Deploy to Netlify

```bash
npm run build
# Then deploy the `dist` folder to Netlify
```

### Deploy to GitHub Pages

1. Update `vite.config.ts` with your base path
2. Run `npm run build`
3. Deploy the `dist` folder

## 🔒 Security Notes

1. **Admin Password**: Store securely in environment variables
2. **Apps Script URL**: Keep private to prevent unauthorized access
3. **Google Sheet**: Consider restricting edit access to the sheet itself
4. **CORS**: Apps Script handles CORS automatically when deployed as web app

## 🐛 Troubleshooting

### "Failed to fetch runs"
- Check that your Apps Script URL is correct in `.env`
- Verify the Apps Script is deployed and accessible
- Check browser console for detailed errors

### "Unauthorized" errors
- Ensure admin password matches in both frontend and Apps Script
- Re-deploy Apps Script after changing script properties

### Runs not appearing
- Check the Google Sheet has the correct structure
- Run `testSetup()` in Apps Script to diagnose issues
- Verify the sheet name is "Runs"

### Apps Script errors
- Check the Apps Script execution log (View > Executions)
- Verify Script Properties are set correctly
- Re-authorize the script if needed

## 📝 License

MIT License - feel free to use and modify for your organization.

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for keeping our team fit and healthy!

