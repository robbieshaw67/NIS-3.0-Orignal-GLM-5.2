# NIP v3.0 — Postgres/Neon Migration Path

## Current state (sandbox)
- **Database:** SQLite (`db/custom.db`)
- **Schema:** `prisma/schema.prisma` with `provider = "sqlite"`
- **Reason:** Sandbox has no Postgres/Neon credentials (L11 — out-of-band)

## Production migration (3 steps)

### Step 1: Provision Neon Postgres
Create a Neon project at https://neon.tech. Copy the connection string (format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).

### Step 2: Set the env var (out-of-band, L11)
In `.env` (or Vercel dashboard):
```
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

### Step 3: Switch the schema provider
In `prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "sqlite"     // ← change to "postgresql"
  url      = env("DATABASE_URL")
}
```

Then:
```bash
bunx prisma migrate dev --name migrate-to-neon
bunx prisma db push
bunx prisma generate
```

## What changes automatically
- All `Json` fields (stored as TEXT in SQLite) become native `JsonB` in Postgres
- All `@default(cuid())` IDs work identically
- The `@prisma/adapter-neon` serverless driver (Design §1) can be added to `src/lib/db.ts`:
  ```typescript
  import { PrismaNeon } from "@prisma/adapter-neon"
  import { Pool } from "@neondatabase/serverless"
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaNeon(pool)
  export const db = new PrismaClient({ adapter })
  ```
  This kills the stale-connection crash class permanently (Design §1).

## What does NOT change
- All schema models, relations, indexes
- All application code (adapters, gates, provider, asOf, promotion, reextraction)
- All 14 job endpoints
- All UI components

## Off-box backup (L13)
Once on Postgres, replace the JSON-file backup in `runBackupJob` with:
```bash
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
# Upload to S3/Vercel Blob
```
The restore drill reads the dump back and verifies row counts (already wired in `runBackupJob`).

## Verification
After migration:
1. `bunx prisma db pull` — confirm schema matches
2. Run `bun run scripts/seed.ts` — confirm all 12 tables populate
3. Hit `/api/snapshot` — confirm 200
4. Run `bun run lint` — confirm asOf grep + L1 price-source gates pass
