-- ============================================================
-- FULL cron setup, EVENING ordering for the NEXT working day.
-- Paste and run in the Supabase SQL Editor. Safe to re-run: it removes
-- old jobs first, then schedules the complete set.
--
-- LUNCH DAYS: Monday to Friday. Ordering happens the EVENING BEFORE.
-- Default members are IN by default for each lunch day.
--
-- DAILY RHYTHM (Sun to Thu, ordering for the next working day):
--   4:00 PM IST  -> morning-invite : open, defaults in, tomorrow's list to
--                   Basecamp + member emails (order / cancel / chat buttons)
--   4:30 PM IST  -> midday-confirm : last call reminder in Basecamp
--   5:00 PM IST  -> last-call      : close, post tomorrow's final list
--                   send-chef-list : tomorrow's list to chef + admin (Mani)
--                   daily-funny    : "sorted / missed" member mails
-- DAILY:
--   9:00 AM IST  -> holiday-wish   : greet the team if today is a holiday
-- WEEKLY:
--   Fri 6:00 PM  -> weekly-report  : Excel of the week emailed to Mani
--
-- Times are UTC (IST = UTC + 5:30):
--   10:30 = 4:00 PM   11:00 = 4:30 PM   11:30 = 5:00 PM
--   03:30 = 9:00 AM   12:30 = 6:00 PM
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- remove every old job (ignore "not found" errors) ----
do $do$
declare j text;
begin
  foreach j in array array[
    'lunch-morning-invite-10am-ist',
    'lunch-midday-reminder-11am-ist',
    'lunch-finalise-1115am-ist',
    'lunch-chef-final-1115am-ist',
    'lunch-daily-funny-1115am-ist',
    'lunch-open-4pm-ist',
    'lunch-lastcall-430pm-ist',
    'lunch-close-5pm-ist',
    'lunch-chef-5pm-ist',
    'lunch-funny-5pm-ist',
    'lunch-holiday-wish-9am-ist',
    'lunch-weekly-report-fri6pm-ist'
  ] loop
    begin perform cron.unschedule(j); exception when others then null; end;
  end loop;
end
$do$;

-- helper note: all jobs call an edge function with the service-role key.

-- ---- 4:00 PM IST, Sun to Thu: OPEN (tomorrow's list + member emails) ----
select cron.schedule('lunch-open-4pm-ist', '30 10 * * 0-4', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/morning-invite',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- 4:30 PM IST, Sun to Thu: LAST CALL reminder ----
select cron.schedule('lunch-lastcall-430pm-ist', '0 11 * * 0-4', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/midday-confirm',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- 5:00 PM IST, Sun to Thu: CLOSE, post tomorrow's final list ----
select cron.schedule('lunch-close-5pm-ist', '30 11 * * 0-4', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/last-call',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- 5:00 PM IST, Sun to Thu: chef + admin list for tomorrow ----
select cron.schedule('lunch-chef-5pm-ist', '30 11 * * 0-4', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/send-chef-list',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{"target":"next"}'::jsonb);
$$);

-- ---- 5:00 PM IST, Sun to Thu: daily funny member mails ----
select cron.schedule('lunch-funny-5pm-ist', '30 11 * * 0-4', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/daily-funny',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- 9:00 AM IST, daily: holiday greeting (only posts on holidays) ----
select cron.schedule('lunch-holiday-wish-9am-ist', '30 3 * * *', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/holiday-wish',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- Friday 6:00 PM IST: weekly Excel report to the admin (Mani) ----
select cron.schedule('lunch-weekly-report-fri6pm-ist', '30 12 * * 5', $$
  select net.http_post(
    url := 'https://awqrddumrfbljqmakivv.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk','Content-Type','application/json'),
    body := '{}'::jsonb);
$$);

-- ---- verify: you should see 7 jobs ----
select jobname, schedule, active from cron.job order by jobname;
