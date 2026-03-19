# Uplift v1.3 Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (free tier sufficient)
- Groq API key (free tier sufficient)

## Step 1: Project Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Uplift

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

## Step 2: Environment Configuration

### Create Environment File

Create `.env` file in `server/` directory:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
SESSION_SECRET=your_long_random_string_here_32_chars_min
VAPID_PUBLIC_KEY=your_vapid_public_key_from_webpush
VAPID_PRIVATE_KEY=your_vapid_private_key_from_webpush
```

### Generate VAPID Keys

```bash
npm install web-push -g
web-push generate-vapid-keys
```

Add the generated keys to your `.env` file.

## Step 3: Cloudflare Infrastructure

### Create D1 Database

```bash
cd server
npx wrangler d1 create uplift-db
```

Copy the `database_id` from the output and add it to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "uplift-db"
database_id = "paste-your-database-id-here"
```

### Initialize Database Tables

```bash
npx wrangler d1 execute uplift-db --local --file=./schema.sql
```

For production:

```bash
npx wrangler d1 execute uplift-db --remote --file=./schema.sql
```

### Create KV Namespace (Optional, for caching)

```bash
npx wrangler kv:namespace create "UPLIFT_CACHE"
```

Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "UPLIFT_CACHE"
id = "your-kv-namespace-id"
```

## Step 4: Local Development

### Start Frontend

```bash
# From project root
npm run dev
```

Frontend will be available at `http://localhost:5173`

### Start Backend Worker

```bash
# From server directory
cd server
npm run dev
```

Backend will be available at `http://localhost:8787`

### Test All Features

- Authentication: `POST http://localhost:8787/api/auth/login`
- Daily Digest: `GET http://localhost:8787/api/daily-digest?lang=en&stream=true`
- AI Deep Dive: `POST http://localhost:8787/api/why-this`
- Bookmarks: `GET/POST/DELETE http://localhost:8787/api/bookmarks`

## Step 5: Build and Deploy

### Build Frontend

```bash
# From project root
npm run build
```

This creates optimized production files in `dist/` directory.

### Deploy Backend

```bash
cd server
npm run deploy
```

This will:
- Build the TypeScript code
- Upload to Cloudflare Workers
- Configure routes and bindings

### Deploy Frontend with Cloudflare Pages

Option 1: Direct Cloudflare Pages deployment
```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy
wrangler pages deploy dist
```

Option 2: Automatic deployment from GitHub
1. Connect your GitHub repository
2. Set build directory to `dist`
3. Set build command to `npm run build`
4. Deploy

## Step 6: Production Configuration

### Update Production `wrangler.toml`

```toml
name = "uplift-api"
main = "src/index.ts"
compatibility_date = "2025-02-01"
compatibility_flags = ["nodejs_compat"]

workers_dev = false

routes = [
  { pattern = "your-domain.com", custom_domain = true }
]

[vars]
NODE_ENV = "production"
ALLOWED_ORIGINS = "https://your-domain.com,https://www.your-domain.com"

[assets]
directory = "./dist"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "uplift-db"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "UPLIFT_CACHE"
id = "your-kv-namespace-id"
```

### Set Environment Variables in Cloudflare Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your Worker
4. Go to Settings - Variables
5. Add environment variables:
   - `GROQ_API_KEY`
   - `SESSION_SECRET`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

## Step 7: Monitoring and Analytics

### Enable Cloudflare Analytics

1. Go to Worker Dashboard
2. Navigate to Analytics
3. View real-time metrics:
   - Request count
   - Errors
   - Response times
   - Geographic distribution

### Set Up Error Logging

Add to your Worker code for Sentry integration:

```typescript
import * as Sentry from "@sentry/cloudflare"

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production"
})
```

## Step 8: Testing

### Security Testing

```bash
# Scan for vulnerabilities
npm audit

# Test API endpoints
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Performance Testing

```bash
# Install wrk
brew install wrk

# Test endpoint performance
wrk -t4 -c100 -d30s https://your-domain.com/api/feed
```

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 100 -d 30 https://your-domain.com/api/feed
```

## Step 9: Backup and Maintenance

### Database Backup

```bash
# Export D1 database
npx wrangler d1 execute uplift-db --remote --command ".dump > backup.sql"
```

### Clear Cache

```bash
# Clear KV cache
npx wrangler kv:key list --namespace-id=your-kv-namespace
npx wrangler kv:key delete --namespace-id=your-kv-namespace <key>
```

## Step 10: Scaling (if needed)

### Pro Upgrade

When you need more resources:
1. Go to Cloudflare Dashboard
2. Upgrade to Workers Paid plan
3. Get higher limits:
   - More CPU time
   - Larger KV storage
   - More D1 database reads/writes

### Multi-Region Deployment

Cloudflare Workers automatically deploy to 300+ locations worldwide. No configuration needed!

## Troubleshooting

### Common Issues

**Issue**: Worker deployment failed
- **Solution**: Check `wrangler.toml` configuration and environment variables

**Issue**: Database connection error
- **Solution**: Verify D1 database ID in `wrangler.toml` matches remote database

**Issue**: CORS errors
- **Solution**: Update `ALLOWED_ORIGINS` environment variable with your domain

**Issue**: Push notifications not working
- **Solution**: Verify VAPID keys are correctly set and service worker is registered

### Debug Mode

Enable debugging in `wrangler.toml`:

```toml
[observability]
enabled = true
head_sampling_rate = 1
```

### Logs View

```bash
# View real-time logs
npx wrangler tail

# View logs for specific date
npx wrangler tail --format=pretty
```

## Cost Estimate (Free Tier)

| Service | Free Tier Limits | Monthly Cost |
|---------|-----------------|--------------|
| Workers Invocations | 100,000/day | $0 |
| Workers CPU Time | 10ms CPU x 100k req/day | $0 |
| D1 Database | 5GB storage, 25M reads/day | $0 |
| KV Storage | 1GB storage, 100k reads/day | $0 |
| Pages Bandwidth | Unlimited | $0 |

**Total**: $0/month for typical usage!
**Paid Plans Only When**: Your app scales beyond 100k+ daily users.

## Next Steps

1. Deploy to production
2. Monitor analytics and performance
3. Gather user feedback
4. Plan for v1.4 features based on usage data

## Support

For issues or questions:
- Check `SECURITY_AUDIT.md` for security details
- Review Cloudflare Workers documentation
- Join community discussions
- Contact: llakterian@gmail.com

---

**Prepared by llakterian @ c0bw3b Inc.**

**Happy Deploying!**
