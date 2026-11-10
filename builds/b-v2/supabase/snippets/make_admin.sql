-- =============================================================================
--  Grant admin rights to an existing user
-- =============================================================================
--  Run in Dashboard → SQL Editor (it runs as the `postgres` role).
--  There is deliberately NO way to do this from the app or the public API:
--  private.admins isn't exposed and no browser role can write to it.
--
--  The admin must ALSO enable two-factor authentication (Account → Security)
--  before the admin dashboard and admin APIs will work for them.
-- =============================================================================

insert into private.admins (user_id, note)
select id, 'granted via SQL editor'
  from auth.users
 where email = 'you@example.com'          -- ← change this
on conflict (user_id) do nothing;

-- Check:
select a.user_id, u.email, a.granted_at
  from private.admins a
  join auth.users u on u.id = a.user_id;

-- To revoke:
-- delete from private.admins where user_id = (select id from auth.users where email = 'you@example.com');
