import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useAuthStore } from './store/authStore';

// Global HTTP GET Cache for API routes
const globalFetchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  configurable: true,
  writable: true,
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const shopId = localStorage.getItem('activeShop');
    
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.href;
    } else if (input instanceof Request) {
      urlStr = input.url;
    }

    const modifiedInit = { ...init };
    if (shopId) {
      modifiedInit.headers = {
        ...modifiedInit.headers,
        'x-shop-id': shopId
      };
    }
  
    const isApi = urlStr.includes('/api/');
    const isLoginEndpoint = urlStr.includes('/api/auth/login');
    
    // Cache GET requests to /api/
    if (method === 'GET' && isApi && !isLoginEndpoint) {
      const cacheKey = `${shopId || 'default'}::${urlStr}`;
      const now = Date.now();
      
      // Serve from cache if valid
      if (globalFetchCache.has(cacheKey) && (now - globalFetchCache.get(cacheKey)!.timestamp < CACHE_TTL)) {
         const cachedResponse = globalFetchCache.get(cacheKey)!.data;
         return new Response(JSON.stringify(cachedResponse), {
           status: 200,
           headers: { 'Content-Type': 'application/json' }
         });
      }
  
      const res = await originalFetch(input, modifiedInit);
      
      if (res.status === 401) {
        if (!isLoginEndpoint) {
          useAuthStore.getState().logout();
        }
        // Return a promise that never resolves to prevent components from parsing the 401 response and alerting before the redirect occurs
        return new Promise(() => {});
      }
  
      if (res.ok) {
         // Clone response so we can read json and still return a valid response
         const clone = res.clone();
         try {
           const data = await clone.json();
           // Only cache successful JSON responses
           if (data && typeof data === 'object') {
               globalFetchCache.set(cacheKey, { data, timestamp: now });
           }
         } catch (e) {
           // ignore json parse error
         }
      }
      
      return res;
    }
    
    // Non-GET or Non-API handling
    const res = await originalFetch(input, modifiedInit);
    if (res.status === 401 && !isLoginEndpoint) {
      useAuthStore.getState().logout();
      return new Promise(() => {});
    }
    return res;
  }
});

// Export prefetcher to be used in layouts
export const prefetchAPI = (url: string, token: string) => {
   const shopId = localStorage.getItem('activeShop');
   const cacheKey = `${shopId || 'default'}::${url}`;
   if (globalFetchCache.has(cacheKey) || !token) return; // already cached
   
   const headers: any = { 'Authorization': `Bearer ${token}` };
   if (shopId) headers['x-shop-id'] = shopId;
   
   fetch(url, { headers }).catch(() => {});
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


