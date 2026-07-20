-- ============================================================
-- Scheduled emails — run AFTER deploying the edge functions.
-- Replace YOUR-PROJECT-REF and YOUR-SERVICE-ROLE-KEY below,
-- then run in SQL Editor. Times are UTC (IST = UTC + 5:30):
--   13:00 UTC = 18:30 IST  → chef list (next day, window just closed, Sun–Thu)
--   05:45 UTC = 11:15 IST  → daily funny mails
--
-- NOTE: cron-ready.sql is the complete, current setup — prefer it.
-- ============================================================


'
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'lunch-chef-list-630pm-ist',
  '0 13 * * 0-4',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-chef-list',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{"target":"next"}'::jsonb
  );
  $$
);

select cron.schedule(
  'lunch-daily-funny-1115am-ist',
  '45 5 * * 1-6',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-funny',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'lunch-last-call-1110am-ist',
  '40 5 * * 1-6',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/last-call',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXJkZHVtcmZibGpxbWFraXZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDAwMjY3NiwiZXhwIjoyMDk5NTc4Njc2fQ.d4jmYhaSxls0sfyd54HeN69YGjvzbVa-tBTsFZ-hgxk',
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To inspect or remove later:
--   select * from cron.job;
--   select cron.unschedule('lunch-chef-list-630pm-ist');
--   select cron.unschedule('lunch-last-call-1110am-ist');
--   select cron.unschedule('lunch-daily-funny-1115am-ist');
