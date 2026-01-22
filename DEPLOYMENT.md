# Deploy to Fly.io - Quick Guide

## ✅ Fly.io is Already Installed!

The CLI is installed at: `C:\Users\pilia\.fly\bin\flyctl.exe`

**Close and reopen PowerShell** to use `flyctl` or `fly` commands.

Or run this once to add to current session:
```powershell
$env:Path += ";$env:USERPROFILE\.fly\bin"
```

## Prerequisites
1. ✅ Fly.io CLI installed
2. Create account: `flyctl auth signup`
3. Login: `flyctl auth login`

## Deployment Steps

### 1. Generate Strong JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output - you'll need it!

### 2. Login and Initialize
```bash
# Login to Fly.io
flyctl auth login

# Navigate to your project
cd C:\Users\pilia\Downloads\Wealth-calculator

# Launch app (this creates everything automatically!)
flyctl launch --name wealthtracker-ai --region fra --now
```

When prompted:
- "Would you like to copy configuration to the new app?" → **Yes**
- "Would you like to setup a PostgreSQL database?" → **No** (we use SQLite)
- "Would you like to deploy now?" → **No** (we need to set secrets first)

### 3. Create Persistent Volume (for SQLite database)
```bash
flyctl volumes create wealthtracker_data --region fra --size 1
```

### 4. Set Environment Variables (Secrets)
```bash
# CRITICAL: Use YOUR generated JWT secret!
flyctl secrets set JWT_SECRET="<paste-your-generated-secret-here>"

# Set production environment
flyctl secrets set NODE_ENV="production"

# Set your Gemini API key
flyctl secrets set GOOGLE_API_KEY="your-gemini-api-key"
flyctl secrets set GEMINI_API_KEY="your-gemini-api-key"

# Set frontend URL (use your fly.io URL)
flyctl secrets set FRONTEND_URL="https://wealthtracker-ai.fly.dev"
```

### 5. Deploy!
```bash
flyctl deploy
```

### 6. Open Your App
```bash
flyctl open
```

## Post-Deployment

### Check Status
```bash
fly status
fly logs
```

### Access Database (for backups)
```bash
fly ssh console
cd /data
ls -lah
```

### Create Backup
```bash
fly ssh console -C "cp /data/finance.db /data/finance-backup-$(date +%Y%m%d).db"
```

### Download Backup
```bash
fly ssh sftp get /data/finance.db ./local-backup.db
```

## Updating Your App

After making code changes:
```bash
git add .
git commit -m "Update features"
fly deploy
```

## Cost Monitoring
```bash
fly dashboard
```
Free tier: 3 VMs with 256MB RAM + 1GB storage

## Troubleshooting

### Logs not showing?
```bash
fly logs --tail
```

### App crashing?
```bash
fly status
fly doctor
```

### Database issues?
```bash
fly ssh console
cd /data
ls -lah finance.db
```

## Security Checklist ✅

- [x] Strong JWT secret (64+ characters)
- [x] HTTPS enforced (automatic on Fly.io)
- [x] CORS restricted to your domain
- [x] Rate limiting enabled
- [x] Helmet security headers
- [x] Database in persistent volume
- [x] Environment variables as secrets
- [x] Password hashing with bcrypt (10 rounds)

## Automatic HTTPS Certificate

Fly.io provides automatic SSL certificates. Your app will be accessible at:
`https://wealthtracker-ai.fly.dev`

## Custom Domain (Optional)

```bash
fly certs add yourdomain.com
fly certs show yourdomain.com
```

Then update DNS:
```
CNAME @ wealthtracker-ai.fly.dev
```

---

**Your app is now:**
- ✅ Hosted securely with HTTPS
- ✅ Protected with rate limiting
- ✅ Using persistent SQLite storage
- ✅ Running in EU (Frankfurt) for GDPR compliance
- ✅ Automatically backed up (manual command above)
- ✅ FREE within Fly.io limits!

Need help? `fly help` or visit https://fly.io/docs
