import { createClient } from "@supabase/supabase-js";

// service_role bypasses row level security, so this key must stay on the server.
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export { supabase };
