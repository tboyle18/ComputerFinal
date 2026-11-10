"""Turn a build's own Supabase SQL into a version that lives in its own Postgres schema.

All four builds share one free Supabase project ("Computer-final"). B-V2 uses `public`.
The other builds each get a schema (a_v1, a_v2, b_v1) so their tables, triggers and
storage buckets never collide with each other or with B-V2.

The build's original SQL file is only read, never changed. Output goes to
deploy/shared-backend/<schema>.sql.

Usage: python3 make_schema_sql.py <schema> <bucket-prefix> <input.sql> [--extra-bucket NAME]
"""
import re
import sys
from pathlib import Path

schema, prefix, src = sys.argv[1], sys.argv[2], Path(sys.argv[3])
extra_buckets = sys.argv[sys.argv.index("--extra-bucket") + 1:] if "--extra-bucket" in sys.argv else []
sql = src.read_text()

BUCKETS = ["listing-images", "avatars"]

# 1. Qualified references to the public schema -> this build's schema.
sql = re.sub(r"\bpublic\.", f"{schema}.", sql, flags=re.I)
# 2. search_path settings and "on schema public" grants.
sql = re.sub(r"(search_path\s*(?:=|to)\s*)public\b", rf"\g<1>{schema}", sql, flags=re.I)
sql = re.sub(r"(on\s+schema\s+)public\b", rf"\g<1>{schema}", sql, flags=re.I)
# 3. Storage bucket ids -> prefixed ids (the Worker proxy maps them back for the app).
for b in BUCKETS:
    sql = sql.replace(f"'{b}'", f"'{prefix}-{b}'")
# 4. Storage policy names are shared across all builds; prefix them.
sql = re.sub(r'(create\s+policy\s+")([^"]+)("\s+on\s+storage\.objects)',
             rf"\g<1>{prefix}: \g<2>\g<3>", sql, flags=re.I)
# 5. Triggers on auth.users share one namespace; give each build its own name.
sql = re.sub(r"(create\s+trigger\s+)(\w+)(\s+after\s+insert\s+on\s+auth\.users)",
             rf"\g<1>\g<2>_{schema}\g<3>", sql, flags=re.I)

header = f"""-- Generated from {src.name} by make_schema_sql.py. Do not edit by hand.
create schema if not exists {schema};
set search_path = {schema}, extensions;

"""

extra = ""
for b in extra_buckets:
    # Builds whose instructions say to create a public `listing-images` bucket by hand.
    extra += f"""
insert into storage.buckets (id, name, public) values ('{prefix}-{b}', '{prefix}-{b}', true)
on conflict (id) do nothing;
create policy "{prefix}: public read" on storage.objects for select using (bucket_id = '{prefix}-{b}');
create policy "{prefix}: signed-in upload" on storage.objects for insert to authenticated with check (bucket_id = '{prefix}-{b}');
create policy "{prefix}: owner delete" on storage.objects for delete to authenticated using (bucket_id = '{prefix}-{b}' and owner = auth.uid());
"""

footer = f"""
-- Supabase only grants API roles access to `public` by default; mirror that here.
grant usage on schema {schema} to anon, authenticated, service_role;
grant all on all tables in schema {schema} to anon, authenticated, service_role;
grant all on all routines in schema {schema} to anon, authenticated, service_role;
grant all on all sequences in schema {schema} to anon, authenticated, service_role;
alter default privileges in schema {schema} grant all on tables to anon, authenticated, service_role;
alter default privileges in schema {schema} grant all on routines to anon, authenticated, service_role;
alter default privileges in schema {schema} grant all on sequences to anon, authenticated, service_role;
"""

out = Path(__file__).with_name(f"{schema}.sql")
out.write_text(header + sql + extra + footer)
print(f"wrote {out} ({len(out.read_text().splitlines())} lines)")
