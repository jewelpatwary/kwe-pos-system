import { create } from 'zustand';
import { Product } from './cartStore';

interface ProductStore {
  products: Product[];
  isLoading: boolean;
  fetchProducts: (token: string, forceRefresh?: boolean) => Promise<void>;
  setProducts: (products: Product[]) => void;
}

const CACHE_KEY = 'pos_products_cache';

export const useProductStore = create<ProductStore>((set) => ({
  products: JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
  isLoading: false,
  fetchProducts: async (token, forceRefresh = false) => {
    // If not forcing refresh, we already initialized from local storage
    if (!forceRefresh && JSON.parse(localStorage.getItem(CACHE_KEY) || '[]').length > 0) {
      return;
    }

    set({ isLoading: true });
    try {
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.data));
        set({ products: data.data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error(err);
      set({ isLoading: false });
    }
  },
  setProducts: (products) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    set({ products });
  },
}));
