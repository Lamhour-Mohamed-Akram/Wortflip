/**
 * Community topics live in a free Supabase project. The anon key is meant to be
 * public: row level security (see supabase/schema.sql) limits it to reading
 * visible topics and inserting topics and reports.
 *
 * Leave SUPABASE_URL empty to run the app without the community part.
 */
export const SUPABASE_URL = 'https://lhyvqvirkkftmdeouavl.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeXZxdmlya2tmdG1kZW91YXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDY4MjYsImV4cCI6MjEwNjAyMjgyNn0.wcYNQya9lcDQSVswmzKudjccJfkKj5pk61c_0kaVgy0';

export const COMMUNITY_ENABLED = SUPABASE_URL.length > 0;
/** Topics are fetched at most this often (per app start it is always tried once). */
export const SYNC_INTERVAL_MS = 10 * 60 * 1000;
/** Newest topics first; older ones are simply not loaded. */
export const MAX_TOPICS = 300;
