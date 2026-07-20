-- ============================================================
-- FULL cron setup — EVENING ORDERING FLOW (paste & run in the
-- Supabase SQL Editor). Safe to re-run: it removes any old jobs
-- first, then schedules the complete set.
--
-- WHY THE AUTO MESSAGE WASN'T WORKING: the previous version of
-- this file only scheduled 3 jobs (chef list, last call, funny).
-- The invite and confirmation crons were never added, so those
-- auto messages never fired.
--
-- LUNCH DAYS: Monday–Friday only (Sat & Sun the office is off).
-- ORDER WINDOW: 5:00–6:30 PM IST the evening before, Sun–Thu.
--   Sun–Thu 17:00 IST → evening invite: "order lunch for TOMORROW"
--                        (Sunday's run asks about Monday)
--   Sun–Thu 18:15 IST → last call: 15 minutes to the 6:30 PM close
--   Fri     17:00 IST → funny "kitchen closed, see you Monday" message
--   Sat               → nothing
--
-- Times are UTC (IST = UTC + 5:30):
--   11:30 UTC = 17:00 IST → evening invite (Sun–Thu) / weekend funny (Fri)
--   12:45 UTC = 18:15 IST → last call in Basecamp (Sun–Thu)
--   13:00 UTC = 18:30 IST → chef list for NEXT day — window just
--                           closed, orders are final (Sun–Thu)
--   05:31 UTC = 11:01 IST → member confirmations (Mon–Fri)
--   05:45 UTC = 11:15 IST → daily funny mails (Mon–Fri)
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
    'lunch-midday-confirm-11am-ist',
    'lunch-evening-invite-5pm-ist',
    'lunch-weekend-funny-fri5pm-ist',
    'lunch-last-call-615pm-ist'
  ] loop
    begin
      perform cron.unschedule(j);
    exception when others then null;
    end;
  end loop;
end
$do$;

-- ---- 17:00 IST, Sun–Thu: invite everyone to order for TOMORROW ----
select cron.schedule(
  'lunch-evening-invite-5pm-ist',
  '30 11 * * 0-4',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/evening-invite',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- 17:00 IST, Friday: funny "see you Monday" message ----
select cron.schedule(
  'lunch-weekend-funny-fri5pm-ist',
  '30 11 * * 5',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/weekend-funny',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- 18:30 IST, Sun–Thu: chef gets the NEXT day's final list ----
-- Fires the moment the 5:00–6:30 PM order window closes, so the plates
-- just booked (tomorrow's lunch; Sunday's run = Monday) go straight to
-- the kitchen. target=next tells the function to use the next lunch day.
select cron.schedule(
  'lunch-chef-list-630pm-ist',
  '0 13 * * 0-4',
  $$
  select net.http_post(
    url     := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/send-chef-list',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{"target":"next"}'::jsonb
  );
  $$
);

-- ---- 11:01 IST, Mon–Fri: members on today's list get confirmations ----
select cron.schedule(
  'lunch-midday-confirm-11am-ist',
  '31 5 * * 1-5',
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

-- ---- 18:15 IST, Sun–Thu: last call — window closes 6:30 PM ----
select cron.schedule(
  'lunch-last-call-615pm-ist',
  '45 12 * * 0-4',
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

-- ---- verify: you should see exactly 6 jobs ----
select jobname, schedule, active from cron.job order by jobname;

-- Recent run history (check status = 'succeeded'):
--   select jobname, status, return_message, start_time
--   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--   order by start_time desc limit 20;
