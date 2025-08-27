# Docker Quick Start Commands

## After Restarting Your Computer:

1. **Make sure Docker Desktop is running**
   - Look for whale icon in system tray
   - If not running, start Docker Desktop from Start Menu

2. **Open Terminal/PowerShell in VSCode or Command Prompt**

3. **Navigate to project folder:**
   ```bash
   cd C:\Users\Taimoor\Documents\GitHub\llm-popularity-tracker
   ```

4. **Start everything with Docker:**
   ```bash
   docker-compose up -d
   ```

5. **Wait 30-60 seconds, then check:**
   ```bash
   # See if containers are running:
   docker ps
   
   # Should show 3 containers:
   # - llm-tracker-app
   # - llm-tracker-postgres  
   # - llm-tracker-redis
   ```

6. **Open your browser:**
   - Go to: http://localhost:3000
   - Health check: http://localhost:3000/api/health

## Useful Commands:

```bash
# View logs if something's wrong:
docker-compose logs -f

# Stop everything:
docker-compose down

# Restart everything:
docker-compose restart

# Complete cleanup (removes all data):
docker-compose down -v
```

## If Docker Desktop Shows Error:
- Make sure virtualization is enabled in BIOS
- Make sure WSL 2 is installed (Docker will prompt you)
- Try running Docker Desktop as Administrator

That's it! The app will be running at http://localhost:3000