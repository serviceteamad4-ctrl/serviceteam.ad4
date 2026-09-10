# Data Migration Guide

If you have existing data with base64-encoded images, follow this guide to migrate them to Supabase Storage.

## Overview

Your existing data has images stored as base64 strings directly in the database. This migration will:
1. Convert base64 images to proper image files
2. Upload them to Supabase Storage
3. Update the database with the new Storage URLs
4. Remove the base64 data from the database

## Prerequisites

- Supabase project set up (follow SUPABASE_SETUP.md first)
- Node.js with access to your database
- Backup of your current database

## Step 1: Backup Your Database

Before running any migration, back up your data:

```bash
# Create a backup dump
pg_dump $DATABASE_URL > backup.sql
```

Keep this file safe.

## Step 2: Create Migration Script

Create a new file: `server/migrate-images.js`

```javascript
import 'dotenv/config';
import { prisma } from './src/db.js';
import { uploadImageToStorage, deleteImageFromStorage } from './src/supabase.js';

const BATCH_SIZE = 10;

async function migrateImages() {
  try {
    console.log('Starting image migration...');

    // Find all requests with base64 images
    const requests = await prisma.request.findMany({
      where: {
        OR: [
          { image: { contains: 'data:image/' } },
          { completedImage: { contains: 'data:image/' } },
        ],
      },
    });

    console.log(`Found ${requests.length} requests with base64 images`);

    if (requests.length === 0) {
      console.log('No images to migrate');
      return;
    }

    // Process in batches
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

      const updates = await Promise.allSettled(
        batch.map(async (request) => {
          const updates = {};

          if (request.image && request.image.includes('data:image/')) {
            try {
              const base64 = request.image.split(',')[1];
              const buffer = Buffer.from(base64, 'base64');
              const fileName = `${request.id}-image-${Date.now()}.jpg`;
              const url = await uploadImageToStorage('service-desk-images', buffer, fileName);
              updates.image = url;
              console.log(`✓ Migrated image for request ${request.id}`);
            } catch (error) {
              console.error(`✗ Failed to migrate image for request ${request.id}:`, error);
            }
          }

          if (request.completedImage && request.completedImage.includes('data:image/')) {
            try {
              const base64 = request.completedImage.split(',')[1];
              const buffer = Buffer.from(base64, 'base64');
              const fileName = `${request.id}-completed-${Date.now()}.jpg`;
              const url = await uploadImageToStorage('service-desk-images', buffer, fileName);
              updates.completedImage = url;
              console.log(`✓ Migrated completed image for request ${request.id}`);
            } catch (error) {
              console.error(`✗ Failed to migrate completed image for request ${request.id}:`, error);
            }
          }

          if (Object.keys(updates).length > 0) {
            await prisma.request.update({
              where: { id: request.id },
              data: updates,
            });
          }
        })
      );

      // Report batch results
      const failed = updates.filter((r) => r.status === 'rejected').length;
      console.log(`Batch processed: ${BATCH_SIZE - failed} succeeded, ${failed} failed`);
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateImages();
```

## Step 3: Run Migration

```bash
cd server
node migrate-images.js
```

Monitor the output for any errors. The script will:
- Find all base64 images in the database
- Upload them to Supabase Storage
- Update the database with new URLs
- Report progress and any failures

## Step 4: Verify Migration

1. Check Supabase Storage to see uploaded images:
   - Go to **Storage** → **service-desk-images**
   - You should see your migrated images

2. Verify database was updated:
   ```bash
   cd server
   npx prisma studio
   ```
   - Check a few records to confirm URLs are stored instead of base64

3. Test the application:
   - Open the app and view an old request
   - Images should display from Supabase Storage

## Step 5: Cleanup

If migration was successful:

1. Create a final backup:
   ```bash
   pg_dump $DATABASE_URL > backup-after-migration.sql
   ```

2. Remove the old base64 data (optional - only if absolutely certain):
   ```sql
   -- This removes base64 data, keeping only URLs
   UPDATE requests 
   SET image = NULL 
   WHERE image LIKE 'data:image/%';
   
   UPDATE requests 
   SET "completedImage" = NULL 
   WHERE "completedImage" LIKE 'data:image/%';
   ```

## Rollback Procedure

If something goes wrong:

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql
```

## Common Issues

### Migration times out
- Reduce `BATCH_SIZE` to 5 in the script
- Ensure your Supabase storage is accessible
- Check network connectivity

### Some images fail to migrate
- The script will skip failed images and continue
- You can manually upload these via the UI
- Check the error messages for specific issues

### Images appear as broken links
- Verify the bucket is public: **Storage** → **service-desk-images** → **Settings**
- Check that the bucket name matches in the code
- Verify image URLs are correctly formatted

## Post-Migration

Your application is now:
- ✅ Using Supabase for database and storage
- ✅ Storing images in cloud storage instead of database
- ✅ Improved performance (smaller database, faster queries)
- ✅ Scalable image storage

You can now safely remove old image backup files after confirming everything works.
