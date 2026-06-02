import { create } from 'zustand';

export interface Product {
  id: number;
  name: string;
  barcode: string;
  sku?: string;
  category: string;
  brand: string;
  brand_name?: string;
  unit?: string;
  unit_name?: string;
  category_id?: number;
  category_name?: string;
  category2_id?: number;
  category2_name?: string;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
  is_credit_allowed?: number;
  is_favorite?: number;
  image_url?: string;
  status?: string;
  expiry_date?: string;
}

export interface CartItem extends Product {
  cart_quantity: number;
}

interface CartStore {
  items: CartItem[];
  discount: number;
  returnCredit: number;
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  setDiscount: (amount: number) => void;
  setReturnCredit: (amount: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  discount: 0,
  returnCredit: 0,
  
  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? { ...item, cart_quantity: item.cart_quantity + 1 }
              : item
          ),
        };
      }
      return { items: [...state.items, { ...product, cart_quantity: 1 }] };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity < 0) return;
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId ? { ...item, cart_quantity: quantity } : item
      ),
    }));
  },

  setDiscount: (amount) => set({ discount: amount }),
  setReturnCredit: (amount) => set({ returnCredit: amount }),

  clearCart: () => set({ items: [], discount: 0, returnCredit: 0 }),

  getTotal: () => {
    const { items, discount, returnCredit } = get();
    const subtotal = items.reduce((sum, item) => sum + item.selling_price * item.cart_quantity, 0);
    return Math.max(0, subtotal - discount - returnCredit);
  },
}));
