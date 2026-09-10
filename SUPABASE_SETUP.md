# Supabase Migration Guide

This guide will help you set up Supabase for the Service Desk application with image storage.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js installed on your system
- Git for version control

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: service-desk (or your preferred name)
   - **Database Password**: Save this securely
   - **Region**: Select the region closest to your users
4. Click "Create new project"
5. Wait for the project to be created (this takes a few minutes)

## Step 2: Set Up Database

1. In your Supabase project, go to **SQL Editor**
2. Create a new query and run the following SQL:

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer TEXT NOT NULL,
  ref TEXT,
  source TEXT,
  "receivedAt" TIMESTAMP,
  ticket TEXT,
  location TEXT,
  site TEXT,
  contact TEXT,
  phone TEXT,
  description TEXT,
  image TEXT,
  ma TEXT DEFAULT 'N',
  "jobType" TEXT,
  status TEXT,
  assignee TEXT,
  appointment TIMESTAMP,
  "appointmentEnd" TIMESTAMP,
  action TEXT,
  result TEXT,
  equipment TEXT,
  "completedImage" TEXT,
  "completedAt" TIMESTAMP,
  map TEXT,
  vehicle TEXT,
  notes TEXT,
  file TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);
```

3. After running the query successfully, you can verify the table in the **Tables** section under **Database**

## Step 3: Create Storage Buckets

1. In your Supabase project, go to **Storage** → **Buckets**
2. Click **Create a new bucket**
3. Name it: `service-desk-images`
4. Set to **Public** bucket
5. Click **Create bucket**

## Step 4: Configure Environment Variables

### Frontend Configuration

1. Create a `.env` file in the root directory (next to `package.json`):

```env
VITE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

2. Get your Supabase credentials:
   - In Supabase, go to **Project Settings** → **API**
   - Copy the **Project URL** (this is your `VITE_SUPABASE_URL`)
   - Copy the **anon public** key (this is your `VITE_SUPABASE_ANON_KEY`)

### Server Configuration

1. Create a `.env` file in the `server` directory:

```env
PORT=4001
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
FRONTEND_URL=http://localhost:5173
```

2. Get your server credentials:
   - **DATABASE_URL**: In Supabase, go to **Project Settings** → **Database** → **Connection pooling** → Copy the connection string (use the `postgres://` format)
   - Replace `[YOUR_PASSWORD]` with your database password
   - **SUPABASE_SERVICE_ROLE_KEY**: In **Project Settings** → **API** → Copy the **service_role secret** key

## Step 5: Update Prisma Configuration

Update your `server/prisma/schema.prisma` to ensure it's configured for PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:

```bash
cd server
npx prisma generate
npx prisma db push
```

This will push your schema to the Supabase PostgreSQL database.

## Step 6: Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server
npm install
```

## Step 7: Configure Storage Permissions (Optional)

If you want to restrict uploads, you can set up Row Level Security (RLS) in Supabase Storage:

1. Go to **Storage** → **service-desk-images** → **Policies**
2. Add policies as needed (for basic setup, public upload is fine)

## Step 8: Run the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The application should now be running at `http://localhost:5173`

## Step 9: Verify Setup

1. Open the application in your browser
2. Try to create a new request
3. Upload an image
4. The image should be stored in Supabase Storage
5. Check in Supabase **Storage** → **service-desk-images** to see your uploaded image

## Troubleshooting

### Images not uploading
- Check that the `service-desk-images` bucket exists and is public
- Verify your Supabase credentials in `.env` files
- Check browser console for CORS errors
- Ensure the bucket name in code matches your bucket name

### Database connection issues
- Verify `DATABASE_URL` is correct
- Check that your database password is correct
- Ensure you're using the connection pooler URL (not the direct URL for production)
- Make sure your IP is allowed in Supabase network access settings

### API connection issues
- Verify `VITE_API_URL` matches your backend server URL
- Ensure the backend server is running on port 4001
- Check CORS settings in `server/src/server.js`

## Next Steps

- Set up authentication for image uploads (optional)
- Configure backup policies for your database
- Set up monitoring and logging in Supabase
- Deploy to production (Railway, Vercel, etc.)

For more information, visit: https://supabase.com/docs
