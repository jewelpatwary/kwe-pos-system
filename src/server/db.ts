import { getSupabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';

// Proxy supabase to implement lazy initialization
const supabase = {
  from: (table: string) => getSupabase().from(table),
};

export const db = {} as any; // Mock for now to prevent breaking other potential imports, though we aim to remove it

export function initDB() {
  // SQLite initialization skipped as we migrated to Supabase
  console.log('Skipping SQLite initDB - logic moved to Supabase');
}

export async function seedProducts() {
  try {
    // Seed Users
    const { count: userCount, error: uErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (uErr) {
        const errorMsg = typeof uErr.message === 'string' && uErr.message.includes('<!DOCTYPE html>')
          ? 'Received HTML response (Likely invalid SUPABASE_URL)'
          : uErr.message;
        console.warn('Could not check users table. Make sure it exists in Supabase and the URL is correct.', errorMsg);
    } else if (userCount === 0) {
      console.log('Seeding initial admin user to Supabase...');
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin123', salt);
      await supabase.from('users').insert([{ username: 'admin', password: hash, role: 'ADMIN' }]);
    }

    // Seed Settings
    const { count: settingsCount } = await supabase.from('settings').select('*', { count: 'exact', head: true });
    if (settingsCount === 0) {
      console.log('Seeding initial settings to Supabase...');
      await supabase.from('settings').insert([
        { key: 'shop_name', value: 'KWE POS System' },
        { key: 'company_name', value: 'TEX_SOLUTIONS_LTD' },
        { key: 'registration_number', value: 'REG-2026-X99' },
        { key: 'address', value: '123 TECH BOULEVARD, SILICON SECTOR 7' },
        { key: 'phone_number', value: '+1-555-0199' },
        { key: 'return_validity_days', value: '3' },
        { key: 'return_allow_cash', value: 'true' },
        { key: 'credit_increase_multiplier', value: '1.0' }
      ]);
    }

    // Seed Suppliers
    const { count: supplierCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
    if (supplierCount === 0) {
      console.log('Seeding initial suppliers to Supabase...');
      await supabase.from('suppliers').insert([
        { name: 'Global Tech Distributors', contact: 'contact@globaltech.com' },
        { name: 'Office Supplies Co', contact: 'sales@officesup.com' }
      ]);
    }

    // Seed Products & Categories
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    if (productCount === 0) {
      console.log('Seeding initial categories and products to Supabase...');
      
      const { data: categories } = await supabase.from('categories').insert([
        { name: 'Groceries', status: 'active' },
        { name: 'Beverages', status: 'active' },
        { name: 'Snacks', status: 'active' },
        { name: 'Household', status: 'active' },
        { name: 'Personal Care', status: 'active' }
      ]).select();

      if (categories && categories.length > 0) {
        const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));
        
        const { data: suppliers } = await supabase.from('suppliers').select('id, name');
        const supMap = Object.fromEntries((suppliers || []).map(s => [s.name, s.id]));

        await supabase.from('products').insert([
          { name: 'Fresh Milk 1L', barcode: '123456789012', category_id: catMap['Groceries'], purchase_price: 1.20, selling_price: 2.50, stock_quantity: 50, supplier_id: supMap['Global Tech Distributors'], is_favorite: true },
          { name: 'White Bread Sliced', barcode: '987654321098', category_id: catMap['Groceries'], purchase_price: 0.80, selling_price: 1.50, stock_quantity: 30, supplier_id: supMap['Office Supplies Co'], is_favorite: true },
          { name: 'Coca-Cola 500ml', barcode: '111222333444', category_id: catMap['Beverages'], purchase_price: 0.90, selling_price: 1.75, stock_quantity: 100, supplier_id: supMap['Global Tech Distributors'], is_favorite: true },
          { name: 'Potato Chips Original', barcode: '555666777888', category_id: catMap['Snacks'], purchase_price: 1.10, selling_price: 2.20, stock_quantity: 45, supplier_id: supMap['Global Tech Distributors'], is_favorite: false },
          { name: 'Dish Soap 500ml', barcode: '222333444555', category_id: catMap['Household'], purchase_price: 1.50, selling_price: 3.00, stock_quantity: 25, supplier_id: supMap['Office Supplies Co'], is_favorite: false },
          { name: 'Bath Soap Bar', barcode: '666777888999', category_id: catMap['Personal Care'], purchase_price: 0.50, selling_price: 1.25, stock_quantity: 60, supplier_id: supMap['Office Supplies Co'], is_favorite: false },
          { name: 'Eggs 12-Pack', barcode: '444555666777', category_id: catMap['Groceries'], purchase_price: 2.10, selling_price: 3.50, stock_quantity: 40, supplier_id: supMap['Global Tech Distributors'], is_favorite: true },
          { name: 'Mineral Water 1.5L', barcode: '101010101010', category_id: catMap['Beverages'], purchase_price: 0.40, selling_price: 1.00, stock_quantity: 200, supplier_id: supMap['Global Tech Distributors'], is_favorite: true },
          { name: 'Instant Noodles 5-Pack', barcode: '202020202020', category_id: catMap['Groceries'], purchase_price: 3.50, selling_price: 5.20, stock_quantity: 80, supplier_id: supMap['Global Tech Distributors'], is_favorite: false },
          { name: 'Cooking Oil 2L', barcode: '303030303030', category_id: catMap['Groceries'], purchase_price: 12.00, selling_price: 15.50, stock_quantity: 20, supplier_id: supMap['Office Supplies Co'], is_favorite: true },
          { name: 'White Sugar 1kg', barcode: '404040404040', category_id: catMap['Groceries'], purchase_price: 2.20, selling_price: 2.85, stock_quantity: 100, supplier_id: supMap['Office Supplies Co'], is_favorite: true },
          { name: 'Thai Rice 5kg', barcode: '505050505050', category_id: catMap['Groceries'], purchase_price: 18.00, selling_price: 24.00, stock_quantity: 15, supplier_id: supMap['Global Tech Distributors'], is_favorite: false },
          { name: 'Facial Tissue 200s', barcode: '606060606060', category_id: catMap['Household'], purchase_price: 1.80, selling_price: 3.50, stock_quantity: 40, supplier_id: supMap['Office Supplies Co'], is_favorite: false },
          { name: 'AA Alkaline Batt 4pk', barcode: '707070707070', category_id: catMap['Household'], purchase_price: 6.50, selling_price: 9.90, stock_quantity: 25, supplier_id: supMap['Global Tech Distributors'], is_favorite: false },
          { name: 'Fluoride Toothpaste', barcode: '808080808080', category_id: catMap['Personal Care'], purchase_price: 2.50, selling_price: 4.50, stock_quantity: 45, supplier_id: supMap['Office Supplies Co'], is_favorite: false },
          { name: 'Herbal Shampoo 250ml', barcode: '909090909090', category_id: catMap['Personal Care'], purchase_price: 4.50, selling_price: 7.80, stock_quantity: 20, supplier_id: supMap['Office Supplies Co'], is_favorite: false }
        ]);
      }
    }
  } catch (err: any) {
    console.error('Supabase seeding error:', err.message);
  }
}
