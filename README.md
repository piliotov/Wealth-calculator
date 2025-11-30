# WealthTracker AI

A local-first personal finance application with an embedded "Virtual CFO" powered by Google Gemini.

## Features

- **Local Privacy:** Data is stored locally.
- **AI Integration:** Chat with your finances using the "Virtual CFO" (Gemini 2.5 Flash).
- **Dashboard:** Visualize Net Worth and Expense Categories.
- **Multi-Currency:** Support for EUR and BGN toggling.

## Quick Start (Preview Mode)

1.  Create a `.env` file in the root with your Gemini API key:
    ```
    API_KEY=your_gemini_api_key_here
    ```
2.  The application runs immediately in the browser using `localStorage` to simulate the database for the preview.

## Running the Real Backend (Optional)

This project contains code for a Node.js + SQLite backend in the `server/` directory.

1.  Navigate to root.
2.  Install backend deps: `npm install express sqlite3 bcryptjs jsonwebtoken cors dotenv`.
3.  Start server: `node server/server.js`.
4.  Update `client/src/services` to fetch from `http://localhost:3001` instead of using `localDb.ts`.
