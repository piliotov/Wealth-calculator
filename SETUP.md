# WealthTracker AI - Setup Guide

## Prerequisites

- Node.js v20+ installed
- A Google Gemini API key (get one free at https://aistudio.google.com/app/apikey)

## Quick Start (One Command!)

### 1. Add your Gemini API key

Edit `.env` file in the project root and replace `YOUR_GEMINI_KEY_HERE` with your actual key:

```env
PORT=3001
JWT_SECRET=mysecretkey123
GOOGLE_API_KEY=your_actual_key_here
GEMINI_API_KEY=your_actual_key_here
```

### 2. Start everything with one command

```powershell
npm start
```

This will:
- Start the Express backend on `http://localhost:3001`
- Start the Vite frontend on `http://localhost:3000`
- Auto-reload both when you make changes

### 3. Open your browser

Navigate to: **http://localhost:3000**

## First Time Use

1. Click "Create Account" on the login screen
2. Enter any username and password (stored in SQLite `server/finance.db`)
3. You'll get 3 default accounts:
   - German Bank (EUR)
   - BG Bank (BGN)
   - Revolut (EUR)

## Features

### ✅ Persistent Data (SQLite Database)
- All accounts, transactions, and users are stored in `server/finance.db`
- Data persists even when the server is restarted
- No more localStorage - everything is real backend storage

### ✅ AI Financial Advisor
- Click the chat bubble in the bottom-right
- Ask questions like:
  - "Can I afford a €500 purchase?"
  - "What's my spending pattern?"
  - "Should I save more this month?"
- The AI sees your real accounts and last 20 transactions

### ✅ Multi-Currency Support
- EUR, BGN, USD accounts
- Automatic conversion for net worth (BGN → EUR at 1.95583)

### ✅ Salary Calculator
- Enter hours worked and hourly rate
- See gross, pension, tax, and net
- Save net salary directly to any account

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | **Run both backend + frontend** (recommended) |
| `npm run dev` | Run frontend only (Vite dev server) |
| `npm run server` | Run backend only (Express server) |
| `npm run dev:server` | Run backend with auto-reload (nodemon) |
| `npm run build` | Build frontend for production |

## Project Structure

```
Wealth-calculator/
├── server/
│   ├── server.js       # Express API (auth, accounts, transactions, AI chat)
│   ├── database.js     # SQLite setup
│   └── finance.db      # SQLite database (auto-created)
├── services/
│   ├── api.ts          # Frontend API client (calls backend)
│   └── localDb.ts      # (deprecated - kept for reference)
├── components/
│   ├── Auth.tsx        # Login/Register
│   ├── Dashboard.tsx   # Main view
│   ├── Profile.tsx     # Account management
│   ├── AIChat.tsx      # Gemini AI chat
│   └── ...
├── App.tsx             # Main app
├── index.tsx           # Entry point
├── .env                # Environment variables
└── package.json

```

## Troubleshooting

### "Cannot connect to server"
- Make sure `npm start` is running
- Check that port 3001 isn't blocked
- Verify `.env` exists with `PORT=3001`

### "AI chat not working"
- Check your `.env` has a valid `GOOGLE_API_KEY`
- Make sure you replaced `YOUR_GEMINI_KEY_HERE`
- Look at the server terminal for error messages

### "No accounts showing up"
- Register a new user (default accounts are created on registration)
- Or manually add accounts in the Profile page

## Next Steps

- **Remove the green test banner**: Edit `components/Auth.tsx` and delete the green `<div>` with "REACT IS RUNNING"
- **Customize currencies**: Edit the currency dropdown in `Profile.tsx`
- **Add more categories**: Update transaction categories in `TransactionForm.tsx`

---

**Enjoy your local-first AI-powered finance tracker!** 🚀
