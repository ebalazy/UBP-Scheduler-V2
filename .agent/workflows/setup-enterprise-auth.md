---
description: Deploy the Enterprise Auth Backend Function
---
# Setup Enterprise Auth

Follow these steps to deploy the secure backend function and upgrade your app.

## 1. Install Supabase CLI
Open a terminal on your computer (not the browser) and run:
- **Mac/Linux**: `brew install supabase/tap/supabase`
- **Windows**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
  - Or download from: https://supabase.com/docs/guides/cli

## 2. Login to Supabase
```bash
supabase login
```

## 3. Link Your Project
Find your Reference ID in the Supabase Dashboard URL (e.g., `https://supabase.com/dashboard/project/abcdefghijklm`).
```bash
supabase link --project-ref <your-project-id>
```
Enter your database password when prompted.

## 4. Deploy the Function
Run this command from the root of your project:
```bash
supabase functions deploy invite-user --no-verify-jwt
```
Select your project if prompted.

## 5. Switch to Enterprise Mode
In `src/components/SettingsModal.jsx` (or wherever UserManagement is imported), change the import:

**FROM:**
```javascript
import UserManagement from './settings/UserManagement';
```

**TO:**
```javascript
import UserManagement from './settings/UserManagement.Enterprise';
```

Now your app will use the secure backend to send official invites!
