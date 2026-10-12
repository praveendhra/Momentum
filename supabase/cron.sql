-- Hourly trigger for email notifications.
-- Run once in Supabase → SQL Editor (safe to re-run; it replaces the job).
-- The send-notifications Edge Function decides per user whether anything is
-- due in their local time zone, and never sends the same email twice.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'momentum-notifications';

select cron.schedule(
  'momentum-notifications',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qcyijvnkgdznekbzccgj.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
