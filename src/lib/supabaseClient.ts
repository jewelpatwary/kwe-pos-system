import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    if (supabaseUrl.includes('supabase.com/dashboard')) {
      throw new Error('SUPABASE_URL appears to be a Dashboard URL. Please use the API Project URL found in Project Settings -> API (e.g., https://your-project.supabase.co)');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}
