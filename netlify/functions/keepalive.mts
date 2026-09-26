/**
 * Daily ping that keeps the free Supabase project awake: Supabase pauses a
 * project after seven days without a single request. Runs on Netlify's
 * scheduler (free), reads one row through the public anon key, and logs the
 * status. Nothing is written.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/community/config';

export default async () => {
  if (!SUPABASE_URL) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/topics?select=id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  console.log(`supabase keepalive: ${response.status}`);
};

export const config = { schedule: '@daily' };
