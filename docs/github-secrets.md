# GitHub Actions secrets

The `main` workflow applies every SQL file in `supabase/migrations/` before deploying to Vercel.

Add these repository secrets in GitHub: `Settings → Secrets and variables → Actions`.

- `SUPABASE_ACCESS_TOKEN`: create it in Supabase account settings → access tokens.
- `SUPABASE_PROJECT_REF`: the project ref from the Supabase URL, for example `lnzmwyeemmeovkpcjdqo`.
- `SUPABASE_DB_PASSWORD`: the database password created with the Supabase project. This is not the API key.

The existing Vercel secrets remain required:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

After this is configured, pushing to `main` runs migrations first. If a migration fails, the Vercel deploy is stopped so the app and database schema do not drift apart.
