# MongoDB Atlas Production Setup

**FIR-86**

## Cluster Setup

1. Log into [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster — **M10 dedicated tier minimum** for production
   - M0 (free tier) must not be used in production: no dedicated resources, connection limits, no backup SLA
3. Select region: `us-east-1` (or the region closest to your EC2 instance to minimise latency)
4. Cluster name: `nextaibuilder-prod`

## Network Access

5. Navigate to **Security → Network Access → Add IP Address**
6. Add the EC2 **Elastic IP** (not the ephemeral public IP — Elastic IP is stable across reboots)
7. Description: `nextaibuilder EC2 production`
8. Do not use `0.0.0.0/0` — whitelist only the specific Elastic IP

## Database Access

9. Navigate to **Security → Database Access → Add New Database User**
10. Authentication method: Password
11. Username: `nab-prod`
12. Password: generate a strong random password (e.g. `openssl rand -hex 24`)
13. Database user privileges: **Custom role** → `readWrite` on database `nextaibuilder` only
    - Do not grant `atlasAdmin` or cluster-level permissions

## Connection String

14. Click **Connect → Connect your application → Node.js 5.5+**
15. Copy the `mongodb+srv://` connection string
16. Format: `mongodb+srv://nab-prod:<password>@<cluster>.mongodb.net/nextaibuilder?retryWrites=true&w=majority`
17. Set as `MONGODB_URI` in `/opt/nab/.env` on EC2

## Backup

18. Navigate to **Backup** → enable **Continuous Cloud Backup**
    - Retention: 7 days minimum for production

## Monitoring & Alerts

19. Navigate to **Alerts** → configure alerts for:
    - Connections > 80% of cluster connection pool limit
    - Disk utilisation > 75%
    - Replication oplog window < 1 hour
    - Query targeting ratio > 1000 (slow query indicator)

20. Enable **Performance Advisor** — surfaces slow query recommendations automatically

## Test Database

For the CI pipeline (`ci.yml`), a temporary MongoDB 7.0 container is used via GitHub Actions services.
The `MONGODB_URI_TEST` secret is not required — CI uses `mongodb://localhost:27017/nextaibuilder_test`.
