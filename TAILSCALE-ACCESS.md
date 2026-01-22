# Access Your App via Tailscale

## Your Tailscale IP
```
100.86.33.4
```

## Access URLs

From any device on your Tailscale network:

- **Main App (Frontend):** `http://100.86.33.4:3000`
- **API Server:** `http://100.86.33.4:3001/api`

## Start the App

```powershell
npm start
```

This runs both the frontend (port 3000) and backend (port 3001).

## If You Can't Connect

### Option 1: Open PowerShell as Administrator and run:
```powershell
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Express API Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### Option 2: Use Windows Firewall GUI
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. TCP, Specific ports: `3000,3001` → Next
6. Allow the connection → Next
7. Check all profiles → Next
8. Name: "WealthTracker Ports" → Finish

### Option 3: Test without firewall first
Tailscale often works without firewall changes. Just try accessing from your phone/tablet first!

## Testing Access

1. **From your laptop:** `http://localhost:3000`
2. **From phone (on Tailscale):** `http://100.86.33.4:3000`
3. **Check if Tailscale is running:** `tailscale status`

## Keep Your Laptop Awake

To prevent the app from stopping when your laptop sleeps:
- Windows Settings → System → Power → Screen and sleep
- Set "When plugged in, PC goes to sleep after" to "Never"

## Alternative: Use MagicDNS

If you have MagicDNS enabled in Tailscale:
```
http://your-laptop-name:3000
```

Check your machine name: `tailscale status`
