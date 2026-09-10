# Quick Start - Supabase Setup

Get your Service Desk app running with Supabase in 5 minutes.

## 1. Create Supabase Project

1. Go to https://supabase.com → Sign up/in
2. Click **New Project**
3. Fill in:
   - **Name**: `service-desk`
   - **Database Password**: Save it!
   - **Region**: Pick closest to you
4. Click **Create new project** (takes 2-3 min)

## 2. Create Storage Bucket

1. In your Supabase project, go to **Storage**
2. Click **Create a new bucket**
3. Name: `service-desk-images`
4. Set to **Public** bucket
5. Click **Create**

## 3. Set Up Database

1. Go to **SQL Editor**
2. Run this SQL:

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer TEXT NOT NULL,
  ref TEXT, source TEXT, "receivedAt" TIMESTAMP, ticket TEXT, location TEXT,
  site TEXT, contact TEXT, phone TEXT, description TEXT, image TEXT, ma TEXT DEFAULT 'N',
  "jobType" TEXT, status TEXT, assignee TEXT, appointment TIMESTAMP, "appointmentEnd" TIMESTAMP,
  action TEXT, result TEXT, equipment TEXT, "completedImage" TEXT, "completedAt" TIMESTAMP,
  map TEXT, vehicle TEXT, notes TEXT, file TEXT,
  "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now()
);
```

## 4. Configure Environment

### Frontend `.env` (next to package.json)
```env
VITE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=YOUR_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Backend `server/.env`
```env
PORT=4001
DATABASE_URL=YOUR_CONNECTION_STRING
SUPABASE_URL=YOUR_PROJECT_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
FRONTEND_URL=http://localhost:5173
```

**Where to find these in Supabase:**
- **Project URL** & **Anon Key**: Project Settings → API
- **Connection String**: Project Settings → Database → Connection pooling (use postgres://)
- **Service Role Key**: Project Settings → API (under service_role secret)

## 5. Install & Run

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Push schema to database
cd server && npx prisma db push && cd ..

# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Start frontend  
npm run dev
```

Open http://localhost:5173 - Done! ✅

## Testing

1. Create a new request
2. Upload an image
3. Go to Supabase → Storage → service-desk-images
4. See your image there? Success! 🎉

## Troubleshooting

**Images not uploading?**
- Check bucket is Public (not Private)
- Verify Supabase URLs in .env files
- Check browser console for errors

**Can't connect to database?**
- Verify CONNECTION_STRING has your password
- Ensure password doesn't have special chars (or URL-encode them)
- Check firewall allows PostgreSQL connections

**API not responding?**
- Confirm backend running on port 4001
- Check FRONTEND_URL in .env matches where frontend runs

## Need More Help?

- Setup issues → Read `SUPABASE_SETUP.md`
- Migrating old data → Read `MIGRATION_GUIDE.md`
- What changed → Read `CHANGES_SUMMARY.md`
- Full API docs → Check `server/src/server.js`

---

**Happy deploying! 🚀**
