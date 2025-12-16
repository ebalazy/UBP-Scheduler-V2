# Deployment Guide

## Build for Production
To create an optimized production build:

```bash
npm run build
```
This generates static files in the `dist/` directory.

## Hosting Options

### 1. GitHub Pages (Recommended)
This project is configured for GitHub Pages via the workflow file `.github/workflows/deploy.yml` (if present).
To deploy manually:
1.  Update `vite.config.js` `base` to match your repo name:
    ```js
    base: '/UBP-Scheduler-V2/',
    ```
2.  Push to `main` branch.

### 2. Vercel / Netlify
1.  Connect your GitHub repository.
2.  Set Build Command: `npm run build`
3.  Set Output Directory: `dist`
4.  **Important**: Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Environment Variables in the hosting dashboard.

## Database Setup (Supabase)

1.  **Schema**: Ensure all tables (`products`, `planning_entries`, etc.) exist.
2.  **RLS Policies**: Apply the latest security policies from `src/supabase/migrations/`.
3.  **Edge Functions**: If using Enterprise User Management, deploy the `invite-user` function:
    ```bash
    supabase functions deploy invite-user
    ```
