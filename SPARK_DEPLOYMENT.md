# Spark Wallet Deployment Guide

## Vercel Deployment

The Spark Lightning wallet integration requires a Breez API key to function.

### Step 1: Get Your Breez Spark API Key

1. Visit https://breez.technology/spark/
2. Sign up/login and create a project
3. Get your API key

### Step 2: Add to Vercel Environment Variables

1. Go to your Vercel project: https://vercel.com/[your-username]/[project-name]
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name:** `VITE_BREEZ_SPARK_API_KEY`
   - **Value:** [Your Breez API key]
   - **Environments:** ✅ Production ✅ Preview ✅ Development

4. Click **Save**

### Step 3: Redeploy

After adding the environment variable, trigger a new deployment:
- Push a new commit, OR
- Go to **Deployments** → Click "..." on latest deployment → **Redeploy**

### Step 4: Verify

Once deployed:
1. Visit your deployed site
2. Navigate to **Settings** → **Wallet**
3. You should be able to create/connect a Spark wallet
4. Check browser console for any API key errors

## Important Notes

- **Each deployment needs its own API key** - If someone forks this project, they need to obtain their own Breez API key
- The API key is exposed in the browser (by design for client-side SDK)
- The `.env.local` file is gitignored and only for local development
- Production deployments must use Vercel environment variables

## Troubleshooting

**"No API key found" error:**
- Verify the environment variable is named exactly: `VITE_BREEZ_SPARK_API_KEY`
- Ensure it's enabled for the correct environment (Production/Preview/Development)
- Trigger a new deployment after adding the variable

**Wallet connection fails:**
- Check browser console for errors
- Verify the API key is valid and not expired
- Check Breez service status

## For PR Reviewers

When merging this PR, the upstream maintainer (CodyTseng) will need to:
1. Obtain their own Breez Spark API key
2. Add it to their Vercel project environment variables
3. The wallet will only work in deployments that have the API key configured
