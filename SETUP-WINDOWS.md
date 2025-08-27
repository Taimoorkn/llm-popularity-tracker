# Windows Setup Guide for LLM Popularity Tracker

## Quick Start (No Database Required!)

The easiest way to start - no database setup needed:

```bash
npm install
npm run dev
```

Visit http://localhost:3000 - That's it! The app will use file-based storage automatically.

## Full Production Setup on Windows

### Option 1: Docker Desktop (Easiest for Production)

1. **Install Docker Desktop for Windows**
   - Download: https://www.docker.com/products/docker-desktop/app, components, data, lib, scripts, store
   - Install and restart your computer
   - Make sure Docker Desktop is running

2. **Run the Application**
   ```bash
   # In the project directory
   docker-compose up -d
   ```

3. **Access the Application**
   - Visit: http://localhost:3000
   - Health check: http://localhost:3000/api/health

That's it! Docker handles PostgreSQL, Redis, and the app automatically.

### Option 2: Manual Installation (For Development)

#### Step 1: Install PostgreSQL

1. **Download PostgreSQL 14 for Windows**
   - Go to: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Download: **PostgreSQL 14.11** (or latest 14.x version)
   - Choose: Windows x86-64

2. **Install PostgreSQL**
   - Run the installer
   - Set password for 'postgres' user: `postgres` (remember this!)
   - Default port: `5432`
   - Default locale is fine
   - Uncheck "Stack Builder" at the end (not needed)

3. **Setup Database**
   
   Open Command Prompt as Administrator and run:
   ```bash
   # Add PostgreSQL to PATH (if not already added)
   setx PATH "%PATH%;C:\Program Files\PostgreSQL\14\bin"
   
   # Close and reopen Command Prompt, then:
   psql -U postgres
   ```
   
   Enter the password you set during installation, then run:
   ```sql
   CREATE DATABASE llm_tracker;
   CREATE USER llm_user WITH PASSWORD 'password123';
   GRANT ALL PRIVILEGES ON DATABASE llm_tracker TO llm_user;
   \q
   ```

#### Step 2: Install Redis

1. **Download Redis for Windows**
   
   Since Redis doesn't officially support Windows, use one of these options:

   **Option A: Redis Windows Port by Microsoft (Recommended)**
   - Download: https://github.com/microsoftarchive/redis/releases
   - Get: `Redis-x64-3.0.504.msi` (latest available)
   - Run the MSI installer
   - Keep all defaults
   - Redis will install as a Windows service

   **Option B: Memurai (Redis-compatible, more recent)**
   - Download: https://www.memurai.com/get-memurai
   - Free for development
   - Install and it runs as a service automatically

2. **Verify Redis is Running**
   ```bash
   # Open new Command Prompt
   redis-cli ping
   # Should respond: PONG
   ```

#### Step 3: Configure Environment

1. **Create .env file**
   ```bash
   # In project directory
   copy .env.example .env
   ```

2. **Edit .env file** (use Notepad or any text editor):
   ```env
   # Database Configuration
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=llm_tracker
   POSTGRES_USER=llm_user
   POSTGRES_PASSWORD=password123

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=

   # Application Settings
   NODE_ENV=development
   LOG_LEVEL=info
   ```

#### Step 4: Initialize Database

```bash
# In project directory
npm install
npm run db:migrate
npm run db:seed
```

#### Step 5: Start the Application

```bash
npm run dev
```

Visit: http://localhost:3000

## Troubleshooting Windows Issues

### PostgreSQL Issues

**"psql is not recognized"**
```bash
# Add to PATH manually
set PATH=%PATH%;C:\Program Files\PostgreSQL\14\bin
```

**"FATAL: password authentication failed"**
- Make sure you're using the correct password from installation
- Try connecting as postgres user first: `psql -U postgres`

**Cannot connect to PostgreSQL**
1. Check if service is running:
   ```bash
   # Open Services (Win+R, type: services.msc)
   # Look for "postgresql-x64-14" - should be "Running"
   ```

2. If not running:
   ```bash
   # As Administrator
   net start postgresql-x64-14
   ```

### Redis Issues

**"redis-cli is not recognized"**
```bash
# Add Redis to PATH
set PATH=%PATH%;C:\Program Files\Redis
```

**Redis not running**
```bash
# Check service
sc query Redis

# Start service (as Administrator)
net start Redis
```

### Node.js Issues

**"npm is not recognized"**
- Install Node.js from: https://nodejs.org/
- Get the LTS version (v18 or v20)
- Restart Command Prompt after installation

### Permission Issues

If you get permission errors, try:
1. Run Command Prompt as Administrator
2. Or use PowerShell as Administrator
3. For file permissions: Right-click folder → Properties → Security → Edit

## Verify Everything Works

Run these commands to verify:

```bash
# Check Node.js
node --version
# Should show: v18.x.x or higher

# Check PostgreSQL
psql -U postgres -c "SELECT version();"
# Should show: PostgreSQL 14.x

# Check Redis
redis-cli ping
# Should show: PONG

# Check Application Health
curl http://localhost:3000/api/health
# Or open in browser: http://localhost:3000/api/health
```

## Windows-Specific Tips

1. **Use PowerShell or Windows Terminal** instead of Command Prompt for better experience
2. **Install Git Bash** for Unix-like commands: https://git-scm.com/download/win
3. **Windows Defender** might slow down npm install - add node_modules to exclusions
4. **Use WSL2** for a Linux-like experience (optional but recommended for development)

## Quick Commands Reference

```bash
# Start everything (if using manual installation)
# Terminal 1: Start PostgreSQL (usually auto-starts as service)
# Terminal 2: Start Redis (usually auto-starts as service)
# Terminal 3: Start app
npm run dev

# Database commands
npm run db:migrate    # Setup database tables
npm run db:seed       # Add initial data
npm run db:reset      # Reset everything

# If services aren't running (Run as Administrator)
net start postgresql-x64-14
net start Redis
```

## Next Steps

1. **Development**: App is ready at http://localhost:3000
2. **Production**: Use Docker Desktop for easier deployment
3. **Monitoring**: Check http://localhost:3000/api/health

## Need Help?

- PostgreSQL not connecting? The app will automatically use file storage
- Redis not working? The app still works without caching
- The application is designed to work even if databases aren't available!

## Alternative: WSL2 (Windows Subsystem for Linux)

For a more Unix-like development experience:

1. Install WSL2: `wsl --install`
2. Install Ubuntu from Microsoft Store
3. Follow the Linux setup guide inside WSL2

This gives you the best of both worlds!