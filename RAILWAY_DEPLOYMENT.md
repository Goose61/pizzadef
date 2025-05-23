# Railway Deployment Guide for Pizza Game

## Why Railway?
Railway provides persistent file storage, making it perfect for our file-based leaderboard system. Unlike Vercel's serverless functions, Railway gives you a persistent environment where your `leaderboard-data.json` file will survive between deployments.

## Deployment Options

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub** (we'll do this after setup)

2. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

3. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your pizza-game repository
   - Railway will automatically detect it's a Node.js app

4. **Environment Variables** (if needed)
   - No special environment variables required for file-based storage
   - Railway will automatically set `PORT` environment variable

5. **Custom Domain** (optional)
   - Go to your project settings
   - Add a custom domain or use the Railway-provided URL

### Option 2: Deploy using Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Generate Domain**
   ```bash
   railway domain
   ```

## Key Features for Your Game

### ✅ Persistent File Storage
- Your `leaderboard-data.json` will persist between deployments
- Automatic backups through our backup API
- No database setup required

### ✅ Automatic Scaling
- Railway handles traffic spikes automatically
- No cold starts like serverless functions

### ✅ Simple Deployment
- Push to GitHub = automatic deployment
- Built-in CI/CD pipeline

### ✅ Cost Effective
- $5/month credit on free tier
- Pay only for what you use

## File Structure After Deployment

```
/app/
├── dist/                 # Built game files
├── public/              # Persistent data directory
│   ├── leaderboard-data.json  # Your leaderboard data
│   └── backups/         # Automatic backups
├── scripts/
│   └── railway-server.js # Railway server
└── pages/api/           # API endpoints
```

## Testing Your Deployment

1. **Health Check**: Visit `https://your-app.railway.app/health`
2. **Game**: Visit `https://your-app.railway.app`
3. **Leaderboard API**: Visit `https://your-app.railway.app/api/simple-leaderboard`

## Monitoring

- Railway provides built-in monitoring
- Check logs in Railway dashboard
- Monitor resource usage and costs

## Backup Strategy

Your leaderboard data is automatically backed up:
- Manual backup: `POST /api/backup-leaderboard`
- List backups: `GET /api/backup-leaderboard`
- Files stored in `/public/backups/`

## Migration from Vercel

1. Your file-based APIs are already compatible
2. No code changes needed
3. Data will start fresh (or import existing data)
4. Update any hardcoded URLs to point to Railway

## Support

- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Documentation: [docs.railway.app](https://docs.railway.app)
- This setup includes health checks and monitoring 