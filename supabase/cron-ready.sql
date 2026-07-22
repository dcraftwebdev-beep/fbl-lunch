-- ============================================================
-- FULL cron setup — MORNING-ONLY SAME-DAY FLOW (paste & run in the
-- Supabase SQL Editor). Safe to re-run: it removes any old jobs
-- first, then schedules the complete set.
--
-- LUNCH DAYS: Monday–Friday. Default members (Dinesh, Jey, Ajey,
-- Dipak, Lazzo) are IN by default every lunch day.
--
-- ORDER WINDOW: same day only. Open every lunch morning until it
-- CLOSES at 11:15 AM IST. !lunch in / !lunch out and the email
-- buttons all work up to 11:15 AM. There is NO evening ordering.
--
--   Mon–Fri 10:00 IST → morning-invite: auto-add defaults + post
--                       today's list to Basecamp (!lunch in/out)
--   Mon–Fri 11:00 IST → midday-confirm: reminder post ("15 min left")
--   Mon–Fri 11:15 IST → last-call: post TODAY's final list to Basecamp
--                     + send-chef-list (today's FINAL list to the chef)
--                     + daily-funny mails
--
-- Times are UTC (IST = UTC + 5:30):
--   04:30 UTC = 10:00 IST   ·   05:30 UTC = 11:00 IST   ·   05:45 UTC = 11:15 IST
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- remove every old job (ignore "not found" errors) ----
do $do$
declare j text;
begin
  foreach j in array array[
    'lunch-chef-list-11am-ist',
    'lunch-chef-list-630pm-ist',
    'lunch-daily-funny-1115am-ist',
    'lunch-last-call-1110am-ist',
    'lunch-morning-invite-10am-ist',
    'lunch-midday-reminder-11am-ist',
    'lunch-midday-confirm-11am-ist',
    'lunch-evening-invite-5pm-ist',
    'lunch-weekend-funny-fri5pm-ist',
    'lunch-last-call-615pm-ist',
    'lunch-evening-mail-630pm-ist',
    'lunch-chef-preview-630pm-ist',
    'lunch-finalise-1115am-ist',
    'lunch-chef-final-1115am-ist'
  ] loop
    begin
      perform cron.unschedule(j);
    exception when others then null;
    end;
  end loop;
end
$do$;

-- ---- 10:00 IST, Mon–Fri: defaults IN + post today's list to Basecamp ----
select cron.schedule(
  'lunch-morning-invite-10am-ist',
  '30 4 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/morning-invite',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- 11:00 IST, Mon–Fri: reminder post ("15 minutes left") ----
select cron.schedule(
  'lunch-midday-reminder-11am-ist',
  '30 5 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/midday-confirm',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- 11:15 IST, Mon–Fri: post TODAY's final list to Basecamp ----
select cron.schedule(
  'lunch-finalise-1115am-ist',
  '45 5 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/last-call',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- 11:15 IST, Mon–Fri: chef gets TODAY's final list ----
select cron.schedule(
  'lunch-chef-final-1115am-ist',
  '45 5 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/send-chef-list',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{"target":"today"}'::jsonb
  );
  $$
);

-- ---- 11:15 IST, Mon–Fri: daily funny mails ----
select cron.schedule(
  'lunch-daily-funny-1115am-ist',
  '45 5 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/daily-funny',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- verify: you should see exactly 5 jobs ----
select jobname, schedule, active from cron.job order by jobname;
