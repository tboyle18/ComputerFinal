# Deployment (hosting only, not part of any build)

All four builds share **one free Supabase project**, `Computer-final` (`yuysazrdltissqvdgccx`). The free plan allows only 2 active projects, and the builds' tables use the same names (`listings`, `messages`, `orders`, …), so each build gets its own Postgres schema and its own storage buckets:

| Build | Schema | Storage buckets | How it reaches Supabase |
|---|---|---|---|
| A-V1 | `a_v1` | `a-v1-listing-images` | Proxy Worker (`proxy/`) |
| A-V2 | `a_v2` | `a-v2-listing-images` | Proxy Worker (`proxy/`) |
| B-V1 | `b_v1` | `b-v1-listing-images`, `b-v1-avatars` | Proxy Worker (`proxy/`) |
| B-V2 | `public` | `listing-images`, `avatars` | Direct, with its own Worker and Edge Functions |

**No build's code was changed.** The builds are compiled with `VITE_SUPABASE_URL=https://<build>.boyletb8.workers.dev/sb`. `proxy/worker.js` serves the build's static files and forwards `/sb/*` to Supabase, adding the schema header and renaming storage buckets on the way.

## Known differences from a dedicated backend (state these in the report)

- **Shared sign-in.** All four builds share one Supabase Auth user list, so an account made on one build also exists on the others. Each build's data still lives in its own schema.
- **Shared Auth settings.** Password rules, email confirmation, rate limits and redirect URLs are set once for the whole project, not per build. B-V2's `supabase/config.toml` settings were not pushed.
- **Realtime** subscriptions in A-V1, A-V2 and B-V1 listen on `public`, so live updates (such as new-message notifications) may not fire for those builds. A page refresh still shows the data.
- **Exposed schemas** were set with SQL (`alter role authenticator set pgrst.db_schemas = …`). If someone later changes the exposed schemas in the Supabase dashboard (Settings → Data API), make sure `a_v1, a_v2, b_v1` are still listed.
- B-V1's `seed.sql` (sample listings) was not loaded.

## Rebuilding

Schema SQL (generated from each build's own SQL, which is only read):

```bash
python3 shared-backend/make_schema_sql.py a_v1 a-v1 ../builds/a-v1/marketplace-app/SUPABASE_SETUP.sql
python3 shared-backend/make_schema_sql.py a_v2 a-v2 ../builds/a-v2/supabase/migrations/001_init_marketplace.sql --extra-bucket listing-images
python3 shared-backend/make_schema_sql.py b_v1 b-v1 ../builds/b-v1/supabase/migrations/20261109000000_trove_schema.sql
```

Redeploying a proxied build (example: A-V2):

```bash
cd ../builds/a-v2 && npm ci && VITE_SUPABASE_URL=https://a-v2.boyletb8.workers.dev/sb VITE_SUPABASE_ANON_KEY=<anon key> npm run build
cd ../../deploy/proxy && npx wrangler deploy -c wrangler-a-v2.jsonc
```

B-V1 uses `VITE_SUPABASE_PUBLISHABLE_KEY` instead of the anon key. B-V2 reads `builds/b-v2/.env.local` (git-ignored) and deploys with its own `wrangler.jsonc`: `npm run build && npx wrangler deploy --name b-v2 --var SUPABASE_URL:https://yuysazrdltissqvdgccx.supabase.co`.

Both keys are the project's public client keys (Supabase dashboard → Settings → API Keys). Never use the `service_role` or secret key here.
