import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import path from 'path';
import bwipjs from 'bwip-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDB, seedProducts } from './src/server/db';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pos_key_2026';

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  console.log('Authenticating token for:', req.url);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Token extracted:', token ? token.substring(0, 10) + '...' : 'NULL');
  
  if (!token || token === 'null' || token === 'undefined') {
      console.log('No token provided');
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
        console.log('Invalid token:', err);
        return res.status(403).json({ success: false, message: 'Forbidden: Invalid token' });
    }
    console.log('Token verified for user:', user);
    req.user = user;
    next();
  });
};

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }
  next();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Database
  initDB();
  seedProducts();

  // --- API ROUTES ---

  // AUTHENTICATION
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Account disabled' });
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      // Log login
      db.prepare(`INSERT INTO user_activity_logs (user_id, action, details) VALUES (?, 'LOGIN', 'User logged in')`).run(user.id);

      res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // USER MANAGEMENT (Admin Only)
  app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    try {
      const users = db.prepare('SELECT id, username, role, status, created_at FROM users').all();
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:id/reset-password', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      
      const result = db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run(hash, id);
      
      db.prepare(`INSERT INTO user_activity_logs (user_id, action, target_id, details) VALUES (?, 'RESET_PASSWORD', ?, 'Admin reset user password')`)
        .run(req.user.id, id);

      if (result.changes > 0) {
        res.json({ success: true, message: 'Password updated successfully' });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    try {
      const users = db.prepare('SELECT id, username, role, status, created_at FROM users').all();
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/users', authenticateToken, requireAdmin, (req: any, res) => {
    const { username, password, role } = req.body;
    try {
      const checkUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (checkUser) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      const insertResult = db.prepare(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`).run(username, hash, role);
      
      // Log creation
      db.prepare(`INSERT INTO user_activity_logs (user_id, action, target_id, details) VALUES (?, 'CREATE_USER', ?, 'Created new user')`)
        .run(req.user.id, insertResult.lastInsertRowid);

      res.json({ success: true, message: 'User created successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    const { username, password, role, status } = req.body;
    try {
      if (id == 1 && status === 'inactive') {
        return res.status(400).json({ success: false, message: 'Cannot disable the main admin account' });
      }

      if (password) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        db.prepare(`UPDATE users SET username = ?, password = ?, role = ?, status = ? WHERE id = ?`)
          .run(username, hash, role, status, id);
      } else {
        db.prepare(`UPDATE users SET username = ?, role = ?, status = ? WHERE id = ?`)
          .run(username, role, status, id);
      }

      db.prepare(`INSERT INTO user_activity_logs (user_id, action, target_id, details) VALUES (?, 'UPDATE_USER', ?, 'Updated user details')`)
        .run(req.user.id, id);

      res.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    try {
      if (id == 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the main admin account' });
      }
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);

      db.prepare(`INSERT INTO user_activity_logs (user_id, action, target_id, details) VALUES (?, 'DELETE_USER', ?, 'Deleted user')`)
        .run(req.user.id, id);

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // SUPPLIER MANAGEMENT
  app.get('/api/suppliers', (req, res) => {
    try {
      const suppliers = db.prepare('SELECT * FROM suppliers').all();
      res.json({ success: true, data: suppliers });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/suppliers', authenticateToken, requireAdmin, (req, res) => {
    const { name, contact, phone } = req.body;
    try {
      const result = db.prepare(`INSERT INTO suppliers (name, contact, phone) VALUES (?, ?, ?)`).run(name, contact, phone || null);
      res.json({ success: true, message: 'Supplier added', id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/suppliers/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, contact, phone } = req.body;
    try {
      db.prepare(`UPDATE suppliers SET name = ?, contact = ?, phone = ? WHERE id = ?`).run(name, contact, phone || null, id);
      res.json({ success: true, message: 'Supplier updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/suppliers/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    try {
      db.prepare(`DELETE FROM suppliers WHERE id = ?`).run(id);
      res.json({ success: true, message: 'Supplier deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Supplier Returns
  app.get('/api/supplier-returns', (req, res) => {
    try {
      const returns = db.prepare(`
        SELECT sr.*, s.name as supplier_name
        FROM supplier_returns sr
        JOIN suppliers s ON sr.supplier_id = s.id
        ORDER BY sr.created_at DESC
      `).all();
      res.json({ success: true, data: returns });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Supplier Return by ID
  app.get('/api/supplier-returns/:id', (req, res) => {
    const { id } = req.params;
    try {
      const returnData = db.prepare(`
        SELECT sr.*, s.name as supplier_name
        FROM supplier_returns sr
        JOIN suppliers s ON sr.supplier_id = s.id
        WHERE sr.id = ?
      `).get(id);
      
      if (!returnData) return res.status(404).json({ success: false, message: 'Return not found' });
      
      const items = db.prepare(`
        SELECT sri.*, p.name as product_name, p.barcode
        FROM supplier_return_items sri
        JOIN products p ON sri.product_id = p.id
        WHERE sri.return_id = ?
      `).all(id);
      
      res.json({ success: true, data: { ...(returnData as any), items } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update Supplier Return
  app.put('/api/supplier-returns/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { total_amount, items, notes, document_reference } = req.body;
    try {
      db.transaction(() => {
        db.prepare('UPDATE supplier_returns SET total_amount = ?, notes = ?, document_reference = ? WHERE id = ?')
          .run(total_amount, notes, document_reference, id);
        
        // Delete old items and insert new ones
        db.prepare('DELETE FROM supplier_return_items WHERE return_id = ?').run(id);                
        const insertItem = db.prepare(`INSERT INTO supplier_return_items (return_id, product_id, quantity, unit_cost, total_cost, reason) 
                                       VALUES (?, ?, ?, ?, ?, ?)`);
        for (const item of items) {
            insertItem.run(id, item.product_id, item.quantity, item.unit_cost, item.total_cost, item.reason);
        }
      })();
      res.json({ success: true, message: 'Supplier return updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete Supplier Return
  app.delete('/api/supplier-returns/:id', authenticateToken, (req: any, res) => {
     const { id } = req.params;
     const reason = req.query.reason as string || 'Manual deletion';
     
     console.log(`[DELETE] Request to delete return ${id} by user ${req.user.id}. Reason: ${reason}`);
    
    try {
      const result = db.transaction(() => {
        const check = db.prepare('SELECT id FROM supplier_returns WHERE id = ?').get(id);
        if (!check) {
          throw new Error(`Return with ID ${id} not found`);
        }
        
        // 1. Delete items first (relational safety)
        const itemsDeleted = db.prepare('DELETE FROM supplier_return_items WHERE return_id = ?').run(id);
        console.log(`  - Deleted ${itemsDeleted.changes} items for return ${id}`);
        
        // 2. Delete the return itself
        const returnDeleted = db.prepare('DELETE FROM supplier_returns WHERE id = ?').run(id);
        console.log(`  - Deletion status for return ${id}: ${returnDeleted.changes} rows affected`);
        
        // 3. Log the deletion
        db.prepare('INSERT INTO deleted_returns_logs (return_id, deleted_by, reason) VALUES (?, ?, ?)')
          .run(id, req.user.id, reason || 'Manual deletion');
          
        return returnDeleted.changes > 0;
      })();

      if (result) {
        res.json({ success: true, message: 'Supplier return deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Return not found or already deleted' });
      }
    } catch (error: any) {
      console.error('[DELETE] Failed to delete supplier return:', error.message);
      res.status(500).json({ success: false, message: error.message || 'Server error during deletion' });
    }
  });
  // Create supplier return
  app.post('/api/supplier-returns', (req, res) => {
    const { supplier_id, return_type, notes, items, document_reference } = req.body;
    try {
      const insertReturn = db.prepare(`INSERT INTO supplier_returns (supplier_id, total_amount, return_type, notes, document_reference) VALUES (?, ?, ?, ?, ?)`);
      const insertItem = db.prepare(`INSERT INTO supplier_return_items (return_id, product_id, quantity, unit_cost, total_cost, reason) VALUES (?, ?, ?, ?, ?, ?)`);
      const updateStock = db.prepare(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?`);
      const logMovement = db.prepare(`INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'OUT', 'RETURN_TO_SUPPLIER', ?)`);
      const updateSupplierBalance = db.prepare(`UPDATE suppliers SET balance = balance - ? WHERE id = ?`);

      let total_amount = 0;
      for (const item of items) {
        total_amount += item.quantity * item.unit_cost;
      }

      db.transaction(() => {
        const returnResult = insertReturn.run(supplier_id, total_amount, return_type, notes, document_reference);
        const returnId = returnResult.lastInsertRowid;

        for (const item of items) {
          const resStock = updateStock.run(item.quantity, item.product_id, item.quantity);
          if (resStock.changes === 0) {
            throw new Error(`Not enough stock for product ID ${item.product_id}`);
          }

          insertItem.run(returnId, item.product_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost, item.reason);
          logMovement.run(item.product_id, item.quantity, returnId);
        }

        if (supplier_id) {
          updateSupplierBalance.run(total_amount, supplier_id);
        }
      })();

      res.json({ success: true, message: 'Return processed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Generate Barcode Image
  app.get('/api/barcode/:text', (req, res) => {
    const { text } = req.params;
    bwipjs.toBuffer({
      bcid: 'code128',       // Barcode type
      text: text,            // Text to encode
      scale: 3,              // 3x scaling factor
      height: 10,            // Bar height, in millimeters
      includetext: true,     // Show human-readable text
      textxalign: 'center',  // Always good to set this
    }, function (err, png) {
      if (err) {
        res.status(500).send(err instanceof Error ? err.message : String(err));
      } else {
        res.set('Content-Type', 'image/png');
        res.send(png);
      }
    });
  });

  // Get product by barcode
  app.get('/api/products/barcode/:code', (req, res) => {
    const { code } = req.params;
    try {
      const product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(code);
      if (product) {
        res.json({ success: true, data: product });
      } else {
        res.status(404).json({ success: false, message: 'Product not found' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  });

  // Get all products
  app.get('/api/products', (req, res) => {
    try {
      const products = db.prepare(`
        SELECT p.*, s.name as supplier_name, c.name as category_name, b.name as brand_name, u.name as unit_name
        FROM products p 
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN units u ON p.unit_id = u.id
      `).all();
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  });

  app.post('/api/products', authenticateToken, requireAdmin, (req, res) => {
    const { name, barcode, category_id, brand_id, unit_id, purchase_price, selling_price, stock_quantity, supplier_id, expiry_enabled, expiry_date } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO products (name, barcode, category_id, brand_id, unit_id, purchase_price, selling_price, stock_quantity, supplier_id, expiry_enabled, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, barcode, category_id || null, brand_id || null, unit_id || null, purchase_price, selling_price, stock_quantity, supplier_id || null, expiry_enabled ? 1 : 0, expiry_date || null);
      
      res.json({ success: true, message: 'Product created', id: result.lastInsertRowid });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed: products.barcode')) {
        return res.status(400).json({ success: false, message: 'Barcode already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, barcode, category_id, brand_id, unit_id, purchase_price, selling_price, stock_quantity, supplier_id, expiry_enabled, expiry_date } = req.body;
    try {
      db.prepare(`
        UPDATE products 
        SET name = ?, barcode = ?, category_id = ?, brand_id = ?, unit_id = ?, purchase_price = ?, selling_price = ?, stock_quantity = ?, supplier_id = ?, expiry_enabled = ?, expiry_date = ?
        WHERE id = ?
      `).run(name, barcode, category_id || null, brand_id || null, unit_id || null, purchase_price, selling_price, stock_quantity, supplier_id || null, expiry_enabled ? 1 : 0, expiry_date || null, id);
      
      res.json({ success: true, message: 'Product updated' });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed: products.barcode')) {
        return res.status(400).json({ success: false, message: 'Barcode already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/products/:id/batches', authenticateToken, (req, res) => {
    try {
      const batches = db.prepare(`
        SELECT * FROM stock_batches 
        WHERE product_id = ? 
        ORDER BY expiry_date ASC, id ASC
      `).all(req.params.id);
      res.json({ success: true, data: batches });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/expiry-alerts', authenticateToken, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const expiringSoon = db.prepare(`
        SELECT sb.*, p.name as product_name, p.barcode 
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE sb.expiry_date BETWEEN ? AND ? AND sb.quantity > 0
      `).all(today, sevenDaysLater);

      const expired = db.prepare(`
        SELECT sb.*, p.name as product_name, p.barcode 
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE sb.expiry_date < ? AND sb.quantity > 0
      `).all(today);

      res.json({ success: true, expiringSoon, expired });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- MASTER DATA ---

  // Units
  app.get('/api/units', (req, res) => {
    try {
      const units = db.prepare('SELECT * FROM units').all();
      res.json({ success: true, data: units });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/units', authenticateToken, requireAdmin, (req, res) => {
    const { name, short_name, status } = req.body;
    try {
      const result = db.prepare('INSERT INTO units (name, short_name, status) VALUES (?, ?, ?)').run(name, short_name, status || 'active');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/units/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, short_name, status } = req.body;
    try {
      db.prepare('UPDATE units SET name = ?, short_name = ?, status = ? WHERE id = ?').run(name, short_name, status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Brands
  app.get('/api/brands', (req, res) => {
    try {
      const brands = db.prepare('SELECT * FROM brands').all();
      res.json({ success: true, data: brands });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/brands', authenticateToken, requireAdmin, (req, res) => {
    const { name, description, status } = req.body;
    try {
      const result = db.prepare('INSERT INTO brands (name, description, status) VALUES (?, ?, ?)').run(name, description, status || 'active');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/brands/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, description, status } = req.body;
    try {
      db.prepare('UPDATE brands SET name = ?, description = ?, status = ? WHERE id = ?').run(name, description, status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Categories
  app.get('/api/categories', (req, res) => {
    try {
      const categories = db.prepare('SELECT * FROM categories').all();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/categories', authenticateToken, requireAdmin, (req, res) => {
    const { name, parent_id, status } = req.body;
    try {
      const result = db.prepare('INSERT INTO categories (name, parent_id, status) VALUES (?, ?, ?)').run(name, parent_id || null, status || 'active');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, parent_id, status } = req.body;
    try {
      db.prepare('UPDATE categories SET name = ?, parent_id = ?, status = ? WHERE id = ?').run(name, parent_id || null, status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Currencies
  app.get('/api/currencies', (req, res) => {
    try {
      const currencies = db.prepare('SELECT * FROM currencies').all();
      res.json({ success: true, data: currencies });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/currencies', authenticateToken, requireAdmin, (req, res) => {
    const { code, name, rate, symbol, is_base, status } = req.body;
    try {
      // If is_base is true, unset other base currencies first
      if (is_base) {
        db.prepare('UPDATE currencies SET is_base = 0').run();
      }
      const result = db.prepare('INSERT INTO currencies (code, name, rate, symbol, is_base, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run(code, name, rate || 1.0, symbol, is_base ? 1 : 0, status || 'active');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/currencies/:id', authenticateToken, requireAdmin, (req, res) => {
    const { code, name, rate, symbol, is_base, status } = req.body;
    try {
      if (is_base) {
        db.prepare('UPDATE currencies SET is_base = 0').run();
      }
      db.prepare('UPDATE currencies SET code = ?, name = ?, rate = ?, symbol = ?, is_base = ?, status = ? WHERE id = ?')
        .run(code, name, rate, symbol, is_base ? 1 : 0, status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Stock Batches & Expiry
  app.post('/api/stock-batches', authenticateToken, requireAdmin, (req, res) => {
    const { product_id, batch_number, expiry_date, quantity, received_date, purchase_invoice_id } = req.body;
    try {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO stock_batches (product_id, batch_number, expiry_date, quantity, received_date, purchase_invoice_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(product_id, batch_number, expiry_date, quantity, received_date || new Date().toISOString().split('T')[0], purchase_invoice_id || null);

        // Update product overall stock
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(quantity, product_id);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/expiry-alerts', authenticateToken, requireAdmin, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const expiringSoon = db.prepare(`
        SELECT sb.*, p.name as product_name, p.barcode
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE sb.expiry_date >= ? AND sb.expiry_date <= ? AND sb.quantity > 0
      `).all(today, nextWeekStr);

      const expired = db.prepare(`
        SELECT sb.*, p.name as product_name, p.barcode
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        WHERE sb.expiry_date < ? AND sb.quantity > 0
      `).all(today);

      res.json({ success: true, expiringSoon, expired });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    try {
      db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
      res.json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // CUSTOMER MANAGEMENT
  app.post('/api/customers/bulk', authenticateToken, requireAdmin, (req, res) => {
    const { customers } = req.body;
    if (!Array.isArray(customers)) {
      return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of customers.' });
    }

    try {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO customers (rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((custs) => {
        for (const c of custs) {
          insert.run(
            c.rfid_card || null,
            c.name,
            c.phone || null,
            Number(c.credit_limit || 0),
            Number(c.daily_limit || 0),
            Number(c.monthly_limit || 0),
            c.auto_sale_cfg ? 1 : 0,
            c.working_place || null,
            c.emp_id || null,
            c.passport_no || null,
            c.auto_burn ? 1 : 0,
            c.auto_burn_start_date || null,
            c.auto_burn_stop_date || null
          );
        }
      });

      transaction(customers);
      res.json({ success: true, message: `${customers.length} customers imported successfully.` });
    } catch (error: any) {
      console.error('Bulk import error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/customers', authenticateToken, (req, res) => {
    try {
      const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
      res.json({ success: true, data: customers });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/customers', authenticateToken, requireAdmin, (req, res) => {
    console.log('API POST /api/customers - req.body:', JSON.stringify(req.body));
    const { rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO customers (rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(rfid_card || null, name, phone, credit_limit || 0, daily_limit || 0, monthly_limit || 0, auto_sale_cfg ? 1 : 0, working_place, emp_id, passport_no, auto_burn ? 1 : 0, auto_burn_start_date || null, auto_burn_stop_date || null);
      console.log('API POST /api/customers - success, customer added, id:', result.lastInsertRowid);
      res.json({ success: true, message: 'Customer added', id: result.lastInsertRowid });
    } catch (error: any) {
      console.error('API POST /api/customers - error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/customers/:id', authenticateToken, requireAdmin, (req, res) => {
    console.log('API PUT /api/customers/:id - req.body:', JSON.stringify(req.body));
    const { id } = req.params;
    const { rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, status, credit_status, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date } = req.body;
    try {
      const result = db.prepare(`
        UPDATE customers SET rfid_card = ?, name = ?, phone = ?, credit_limit = ?, daily_limit = ?, monthly_limit = ?, status = ?, credit_status = ?, auto_sale_cfg = ?, working_place = ?, emp_id = ?, passport_no = ?, auto_burn = ?, auto_burn_start_date = ?, auto_burn_stop_date = ?
        WHERE id = ?
      `).run(rfid_card || null, name, phone, credit_limit || 0, daily_limit || 0, monthly_limit || 0, status, credit_status, auto_sale_cfg ? 1 : 0, working_place, emp_id, passport_no, auto_burn ? 1 : 0, auto_burn_start_date || null, auto_burn_stop_date || null, id);
      console.log('API PUT /api/customers/:id - success, customer updated, id:', id);
      res.json({ success: true, message: 'Customer updated' });
    } catch (error: any) {
      console.error('API PUT /api/customers/:id - error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/customers/:id', authenticateToken, requireAdmin, (req: any, res) => {
    console.log('API DELETE /api/customers/:id - id:', req.params.id, 'user:', req.user);
    const { id } = req.params;
    try {
      const result = db.prepare(`DELETE FROM customers WHERE id = ?`).run(parseInt(id, 10));
      console.log('API DELETE /api/customers/:id - result:', result, 'id:', id);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      res.json({ success: true, message: 'Customer deleted' });
    } catch (error: any) {
      console.error('API DELETE /api/customers/:id - error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/customers/:id/credit-logs', authenticateToken, (req, res) => {
    const { id } = req.params;
    try {
      const logs = db.prepare('SELECT * FROM credit_logs WHERE customer_id = ? ORDER BY created_at DESC').all(id);
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/customers/:id/payment', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    const { amount, notes } = req.body;
    try {
      db.transaction(() => {
        const customer = db.prepare('SELECT credit_limit, current_balance FROM customers WHERE id = ?').get(id) as any;
        if (!customer) throw new Error('Customer not found');

        // Update balance
        db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(amount, id);
        
        // Dynamic Limit Increase Logic
        const multiplierSetting = db.prepare("SELECT value FROM settings WHERE key = 'credit_increase_multiplier'").get() as any;
        const multiplier = parseFloat(multiplierSetting?.value || '1.0');
        const increaseAmount = amount * multiplier;
        const newLimit = customer.credit_limit + increaseAmount;

        db.prepare('UPDATE customers SET credit_limit = ? WHERE id = ?').run(newLimit, id);
        
        // Logs
        db.prepare(`INSERT INTO credit_logs (customer_id, amount, type, notes) VALUES (?, ?, 'PAYMENT', ?)`).run(id, amount, notes || 'Manual Payment');
        db.prepare(`INSERT INTO credit_limit_history (customer_id, old_limit, new_limit, reason) VALUES (?, ?, ?, ?)`)
          .run(id, customer.credit_limit, newLimit, `Automatic increase from payment of RM${amount}`);
      })();
      res.json({ success: true, message: 'Payment recorded and limit increased' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Credit Status/Limit Management APIs
  app.post('/api/admin/customers/:id/credit-status', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    const { new_status, reason } = req.body;
    try {
      db.transaction(() => {
        const customer = db.prepare('SELECT credit_status FROM customers WHERE id = ?').get(id) as any;
        if (!customer) throw new Error('Customer not found');

        db.prepare('UPDATE customers SET credit_status = ? WHERE id = ?').run(new_status, id);
        db.prepare(`INSERT INTO credit_status_logs (customer_id, previous_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)`)
          .run(id, customer.credit_status, new_status, req.user.id, reason || 'Admin update');
      })();
      res.json({ success: true, message: `Status updated to ${new_status}` });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/customers/:id/update-limit', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { new_limit, reason } = req.body;
    try {
      db.transaction(() => {
        const customer = db.prepare('SELECT credit_limit FROM customers WHERE id = ?').get(id) as any;
        if (!customer) throw new Error('Customer not found');

        db.prepare('UPDATE customers SET credit_limit = ? WHERE id = ?').run(new_limit, id);
        db.prepare(`INSERT INTO credit_limit_history (customer_id, old_limit, new_limit, reason) VALUES (?, ?, ?, ?)`)
          .run(id, customer.credit_limit, new_limit, reason || 'Manual update');
      })();
      res.json({ success: true, message: 'Credit limit updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/customers/:id/limit-history', authenticateToken, requireAdmin, (req, res) => {
    try {
      const history = db.prepare('SELECT * FROM credit_limit_history WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
      res.json({ success: true, data: history });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/customers/:id/status-logs', authenticateToken, requireAdmin, (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT cl.*, u.username as changed_by_user 
        FROM credit_status_logs cl
        LEFT JOIN users u ON cl.changed_by = u.id
        WHERE cl.customer_id = ? 
        ORDER BY cl.created_at DESC
      `).all(req.params.id);
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/credit-settings', authenticateToken, requireAdmin, (req, res) => {
    try {
      const multiplier = db.prepare("SELECT value FROM settings WHERE key = 'credit_increase_multiplier'").get() as any;
      res.json({ success: true, multiplier: multiplier?.value || '1.0' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/settings/returns', authenticateToken, (req, res) => {
    try {
      const validityDays = db.prepare("SELECT value FROM settings WHERE key = 'return_validity_days'").get() as any;
      const allowCash = db.prepare("SELECT value FROM settings WHERE key = 'return_allow_cash'").get() as any;
      
      res.json({ 
        success: true, 
        data: {
          validityDays: parseInt(validityDays?.value || '3'),
          allowCash: allowCash?.value !== 'false' // default true
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/settings/returns', authenticateToken, requireAdmin, (req, res) => {
    const { validityDays, allowCash } = req.body;
    try {
      db.transaction(() => {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('return_validity_days', ?)").run(validityDays?.toString() || '3');
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('return_allow_cash', ?)").run(allowCash?.toString() || 'true');
      })();
      res.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Store Profile Settings
  app.get('/api/settings/store', authenticateToken, (req, res) => {
    try {
      const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('shop_name', 'company_name', 'registration_number', 'address', 'phone_number')").all() as any[];
      const data: any = {};
      settings.forEach(s => data[s.key] = s.value);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/settings/store', authenticateToken, requireAdmin, (req, res) => {
    const { shop_name, company_name, registration_number, address, phone_number } = req.body;
    try {
      db.transaction(() => {
        if (shop_name) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('shop_name', ?)").run(shop_name);
        if (company_name) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('company_name', ?)").run(company_name);
        if (registration_number) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('registration_number', ?)").run(registration_number);
        if (address) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('address', ?)").run(address);
        if (phone_number) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('phone_number', ?)").run(phone_number);
      })();
      res.json({ success: true, message: 'Store profile updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/credit-settings', authenticateToken, requireAdmin, (req, res) => {
    const { multiplier } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('credit_increase_multiplier', ?)").run(multiplier.toString());
      res.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // RFID AUTO-SALE & CREDIT ENGINE
  app.post('/api/rfid/scan', async (req, res) => {
    const { rfid_card } = req.body;
    const now = new Date();
    
    try {
      // 1. Fetch Customer (Optimized lookup)
      const customer = db.prepare('SELECT * FROM customers WHERE rfid_card = ?').get(rfid_card) as any;
      
      if (!customer) {
        db.prepare('INSERT INTO rfid_scans (rfid_card, status, reason) VALUES (?, "FAILED", "Customer not found")').run(rfid_card);
        return res.status(404).json({ success: false, message: 'Card not registered' });
      }

      if (customer.status !== 'active' || customer.credit_status !== 'ACTIVE') {
        const reason = customer.credit_status !== 'ACTIVE' ? `Credit ${customer.credit_status}` : "Account suspended";
        db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "FAILED", ?)').run(rfid_card, customer.name, reason);
        return res.status(403).json({ success: false, message: reason });
      }

      // 2. Anti-Duplicate Check (5 seconds)
      if (customer.last_scan_at) {
        const lastScan = new Date(customer.last_scan_at);
        if (now.getTime() - lastScan.getTime() < 5000) {
          db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "DUPLICATE", "Duplicate scan detected")').run(rfid_card, customer.name);
          return res.status(429).json({ success: false, message: 'Duplicate scan. Please wait 5 seconds.' });
        }
      }

      // 3. Get Auto-Sale Configuration
      const config = db.prepare('SELECT * FROM auto_sales_config WHERE is_active = 1 LIMIT 1').get() as any;
      if (!config) {
         db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "FAILED", "No active auto-sale config")').run(rfid_card, customer.name);
         return res.status(400).json({ success: false, message: 'Auto-sale feature is currently disabled' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(config.product_id) as any;
      if (!product || product.stock_quantity <= 0) {
        db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "FAILED", "Out of stock")').run(rfid_card, customer.name);
        return res.status(400).json({ success: false, message: 'Out of stock' });
      }

      // 4. Verify Credit
      const dailyRemaining = customer.daily_limit - customer.daily_used;
      const monthlyRemaining = customer.monthly_limit - customer.monthly_used;

      if (dailyRemaining < product.selling_price) {
        db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "INSUFFICIENT_CREDIT", "Daily limit reached")').run(rfid_card, customer.name);
        return res.status(403).json({ success: false, message: 'Daily limit reached' });
      }

      if (monthlyRemaining < product.selling_price) {
        db.prepare('INSERT INTO rfid_scans (rfid_card, customer_name, status, reason) VALUES (?, ?, "INSUFFICIENT_CREDIT", "Monthly limit reached")').run(rfid_card, customer.name);
        return res.status(403).json({ success: false, message: 'Monthly limit reached' });
      }

      // 5. Execute Auto-Sale (Transaction)
      db.transaction(() => {
        // Update Customer Usage
        db.prepare(`
          UPDATE customers 
          SET daily_used = daily_used + ?, 
              monthly_used = monthly_used + ?,
              current_balance = current_balance + ?,
              last_scan_at = ?
          WHERE id = ?
        `).run(product.selling_price, product.selling_price, product.selling_price, now.toISOString(), customer.id);

        // Create Sale
        const saleResult = db.prepare(`
          INSERT INTO sales (total_amount, discount_amount, payment_method, status) 
          VALUES (?, 0, 'CREDIT', 'completed')
        `).run(product.selling_price);
        const saleId = saleResult.lastInsertRowid;

        // Create Sale Item
        db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES (?, ?, 1, ?, ?)
        `).run(saleId, product.id, product.selling_price, product.selling_price);

        // Deduct Stock
        db.prepare('UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = ?').run(product.id);

        // Log Scan
        db.prepare(`
          INSERT INTO rfid_scans (rfid_card, customer_name, status, reason)
          VALUES (?, ?, "SUCCESS", ?)
        `).run(rfid_card, customer.name, `Auto-sale for ${product.name}`);

        // Credit Log
        db.prepare(`
          INSERT INTO credit_logs (customer_id, amount, type, reference_id, notes)
          VALUES (?, ?, 'CHARGE', ?, ?)
        `).run(customer.id, product.selling_price, saleId, `Auto-sale: ${product.name}`);
      })();

      res.json({ 
        success: true, 
        message: 'Sale Successful', 
        customer: customer.name,
        product: product.name,
        amount: product.selling_price,
        daily_remaining: (dailyRemaining - product.selling_price).toFixed(2),
        monthly_remaining: (monthlyRemaining - product.selling_price).toFixed(2)
      });

    } catch (error: any) {
      console.error('RFID Scan Error:', error);
      res.status(500).json({ success: false, message: 'Internal engine error' });
    }
  });

  // Credit Reset Background Jobs
  const checkCreditResets = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = today.substring(0, 7);

    try {
      // 1. Daily Burn, Reset & Summary
      const lastResetDate = db.prepare("SELECT value FROM settings WHERE key = 'last_daily_reset'").get() as any;
      if (!lastResetDate || lastResetDate.value !== today) {
        console.log('Running daily credit reset and summary logic...');
        const yesterday = lastResetDate ? lastResetDate.value : null;

        db.transaction(() => {
          // If we have a record of "yesterday", summarize it
          if (yesterday) {
            const realSales = db.prepare(`
              SELECT sum(total_amount) as total FROM sales 
              WHERE date(created_at) = ? AND payment_method IN ('CASH', 'CREDIT') AND status = 'completed'
            `).get(yesterday) as any;
            
            const creditSales = db.prepare(`
              SELECT sum(total_amount) as total FROM sales 
              WHERE date(created_at) = ? AND payment_method = 'CREDIT' AND status = 'completed'
            `).get(yesterday) as any;

            const autoBurnSales = db.prepare(`
              SELECT sum(total_amount) as total FROM sales 
              WHERE date(created_at) = ? AND payment_method = 'AUTO_BURN' AND status = 'completed'
            `).get(yesterday) as any;

            const onlineSales = db.prepare(`
              SELECT sum(total_amount) as total FROM sales 
              WHERE date(created_at) = ? AND payment_method = 'ONLINE' AND status = 'completed'
            `).get(yesterday) as any;

            db.prepare(`
              INSERT OR REPLACE INTO sales_summary_logs (date, total_real_sales, total_credit_sales, total_auto_burn_sales, total_online_sales)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              yesterday, 
              realSales?.total || 0, 
              creditSales?.total || 0, 
              autoBurnSales?.total || 0, 
              onlineSales?.total || 0
            );
          }

          // Process AUTO_BURN for active customers
          const customersWithUnused = db.prepare('SELECT id, name, daily_limit, daily_used FROM customers WHERE daily_used < daily_limit AND credit_status = "ACTIVE"').all() as any[];
          for (const c of customersWithUnused) {
            const burned = c.daily_limit - c.daily_used;
            if (burned > 0) {
              // 1. Record in auto_burn_sales (Specific table as per instructions)
              db.prepare('INSERT INTO auto_burn_sales (customer_id, amount, status) VALUES (?, ?, "SYSTEM_GENERATED")').run(c.id, burned);
              
              // 2. Insert into sales ledger as a credit sale
              const saleResult = db.prepare(`
                INSERT INTO sales (total_amount, discount_amount, payment_method, customer_id, status) 
                VALUES (?, 0, 'AUTO_BURN', ?, 'completed')
              `).run(burned, c.id);
              
              const saleId = saleResult.lastInsertRowid;

              // 3. Optional: Add a credit log for traceability
              db.prepare(`
                INSERT INTO credit_logs (customer_id, amount, type, reference_id, notes) 
                VALUES (?, ?, 'DAILY_BURN', ?, ?)
              `).run(c.id, burned, saleId, 'Daily credit expired - converted to AUTO_BURN sale');
              
              // 4. Burn logs (existing table for backward compatibility if needed, but user wants traceability)
              db.prepare('INSERT INTO daily_credit_logs (customer_id, burned_amount, date) VALUES (?, ?, ?)').run(c.id, burned, yesterday || today);
            }
          }
          
          // Reset daily_used for all ACTIVE customers
          db.prepare('UPDATE customers SET daily_used = 0 WHERE credit_status = "ACTIVE"').run();
          
          // Update setting
          if (!lastResetDate) {
            db.prepare("INSERT INTO settings (key, value) VALUES ('last_daily_reset', ?)").run(today);
          } else {
            db.prepare("UPDATE settings SET value = ? WHERE key = 'last_daily_reset'").run(today);
          }
        })();
      }

      // 2. Monthly Reset
      const lastMonthlyReset = db.prepare("SELECT value FROM settings WHERE key = 'last_monthly_reset'").get() as any;
      if (!lastMonthlyReset || lastMonthlyReset.value !== month) {
         console.log('Running monthly credit reset...');
         db.transaction(() => {
            // Log monthly usage before reset
            const monthlyUsage = db.prepare('SELECT id, monthly_used FROM customers WHERE monthly_used > 0 AND credit_status = "ACTIVE"').all() as any[];
            for (const c of monthlyUsage) {
               db.prepare('INSERT INTO monthly_credit_logs (customer_id, usage_amount, month) VALUES (?, ?, ?)').run(c.id, c.monthly_used, month);
            }
            
            db.prepare('UPDATE customers SET monthly_used = 0 WHERE credit_status = "ACTIVE"').run();
            
            if (!lastMonthlyReset) {
              db.prepare("INSERT INTO settings (key, value) VALUES ('last_monthly_reset', ?)").run(month);
            } else {
              db.prepare("UPDATE settings SET value = ? WHERE key = 'last_monthly_reset'").run(month);
            }
         })();
      }
    } catch (error) {
      console.error('Credit reset error:', error);
    }
  };

  // Run initial check and then every hour
  checkCreditResets();
  setInterval(checkCreditResets, 1000 * 60 * 60);

  // Auto-sale Configuration
  app.get('/api/admin/auto-sale-config', authenticateToken, requireAdmin, (req, res) => {
    try {
      const config = db.prepare('SELECT * FROM auto_sales_config').all();
      res.json({ success: true, data: config });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/auto-sale-config', authenticateToken, requireAdmin, (req, res) => {
    const { name, product_id, is_active } = req.body;
    try {
      db.transaction(() => {
        if (is_active) {
          db.prepare('UPDATE auto_sales_config SET is_active = 0').run();
        }
        db.prepare('INSERT INTO auto_sales_config (name, product_id, is_active) VALUES (?, ?, ?)').run(name, product_id, is_active ? 1 : 0);
      })();
      res.json({ success: true, message: 'Config added' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/auto-sale-config/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, product_id, is_active } = req.body;
    try {
      db.transaction(() => {
        if (is_active) {
          db.prepare('UPDATE auto_sales_config SET is_active = 0').run();
        }
        db.prepare('UPDATE auto_sales_config SET name = ?, product_id = ?, is_active = ? WHERE id = ?')
          .run(name, product_id, is_active ? 1 : 0, id);
      })();
      res.json({ success: true, message: 'Config updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // RFID Scan Audit Logs
  app.get('/api/admin/rfid-logs', authenticateToken, requireAdmin, (req, res) => {
     try {
       const logs = db.prepare('SELECT * FROM rfid_scans ORDER BY created_at DESC LIMIT 500').all();
       res.json({ success: true, data: logs });
     } catch (error: any) {
       res.status(500).json({ success: false, message: error.message });
     }
  });

  // Deleted Returns Logs
  app.get('/api/admin/deleted-returns-logs', authenticateToken, requireAdmin, (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT dl.*, u.username as deleted_by_user 
        FROM deleted_returns_logs dl
        LEFT JOIN users u ON dl.deleted_by = u.id
        ORDER BY dl.created_at DESC
      `).all();
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  // POS Daily Summary
  app.get('/api/pos/daily-summary', authenticateToken, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Category Breakdown for Today
      const categorySales = db.prepare(`
        SELECT 
          coalesce(c.name, 'UNCATEGORIZED') as category_name,
          p.name as product_name,
          p.barcode,
          sum(si.quantity) as qty,
          sum(si.subtotal) as total
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE date(s.created_at) = ? AND s.status = 'completed' AND s.payment_method != 'AUTO_BURN'
        GROUP BY c.id, p.id
        ORDER BY c.name, p.name
      `).all(today) as any[];

      // 2. Summary Totals
      const summary = db.prepare(`
        SELECT 
          sum(total_amount) as grand_total,
          sum(CASE WHEN payment_method = 'CREDIT' THEN total_amount ELSE 0 END) as total_credit,
          sum(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END) as total_cash,
          sum(CASE WHEN payment_method = 'ONLINE' THEN total_amount ELSE 0 END) as total_online,
          sum(CASE WHEN payment_method = 'AUTO_BURN' THEN total_amount ELSE 0 END) as total_auto_burn
        FROM sales
        WHERE date(created_at) = ? AND status = 'completed'
      `).get(today) as any;

      res.json({
        success: true,
        date: today,
        data: categorySales,
        summary: {
          grandTotal: summary?.grand_total || 0,
          totalCredit: summary?.total_credit || 0,
          totalCash: summary?.total_cash || 0,
          totalOnline: summary?.total_online || 0,
          totalAutoBurn: summary?.total_auto_burn || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get all sales
  app.get('/api/sales', authenticateToken, (req, res) => {
    try {
      const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
      res.json({ success: true, data: sales });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create sale
  app.post('/api/sales', (req, res) => {
    const { items, payment_method, discount_amount, customer_id } = req.body;
    try {
      let total_amount = 0;
      for (const item of items) {
        total_amount += item.selling_price * (item.cart_quantity || item.quantity);
      }
      total_amount = Math.max(0, total_amount - (discount_amount || 0));

      const insertSale = db.prepare(`INSERT INTO sales (total_amount, discount_amount, payment_method, customer_id, status) VALUES (?, ?, ?, ?, 'completed')`);
      const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`);
      const updateStock = db.prepare(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`);
      const logMovement = db.prepare(`INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'OUT', 'SALE', ?)`);

      let saleId: number = 0;
      db.transaction(() => {
        // 1. Validate Expiry
        for (const item of items) {
          const prod = db.prepare('SELECT expiry_enabled FROM products WHERE id = ?').get(item.id || item.product_id) as any;
          if (prod.expiry_enabled) {
            // Check if any expired batch exists that might be sold
            const today = new Date().toISOString().split('T')[0];
            const expiredInStock = db.prepare(`
              SELECT SUM(quantity) as expired_qty FROM stock_batches 
              WHERE product_id = ? AND expiry_date < ? AND quantity > 0
            `).get(item.id || item.product_id, today) as any;

            const totalInStock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.id || item.product_id) as any;
            
            // If the requested quantity exceeds the non-expired stock, block it
            const nonExpiredStock = (totalInStock.stock_quantity || 0) - (expiredInStock.expired_qty || 0);
            const requestedQty = item.cart_quantity || item.quantity;
            
            if (nonExpiredStock < requestedQty) {
              throw new Error(`Insufficient non-expired stock for ${item.name}. (Available: ${nonExpiredStock})`);
            }
          }
        }

        // 2. If Credit, validate customer and limits
        if (payment_method === 'CREDIT') {
          if (!customer_id) throw new Error('Customer ID required for credit sale');
          
          const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) as any;
          if (!customer) throw new Error('Customer not found');
          if (customer.credit_status !== 'ACTIVE') throw new Error(`Credit account is ${customer.credit_status}`);

          // Check for credit allowed items
          for (const item of items) {
             const prod = db.prepare('SELECT is_credit_allowed FROM products WHERE id = ?').get(item.id || item.product_id) as any;
             if (!prod.is_credit_allowed) throw new Error(`Item ${item.name} is not allowed for credit purchase`);
          }

          const dailyRemaining = customer.daily_limit - customer.daily_used;
          const monthlyRemaining = customer.monthly_limit - customer.monthly_used;

          if (dailyRemaining < total_amount) throw new Error('Daily credit limit exceeded');
          if (monthlyRemaining < total_amount) throw new Error('Monthly credit limit exceeded');

          // Update usage
          db.prepare(`
            UPDATE customers 
            SET daily_used = daily_used + ?, 
                monthly_used = monthly_used + ?, 
                current_balance = current_balance + ? 
            WHERE id = ?
          `).run(total_amount, total_amount, total_amount, customer_id);

          db.prepare(`INSERT INTO credit_logs (customer_id, amount, type, notes) VALUES (?, ?, 'CHARGE', 'POS Credit Sale')`).run(customer_id, total_amount);
        }

        const saleResult = insertSale.run(total_amount, discount_amount || 0, payment_method, customer_id || null);
        saleId = saleResult.lastInsertRowid as number;

        for (const item of items) {
          const productId = item.id || item.product_id;
          const qty = item.cart_quantity || item.quantity;
          const price = item.selling_price || item.unit_price;
          const subtotal = price * qty;
          
          insertItem.run(saleId, productId, qty, price, subtotal);
          updateStock.run(qty, productId);
          logMovement.run(productId, qty, saleId);

          // FIFO Batch Deduction
          let remainingQtyToDeduct = qty;
          // Get non-expired batches first, then expired if we must (though we blocked above if non-expired is too low)
          const today = new Date().toISOString().split('T')[0];
          const batches = db.prepare(`
            SELECT * FROM stock_batches 
            WHERE product_id = ? AND quantity > 0 
            ORDER BY expiry_date ASC, id ASC
          `).all(productId) as any[];

          for (const batch of batches) {
            if (remainingQtyToDeduct <= 0) break;
            const deduct = Math.min(batch.quantity, remainingQtyToDeduct);
            db.prepare('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?').run(deduct, batch.id);
            remainingQtyToDeduct -= deduct;
          }
        }
      })();

      res.json({ success: true, message: 'Sale completed', saleId });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Get sale by ID
  app.get('/api/sales/:id', (req, res) => {
    const { id } = req.params;
    try {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as any;
      if (!sale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
      }

      const items = db.prepare(`
        SELECT si.*, p.name, p.barcode 
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(id) as any[];

      // Get return info
      const returnedItems = db.prepare(`
        SELECT product_id, sum(quantity) as returned_qty 
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        WHERE sr.sale_id = ?
        GROUP BY product_id
      `).all(id) as any[];

      const returnedMap = new Map();
      for (const r of returnedItems) {
        returnedMap.set(r.product_id, r.returned_qty);
      }

      const enhancedItems = items.map(item => ({
        ...item,
        returned_quantity: returnedMap.get(item.product_id) || 0
      }));

      res.json({ success: true, data: { ...sale, items: enhancedItems } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create Customer Return
  app.post('/api/sales-returns', (req, res) => {
    const { sale_id, refund_type, items } = req.body;
    try {
      let total_refund = 0;
      for (const item of items) {
        total_refund += item.refund_amount * item.quantity;
      }

      const insertReturn = db.prepare(`INSERT INTO sales_returns (sale_id, total_refund, refund_type) VALUES (?, ?, ?)`);
      const insertItem = db.prepare(`INSERT INTO sales_return_items (return_id, product_id, quantity, refund_amount) VALUES (?, ?, ?, ?)`);
      const updateStock = db.prepare(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`);
      const logMovement = db.prepare(`INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'IN', 'CUSTOMER_RETURN', ?)`);

      let returnId = 0;
      db.transaction(() => {
        const returnResult = insertReturn.run(sale_id, total_refund, refund_type);
        returnId = returnResult.lastInsertRowid as number;

        for (const item of items) {
          if (item.quantity > 0) {
            insertItem.run(returnId, item.product_id, item.quantity, item.refund_amount);
            updateStock.run(item.quantity, item.product_id);
            logMovement.run(item.product_id, item.quantity, returnId);
          }
        }
      })();

      res.json({ success: true, message: 'Return processed successfully', returnId, total_refund });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Price Check Endpoint
  app.get('/api/products/price-check/:barcode', (req, res) => {
    const { barcode } = req.params;
    try {
      const product = db.prepare('SELECT name, selling_price, stock_quantity, category FROM products WHERE barcode = ?').get(barcode);
      if (product) {
        res.json({ success: true, data: product });
      } else {
        res.status(404).json({ success: false, message: 'Product not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/products/search', authenticateToken, (req, res) => {
    try {
      const { q } = req.query;
      const products = db.prepare(`
        SELECT * FROM products 
        WHERE name LIKE ? OR barcode LIKE ? 
        LIMIT 10
      `).all(`%${q}%`, `%${q}%`);
      res.json({ success: true, data: products });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Void Logs
  app.get('/api/void-logs', authenticateToken, requireAdmin, (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT vl.*, 
               p.name as product_name, 
               p.barcode, 
               u.username as void_by_user,
               s.total_amount
        FROM void_logs vl
        LEFT JOIN products p ON vl.product_id = p.id
        LEFT JOIN users u ON vl.void_by = u.id
        LEFT JOIN sales s ON vl.sale_id = s.id
        ORDER BY vl.created_at DESC
      `).all();
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Void Sale/Item Endpoint
  app.post('/api/void', authenticateToken, (req: any, res) => {
    const { admin_username, admin_password, sale_id, items, reason, is_full_sale } = req.body;
    try {
      // 1. Verify admin/manager credentials if not already
      let adminId = req.user.id;
      if (req.user.role === 'CASHIER') {
        const adminUser = db.prepare('SELECT * FROM users WHERE username = ? AND status = "active"').get(admin_username) as any;
        if (!adminUser || !bcrypt.compareSync(admin_password, adminUser.password)) {
          return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
        if (adminUser.role !== 'ADMIN' && adminUser.role !== 'MANAGER') {
          return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        adminId = adminUser.id;
      }

      // 2. Process voids
      const insertVoid = db.prepare(`INSERT INTO void_logs (sale_id, product_id, quantity, reason, void_by) VALUES (?, ?, ?, ?, ?)`);
      const updateStock = db.prepare(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`);
      const logMovement = db.prepare(`INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'IN', 'VOID', ?)`);
      const updateSaleItem = db.prepare(`UPDATE sale_items SET quantity = quantity - ?, subtotal = subtotal - (unit_price * ?) WHERE sale_id = ? AND product_id = ?`);
      const updateSaleTotal = db.prepare(`UPDATE sales SET total_amount = (SELECT coalesce(sum(subtotal), 0) FROM sale_items WHERE sale_id = ?) WHERE id = ?`);
      
      db.transaction(() => {
        for (const item of items) {
          if (item.quantity > 0) {
            const voidResult = insertVoid.run(sale_id || null, item.product_id, item.quantity, reason || 'Void Item', adminId);
            if (sale_id) {
               updateStock.run(item.quantity, item.product_id);
               updateSaleItem.run(item.quantity, item.quantity, sale_id, item.product_id);
               // log stock movement
               logMovement.run(item.product_id, item.quantity, voidResult.lastInsertRowid);
            }
          }
        }
        
        if (sale_id) {
           updateSaleTotal.run(sale_id, sale_id);
           if (is_full_sale) {
             db.prepare(`UPDATE sales SET status = 'voided' WHERE id = ?`).run(sale_id);
           }
        }
      })();

      res.json({ success: true, message: 'Void successful' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Customer Returns
  app.get('/api/sales-returns', (req, res) => {
    try {
      const returns = db.prepare(`
        SELECT sr.id, sr.sale_id, sr.total_refund, sr.refund_type, sr.created_at,
          (SELECT count(sri.id) FROM sales_return_items sri WHERE sri.return_id = sr.id) as num_items,
          (SELECT sum(sri.quantity) FROM sales_return_items sri WHERE sri.return_id = sr.id) as sum_qty
        FROM sales_returns sr
        ORDER BY sr.created_at DESC
      `).all() as any[];

      // calculate aggregates
      const totalRefundValue = db.prepare(`SELECT sum(total_refund) as t FROM sales_returns`).get() as any;
      const counts = db.prepare(`SELECT refund_type, count(id) as c FROM sales_returns GROUP BY refund_type`).all() as any[];

      const summary = {
        totalValue: totalRefundValue?.t || 0,
        exchangeCount: counts.find(c => c.refund_type === 'EXCHANGE')?.c || 0,
        cashCount: counts.find(c => c.refund_type === 'CASH')?.c || 0,
        totalReturns: returns.length
      };

      res.json({ success: true, data: returns, summary });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update Return
  app.put('/api/sales-returns/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;
    try {
      db.prepare('UPDATE sales_returns SET payment_status = ? WHERE id = ?').run(payment_status, id);
      res.json({ success: true, message: 'Return updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete Return
  app.delete('/api/sales-returns/:id', authenticateToken, requireAdmin, (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      db.transaction(() => {
        db.prepare('DELETE FROM sales_returns WHERE id = ?').run(id);                
        db.prepare('DELETE FROM sales_return_items WHERE return_id = ?').run(id);
        db.prepare('INSERT INTO deleted_returns_logs (return_id, deleted_by, reason) VALUES (?, ?, ?)')
          .run(id, req.user.id, reason || 'Manual deletion');
      })();
      res.json({ success: true, message: 'Return deleted and logged' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Detailed Sales Report API
  app.get('/api/admin/detailed-sales-report', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { start_date, end_date, category_id } = req.query;
      let dateFilter = '';
      let dateParams: any[] = [];
      let categoryFilter = '';
      let categoryParams: any[] = [];

      if (start_date && end_date) {
        dateFilter = 'AND date(s.created_at) BETWEEN ? AND ?';
        dateParams = [start_date, end_date];
      }

      if (category_id && category_id !== 'all') {
        categoryFilter = 'AND p.category_id = ?';
        categoryParams = [category_id];
      }

      // 1. Payment Method Breakdown (Summary)
      const stats = db.prepare(`
        SELECT payment_method, sum(total) as total, sum(count) as count FROM (
          SELECT s.payment_method, sum(si.subtotal) as total, count(DISTINCT s.id) as count
          FROM sales s JOIN sale_items si ON s.id = si.sale_id JOIN products p ON si.product_id = p.id
          WHERE s.status = 'completed' ${dateFilter} ${categoryFilter} GROUP BY s.payment_method
          UNION ALL
          SELECT sr.refund_type as payment_method, sum(-(sri.quantity * sri.refund_amount)) as total, count(DISTINCT sr.id) as count
          FROM sales_returns sr JOIN sales_return_items sri ON sr.id = sri.return_id JOIN products p ON sri.product_id = p.id
          WHERE 1=1 ${dateFilter.replace(/s\.created_at/g, 'sr.created_at')} ${categoryFilter} GROUP BY sr.refund_type
        ) GROUP BY payment_method
      `).all(...dateParams, ...categoryParams, ...dateParams, ...categoryParams) as any[];

      // 2. Category-wise Breakdown
      const categoryBreakdown = db.prepare(`
        SELECT category_name, sum(total_qty) as total_qty, sum(total_value) as total_value FROM (
          SELECT coalesce(c.name, 'Uncategorized') as category_name, sum(si.quantity) as total_qty, sum(si.subtotal) as total_value
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN products p ON si.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE s.status = 'completed' ${dateFilter} ${categoryFilter}
          GROUP BY c.id, c.name
          UNION ALL
          SELECT coalesce(c.name, 'Uncategorized') as category_name, sum(-sri.quantity) as total_qty, sum(-(sri.quantity * sri.refund_amount)) as total_value
          FROM sales_return_items sri
          JOIN sales_returns sr ON sri.return_id = sr.id
          JOIN products p ON sri.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE 1=1 ${dateFilter.replace(/s\.created_at/g, 'sr.created_at')} ${categoryFilter}
          GROUP BY c.id, c.name
        ) GROUP BY category_name
      `).all(...dateParams, ...categoryParams, ...dateParams, ...categoryParams) as any[];

      const categoryPaymentBreakdown = db.prepare(`
        SELECT category_name, payment_method, sum(total_value) as total_value FROM (
          SELECT coalesce(c.name, 'Uncategorized') as category_name, s.payment_method, sum(si.subtotal) as total_value
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN products p ON si.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE s.status = 'completed' ${dateFilter} ${categoryFilter}
          GROUP BY c.id, c.name, s.payment_method
          UNION ALL
          SELECT coalesce(c.name, 'Uncategorized') as category_name, sr.refund_type as payment_method, sum(-(sri.quantity * sri.refund_amount)) as total_value
          FROM sales_return_items sri
          JOIN sales_returns sr ON sri.return_id = sr.id
          JOIN products p ON sri.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE 1=1 ${dateFilter.replace(/s\.created_at/g, 'sr.created_at')} ${categoryFilter}
          GROUP BY c.id, c.name, sr.refund_type
        ) GROUP BY category_name, payment_method
      `).all(...dateParams, ...categoryParams, ...dateParams, ...categoryParams) as any[];

      // Merge payment breakdown into category breakdown
      const finalCategoryBreakdown = categoryBreakdown.map(cat => {
        const payments = categoryPaymentBreakdown
          .filter(cp => cp.category_name === cat.category_name)
          .reduce((acc: any, curr) => {
            acc[curr.payment_method] = curr.total_value;
            return acc;
          }, {});
        return { ...cat, payments };
      });

      // 3. Item-wise Details
      const itemDetails = db.prepare(`
        SELECT 
          p.name as product_name,
          coalesce(c.name, 'Uncategorized') as category_name,
          sum(si.quantity) as total_qty,
          sum(si.subtotal) as total_value
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.status = 'completed' ${dateFilter} ${categoryFilter}
        GROUP BY p.id, p.name, c.name
        ORDER BY total_value DESC
        LIMIT 50
      `).all(...dateParams, ...categoryParams) as any[];

      const summary = {
        totalReal: stats.filter(s => ['CASH', 'CREDIT', 'ONLINE'].includes(s.payment_method)).reduce((acc, s) => acc + s.total, 0),
        totalCredit: stats.find(s => s.payment_method === 'CREDIT')?.total || 0,
        totalAutoBurn: stats.find(s => s.payment_method === 'AUTO_BURN')?.total || 0,
        totalOnline: stats.find(s => s.payment_method === 'ONLINE')?.total || 0,
        totalCash: stats.find(s => s.payment_method === 'CASH')?.total || 0,
        grandTotal: stats.reduce((acc, s) => acc + s.total, 0)
      };

      res.json({ 
        success: true, 
        data: stats, 
        summary, 
        categoryBreakdown: finalCategoryBreakdown,
        itemDetails
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Detailed Sales Report Rows API (Granular)
  app.get('/api/admin/detailed-sales-report-rows', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { start_date, end_date, category_id } = req.query;
      let dateFilter = '';
      let dateParams: any[] = [];
      let categoryFilter = '';
      let categoryParams: any[] = [];

      if (start_date && end_date) {
        dateFilter = 'AND date(s.created_at) BETWEEN ? AND ?';
        dateParams = [start_date, end_date];
      }

      if (category_id && category_id !== 'all') {
        categoryFilter = 'AND p.category_id = ?';
        categoryParams = [category_id];
      }

      const rows = db.prepare(`
        SELECT 
          s.created_at as timestamp,
          coalesce(c.name, 'Uncategorized') as category_name,
          p.name as product_name,
          si.quantity as qty_sold,
          CASE WHEN s.payment_method = 'CASH' THEN si.subtotal ELSE 0 END as cash_amount,
          CASE WHEN s.payment_method = 'ONLINE' THEN si.subtotal ELSE 0 END as online_amount,
          CASE WHEN s.payment_method = 'CREDIT' THEN si.subtotal ELSE 0 END as credit_amount,
          CASE WHEN s.payment_method = 'AUTO_BURN' THEN si.subtotal ELSE 0 END as auto_burn_amount,
          si.subtotal as total_amount
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.status = 'completed' ${dateFilter} ${categoryFilter}

        UNION ALL

        SELECT 
          sr.created_at as timestamp,
          coalesce(c.name, 'Uncategorized') as category_name,
          p.name || ' (RETURN)' as product_name,
          -sri.quantity as qty_sold,
          CASE WHEN sr.refund_type = 'CASH' THEN -(sri.quantity * sri.refund_amount) ELSE 0 END as cash_amount,
          0 as online_amount,
          CASE WHEN sr.refund_type = 'EXCHANGE' THEN -(sri.quantity * sri.refund_amount) ELSE 0 END as credit_amount,
          0 as auto_burn_amount,
          -(sri.quantity * sri.refund_amount) as total_amount
        FROM sales_return_items sri
        JOIN sales_returns sr ON sri.return_id = sr.id
        JOIN products p ON sri.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1 ${dateFilter.replace(/s\.created_at/g, 'sr.created_at')} ${categoryFilter}

        ORDER BY timestamp DESC
        LIMIT 2000
      `).all(...dateParams, ...categoryParams, ...dateParams, ...categoryParams) as any[];

      // Also get totals for the summary section
      const summary = db.prepare(`
        SELECT 
          sum(total_amount) as grand_total,
          sum(cash_amount) as total_cash,
          sum(online_amount) as total_online,
          sum(credit_amount) as total_credit,
          sum(auto_burn_amount) as total_auto_burn
        FROM (
          SELECT 
            si.subtotal as total_amount,
            CASE WHEN s.payment_method = 'CASH' THEN si.subtotal ELSE 0 END as cash_amount,
            CASE WHEN s.payment_method = 'ONLINE' THEN si.subtotal ELSE 0 END as online_amount,
            CASE WHEN s.payment_method = 'CREDIT' THEN si.subtotal ELSE 0 END as credit_amount,
            CASE WHEN s.payment_method = 'AUTO_BURN' THEN si.subtotal ELSE 0 END as auto_burn_amount
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN products p ON si.product_id = p.id
          WHERE s.status = 'completed' ${dateFilter} ${categoryFilter}

          UNION ALL

          SELECT 
            -(sri.quantity * sri.refund_amount) as total_amount,
            CASE WHEN sr.refund_type = 'CASH' THEN -(sri.quantity * sri.refund_amount) ELSE 0 END as cash_amount,
            0 as online_amount,
            CASE WHEN sr.refund_type = 'EXCHANGE' THEN -(sri.quantity * sri.refund_amount) ELSE 0 END as credit_amount,
            0 as auto_burn_amount
          FROM sales_return_items sri
          JOIN sales_returns sr ON sri.return_id = sr.id
          JOIN products p ON sri.product_id = p.id
          WHERE 1=1 ${dateFilter.replace(/s\.created_at/g, 'sr.created_at')} ${categoryFilter}
        )
      `).get(...dateParams, ...categoryParams, ...dateParams, ...categoryParams) as any;

      res.json({ success: true, data: rows, summary });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/expiry-insights', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { days } = req.query;
      const thresholdDays = parseInt(days as string) || 90;
      const today = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(today.getDate() + thresholdDays);
      
      const thresholdStr = thresholdDate.toISOString().split('T')[0];

      const expiringBatches = db.prepare(`
        SELECT 
          sb.id as batch_id,
          sb.batch_number,
          sb.expiry_date,
          sb.quantity as batch_quantity,
          p.id as product_id,
          p.name as product_name,
          p.barcode,
          p.stock_quantity as total_stock,
          pi.invoice_number,
          s.name as supplier_name
        FROM stock_batches sb
        JOIN products p ON sb.product_id = p.id
        LEFT JOIN purchase_invoices pi ON sb.purchase_invoice_id = pi.id
        LEFT JOIN suppliers s ON pi.supplier_id = s.id
        WHERE sb.expiry_date IS NOT NULL 
        AND sb.expiry_date != ''
        AND sb.expiry_date <= ?
        AND p.stock_quantity > 0
        ORDER BY sb.expiry_date ASC
      `).all(thresholdStr);

      res.json({ success: true, data: expiringBatches });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Dashboard Summary API
  app.get('/api/admin/dashboard-stats', authenticateToken, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const realSales = db.prepare('SELECT sum(total_amount) as total FROM sales WHERE date(created_at) = ? AND payment_method IN ("CASH", "CREDIT", "ONLINE") AND status = "completed"').get(today) as any;
      const creditSales = db.prepare('SELECT sum(total_amount) as total FROM sales WHERE date(created_at) = ? AND payment_method = "CREDIT" AND status = "completed"').get(today) as any;
      const autoBurnSales = db.prepare('SELECT sum(total_amount) as total FROM sales WHERE date(created_at) = ? AND payment_method = "AUTO_BURN" AND status = "completed"').get(today) as any;
      const onlineSales = db.prepare('SELECT sum(total_amount) as total FROM sales WHERE date(created_at) = ? AND payment_method = "ONLINE" AND status = "completed"').get(today) as any;

      const purchaseStats = db.prepare('SELECT sum(total_amount) as total, sum(due_amount) as due FROM purchase_invoices WHERE date(created_at) = ? AND status = "ACTIVE"').get(today) as any;
      const expenseStats = db.prepare('SELECT sum(amount) as total FROM expenses WHERE date = ?').get(today) as any;

      const profit = db.prepare(`
        SELECT sum(si.subtotal - (p.purchase_price * si.quantity)) as total
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE date(s.created_at) = ? AND s.status = "completed" AND s.payment_method != 'AUTO_BURN'
      `).get(today) as any;
      
      const outstanding = db.prepare('SELECT sum(current_balance) as total FROM customers').get() as any;

      const grossProfit = profit?.total || 0;
      const totalExpensesToday = expenseStats?.total || 0;
      const netProfit = grossProfit - totalExpensesToday;

      const lowStock = db.prepare('SELECT name, stock_quantity FROM products WHERE stock_quantity <= 10 LIMIT 5').all();
      const topProducts = db.prepare(`
        SELECT p.name, sum(si.quantity) as qty 
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        GROUP BY p.id
        ORDER BY qty DESC
        LIMIT 5
      `).all();

      res.json({
        success: true,
        data: {
          kpis: [
            { label: 'Today Total Sales', value: `$${((realSales?.total || 0) + (autoBurnSales?.total || 0) + (onlineSales?.total || 0)).toFixed(2)}`, icon: 'DollarSign', color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Gross Profit', value: `$${grossProfit.toFixed(2)}`, icon: 'TrendingUp', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Today Expenses', value: `$${totalExpensesToday.toFixed(2)}`, icon: 'PackageMinus', color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Net Profit', value: `$${netProfit.toFixed(2)}`, icon: 'CheckCircle', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Cash Sales', value: `$${(realSales?.total || 0).toFixed(2)}`, icon: 'Banknote', color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Total Credit Sales', value: `$${(creditSales?.total || 0).toFixed(2)}`, icon: 'CreditCard', color: 'text-indigo-600', bg: 'bg-indigo-100' },
            { label: 'Today\'s Purchases', value: `$${(purchaseStats?.total || 0).toFixed(2)}`, icon: 'ShoppingCart', color: 'text-red-600', bg: 'bg-red-100' },
          ],
          summary: {
            todayReal: realSales?.total || 0,
            todayCredit: creditSales?.total || 0,
            todayAutoBurn: autoBurnSales?.total || 0,
            todayOnline: onlineSales?.total || 0,
            todayProfit: grossProfit,
            netProfit: netProfit,
            totalOutstanding: outstanding?.total || 0,
            todayPurchases: purchaseStats?.total || 0,
            todaySupplierDue: purchaseStats?.due || 0,
            todayExpenses: totalExpensesToday
          },
          lowStock,
          topProducts
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- Expenses APIs ---
  app.get('/api/admin/expenses', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { category, search, start_date, end_date, from, to } = req.query;
      let query = 'SELECT * FROM expenses WHERE 1=1';
      const params: any[] = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (search) {
        query += ' AND description LIKE ?';
        params.push(`%${search}%`);
      }
      
      const startDate = start_date || from;
      const endDate = end_date || to;
      
      if (startDate && endDate) {
        query += ' AND date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY date DESC, id DESC';
      const expenses = db.prepare(query).all(...params);
      res.json({ success: true, data: expenses });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/expenses', authenticateToken, requireAdmin, (req: any, res) => {
    const { category, description, amount, date, payment_method } = req.body;
    try {
      db.prepare(`
        INSERT INTO expenses (category, description, amount, date, payment_method, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(category, description, amount, date, payment_method || 'CASH', req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/expenses/:id', authenticateToken, requireAdmin, (req: any, res) => {
    try {
      db.transaction(() => {
        const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id) as any;
        if (!expense) throw new Error('Expense not found');

        db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);

        db.prepare(`
          INSERT INTO financial_audit_logs (type, reference_id, user_id, details)
          VALUES (?, ?, ?, ?)
        `).run('EXPENSE_DELETE', req.params.id, req.user.id, JSON.stringify(expense));
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Inventory Management APIs
  app.get('/api/admin/inventory/sessions', authenticateToken, requireAdmin, (req, res) => {
    try {
      const sessions = db.prepare('SELECT s.*, u.username as creator_name FROM inventory_sessions s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.created_at DESC').all();
      res.json({ success: true, data: sessions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions', authenticateToken, requireAdmin, (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = db.prepare('INSERT INTO inventory_sessions (date, created_by, status) VALUES (?, ?, ?)')
        .run(today, req.user.id, 'DRAFT');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/inventory/sessions/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const session = db.prepare('SELECT s.*, u.username as creator_name FROM inventory_sessions s LEFT JOIN users u ON s.created_by = u.id WHERE s.id = ?').get(req.params.id) as any;
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
      
      const items = db.prepare(`
        SELECT i.*, p.name, p.barcode 
        FROM inventory_items i 
        JOIN products p ON i.product_id = p.id 
        WHERE i.inventory_id = ?
      `).all(req.params.id);
      
      res.json({ success: true, data: { ...session, items } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/inventory/sessions/:id', authenticateToken, (req: any, res) => {
    try {
      const session = db.prepare('SELECT status FROM inventory_sessions WHERE id = ?').get(req.params.id) as any;
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
      
      db.transaction(() => {
        db.prepare('DELETE FROM inventory_items WHERE inventory_id = ?').run(req.params.id);
        db.prepare('DELETE FROM inventory_audit_logs WHERE inventory_id = ?').run(req.params.id);
        db.prepare('DELETE FROM inventory_sessions WHERE id = ?').run(req.params.id);
      })();
      res.json({ success: true, message: 'Session deleted' });
    } catch (error: any) {
      console.error('Delete session error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/inventory/sessions/:id/items/:itemId', authenticateToken, (req: any, res) => {
    try {
      const { id, itemId } = req.params;
      const result = db.prepare('DELETE FROM inventory_items WHERE id = ? AND inventory_id = ?').run(itemId, id);
      
      if (result.changes > 0) {
        res.json({ success: true, message: 'Item deleted' });
      } else {
        res.status(404).json({ success: false, message: 'Item not found in this session' });
      }
    } catch (error: any) {
      console.error('Delete item error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions/:id/items', authenticateToken, requireAdmin, (req: any, res) => {
    try {
      const { product_id, physical_stock } = req.body;
      const product = db.prepare('SELECT purchase_price, selling_price, stock_quantity FROM products WHERE id = ?').get(product_id) as any;
      
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      const system_stock = product.stock_quantity;
      const difference = physical_stock - system_stock;
      const value_difference = difference * product.purchase_price;

      // Check if item already exists in session
      const existing = db.prepare('SELECT id FROM inventory_items WHERE inventory_id = ? AND product_id = ?').get(req.params.id, product_id) as any;
      
      if (existing) {
        db.prepare(`
          UPDATE inventory_items 
          SET physical_stock = ?, difference = ?, value_difference = ?
          WHERE id = ?
        `).run(physical_stock, difference, value_difference, existing.id);
      } else {
        db.prepare(`
          INSERT INTO inventory_items (inventory_id, product_id, system_stock, physical_stock, difference, buying_price, selling_price, value_difference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.id, product_id, system_stock, physical_stock, difference, product.purchase_price, product.selling_price, value_difference);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions/:id/complete', authenticateToken, requireAdmin, (req: any, res) => {
    try {
      const { option } = req.body; // 'AUTO_UPDATE' or 'FINISH_ONLY'
      const session = db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(req.params.id) as any;
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      const items = db.prepare('SELECT * FROM inventory_items WHERE inventory_id = ?').all(req.params.id) as any[];
      
      let total_system_value = 0;
      let total_physical_value = 0;
      let total_difference = 0;

      db.transaction(() => {
        for (const item of items) {
          total_system_value += item.system_stock * item.buying_price;
          total_physical_value += item.physical_stock * item.buying_price;
          total_difference += item.value_difference;

          if (option === 'AUTO_UPDATE') {
            // Update product stock
            db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(item.physical_stock, item.product_id);
            
            // Record movement
            db.prepare(`
              INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
              VALUES (?, ?, 'ADJUSTMENT', 'INVENTORY', ?)
            `).run(item.product_id, item.difference, req.params.id);

            // Detailed audit log
            db.prepare(`
              INSERT INTO inventory_audit_logs (inventory_id, user_id, action, details)
              VALUES (?, ?, 'STOCK_SYNC', ?)
            `).run(req.params.id, req.user.id, `Synced stock for product ID ${item.product_id}: ${item.system_stock} -> ${item.physical_stock}`);
          }
        }

        db.prepare(`
          UPDATE inventory_sessions 
          SET total_system_value = ?, total_physical_value = ?, total_difference = ?, status = 'COMPLETED'
          WHERE id = ?
        `).run(total_system_value, total_physical_value, total_difference, req.params.id);

        db.prepare(`
          INSERT INTO inventory_audit_logs (inventory_id, user_id, action, details)
          VALUES (?, ?, 'SESSION_COMPLETED', ?)
        `).run(req.params.id, req.user.id, `Session completed with option: ${option}`);
      })();

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/inventory/stats', authenticateToken, requireAdmin, (req, res) => {
    try {
      const summary = db.prepare(`
        SELECT 
          count(id) as total_sessions,
          sum(total_difference) as net_variance,
          (SELECT sum(total_difference) FROM inventory_sessions WHERE total_difference < 0) as total_loss,
          (SELECT sum(total_difference) FROM inventory_sessions WHERE total_difference > 0) as total_gain
        FROM inventory_sessions 
        WHERE status = 'COMPLETED'
      `).get() as any;

      const topVariance = db.prepare(`
        SELECT p.name, sum(abs(i.difference)) as total_variance
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        JOIN inventory_sessions s ON i.inventory_id = s.id
        WHERE s.status = 'COMPLETED'
        GROUP BY i.product_id
        ORDER BY total_variance DESC
        LIMIT 5
      `).all();

      res.json({ success: true, data: { summary, topVariance } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- Purchase Invoice APIs ---
  app.get('/api/admin/purchase-invoices', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { supplier_id, payment_status, search } = req.query;
      let query = 'SELECT pi.*, s.name as supplier_name FROM purchase_invoices pi JOIN suppliers s ON pi.supplier_id = s.id WHERE 1=1';
      const params: any[] = [];

      if (supplier_id) {
        query += ' AND pi.supplier_id = ?';
        params.push(supplier_id);
      }
      if (payment_status) {
        query += ' AND pi.payment_status = ?';
        params.push(payment_status);
      }
      if (search) {
        query += ' AND (pi.invoice_number LIKE ? OR s.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY pi.date DESC, pi.id DESC';
      const invoices = db.prepare(query).all(...params);
      res.json({ success: true, data: invoices });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/purchase-invoices', authenticateToken, requireAdmin, (req: any, res) => {
    const { invoice_number, supplier_id, date, items, total_amount, paid_amount } = req.body;
    
    try {
      db.transaction(() => {
        const due_amount = total_amount - (paid_amount || 0);
        const payment_status = due_amount <= 0 ? 'PAID' : 'CREDIT';

        const result = db.prepare(`
          INSERT INTO purchase_invoices (invoice_number, supplier_id, total_amount, paid_amount, due_amount, payment_status, date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(invoice_number, supplier_id, total_amount, paid_amount || 0, due_amount, payment_status, date);

        const invoiceId = result.lastInsertRowid;

        // Record initial payment if any
        if (paid_amount > 0) {
          db.prepare('INSERT INTO purchase_invoice_payments (invoice_id, amount, date) VALUES (?, ?, ?)').run(invoiceId, paid_amount, date);
        }

        for (const item of items) {
          db.prepare(`
            INSERT INTO purchase_invoice_items (invoice_id, product_id, quantity, bonus_qty, unit_price, total_price, batch_number, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(invoiceId, item.product_id, item.quantity, item.bonus_qty || 0, item.unit_price, item.quantity * item.unit_price, item.batch_number || null, item.expiry_date || null);

          // Update product stock and price (including bonus qty)
          const totalStockIncrement = (item.quantity || 0) + (item.bonus_qty || 0);
          const effectivePurchasePrice = totalStockIncrement > 0 
            ? (item.quantity * item.unit_price) / totalStockIncrement 
            : item.unit_price;

          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, purchase_price = ? WHERE id = ?')
            .run(totalStockIncrement, effectivePurchasePrice, item.product_id);

          // Create stock batch if batch info provided
          if (item.batch_number || item.expiry_date) {
            db.prepare(`
              INSERT INTO stock_batches (product_id, batch_number, expiry_date, quantity, purchase_invoice_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(item.product_id, item.batch_number || null, item.expiry_date || null, totalStockIncrement, invoiceId);
          }

          // Log stock movement
          db.prepare(`
            INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
            VALUES (?, ?, 'PURCHASE', 'PURCHASE_INVOICE', ?)
          `).run(item.product_id, totalStockIncrement, invoice_number);
        }
      })();

      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ success: false, message: 'Invoice number already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const invoice = db.prepare(`
        SELECT pi.*, s.name as supplier_name, s.phone as supplier_phone 
        FROM purchase_invoices pi 
        JOIN suppliers s ON pi.supplier_id = s.id 
        WHERE pi.id = ?
      `).get(req.params.id) as any;

      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

      const items = db.prepare(`
        SELECT pii.*, p.name as product_name, p.barcode 
        FROM purchase_invoice_items pii 
        JOIN products p ON pii.product_id = p.id 
        WHERE pii.invoice_id = ?
      `).all(req.params.id);

      const payments = db.prepare('SELECT * FROM purchase_invoice_payments WHERE invoice_id = ? ORDER BY created_at DESC').all(req.params.id);

      res.json({ success: true, data: { ...invoice, items, payments } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/purchase-invoices/:id/payments', authenticateToken, requireAdmin, (req, res) => {
    const { amount, date, payment_method } = req.body;
    try {
      db.transaction(() => {
        const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(req.params.id) as any;
        if (!invoice) throw new Error('Invoice not found');
        if (invoice.status === 'VOID') throw new Error('Cannot pay voided invoice');

        const newPaidAmount = invoice.paid_amount + amount;
        const newDueAmount = invoice.total_amount - newPaidAmount;
        const newPaymentStatus = newDueAmount <= 0 ? 'PAID' : 'CREDIT';

        db.prepare(`
          UPDATE purchase_invoices 
          SET paid_amount = ?, due_amount = ?, payment_status = ?
          WHERE id = ?
        `).run(newPaidAmount, newDueAmount, newPaymentStatus, req.params.id);

        db.prepare(`
          INSERT INTO purchase_invoice_payments (invoice_id, amount, payment_method, date)
          VALUES (?, ?, ?, ?)
        `).run(req.params.id, amount, payment_method || 'CASH', date || new Date().toISOString().split('T')[0]);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/purchase-invoices/:id/void', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.transaction(() => {
        const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(req.params.id) as any;
        if (!invoice) throw new Error('Invoice not found');
        if (invoice.status === 'VOID') throw new Error('Invoice already voided');

        const items = db.prepare('SELECT * FROM purchase_invoice_items WHERE invoice_id = ?').all(req.params.id) as any[];

        // Reverse stock
        for (const item of items) {
          const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
          db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
            .run(totalStockDecrement, item.product_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
            VALUES (?, ?, 'VOID_PURCHASE', 'PURCHASE_INVOICE', ?)
          `).run(item.product_id, -totalStockDecrement, invoice.invoice_number);
        }

        db.prepare('UPDATE purchase_invoices SET status = "VOID" WHERE id = ?').run(req.params.id);

        db.prepare(`
          INSERT INTO financial_audit_logs (type, reference_id, user_id, details)
          VALUES (?, ?, ?, ?)
        `).run('INVOICE_VOID', req.params.id, (req as any).user.id, `Voided invoice ${invoice.invoice_number}`);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, (req: any, res) => {
    const { supplier_id, date, items, total_amount, paid_amount } = req.body;
    try {
      db.transaction(() => {
        const oldInvoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(req.params.id) as any;
        if (!oldInvoice) throw new Error('Invoice not found');
        if (oldInvoice.status === 'VOID') throw new Error('Cannot edit voided invoice');

        const oldItems = db.prepare('SELECT * FROM purchase_invoice_items WHERE invoice_id = ?').all(req.params.id) as any[];

        // 1. Reverse old stock
        for (const item of oldItems) {
          const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
          db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
            .run(totalStockDecrement, item.product_id);
          
          db.prepare(`
            INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
            VALUES (?, ?, 'EDIT_PURCHASE_REVERSE', 'PURCHASE_INVOICE', ?)
          `).run(item.product_id, -totalStockDecrement, oldInvoice.invoice_number);
        }

        // 2. Clear old items
        db.prepare('DELETE FROM purchase_invoice_items WHERE invoice_id = ?').run(req.params.id);

        // 3. Update Invoice Header
        const due_amount = total_amount - (paid_amount || 0);
        const payment_status = due_amount <= 0 ? 'PAID' : 'CREDIT';

        db.prepare(`
          UPDATE purchase_invoices 
          SET supplier_id = ?, total_amount = ?, paid_amount = ?, due_amount = ?, payment_status = ?, date = ?
          WHERE id = ?
        `).run(supplier_id, total_amount, paid_amount || 0, due_amount, payment_status, date, req.params.id);

        // 4. Add new items and apply new stock
        for (const item of items) {
          db.prepare(`
            INSERT INTO purchase_invoice_items (invoice_id, product_id, quantity, bonus_qty, unit_price, total_price, batch_number, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(req.params.id, item.product_id, item.quantity, item.bonus_qty || 0, item.unit_price, item.quantity * item.unit_price, item.batch_number || null, item.expiry_date || null);

          const totalStockIncrement = (item.quantity || 0) + (item.bonus_qty || 0);
          
          // Create stock batch if batch info provided
          if (item.batch_number || item.expiry_date) {
            db.prepare(`
              INSERT INTO stock_batches (product_id, batch_number, expiry_date, quantity, purchase_invoice_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(item.product_id, item.batch_number || null, item.expiry_date || null, totalStockIncrement, req.params.id);
          }

          const effectivePurchasePrice = totalStockIncrement > 0 
            ? (item.quantity * item.unit_price) / totalStockIncrement 
            : item.unit_price;

          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ?, purchase_price = ? WHERE id = ?')
            .run(totalStockIncrement, effectivePurchasePrice, item.product_id);

          db.prepare(`
            INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
            VALUES (?, ?, 'EDIT_PURCHASE_APPLY', 'PURCHASE_INVOICE', ?)
          `).run(item.product_id, totalStockIncrement, oldInvoice.invoice_number);
        }

        // 5. Audit Log
        db.prepare(`
          INSERT INTO purchase_invoice_audit_logs (invoice_id, user_id, old_data, new_data)
          VALUES (?, ?, ?, ?)
        `).run(req.params.id, req.user.id, JSON.stringify(oldInvoice), JSON.stringify(req.body));
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.transaction(() => {
        const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(req.params.id) as any;
        if (!invoice) throw new Error('Invoice not found');

        const items = db.prepare('SELECT * FROM purchase_invoice_items WHERE invoice_id = ?').all(req.params.id) as any[];

        // 1. Reverse stock if it wasn't already voided
        if (invoice.status !== 'VOID') {
          for (const item of items) {
            const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
            db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
              .run(totalStockDecrement, item.product_id);
            
            db.prepare(`
              INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id)
              VALUES (?, ?, 'DELETE_PURCHASE_REVERSE', 'PURCHASE_INVOICE', ?)
            `).run(item.product_id, -totalStockDecrement, invoice.invoice_number);
          }
        }

        // 2. Delete payments
        db.prepare('DELETE FROM purchase_invoice_payments WHERE invoice_id = ?').run(req.params.id);

        // 3. Delete items
        db.prepare('DELETE FROM purchase_invoice_items WHERE invoice_id = ?').run(req.params.id);

        // 4. Delete batches linked to this invoice
        db.prepare('DELETE FROM stock_batches WHERE purchase_invoice_id = ?').run(req.params.id);

        // 5. Delete audit logs
        db.prepare('DELETE FROM purchase_invoice_audit_logs WHERE invoice_id = ?').run(req.params.id);

        // 6. Delete the invoice itself
        db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(req.params.id);

        // 7. Global Financial Audit
        db.prepare(`
          INSERT INTO financial_audit_logs (type, reference_id, user_id, details)
          VALUES (?, ?, ?, ?)
        `).run('INVOICE_PURGE', req.params.id, (req as any).user.id, `Permanently deleted invoice ${invoice.invoice_number}`);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/purchase-stats', authenticateToken, requireAdmin, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const month = today.substring(0, 7);

      const monthlyTotal = db.prepare('SELECT sum(total_amount) as total FROM purchase_invoices WHERE status = "ACTIVE" AND date LIKE ?').get(month + '%') as any;
      const totalPaid = db.prepare('SELECT sum(paid_amount) as total FROM purchase_invoices WHERE status = "ACTIVE"').get() as any;
      const totalDue = db.prepare('SELECT sum(due_amount) as total FROM purchase_invoices WHERE status = "ACTIVE"').get() as any;

      const topSuppliers = db.prepare(`
        SELECT s.name, sum(pi.total_amount) as amount 
        FROM purchase_invoices pi 
        JOIN suppliers s ON pi.supplier_id = s.id 
        WHERE pi.status = "ACTIVE" 
        GROUP BY pi.supplier_id 
        ORDER BY amount DESC 
        LIMIT 5
      `).all();

      res.json({
        success: true,
        data: {
          monthlyTotal: monthlyTotal?.total || 0,
          totalPaid: totalPaid?.total || 0,
          totalDue: totalDue?.total || 0,
          topSuppliers
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- Stock Adjustment APIs ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      adjustment_type TEXT CHECK(adjustment_type IN ('IN', 'OUT')) NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      buying_price REAL NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  app.get('/api/stock-adjustments', authenticateToken, (req, res) => {
    try {
      const { start_date, end_date, product_id, reason } = req.query;
      let query = `
        SELECT sa.*, p.name as product_name, p.barcode, u.username as created_by_name
        FROM stock_adjustments sa
        JOIN products p ON sa.product_id = p.id
        JOIN users u ON sa.created_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (start_date && end_date) {
        query += ' AND date(sa.created_at) BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }
      if (product_id) {
        query += ' AND sa.product_id = ?';
        params.push(product_id);
      }
      if (reason) {
        query += ' AND sa.reason = ?';
        params.push(reason);
      }

      query += ' ORDER BY sa.created_at DESC LIMIT 500';
      const adjustments = db.prepare(query).all(...params);
      res.json({ success: true, data: adjustments });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/stock-adjustments', authenticateToken, (req: any, res) => {
    const { product_id, adjustment_type, quantity, reason, note } = req.body;
    const userId = req.user.id;

    if (!product_id || !adjustment_type || !quantity || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
      const transaction = db.transaction(() => {
        const product = db.prepare('SELECT id, stock_quantity, purchase_price FROM products WHERE id = ?').get(product_id) as any;
        if (!product) throw new Error('Product not found');

        const prevStock = product.stock_quantity;
        let newStock = prevStock;

        if (adjustment_type === 'IN') {
          newStock += parseFloat(quantity);
        } else {
          newStock -= parseFloat(quantity);
          if (newStock < 0 && req.user.role !== 'ADMIN') {
            throw new Error('Insufficient stock for adjustment (requires Admin override)');
          }
        }

        // Update product stock
        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, product_id);

        // Record adjustment
        db.prepare(`
          INSERT INTO stock_adjustments (product_id, adjustment_type, quantity, reason, note, previous_stock, new_stock, buying_price, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(product_id, adjustment_type, quantity, reason, note || '', prevStock, newStock, product.purchase_price, userId);

        return { prevStock, newStock };
      });

      const result = transaction();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Daily PDF Report Data
  app.get('/api/admin/daily-pdf-report', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { month } = req.query; // format YYYY-MM
      const monthPrefix = `${month}-%`;

      // 1. Sales by category and date
      const salesByCategory = db.prepare(`
        SELECT 
          date(s.created_at) as date,
          UPPER(coalesce(c.name, 'OTHER')) as category,
          sum(si.subtotal) as total
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.status = 'completed' AND date(s.created_at) LIKE ?
        GROUP BY date, category
      `).all(monthPrefix) as any[];

      // subtract returns from salesByCategory
      const returnsByCategory = db.prepare(`
        SELECT 
          date(sr.created_at) as date,
          UPPER(coalesce(c.name, 'OTHER')) as category,
          sum(sri.quantity * sri.refund_amount) as total
        FROM sales_return_items sri
        JOIN sales_returns sr ON sri.return_id = sr.id
        LEFT JOIN products p ON sri.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE date(sr.created_at) LIKE ?
        GROUP BY date, category
      `).all(monthPrefix) as any[];

      // 2. Total Cash/Credit Sales by Date
      const salesByPaymentMethod = db.prepare(`
        SELECT 
          date(created_at) as date,
          CASE 
            WHEN customer_id IS NOT NULL THEN 'CREDIT' 
            ELSE payment_method 
          END as payment_method,
          sum(total_amount) as total
        FROM sales 
        WHERE status = 'completed' AND date(created_at) LIKE ?
        GROUP BY date, CASE WHEN customer_id IS NOT NULL THEN 'CREDIT' ELSE payment_method END
      `).all(monthPrefix) as any[];

      // subtract returns by payment method
      const returnsByPaymentMethod = db.prepare(`
        SELECT 
          date(sr.created_at) as date,
          CASE 
            WHEN s.customer_id IS NOT NULL THEN 'CREDIT' 
            ELSE sr.refund_type 
          END as payment_method,
          sum(sr.total_refund) as total
        FROM sales_returns sr
        JOIN sales s ON sr.sale_id = s.id
        WHERE date(sr.created_at) LIKE ?
        GROUP BY date, CASE WHEN s.customer_id IS NOT NULL THEN 'CREDIT' ELSE sr.refund_type END
      `).all(monthPrefix) as any[];

      // 3. Purchases by Date, Canteen/Minimart, Cash/Credit
      const purchases = db.prepare(`
        SELECT 
          pi.date,
          UPPER(coalesce(c.name, 'OTHER')) as category,
          pi.payment_status,
          sum(pii.total_price) as total
        FROM purchase_invoice_items pii
        JOIN purchase_invoices pi ON pii.invoice_id = pi.id
        LEFT JOIN products p ON pii.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE pi.status = 'ACTIVE' AND pi.date LIKE ?
        GROUP BY pi.date, category, pi.payment_status
      `).all(monthPrefix) as any[];

      // 4. All Categories
      const categories = db.prepare('SELECT UPPER(name) as name FROM categories').all() as { name: string }[];

      // 5. Expenses for the month
      const expenses = db.prepare(`
        SELECT 
          category,
          description,
          sum(amount) as total
        FROM expenses
        WHERE date LIKE ?
        GROUP BY category, description
      `).all(monthPrefix) as any[];

      res.json({ success: true, data: { salesByCategory, returnsByCategory, salesByPaymentMethod, returnsByPaymentMethod, purchases, expenses, categories } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Profit & Loss Analytics API
  app.get('/api/admin/profit-analytics', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const dateParams = [start_date, end_date];

      // 1. Daily Ledger (Sales, COGS, Expenses per day)
      const dailySales = db.prepare(`
        SELECT 
          date(s.created_at) as date,
          sum(si.subtotal) as sales,
          sum(si.quantity * p.purchase_price) as cogs
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        JOIN products p ON si.product_id = p.id
        WHERE s.status = 'completed' AND s.payment_method != 'AUTO_BURN'
        AND date(s.created_at) BETWEEN ? AND ?
        GROUP BY date(s.created_at)
      `).all(...dateParams) as any[];

      const dailyExpenses = db.prepare(`
        SELECT date, sum(amount) as expenses
        FROM expenses
        WHERE date BETWEEN ? AND ?
        GROUP BY date
      `).all(...dateParams) as any[];

      // Merge daily data
      const dateMap = new Map();
      dailySales.forEach(s => {
        dateMap.set(s.date, { date: s.date, sales: s.sales, cogs: s.cogs, expenses: 0 });
      });
      dailyExpenses.forEach(e => {
        if (dateMap.has(e.date)) {
          dateMap.get(e.date).expenses = e.expenses;
        } else {
          dateMap.set(e.date, { date: e.date, sales: 0, cogs: 0, expenses: e.expenses });
        }
      });

      const dailyLedger = Array.from(dateMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(row => ({
          ...row,
          gross_profit: row.sales - row.cogs,
          net_profit: row.sales - row.cogs - row.expenses
        }));

      // 2. Summary KPI calculation
      const totalSales = dailyLedger.reduce((sum, r) => sum + r.sales, 0);
      const totalCOGS = dailyLedger.reduce((sum, r) => sum + r.cogs, 0);
      const totalExpenses = dailyLedger.reduce((sum, r) => sum + r.expenses, 0);
      const grossProfit = totalSales - totalCOGS;
      const netProfit = grossProfit - totalExpenses;

      // 3. Expense Categories
      const expenseCategories = db.prepare(`
        SELECT category, sum(amount) as total
        FROM expenses
        WHERE date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY total DESC
      `).all(...dateParams);

      res.json({
        success: true,
        data: {
          summary: { totalSales, totalCOGS, totalExpenses, grossProfit, netProfit },
          dailyTrends: dailyLedger.map(r => ({ date: r.date, sales: r.sales, profit: r.net_profit })),
          dailyLedger,
          expenseCategories
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 404 handler for API routes (prevent serving HTML index on missing API calls)
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: `API endpoint not found: ${req.originalUrl}` });
  });

  // --- VITE MIDDLEWARE (Must be after API routes) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
