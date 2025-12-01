# WealthTracker AI 💰

A full-stack personal finance application with AI-powered financial advisor using Google Gemini.

## ✨ Features

- **💾 Persistent Storage**: SQLite database with automatic backups
- **🤖 AI Financial Advisor**: Chat with your finances using Google Gemini
- **📊 Visual Dashboard**: Interactive charts for income/expenses, net worth tracking
- **💱 Multi-Currency**: Support for EUR, BGN, and USD with automatic conversion
- **🏦 Account Management**: Multiple accounts with different currencies
- **💸 Money Transfers**: Transfer between accounts with currency conversion
- **📝 Transaction Tracking**: Full CRUD operations with automatic balance updates
- **💳 Loan Tracker**: Track money lent to or borrowed from others with repayment tracking
- **🧮 German Salary Calculator**: Accurate tax calculation for all 6 tax classes (Steuerklasse 1-6)
  - Regular employees with full social security
  - Werkstudent (student workers) with reduced contributions
  - Minijob (≤520€) tax-free calculation
- **🔔 Modern Notifications**: Beautiful toast notifications and confirm dialogs
- **🌙 Dark Theme**: Modern, sleek interface optimized for readability

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/piliotov/Wealth-calculator.git
   cd Wealth-calculator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Google Gemini API key:
   ```
   PORT=3001
   JWT_SECRET=your_random_secret_here
   GOOGLE_API_KEY=your_gemini_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   Get a free API key from: https://makersuite.google.com/app/apikey

4. **Start the application**
   ```bash
   npm start
   ```
   
   This will start both the backend (port 3001) and frontend (port 3000) simultaneously.

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
Wealth-calculator/
├── server/                 # Backend (Node.js + Express + SQLite)
│   ├── server.cjs         # Main server with API endpoints
│   ├── database.cjs       # Database initialization
│   └── finance.db         # SQLite database (auto-created, gitignored)
├── components/            # React components
│   ├── Auth.tsx          # Login/Register
│   ├── Dashboard.tsx     # Main dashboard with charts
│   ├── Profile.tsx       # Account management
│   ├── SalaryCalculator.tsx  # German tax calculator
│   ├── TransactionForm.tsx   # Add transactions
│   ├── TransferForm.tsx      # Transfer between accounts
│   ├── LendingTracker.tsx    # Loan tracking
│   ├── AIChat.tsx            # Floating AI chat
│   ├── Toast.tsx             # Notification toasts
│   ├── ToastContainer.tsx    # Toast manager
│   └── ConfirmDialog.tsx     # Confirmation dialogs
├── services/              # API client services
│   └── api.ts            # Backend API calls
├── App.tsx               # Main app component
├── .env                  # Environment variables (gitignored)
├── .env.example          # Environment template
└── package.json          # Dependencies and scripts
```

## 🛠️ Tech Stack

**Frontend:**
- React 19.2.0
- TypeScript 5.8.2
- Vite 6.4.1
- Recharts 3.5.1 (charts)
- Lucide React (icons)
- Tailwind CSS

**Backend:**
- Node.js
- Express.js
- SQLite3
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- Google Generative AI SDK

## 📝 Usage

### First Time Setup
1. Register a new account
2. Three default accounts are created automatically:
   - German Bank (EUR)
   - BG Bank (BGN)
   - Revolut (EUR)

### Adding Transactions
- Use the transaction form to add income or expenses
- Select account, amount, category, and description
- Balance updates automatically

### Transferring Money
- Transfer between your accounts with automatic currency conversion
- Exchange rates: EUR=1, BGN=1.95583, USD=1.1

### Tracking Loans
- Record money lent to or borrowed from others
- Add optional due dates
- Mark as repaid with one click (creates offsetting transaction)

### Salary Calculator
- Select employment type (Regular/Werkstudent/Minijob)
- Choose tax class (1-6)
- Enter gross salary
- View detailed breakdown of all deductions
- Add net salary directly to your account

### AI Financial Advisor
- Click the chat bubble to ask questions about your finances
- "What's my balance?"
- "How much did I spend on food this month?"
- "Can I afford a €500 purchase?"

## 🔒 Security

- Passwords are hashed with bcrypt
- JWT tokens for authentication
- API endpoints protected with authentication middleware
- Database stored locally (not in the cloud)

## 📊 Database Schema

**Users Table:**
- id, username, password_hash

**Accounts Table:**
- id, user_id, name, currency, balance, type

**Transactions Table:**
- id, user_id, account_id, type, category, amount, currency, date, description

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Google Gemini AI for the financial advisor feature
- Recharts for beautiful data visualization
- The open-source community

---

**Note:** This application stores all financial data locally in an SQLite database. Your data never leaves your machine unless you explicitly push it to a remote server.
