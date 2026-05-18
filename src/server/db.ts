import Database from 'better-sqlite3';
import path from 'path';

// Use SQLite for the local offline POS. 
// For cloud sync, the system will eventually sync these logs to PostgreSQL.
export const db = new Database(path.join(process.cwd(), 'mart_local.db'), { verbose: console.log });

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      short_name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (parent_id) REFERENCES categories (id)
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      rate REAL DEFAULT 1.0,
      symbol TEXT,
      is_base INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      category_id INTEGER,
      brand_id INTEGER,
      unit_id INTEGER,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      supplier_id INTEGER,
      is_credit_allowed INTEGER DEFAULT 1,
      expiry_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
      FOREIGN KEY (category_id) REFERENCES categories (id),
      FOREIGN KEY (brand_id) REFERENCES brands (id),
      FOREIGN KEY (unit_id) REFERENCES units (id)
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      due_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'CREDIT', -- PAID, CREDIT
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, VOID
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      batch_number TEXT,
      expiry_date TEXT,
      quantity INTEGER NOT NULL,
      received_date TEXT,
      purchase_invoice_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices (id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      payment_method TEXT NOT NULL,
      customer_id INTEGER,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS auto_burn_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'SYSTEM_GENERATED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS sales_summary_logs (
      date TEXT PRIMARY KEY,
      total_real_sales REAL DEFAULT 0,
      total_credit_sales REAL DEFAULT 0,
      total_auto_burn_sales REAL DEFAULT 0,
      total_online_sales REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS supplier_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      total_amount REAL NOT NULL,
      return_type TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    );

    CREATE TABLE IF NOT EXISTS supplier_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      reason TEXT,
      FOREIGN KEY (return_id) REFERENCES supplier_returns (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      total_refund REAL NOT NULL,
      refund_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales (id)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      refund_amount REAL NOT NULL,
      FOREIGN KEY (return_id) REFERENCES sales_returns (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_card TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      credit_limit REAL DEFAULT 0,
      daily_limit REAL DEFAULT 0,
      daily_used REAL DEFAULT 0,
      monthly_limit REAL DEFAULT 0,
      monthly_used REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      credit_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CLOSED
      last_scan_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credit_limit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      old_limit REAL,
      new_limit REAL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS credit_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      previous_status TEXT,
      new_status TEXT,
      changed_by INTEGER,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id),
      FOREIGN KEY (changed_by) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS credit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL, -- 'CHARGE', 'PAYMENT', 'DAILY_BURN'
      reference_id INTEGER, -- sale_id if it's a charge
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS user_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    CREATE TABLE IF NOT EXISTS void_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      reason TEXT,
      void_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (void_by) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_credit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      burned_amount REAL NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS monthly_credit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      usage_amount REAL NOT NULL,
      month TEXT NOT NULL, -- YYYY-MM
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS auto_sales_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_id INTEGER,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS rfid_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_card TEXT NOT NULL,
      customer_name TEXT,
      status TEXT, -- 'SUCCESS', 'FAILED', 'DUPLICATE', 'INSUFFICIENT_CREDIT'
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_by INTEGER,
      total_system_value REAL DEFAULT 0,
      total_physical_value REAL DEFAULT 0,
      total_difference REAL DEFAULT 0,
      status TEXT DEFAULT 'DRAFT', -- DRAFT, COMPLETED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER,
      product_id INTEGER,
      system_stock INTEGER NOT NULL,
      physical_stock INTEGER NOT NULL,
      difference INTEGER NOT NULL,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      value_difference REAL NOT NULL,
      FOREIGN KEY (inventory_id) REFERENCES inventory_sessions (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS inventory_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory_sessions (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      bonus_qty INTEGER DEFAULT 0,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      batch_number TEXT,
      expiry_date TEXT,
      FOREIGN KEY (invoice_id) REFERENCES purchase_invoices (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'CASH',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES purchase_invoices (id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'CASH',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      user_id INTEGER,
      old_data TEXT,
      new_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES purchase_invoices (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS financial_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'EXPENSE_DELETE', 'EXPENSE_EDIT', 'INVOICE_EDIT', 'PAYMENT'
      reference_id INTEGER,
      user_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    CREATE TABLE IF NOT EXISTS deleted_returns_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER,
      deleted_by INTEGER,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deleted_by) REFERENCES users (id)
    );
  `);

  // --- MIGRATIONS ---
  // RFID Scans table
  try { db.exec('ALTER TABLE rfid_scans ADD COLUMN status TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE rfid_scans ADD COLUMN reason TEXT'); } catch(e) {}
  
  // Suppliers table
  try { db.exec('ALTER TABLE suppliers ADD COLUMN phone TEXT'); } catch(e) {}
  
  // Products table
  try { db.exec('ALTER TABLE products ADD COLUMN category_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN brand_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN unit_id INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN expiry_enabled INTEGER DEFAULT 0'); } catch(e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN is_favorite INTEGER DEFAULT 0'); } catch(e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN expiry_date TEXT'); } catch(e) {}
  
  // Customers table
  try { db.exec('ALTER TABLE customers ADD COLUMN credit_status TEXT DEFAULT "ACTIVE"'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN last_scan_at DATETIME'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN auto_sale_cfg INTEGER DEFAULT 0'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN working_place TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN emp_id TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN passport_no TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN auto_burn_start_date DATETIME'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN auto_burn_stop_date DATETIME'); } catch(e) {}
  try { db.exec('ALTER TABLE customers ADD COLUMN auto_burn INTEGER DEFAULT 0'); } catch(e) {}

  // Supplier returns
  try { db.exec('ALTER TABLE supplier_returns ADD COLUMN document_reference TEXT'); } catch(e) {}
  
  // Purchase invoice items table
  try { db.exec('ALTER TABLE purchase_invoice_items ADD COLUMN bonus_qty INTEGER DEFAULT 0'); } catch(e) {}
  
  // Sales returns table
  try { db.exec('ALTER TABLE sales_returns ADD COLUMN payment_status TEXT DEFAULT "UNPAID"'); } catch(e) {}
}

import bcrypt from 'bcryptjs';

export function seedProducts() {
  // Seed Users
  const userStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userResult = userStmt.get() as { count: number };
  if (userResult.count === 0) {
    console.log('Seeding initial admin user...');
    const insertUser = db.prepare(`
      INSERT INTO users (username, password, role)
      VALUES (?, ?, ?)
    `);
    
    // Default admin: admin / admin123
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    insertUser.run('admin', hash, 'ADMIN');
  }

  // Seed Settings
  const settingsStmt = db.prepare('SELECT COUNT(*) as count FROM settings');
  const settingsResult = settingsStmt.get() as { count: number };
  if (settingsResult.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('shop_name', 'KWE POS System');
    insertSetting.run('company_name', 'TEX_SOLUTIONS_LTD');
    insertSetting.run('registration_number', 'REG-2026-X99');
    insertSetting.run('address', '123 TECH BOULEVARD, SILICON SECTOR 7');
    insertSetting.run('phone_number', '+1-555-0199');
    insertSetting.run('return_validity_days', '3');
    insertSetting.run('return_allow_cash', 'true');
    insertSetting.run('credit_increase_multiplier', '1.0');
  }

  const supplierStmt = db.prepare('SELECT COUNT(*) as count FROM suppliers');
  const supResult = supplierStmt.get() as { count: number };
  if (supResult.count === 0) {
    db.prepare(`INSERT INTO suppliers (name, contact) VALUES ('Global Tech Distributors', 'contact@globaltech.com')`).run();
    db.prepare(`INSERT INTO suppliers (name, contact) VALUES ('Office Supplies Co', 'sales@officesup.com')`).run();
  }

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const result = countStmt.get() as { count: number };
  
  if (result.count === 0) {
    console.log('Seeding initial products...');
    
    // Seed Categories first
    db.prepare(`INSERT INTO categories (name, status) VALUES ('Groceries', 'active')`).run(); // ID 1
    db.prepare(`INSERT INTO categories (name, status) VALUES ('Beverages', 'active')`).run(); // ID 2
    db.prepare(`INSERT INTO categories (name, status) VALUES ('Snacks', 'active')`).run(); // ID 3
    db.prepare(`INSERT INTO categories (name, status) VALUES ('Household', 'active')`).run(); // ID 4
    db.prepare(`INSERT INTO categories (name, status) VALUES ('Personal Care', 'active')`).run(); // ID 5

    const insert = db.prepare(`
      INSERT INTO products (name, barcode, category_id, brand_id, purchase_price, selling_price, stock_quantity, supplier_id, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Mini Mart products
    insert.run('Fresh Milk 1L', '123456789012', 1, null, 1.20, 2.50, 50, 1, 1);
    insert.run('White Bread Sliced', '987654321098', 1, null, 0.80, 1.50, 30, 2, 1);
    insert.run('Coca-Cola 500ml', '111222333444', 2, null, 0.90, 1.75, 100, 1, 1);
    insert.run('Potato Chips Original', '555666777888', 3, null, 1.10, 2.20, 45, 1, 0);
    insert.run('Dish Soap 500ml', '222333444555', 4, null, 1.50, 3.00, 25, 2, 0);
    insert.run('Bath Soap Bar', '666777888999', 5, null, 0.50, 1.25, 60, 2, 0);
    insert.run('Eggs 12-Pack', '444555666777', 1, null, 2.10, 3.50, 40, 1, 1);
    insert.run('Mineral Water 1.5L', '101010101010', 2, null, 0.40, 1.00, 200, 1, 1);
    insert.run('Instant Noodles 5-Pack', '202020202020', 1, null, 3.50, 5.20, 80, 1, 0);
    insert.run('Cooking Oil 2L', '303030303030', 1, null, 12.00, 15.50, 20, 2, 1);
    insert.run('White Sugar 1kg', '404040404040', 1, null, 2.20, 2.85, 100, 2, 1);
    insert.run('Thai Rice 5kg', '505050505050', 1, null, 18.00, 24.00, 15, 1, 0);
    insert.run('Facial Tissue 200s', '606060606060', 4, null, 1.80, 3.50, 40, 2, 0);
    insert.run('AA Alkaline Batt 4pk', '707070707070', 4, null, 6.50, 9.90, 25, 1, 0);
    insert.run('Fluoride Toothpaste', '808080808080', 5, null, 2.50, 4.50, 45, 2, 0);
    insert.run('Herbal Shampoo 250ml', '909090909090', 5, null, 4.50, 7.80, 20, 2, 0);
  }
}
