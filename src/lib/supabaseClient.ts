import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'node:async_hooks';

export const shopContext = new AsyncLocalStorage<string>();

const shopClients: Record<string, SupabaseClient> = {};
let defaultClient: SupabaseClient | null = null;

// Registry of shops loaded from server
export const shopsRegistry: Record<string, { supabaseUrl: string, supabaseKey: string }> = {};

export function getSupabase(explicitShopId?: string): SupabaseClient {
  const shopId = explicitShopId || shopContext.getStore();

  if (shopId && shopId !== 'default') {
    if (shopClients[shopId]) {
      return shopClients[shopId];
    }
    const config = shopsRegistry[shopId];
    if (config && config.supabaseUrl && config.supabaseKey) {
      if (config.supabaseUrl.includes('supabase.com/dashboard')) {
        throw new Error('SUPABASE_URL appears to be a Dashboard URL.');
      }
      const client = createClient(config.supabaseUrl, config.supabaseKey);
      shopClients[shopId] = client;
      return client;
    }
    console.warn(`[Supabase] Shop config not found for ${shopId}, falling back to default`);
  }

  // Fallback to default
  if (!defaultClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required for default instance');
    }

    if (supabaseUrl.includes('supabase.com/dashboard')) {
      throw new Error('SUPABASE_URL appears to be a Dashboard URL. Please use the API Project URL found in Project Settings -> API (e.g., https://your-project.supabase.co)');
    }
    
    defaultClient = createClient(supabaseUrl, supabaseKey);
  }
  return defaultClient;
}
