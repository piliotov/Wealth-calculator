# ⚠️ IMPORTANT: Vercel Limitations for WealthTracker

## ❌ Why Vercel is NOT Recommended

**Vercel is serverless and CANNOT support SQLite databases.**

### Problems:
1. **No Persistent Storage** - Your database will reset on every deployment
2. **Serverless Functions** - Each API request creates a new instance (can't maintain DB connection)
3. **Read-only Filesystem** - SQLite needs write access
4. **Loss of All Data** - Every time the function restarts, you lose transactions/accounts

---

## ✅ Better FREE Alternatives

### 1. **Fly.io** (Recommended)
- ✅ Supports SQLite with persistent volumes
- ✅ FREE tier (3 VMs + 1GB storage)
- ✅ Works perfectly with your current code
- ✅ See `DEPLOYMENT.md` for instructions

### 2. **Railway.app**
- ✅ $5 free credit monthly
- ✅ Persistent SQLite storage
- ✅ GitHub auto-deploy

---

## If You MUST Use Vercel...

You'll need to migrate from SQLite to PostgreSQL (Vercel Postgres).

### Required Changes:

1. **Install PostgreSQL adapter:**
   ```bash
   npm install pg
   ```

2. **Replace SQLite with PostgreSQL in `server/database.cjs`**

3. **Update all SQL queries** (different syntax)

4. **Add Vercel Postgres** (costs $20/month after free tier)

### Vercel Config (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.cjs",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/server.cjs"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## 🎯 My Strong Recommendation

**Use Fly.io instead!**

### Why:
- ✅ No code changes needed
- ✅ SQLite works perfectly
- ✅ Persistent storage
- ✅ Completely FREE
- ✅ 5-minute deployment

### Quick Deploy:
```bash
fly launch
fly deploy
```

That's it! Your app works immediately.

---

## What to Upload to Git

### ✅ DO Upload:
```
✓ All .ts/.tsx files (source code)
✓ All .cjs files (server code)
✓ package.json & package-lock.json
✓ .env.example (template)
✓ .gitignore
✓ README.md, DEPLOYMENT.md, SECURITY-HOSTING.md
✓ vite.config.ts, tsconfig.json
✓ fly.toml, Dockerfile
✓ index.html, index.tsx
✓ All files in components/, services/, server/
```

### ❌ DO NOT Upload:
```
✗ .env (contains your API keys!)
✗ *.db files (your personal financial data!)
✗ node_modules/ (auto-installed)
✗ dist/ (auto-built)
✗ .vercel/ (deployment cache)
```

### Check Before Pushing:
```bash
# See what will be committed
git status

# Verify .env is NOT listed
# Verify *.db files are NOT listed

# If they appear, they're NOT in .gitignore!
```

---

## Safe Git Push Checklist

```bash
# 1. Check ignored files are working
git status

# 2. Verify .env is protected
cat .gitignore | grep ".env"

# 3. Verify database is protected  
cat .gitignore | grep "*.db"

# 4. Add all safe files
git add .

# 5. Commit
git commit -m "Add budget tracking and security"

# 6. Push
git push origin main
```

---

## Environment Variables for Deployment

Whatever platform you use, set these in the dashboard:

```bash
NODE_ENV=production
JWT_SECRET=<your-64-char-random-secret>
GOOGLE_API_KEY=<your-gemini-key>
GEMINI_API_KEY=<your-gemini-key>
PORT=3001
```

**Never commit .env to GitHub!** ✅ Already protected by .gitignore

---

## Summary

| Platform | SQLite | Free Tier | Recommended |
|----------|--------|-----------|-------------|
| **Fly.io** | ✅ Yes | ✅ Good | ⭐⭐⭐⭐⭐ |
| **Railway** | ✅ Yes | ✅ $5/mo | ⭐⭐⭐⭐ |
| Vercel | ❌ No | Limited | ⭐ |
| Render | ❌ Paid | Limited | ⭐⭐ |

**Use Fly.io!** See `DEPLOYMENT.md` for step-by-step guide.
