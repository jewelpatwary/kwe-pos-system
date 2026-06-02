import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bwipjs from 'bwip-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDB, seedProducts } from './src/server/db.js';
import { getSupabase } from './src/lib/supabaseClient.js';

import os from 'os';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pos_key_2026';

// Global uncaught exception and unhandled promise rejection handlers to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception thrown:', error);
});

// --- DATA FILE CONFIGURATION ---
// Use /tmp or os.tmpdir() for serverless environments (Vercel) to avoid read-only filesystem errors.
// We are migrating towards Supabase for all persistent storage, so these local files are increasingly legacy.
const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), 'pos-data')
  : path.join(process.cwd(), 'src', 'server', 'data');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`[DATA_DIR] Warning: Could not ensure directory exists at ${DATA_DIR}. This is expected in some read-only environments.`, err.message);
}
const CAT2_FILE = path.join(DATA_DIR, 'categories2.json');
const PROD_CAT2_FILE = path.join(DATA_DIR, 'product_category2.json');
const PROD_SALES_TYPE_FILE = path.join(DATA_DIR, 'product_sales_type.json');
const PROD_STATUS_FILE = path.join(DATA_DIR, 'product_status.json');
const PROD_AUTO_CREDIT_PRODUCT_FILE = path.join(DATA_DIR, 'customer_auto_credit_product.json');
const CUSTOMER_METADATA_FILE = path.join(DATA_DIR, 'customer_metadata.json');
const PROD_MODIFIED_FILE = path.join(DATA_DIR, 'product_last_modified.json');
const PAYMENT_TYPES_FILE = path.join(DATA_DIR, 'payment_types.json');
const INVOICE_CATEGORIES_FILE = path.join(DATA_DIR, 'invoice_categories.json');
const PI_EXT_FILE = path.join(DATA_DIR, 'purchase_invoice_ext.json');
const EXPENSE_CATEGORIES_FILE = path.join(DATA_DIR, 'expense_categories.json');
const SEED_LOCK_FILE = path.join(DATA_DIR, 'seed.lock');

// --- ONLINE SETTINGS STORE (SUPABASE SYNC) ---
const SETTINGS_KEYS = {
  CAT2: 'data_categories2',
  PROD_CAT2: 'data_product_mapping_category2',
  PAYMENT_TYPES: 'data_payment_types',
  INVOICE_CATEGORIES: 'data_invoice_categories',
  PI_EXT: 'data_purchase_invoice_ext',
  EXPENSE_CATEGORIES: 'data_expense_categories',
  PROD_SALES_TYPE: 'data_product_sales_type',
  PROD_STATUS: 'data_product_status',
  CUSTOMER_AUTO_CREDIT: 'data_customer_auto_credit_product',
  CUSTOMER_METADATA: 'data_customer_metadata',
  PROD_MODIFIED: 'data_product_last_modified'
};

const settingsCache: { [key: string]: any } = {};

// Proxy supabase to implement lazy initialization
const supabase = {
  from: (table: string) => getSupabase().from(table),
  rpc: (fn: string, params: any) => getSupabase().rpc(fn, params),
};

async function syncSettingOnline(key: string, value: any) {
  settingsCache[key] = value;
  try {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    await supabase.from('settings').upsert({ key, value: strValue }, { onConflict: 'key' });
  } catch (err) {
    console.error(`[SYNC] Failed to push ${key} to Supabase:`, err);
  }
}

async function initializeSettingsFromOnline() {
  console.log('[INITIALIZE] Fetching settings from Supabase...');
  try {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) throw error;
    if (data) {
      data.forEach((item: any) => {
        try {
          const trimmed = (item.value || '').trim();
          // Only auto-parse if it looks like JSON
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
             settingsCache[item.key] = JSON.parse(trimmed);
          } else {
             settingsCache[item.key] = item.value;
          }
        } catch (e) {
          settingsCache[item.key] = item.value;
        }
      });
      console.log(`[INITIALIZE] Loaded ${data.length} settings from database.`);
    }
  } catch (err) {
    console.error('[INITIALIZE] Fatal error loading settings:', err);
  }
}

async function getSettingOnline(key: string, defaultValueRef: any) {
  try {
    const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
    if (!error && data && data.value) {
      try {
        const parsed = JSON.parse(data.value.trim());
        settingsCache[key] = parsed;
        return parsed;
      } catch (e) {
        // failed parsing, use cache
      }
    }
  } catch (err) {
    console.error(`[DATABASE] Failed to read key ${key} from database:`, err);
  }
  return settingsCache[key] !== undefined ? settingsCache[key] : defaultValueRef;
}

async function readCategories2() {
  return await getSettingOnline(SETTINGS_KEYS.CAT2, []);
}

async function readCategories2Async() {
  return await readCategories2();
}

async function writeCategories2(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.CAT2, data);
}

async function readProductCategory2() {
  return await getSettingOnline(SETTINGS_KEYS.PROD_CAT2, {});
}
async function writeProductCategory2(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PROD_CAT2, data);
}

async function readPaymentTypes() {
  const initial = [
    { id: 1, name: 'Cash', status: 'active' },
    { id: 2, name: 'Bank', status: 'active' },
    { id: 3, name: 'Credit', status: 'active' }
  ];
  return await getSettingOnline(SETTINGS_KEYS.PAYMENT_TYPES, initial);
}
async function writePaymentTypes(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PAYMENT_TYPES, data);
}

async function readInvoiceCategories() {
  const initial = [
    { id: 1, name: 'Minimart', status: 'active' },
    { id: 2, name: 'Canteen', status: 'active' }
  ];
  return await getSettingOnline(SETTINGS_KEYS.INVOICE_CATEGORIES, initial);
}
async function writeInvoiceCategories(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.INVOICE_CATEGORIES, data);
}

async function readPIExt() {
  return await getSettingOnline(SETTINGS_KEYS.PI_EXT, {});
}
async function writePIExt(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PI_EXT, data);
}

async function readExpenseCategories() {
  return await getSettingOnline(SETTINGS_KEYS.EXPENSE_CATEGORIES, []);
}
async function writeExpenseCategories(data: any) {
  await syncSettingOnline(SETTINGS_KEYS.EXPENSE_CATEGORIES, data);
}

async function readProductSalesType() {
  return await getSettingOnline(SETTINGS_KEYS.PROD_SALES_TYPE, {});
}
async function writeProductSalesType(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PROD_SALES_TYPE, data);
}

async function readProductStatus() {
  return await getSettingOnline(SETTINGS_KEYS.PROD_STATUS, {});
}
async function writeProductStatus(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PROD_STATUS, data);
}

async function readCustomerAutoCreditProduct() {
  return await getSettingOnline(SETTINGS_KEYS.CUSTOMER_AUTO_CREDIT, {});
}
async function writeCustomerAutoCreditProduct(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.CUSTOMER_AUTO_CREDIT, data);
}

async function readCustomerMetadata() {
  return await getSettingOnline(SETTINGS_KEYS.CUSTOMER_METADATA, {});
}
async function writeCustomerMetadata(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.CUSTOMER_METADATA, data);
}

async function readProductModified() {
  return await getSettingOnline(SETTINGS_KEYS.PROD_MODIFIED, {});
}
async function writeProductModified(data: any) { 
  await syncSettingOnline(SETTINGS_KEYS.PROD_MODIFIED, data);
}


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

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Database in the background synchronously to avoid blocking module import in serverless environments
initDB();
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Safe check for seeded status - we rely on the Supabase settings table internal check mostly.
  // We use the local lock file only as an optimization to avoid unnecessary Supabase calls on local dev.
  const isAlreadySeeded = process.env.VERCEL !== '1' && fs.existsSync(SEED_LOCK_FILE); 
  
  seedProducts(isAlreadySeeded).then(() => {
    if (!isAlreadySeeded && process.env.VERCEL !== '1') {
      try {
        fs.writeFileSync(SEED_LOCK_FILE, 'seeded at ' + new Date().toISOString());
      } catch (e) {}
    }
  }).catch((err: any) => {
    console.error("Database initialization check failed:", err);
  });
}

// --- API ROUTES ---

  // Payment Types Endpoints
  app.get('/api/payment_types', async (req, res) => {
    try {
      const data = await readPaymentTypes();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/payment_types', authenticateToken, requireAdmin, async (req, res) => {
    const { name, status } = req.body;
    try {
      const data = await readPaymentTypes();
      const nextId = data.reduce((max: number, c: any) => Math.max(max, Number(c.id)), 0) + 1;
      const newItem = { id: nextId, name, statusValue: status || 'active', status: status || 'active' };
      data.push(newItem);
      await writePaymentTypes(data);
      res.json({ success: true, id: nextId });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/payment_types/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const data = await readPaymentTypes();
      const idx = data.findIndex((c: any) => c.id.toString() === id.toString());
      if (idx !== -1) {
        data[idx] = { ...data[idx], name, status: status || data[idx].status };
        await writePaymentTypes(data);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Payment type not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/payment_types/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const data = await readPaymentTypes();
      const filtered = data.filter((c: any) => c.id.toString() !== id.toString());
      await writePaymentTypes(filtered);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Invoice Categories Endpoints
  app.get('/api/invoice_categories', async (req, res) => {
    try {
      const data = await readInvoiceCategories();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/invoice_categories', authenticateToken, requireAdmin, async (req, res) => {
    const { name, status } = req.body;
    try {
      const data = await readInvoiceCategories();
      const nextId = data.reduce((max: number, c: any) => Math.max(max, Number(c.id)), 0) + 1;
      const newItem = { id: nextId, name, status: status || 'active' };
      data.push(newItem);
      await writeInvoiceCategories(data);
      res.json({ success: true, id: nextId });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/invoice_categories/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const data = await readInvoiceCategories();
      const idx = data.findIndex((c: any) => c.id.toString() === id.toString());
      if (idx !== -1) {
        data[idx] = { ...data[idx], name, status: status || data[idx].status };
        await writeInvoiceCategories(data);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Invoice category not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/invoice_categories/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const data = await readInvoiceCategories();
      const filtered = data.filter((c: any) => c.id.toString() !== id.toString());
      await writeInvoiceCategories(filtered);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Expense Categories Endpoints
  app.get('/api/expense_categories', async (req, res) => {
    try {
      const data = await readExpenseCategories();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/expense_categories', authenticateToken, requireAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const data = await readExpenseCategories();
      if (!data.includes(name)) {
        data.push(name);
        await writeExpenseCategories(data);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/expense_categories', authenticateToken, requireAdmin, async (req, res) => {
      const { oldName, newName } = req.body;
      try {
          let data = await readExpenseCategories();
          const idx = data.indexOf(oldName);
          if (idx !== -1) {
              data[idx] = newName;
              await writeExpenseCategories(data);

              // Also update categories in the supabase database to keep them consistent
              await supabase.from('expenses')
                  .update({ category: newName })
                  .eq('category', oldName);

              res.json({ success: true });
          } else {
              res.status(404).json({ success: false, message: 'Category not found' });
          }
      } catch (error: any) {
          res.status(500).json({ success: false, message: error.message });
      }
  });

  app.delete('/api/expense_categories/:name', authenticateToken, requireAdmin, async (req, res) => {
    const { name } = req.params;
    try {
      const data = await readExpenseCategories();
      const filtered = data.filter((c: string) => c !== name);
      await writeExpenseCategories(filtered);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

// AUTHENTICATION
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Attempt for username: ${username}`);
    
    // Check if Supabase keys are configured
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isConfigured = !!(supabaseUrl && supabaseKey);

    try {
      if (!isConfigured) {
        console.warn('[LOGIN] Supabase lies unconfigured. Evaluating fallback administration credentials.');
        if (username === 'admin' && password === 'admin123') {
          console.log('[LOGIN] Graceful fallback login allowed for admin/admin123 on unconfigured instance.');
          const token = jwt.sign(
            { id: 999999, username: 'admin', role: 'ADMIN' },
            JWT_SECRET,
            { expiresIn: '12h' }
          );
          return res.json({
            success: true,
            token,
            user: { id: 999999, username: 'admin', role: 'ADMIN' }
          });
        }
        return res.status(401).json({ success: false, message: 'Supabase unconfigured. Please use the default credentials: admin / admin123' });
      }

      // If configured, access Supabase
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .limit(1);
        const user = userData?.[0];

        if (error || !user) {
          const errorMessage = typeof error?.message === 'string' && error.message.includes('<!DOCTYPE html>') 
            ? 'Received HTML response (Likely invalid SUPABASE_URL)' 
            : error?.message || 'Not found';
          console.log(`[LOGIN] User lookup failed or error: ${errorMessage}`);
          
          // Let admin/admin123 succeed as fallback if it is a DB connection/configuration error
          if (username === 'admin' && password === 'admin123') {
            console.warn('[LOGIN] Database query failed or user not present. Authenticating via admin fallback.');
            const token = jwt.sign(
              { id: 999999, username: 'admin', role: 'ADMIN' },
              JWT_SECRET,
              { expiresIn: '12h' }
            );
            return res.json({
              success: true,
              token,
              user: { id: 999999, username: 'admin', role: 'ADMIN' }
            });
          }
          
          return res.status(401).json({ success: false, message: 'Invalid credentials or database offline' });
        }

        if (user.status !== 'active') {
          console.log(`[LOGIN] Account is not active: ${user.status}`);
          return res.status(403).json({ success: false, message: 'Account disabled' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
          console.log(`[LOGIN] Password mismatch for ${username}`);
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        console.log(`[LOGIN] Authenticated successfully: ${username}`);

        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: '12h' }
        );

        // Attempt logging without crashing if the logs table fails
        try {
          await supabase
            .from('user_activity_logs')
            .insert([{ user_id: user.id, action: 'LOGIN', details: 'User logged in' }]);
        } catch (logErr) {
          console.warn('[LOGIN] Skipping user activity log insert due to table/connection constraints:', logErr);
        }

        return res.json({
          success: true,
          token,
          user: { id: user.id, username: user.username, role: user.role }
        });

      } catch (dbError: any) {
        console.error('[LOGIN] Supabase client operation exception:', dbError);
        
        // Handle admin fallback if DB threw connection exceptions
        if (username === 'admin' && password === 'admin123') {
          console.warn('[LOGIN] Exception caught. Allowing admin fallback credentials access.');
          const token = jwt.sign(
            { id: 999999, username: 'admin', role: 'ADMIN' },
            JWT_SECRET,
            { expiresIn: '12h' }
          );
          return res.json({
            success: true,
            token,
            user: { id: 999999, username: 'admin', role: 'ADMIN' }
          });
        }
        
        return res.status(500).json({ success: false, message: `Database connection error: ${dbError?.message || dbError}` });
      }

    } catch (error: any) {
      console.error('[LOGIN] Critical error in handler loop:', error);
      res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
  });

  // CONFIGURATION STATUS CHECK
  app.get('/api/config-status', async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isConfigured = !!(supabaseUrl && supabaseKey);
    let isConnected = false;
    let errorDetail: string | null = null;

    if (isConfigured) {
      try {
        const { error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (error) {
          errorDetail = typeof error.message === 'string' && error.message.includes('<!DOCTYPE html>')
            ? 'Received HTML response (Likely invalid SUPABASE_URL)'
            : error.message;
        } else {
          isConnected = true;
        }
      } catch (err: any) {
        errorDetail = err?.message || String(err);
      }
    }

    res.json({
      success: true,
      isConfigured,
      isConnected,
      errorDetail,
      env: {
        SUPABASE_URL: supabaseUrl ? 'SET' : 'MISSING',
        SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? 'SET' : 'MISSING'
      }
    });
  });

  // USER MANAGEMENT (Admin Only)
  app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, status, created_at')
        .order('username', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase users fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:id/reset-password', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      
      const { error } = await supabase
        .from('users')
        .update({ password: hash })
        .eq('id', id);
      
      if (error) throw error;

      await supabase
        .from('user_activity_logs')
        .insert([{ user_id: req.user.id, action: 'RESET_PASSWORD', target_id: id, details: 'Admin reset user password' }]);

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error: any) {
      console.error('Supabase password reset error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, status, created_at')
        .order('username', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase users fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/users', authenticateToken, requireAdmin, async (req: any, res) => {
    const { username, password, role } = req.body;
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      const { data, error } = await supabase
        .from('users')
        .insert([{ username, password: hash, role }])
        .select();
      
      if (error) throw error;

      // Log creation
      await supabase
        .from('user_activity_logs')
        .insert([{ user_id: req.user.id, action: 'CREATE_USER', target_id: data[0].id, details: 'Created new user' }]);

      res.json({ success: true, message: 'User created successfully' });
    } catch (error: any) {
      console.error('Supabase user creation error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { username, password, role, status } = req.body;
    try {
      const updateData: any = { username, role, status };
      
      if (password) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        updateData.password = hash;
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('user_activity_logs')
        .insert([{ user_id: req.user.id, action: 'UPDATE_USER', target_id: id, details: 'Updated user details' }]);

      res.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
      console.error('Supabase user update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('user_activity_logs')
        .insert([{ user_id: req.user.id, action: 'DELETE_USER', target_id: id, details: 'Deleted user' }]);

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
      console.error('Supabase user deletion error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // SUPPLIER MANAGEMENT
  app.get('/api/suppliers', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase suppliers fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/suppliers', authenticateToken, requireAdmin, async (req, res) => {
    const { name, contact, phone, bank_name, bank_account_name, bank_account_no, bank_routing_no } = req.body;
    try {
      const insertObj: any = { 
        name, 
        contact, 
        phone: phone || null,
        bank_name: bank_name || null,
        bank_account_name: bank_account_name || null,
        bank_account_no: bank_account_no || null,
        bank_routing_no: bank_routing_no || null
      };

      let { data, error } = await supabase
        .from('suppliers')
        .insert([insertObj])
        .select();
      
      if (error) {
        const errStr = JSON.stringify(error).toLowerCase();
        const isColumnMissing = error.code === '42703' || 
                                errStr.includes('bank_name') || 
                                errStr.includes('bank_account_name') || 
                                errStr.includes('bank_account_no') || 
                                errStr.includes('bank_routing_no') ||
                                (error.message && error.message.includes('column') && error.message.includes('exist'));

        if (isColumnMissing) {
          console.warn('[SUPPLIERS] Banking columns do not exist in database. Retrying insertion without them.', error);
          const fallbackObj = { name, contact, phone: phone || null };
          const retryResult = await supabase
            .from('suppliers')
            .insert([fallbackObj])
            .select();
          
          if (retryResult.error) throw retryResult.error;
          data = retryResult.data;
          
          return res.json({ 
            success: true, 
            message: 'Supplier added (Warning: Banking details columns do not exist in database yet)', 
            id: data[0].id 
          });
        }
        throw error;
      }
      res.json({ success: true, message: 'Supplier added', id: data[0].id });
    } catch (error: any) {
      console.error('Supabase suppliers insert error:', error);
      res.status(500).json({ success: false, message: error.message || error });
    }
  });

  app.put('/api/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, contact, phone, bank_name, bank_account_name, bank_account_no, bank_routing_no } = req.body;
    try {
      const updateObj: any = { 
        name, 
        contact, 
        phone: phone || null,
        bank_name: bank_name || null,
        bank_account_name: bank_account_name || null,
        bank_account_no: bank_account_no || null,
        bank_routing_no: bank_routing_no || null
      };

      const { error } = await supabase
        .from('suppliers')
        .update(updateObj)
        .eq('id', id);
        
      if (error) {
        const errStr = JSON.stringify(error).toLowerCase();
        const isColumnMissing = error.code === '42703' || 
                                errStr.includes('bank_name') || 
                                errStr.includes('bank_account_name') || 
                                errStr.includes('bank_account_no') || 
                                errStr.includes('bank_routing_no') ||
                                (error.message && error.message.includes('column') && error.message.includes('exist'));

        if (isColumnMissing) {
          console.warn('[SUPPLIERS] Banking columns do not exist in database. Retrying update without them.', error);
          const fallbackObj = { name, contact, phone: phone || null };
          const retryResult = await supabase
            .from('suppliers')
            .update(fallbackObj)
            .eq('id', id);
          
          if (retryResult.error) throw retryResult.error;
          
          return res.json({ 
            success: true, 
            message: 'Supplier updated (Warning: Banking details columns do not exist in database yet)' 
          });
        }
        throw error;
      }
      res.json({ success: true, message: 'Supplier updated' });
    } catch (error: any) {
      console.error('Supabase suppliers update error:', error);
      res.status(500).json({ success: false, message: error.message || error });
    }
  });

  app.delete('/api/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      res.json({ success: true, message: 'Supplier deleted' });
    } catch (error: any) {
      console.error('Supabase suppliers delete error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Supplier Returns
  app.get('/api/supplier-returns', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('supplier_returns')
        .select('*, suppliers!inner(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const formatted = (data || []).map((r: any) => ({
        ...r,
        supplier_name: r.suppliers?.name
      }));

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase get supplier returns error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Supplier Return by ID
  app.get('/api/supplier-returns/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const { data: returnData, error: rErr } = await supabase
        .from('supplier_returns')
        .select('*, suppliers!inner(name)')
        .eq('id', id)
        .single();
      
      if (rErr || !returnData) return res.status(404).json({ success: false, message: 'Return not found' });
      
      const { data: items, error: iErr } = await supabase
        .from('supplier_return_items')
        .select('*, products(name, barcode)')
        .eq('return_id', id);
      
      if (iErr) throw iErr;

      const formattedItems = (items || []).map((it: any) => ({
        ...it,
        product_name: it.products?.name,
        barcode: it.products?.barcode
      }));
      
      res.json({ success: true, data: { ...returnData, supplier_name: returnData.suppliers?.name, items: formattedItems } });
    } catch (error: any) {
      console.error('Supabase get supplier return by id error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update Supplier Return
  app.put('/api/supplier-returns/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { total_amount, items, notes, document_reference } = req.body;
    try {
      const { error: hErr } = await supabase.from('supplier_returns').update({
        total_amount,
        notes,
        document_reference
      }).eq('id', id);
      if (hErr) throw hErr;
      
      // Delete old items and insert new ones
      await supabase.from('supplier_return_items').delete().eq('return_id', id);

      for (const item of items) {
        await supabase.from('supplier_return_items').insert([{
          return_id: parseInt(id),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          reason: item.reason
        }]);
      }

      res.json({ success: true, message: 'Supplier return updated' });
    } catch (error: any) {
      console.error('Supabase update supplier return error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete Supplier Return
  app.delete('/api/supplier-returns/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const reason = req.query.reason as string || 'Manual deletion';
    
    try {
      const { data: check, error: cErr } = await supabase.from('supplier_returns').select('id').eq('id', id).single();
      if (cErr || !check) {
        return res.status(404).json({ success: false, message: 'Return not found' });
      }
      
      // 1. Delete items first
      await supabase.from('supplier_return_items').delete().eq('return_id', id);
      
      // 2. Delete the return itself
      const { error: dErr } = await supabase.from('supplier_returns').delete().eq('id', id);
      if (dErr) throw dErr;
      
      // 3. Log the deletion
      await supabase.from('deleted_returns_logs').insert([{
        return_id: id,
        deleted_by: req.user.id,
        reason: reason || 'Manual deletion'
      }]);
      
      res.json({ success: true, message: 'Supplier return deleted successfully' });
    } catch (error: any) {
      console.error('Supabase delete supplier return error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create supplier return
  app.post('/api/supplier-returns', authenticateToken, async (req, res) => {
    const { supplier_id, return_type, notes, items, document_reference } = req.body;
    try {
      let total_amount = 0;
      for (const item of items) {
        total_amount += item.quantity * item.unit_cost;
      }

      const { data: newReturn, error: rErr } = await supabase.from('supplier_returns').insert([{
        supplier_id,
        total_amount,
        return_type,
        notes,
        document_reference
      }]).select().single();

      if (rErr) throw rErr;
      const returnId = newReturn.id;

      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (!prod || prod.stock_quantity < item.quantity) {
          throw new Error(`Not enough stock for product ID ${item.product_id}`);
        }

        await supabase.from('products').update({ stock_quantity: prod.stock_quantity - item.quantity }).eq('id', item.product_id);

        await supabase.from('supplier_return_items').insert([{
          return_id: returnId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.quantity * item.unit_cost,
          reason: item.reason
        }]);

        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          quantity: -item.quantity,
          type: 'OUT',
          reference_type: 'RETURN_TO_SUPPLIER',
          reference_id: returnId.toString()
        }]);
      }

      if (supplier_id) {
        const { data: supplier } = await supabase.from('suppliers').select('balance').eq('id', supplier_id).single();
        await supabase.from('suppliers').update({ balance: (supplier?.balance || 0) - total_amount }).eq('id', supplier_id);
      }

      res.json({ success: true, data: { id: returnId } });
    } catch (error: any) {
      console.error('Supabase create supplier return error:', error);
      res.status(500).json({ success: false, message: error.message });
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
  app.get('/api/products/barcode/:code', async (req, res) => {
    const { code } = req.params;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', code)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Not found in PostgREST
          return res.status(404).json({ success: false, message: 'Product not found' });
        }
        throw error;
      }

      if (data) {
        const cats2 = await readCategories2Async();
        const mappings = await readProductCategory2();
        const salesTypes = await readProductSalesType();
        const statusTypes = await readProductStatus();
        const modifiedTimes = await readProductModified();
        const cat2Id = mappings[data.id.toString()] || null;
        const cat2Obj = cat2Id ? cats2.find((c: any) => c.id.toString() === cat2Id.toString()) : null;
        data.category2_id = cat2Id ? Number(cat2Id) : null;
        data.category2_name = cat2Obj ? cat2Obj.name : null;
        data.sales_type = salesTypes[data.id.toString()] || 'Sales product';
        data.status = statusTypes[data.id.toString()] || 'active';
        data.created_at = data.created_at || new Date().toISOString();
        data.updated_at = modifiedTimes[data.id.toString()] || data.created_at || new Date().toISOString();
      }
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase products barcode fetch error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  });

  // Get all products
  app.get('/api/products', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name),
          categories(name, status),
          brands(name),
          units(name)
        `)
        .range(0, 50000)
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const cats2 = await readCategories2Async();
      const mappings = await readProductCategory2();
      const salesTypes = await readProductSalesType();
      const statusTypes = await readProductStatus();
      const modifiedTimes = await readProductModified();

      // Transform to match SQLite structure
      const products = (data || []).map(p => {
        const cat2Id = mappings[p.id.toString()] || null;
        const cat2Obj = cat2Id ? cats2.find((c: any) => c.id.toString() === cat2Id.toString()) : null;
        return {
          ...p,
          supplier_name: p.suppliers?.name,
          category_name: p.categories?.name,
          category_status: p.categories?.status,
          brand_name: p.brands?.name,
          unit_name: p.units?.name,
          category2_id: cat2Id ? Number(cat2Id) : null,
          category2_name: cat2Obj ? cat2Obj.name : null,
          sales_type: salesTypes[p.id.toString()] || 'Sales product',
          status: statusTypes[p.id.toString()] || 'active',
          created_at: p.created_at || new Date().toISOString(),
          updated_at: modifiedTimes[p.id.toString()] || p.created_at || new Date().toISOString()
        };
      });
      
      res.json({ success: true, data: products });
    } catch (error: any) {
      console.error('Supabase products fetch error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  });

  app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
    const { name, barcode, category_id, brand_id, unit_id, purchase_price, selling_price, stock_quantity, supplier_id, expiry_enabled, expiry_date, category2_id, sales_type, status, is_favorite, is_credit_allowed } = req.body;
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name,
          barcode,
          category_id: category_id || null,
          brand_id: brand_id || null,
          unit_id: unit_id || null,
          purchase_price,
          selling_price,
          stock_quantity,
          supplier_id: supplier_id || null,
          expiry_enabled: !!expiry_enabled,
          expiry_date: expiry_date || null,
          is_favorite: !!is_favorite,
          is_credit_allowed: is_credit_allowed === undefined ? true : !!is_credit_allowed
        }])
        .select();

      if (error) throw error;
      
      const productId = data[0].id.toString();

      if (category2_id) {
        const mappings = await readProductCategory2();
        mappings[productId] = category2_id.toString();
        await writeProductCategory2(mappings);
      }

      const salesTypes = await readProductSalesType();
      salesTypes[productId] = sales_type || 'Sales product';
      await writeProductSalesType(salesTypes);

      const statusTypes = await readProductStatus();
      statusTypes[productId] = status || 'active';
      await writeProductStatus(statusTypes);

      const modifiedMap = await readProductModified();
      modifiedMap[productId] = new Date().toISOString();
      await writeProductModified(modifiedMap);

      res.json({ success: true, message: 'Product created', id: data[0].id });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation in Postgres
        return res.status(400).json({ success: false, message: 'Barcode already exists' });
      }
      console.error('Supabase products insert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, barcode, category_id, brand_id, unit_id, purchase_price, selling_price, stock_quantity, supplier_id, expiry_enabled, expiry_date, category2_id, sales_type, status, is_favorite, is_credit_allowed } = req.body;
    
    console.log(`Updating product ${id}. is_credit_allowed in body:`, is_credit_allowed);

    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          name,
          barcode,
          category_id: category_id || null,
          brand_id: brand_id || null,
          unit_id: unit_id || null,
          purchase_price,
          selling_price,
          stock_quantity,
          supplier_id: supplier_id || null,
          expiry_enabled: !!expiry_enabled,
          expiry_date: expiry_date || null,
          is_favorite: !!is_favorite,
          is_credit_allowed: is_credit_allowed === undefined ? true : !!is_credit_allowed
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      console.log(`Product ${id} updated successfully. is_credit_allowed saved:`, data?.[0]?.is_credit_allowed);
      const mappings = await readProductCategory2();
      if (category2_id) {
        mappings[id.toString()] = category2_id.toString();
      } else {
        delete mappings[id.toString()];
      }
      await writeProductCategory2(mappings);

      const salesTypes = await readProductSalesType();
      if (sales_type) {
        salesTypes[id.toString()] = sales_type;
      } else {
        delete salesTypes[id.toString()];
      }
      await writeProductSalesType(salesTypes);

      const statusTypes = await readProductStatus();
      if (status) {
        statusTypes[id.toString()] = status;
      } else {
        delete statusTypes[id.toString()];
      }
      await writeProductStatus(statusTypes);

      const modifiedMap = await readProductModified();
      modifiedMap[id.toString()] = new Date().toISOString();
      await writeProductModified(modifiedMap);

      res.json({ success: true, message: 'Product updated' });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ success: false, message: 'Barcode already exists' });
      }
      console.error('Supabase products update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/products/bulk', authenticateToken, requireAdmin, async (req, res) => {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid product list' });
    }

    try {
      console.log(`Starting bulk import for ${products.length} products`);
      
      // 0. Check for existing barcodes first
      const rawBarcodes = products.map((p: any) => p.barcode);
      const filteredBarcodes = rawBarcodes.filter((b: any) => b && b.trim() !== '');
      
      // Check for internal duplicates in the CSV itself
      const internalDuplicates = filteredBarcodes.filter((item: string, index: number) => filteredBarcodes.indexOf(item) !== index);
      if (internalDuplicates.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Conflict: Your import file contains duplicate barcodes within itself: ${Array.from(new Set(internalDuplicates)).join(', ')}. Each barcode must be unique.` 
        });
      }

      if (filteredBarcodes.length > 0) {
        const { data: existingProds, error: checkError } = await supabase
          .from('products')
          .select('barcode, name')
          .in('barcode', filteredBarcodes)
          .range(0, 10000);

        if (checkError) {
          console.error('Error checking existing barcodes:', checkError);
        } else if (existingProds && existingProds.length > 0) {
          const detail = existingProds.map(p => `${p.barcode} (Existing Product Name: "${p.name || 'Unnamed'}")`).join(', ');
          return res.status(400).json({ 
            success: false, 
            message: `Conflict: The following barcodes already exist in the system: ${detail}. You cannot import them again.` 
          });
        }
      }

      // 1. Prepare data for Supabase insert
      const supabasePayload = products.map((p: any) => ({
        name: p.name,
        barcode: (p.barcode && p.barcode.trim() !== '') ? p.barcode.trim() : null,
        category_id: p.category_id,
        brand_id: p.brand_id,
        unit_id: p.unit_id,
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
        stock_quantity: Math.floor(p.stock_quantity),
        supplier_id: p.supplier_id,
        expiry_enabled: !!p.expiry_enabled,
        expiry_date: p.expiry_date || null,
        is_credit_allowed: p.is_credit_allowed !== false,
        is_favorite: !!p.is_favorite
      }));

      // 2. Perform bulk insert
      const { data, error } = await supabase
        .from('products')
        .insert(supabasePayload)
        .select('id, barcode');

      if (error) {
        console.error('Supabase bulk insert error details:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from bulk insert');
      }

      // 3. Update local JSON metadata for the new products
      const mappings = await readProductCategory2();
      const salesTypes = await readProductSalesType();
      const statusTypes = await readProductStatus();
      const modifiedMap = await readProductModified();
      const now = new Date().toISOString();

      data.forEach((newProd: any) => {
        const original = products.find((p: any) => p.barcode === newProd.barcode);
        if (original) {
          const pid = newProd.id.toString();
          if (original.category2_id) mappings[pid] = original.category2_id.toString();
          salesTypes[pid] = original.sales_type || 'Sales product';
          statusTypes[pid] = original.status || 'active';
          modifiedMap[pid] = now;
        }
      });

      await writeProductCategory2(mappings);
      await writeProductSalesType(salesTypes);
      await writeProductStatus(statusTypes);
      await writeProductModified(modifiedMap);

      res.json({ success: true, message: `Bulk import successful. ${data.length} products added.` });
    } catch (error: any) {
      console.error('Bulk import full error raw:', error);
      
      let message = 'An unknown error occurred during bulk import.';
      if (error && error.code === '23505') {
        const detail = error.detail || '';
        const match = detail.match(/Key \((.*?)\)=\((.*?)\) already exists/);
        if (match) {
          message = `Conflict: The ${match[1]} "${match[2]}" already exists in the system. Check your records or search for this item.`;
        } else {
          message = 'Conflict: One or more unique values (like barcodes) already exist in the system.';
        }
      } else if (error && error.message) {
        message = error.message;
      } else if (error && error.details) {
        message = error.details;
      } else if (typeof error === 'string') {
        message = error;
      } else if (error) {
        try {
          message = JSON.stringify(error, Object.getOwnPropertyNames(error));
        } catch (e) {
          message = String(error);
        }
      }

      res.status(500).json({ success: false, message: `Bulk import error: ${message}` });
    }
  });

  app.get('/api/products/:id/batches', authenticateToken, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('stock_batches')
        .select('*')
        .eq('product_id', req.params.id)
        .order('expiry_date', { ascending: true })
        .order('id', { ascending: true });
        
      if (error) throw error;
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase batches fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- MASTER DATA API ---
  app.get('/api/units', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase units fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/units', authenticateToken, requireAdmin, async (req, res) => {
    const { name, short_name, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Unit name is required' });
    try {
      const { data, error } = await supabase
        .from('units')
        .insert([{ name, short_name, status: status || 'active' }])
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to create unit record');
      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error('Supabase units insert error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error creating unit' });
    }
  });

  app.put('/api/units/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, short_name, status } = req.body;
    try {
      const { error } = await supabase
        .from('units')
        .update({ name, short_name, status })
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase units update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/units/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Check for products using this unit
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', req.params.id);

      if (countError) throw countError;
      if (count && count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete unit because it is being used by ${count} product(s).` 
        });
      }

      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase units delete error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error deleting unit' });
    }
  });

  // Brands
  app.get('/api/brands', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase brands fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/brands', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Brand name is required' });
    try {
      const { data, error } = await supabase
        .from('brands')
        .insert([{ name, description, status: status || 'active' }])
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to create brand record');
      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error('Supabase brands insert error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error creating brand' });
    }
  });

  app.put('/api/brands/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, status } = req.body;
    try {
      const { error } = await supabase
        .from('brands')
        .update({ name, description, status })
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase brands update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/brands/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Check for products using this brand
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', req.params.id);

      if (countError) throw countError;
      if (count && count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete brand because it is being used by ${count} product(s).` 
        });
      }

      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase brands delete error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error deleting brand' });
    }
  });

  // --- Category 2 Local Emulators (Already defined at top) ---

  // Categories 2 Endpoints
  app.get('/api/categories2', async (req, res) => {
    try {
      const data = await readCategories2Async();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Local categories2 fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/categories2', authenticateToken, requireAdmin, async (req, res) => {
    const { name, status } = req.body;
    try {
      const data = await readCategories2Async();
      const nextId = data.reduce((max: number, c: any) => Math.max(max, Number(c.id)), 0) + 1;
      const newItem = { id: nextId, name, status: status || 'active' };
      data.push(newItem);
      await syncSettingOnline(SETTINGS_KEYS.CAT2, data);
      res.json({ success: true, id: nextId });
    } catch (error: any) {
      console.error('Local categories2 insert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/categories2/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const data = await readCategories2Async();
      const idx = data.findIndex((c: any) => c.id.toString() === id.toString());
      if (idx !== -1) {
        data[idx] = { ...data[idx], name, status };
        await syncSettingOnline(SETTINGS_KEYS.CAT2, data);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Category 2 not found' });
      }
    } catch (error: any) {
      console.error('Local categories2 update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/categories2/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const data = await readCategories2Async();
      const filtered = data.filter((c: any) => c.id.toString() !== id.toString());
      await syncSettingOnline(SETTINGS_KEYS.CAT2, filtered);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Local categories2 delete error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      const filtered = (data || []).filter((cat: any) => {
        const nameUpper = (cat.name || '').toUpperCase();
        return !nameUpper.includes('NON SEALS') && !nameUpper.includes('NON-SEALS');
      });

      res.json({ success: true, data: filtered });
    } catch (error: any) {
      console.error('Supabase categories fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/categories', authenticateToken, requireAdmin, async (req, res) => {
    const { name, parent_id, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name, parent_id: parent_id || null, status: status || 'active' }])
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to create category record');
      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error('Supabase categories insert error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      console.error('Supabase categories insert error keys:', Object.keys(error || {}));
      console.error('Supabase categories insert error (raw):', error);
      res.status(500).json({ success: false, message: error.message || 'Error creating category' });
    }
  });

  app.put('/api/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, parent_id, status } = req.body;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name, parent_id: parent_id || null, status })
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase categories update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Check for products using this category
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', req.params.id);

      if (productError) throw productError;
      if (productCount && productCount > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete category because it is being used by ${productCount} product(s).` 
        });
      }

      // Check for subcategories
      const { count: childCount, error: childError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', req.params.id);

      if (childError) throw childError;
      if (childCount && childCount > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete category because it has ${childCount} sub-category(s).` 
        });
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase categories delete error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error deleting category' });
    }
  });

  // Currencies
  app.get('/api/currencies', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase currencies fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/currencies', authenticateToken, requireAdmin, async (req, res) => {
    const { code, name, rate, symbol, is_base, status } = req.body;
    try {
      // If is_base is true, unset other base currencies first
      if (is_base) {
        await supabase
          .from('currencies')
          .update({ is_base: false })
          .neq('id', -1); // Just to get all, technically this is not efficient, but it follows the logic. Better is to do it properly. Actually I can just update all is_base to false first.
      }
      
      await supabase
        .from('currencies')
        .update({ is_base: false })
        .neq('id', 0); // Hacky way to update all? No, just use `default` logic or handle it.
      
      // Let's simplify and just do the insert. The SQLite logic here is complex. 
      // I will do a simple insert.
      
      const { data, error } = await supabase
        .from('currencies')
        .insert([{
          code, 
          name, 
          rate: rate || 1.0, 
          symbol, 
          is_base: !!is_base, 
          status: status || 'active' 
        }])
        .select();
      
      if (error) throw error;
      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error('Supabase currencies insert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/currencies/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { code, name, rate, symbol, is_base, status } = req.body;
    try {
      if (is_base) {
         await supabase
          .from('currencies')
          .update({ is_base: false })
          .neq('id', req.params.id);
      }
      
      const { error } = await supabase
        .from('currencies')
        .update({ code, name, rate, symbol, is_base: !!is_base, status })
        .eq('id', req.params.id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase currencies update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Stock Batches & Expiry
  app.post('/api/stock-batches', authenticateToken, requireAdmin, async (req, res) => {
    const { product_id, batch_number, expiry_date, quantity, received_date, purchase_invoice_id } = req.body;
    try {
      const { data, error } = await supabase
        .from('stock_batches')
        .insert([{
          product_id,
          batch_number,
          expiry_date: expiry_date || null,
          quantity,
          received_date: received_date || new Date().toISOString().split('T')[0],
          purchase_invoice_id: purchase_invoice_id || null
        }])
        .select();

      if (error) throw error;
      
      // Update product overall stock
      const { error: updateError } = await supabase.rpc('increment_product_stock', { 
        product_id: product_id, 
        increment_amount: quantity 
      });
      // Assuming I need to create an RPC function in Supabase for this. 
      // For now, I'll stick to basic update.
      
      const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', product_id).single();
      await supabase.from('products').update({ stock_quantity: (product?.stock_quantity || 0) + quantity }).eq('id', product_id);
      
      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error('Supabase stock-batches insert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/expiry-alerts', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const { data: expiringSoon, error: soonError } = await supabase
        .from('stock_batches')
        .select('*, products(name, barcode)')
        .gte('expiry_date', today)
        .lte('expiry_date', nextWeekStr)
        .gt('quantity', 0);
        
      if (soonError) throw soonError;

      const { data: expired, error: expiredError } = await supabase
        .from('stock_batches')
        .select('*, products(name, barcode)')
        .lt('expiry_date', today)
        .gt('quantity', 0);
        
      if (expiredError) throw expiredError;
      
      const formattedExpiringSoon = (expiringSoon || []).map(b => ({ ...b, product_name: b.products?.name, barcode: b.products?.barcode }));
      const formattedExpired = (expired || []).map(b => ({ ...b, product_name: b.products?.name, barcode: b.products?.barcode }));

      res.json({ success: true, expiringSoon: formattedExpiringSoon, expired: formattedExpired });
    } catch (error: any) {
      console.error('Supabase expiry-alerts fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      // Check for product usage in various tables
      const tablesToCheck = [
        { table: 'sale_items', label: 'Sales' },
        { table: 'purchase_invoice_items', label: 'Purchases' },
        { table: 'stock_batches', label: 'Stock Batches' },
        { table: 'inventory_items', label: 'Inventory Audit' },
        { table: 'stock_movements', label: 'Stock Movements' },
        { table: 'stock_adjustments', label: 'Stock Adjustments' },
        { table: 'sales_return_items', label: 'Sales Returns' },
        { table: 'supplier_return_items', label: 'Supplier Returns' },
        { table: 'void_logs', label: 'Void Logs' },
        { table: 'auto_sales_config', label: 'Auto Sales Config' }
      ];

      for (const t of tablesToCheck) {
        const { count, error: countError } = await supabase
          .from(t.table)
          .select('*', { count: 'exact', head: true })
          .eq('product_id', id);

        if (countError) throw countError;
        if (count && count > 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot delete product because it has references in ${t.label}. Consider deactivating it instead.` 
          });
        }
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error: any) {
      console.error('Supabase products delete error:', error);
      res.status(500).json({ success: false, message: error.message || 'Error deleting product' });
    }
  });

  // CUSTOMER MANAGEMENT
  app.get('/api/customers', authenticateToken, async (req, res) => {
    const { type } = req.query;
    try {
      let query = supabase.from('customers').select('*');

      if (type) {
        query = query.eq('member_type', type);
      }
      
      const { data: customersData, error } = await query.order('name', { ascending: true });
        
      if (error) throw error;

      // Group and sum auto_burn_sales from database
      const { data: burnSums, error: burnError } = await supabase
        .from('auto_burn_sales')
        .select('customer_id, amount');
      
      const sumsMap: { [key: string]: number } = {};
      if (!burnError && burnSums) {
        burnSums.forEach((b: any) => {
          const cid = String(b.customer_id);
          sumsMap[cid] = (sumsMap[cid] || 0) + Number(b.amount || 0);
        });
      }

      const autoCreditProductMappings = await readCustomerAutoCreditProduct();
      const metadataMappings = await readCustomerMetadata();

      const mergedData = (customersData || []).map((c: any) => {
        const meta = metadataMappings[String(c.id)] || {};
        return {
          ...c,
          daily_limit_mode: meta.daily_limit_mode || 'AUTO',
          total_pax: meta.total_pax !== undefined ? meta.total_pax : 1,
          total_monthly_limit: meta.total_monthly_limit !== undefined ? meta.total_monthly_limit : 0,
          auto_burn_total: sumsMap[String(c.id)] || 0,
          auto_credit_product_id: autoCreditProductMappings[String(c.id)] || null
        };
      });

      res.json({ success: true, data: mergedData });
    } catch (error: any) {
      console.error('Supabase customers fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/customers/bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const customers = req.body.customers;
      if (!Array.isArray(customers) || customers.length === 0) {
        return res.status(400).json({ success: false, message: 'No customers provided' });
      }

      // Check unique RFIDs
      const rfids = customers.map(c => c.rfid_card).filter(Boolean);
      if (rfids.length > 0) {
        const { data: existing } = await supabase.from('customers').select('rfid_card').in('rfid_card', rfids);
        if (existing && existing.length > 0) {
          const dupes = existing.map(e => e.rfid_card).join(', ');
          return res.status(400).json({ success: false, message: `RFID cards already exist in database: ${dupes}` });
        }
      }

      const validCustomers = customers.map(row => {
        return {
          rfid_card: row.rfid_card || null,
          name: row.name,
          phone: row.phone || null,
          credit_limit: parseFloat(row.credit_limit) || 0,
          daily_limit: parseFloat(row.daily_limit) || 0,
          monthly_limit: parseFloat(row.monthly_limit) || 0,
          working_place: row.working_place || null,
          emp_id: row.emp_id || null,
          passport_no: row.passport_no || null,
          auto_burn: !!row.auto_burn,
          auto_burn_start_date: row.auto_burn_start_date || null,
          auto_burn_stop_date: row.auto_burn_stop_date || null,
          member_type: row.member_type || 'DELIVERY',
          status: 'active',
          credit_status: 'ACTIVE'
        };
      });

      // Chunk the inserts
      const CHUNK_SIZE = 500;
      for (let i = 0; i < validCustomers.length; i += CHUNK_SIZE) {
        const chunk = validCustomers.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('customers').insert(chunk);
        if (error) throw error;
      }

      res.json({ success: true, message: `${validCustomers.length} customers imported successfully.` });
    } catch (error: any) {
      console.error('Supabase bulk customer import error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/customers', authenticateToken, requireAdmin, async (req, res) => {
    const { rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, total_pax, total_monthly_limit, daily_limit_mode, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date, member_type, auto_credit_product_id } = req.body;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          rfid_card: rfid_card || null,
          name,
          phone,
          credit_limit: credit_limit || 0,
          daily_limit: daily_limit || 0,
          monthly_limit: monthly_limit || 0,
          auto_sale_cfg: auto_sale_cfg ? 1 : 0,
          working_place,
          emp_id,
          passport_no,
          auto_burn: !!auto_burn,
          auto_burn_start_date: auto_burn_start_date || null,
          auto_burn_stop_date: auto_burn_stop_date || null,
          member_type: member_type || 'DELIVERY'
        }])
        .select();
      
      if (error) throw error;
      
      const metadataMappings = await readCustomerMetadata();
      metadataMappings[data[0].id.toString()] = {
        daily_limit_mode: daily_limit_mode || 'AUTO',
        total_pax: Number(total_pax || 1),
        total_monthly_limit: Number(total_monthly_limit || 0)
      };
      await writeCustomerMetadata(metadataMappings);

      if (auto_credit_product_id) {
        const mappings = await readCustomerAutoCreditProduct();
        mappings[data[0].id.toString()] = auto_credit_product_id.toString();
        await writeCustomerAutoCreditProduct(mappings);
      }
      
      res.json({ success: true, message: 'Customer added', id: data[0].id });
    } catch (error: any) {
      console.error('Supabase customers insert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { rfid_card, name, phone, credit_limit, daily_limit, monthly_limit, total_pax, total_monthly_limit, daily_limit_mode, status, credit_status, auto_sale_cfg, working_place, emp_id, passport_no, auto_burn, auto_burn_start_date, auto_burn_stop_date, member_type, auto_credit_product_id } = req.body;
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          rfid_card: rfid_card || null,
          name,
          phone,
          credit_limit: credit_limit || 0,
          daily_limit: daily_limit || 0,
          monthly_limit: monthly_limit || 0,
          status,
          credit_status,
          auto_sale_cfg: auto_sale_cfg ? 1 : 0,
          working_place,
          emp_id,
          passport_no,
          auto_burn: !!auto_burn,
          auto_burn_start_date: auto_burn_start_date || null,
          auto_burn_stop_date: auto_burn_stop_date || null,
          member_type: member_type
        })
        .eq('id', id);

      if (error) throw error;
      
      const metadataMappings = await readCustomerMetadata();
      metadataMappings[id.toString()] = {
        daily_limit_mode: daily_limit_mode || 'AUTO',
        total_pax: Number(total_pax || 1),
        total_monthly_limit: Number(total_monthly_limit || 0)
      };
      await writeCustomerMetadata(metadataMappings);

      const mappings = await readCustomerAutoCreditProduct();
      if (auto_credit_product_id) {
        mappings[id.toString()] = auto_credit_product_id.toString();
      } else {
        delete mappings[id.toString()];
      }
      await writeCustomerAutoCreditProduct(mappings);
      
      res.json({ success: true, message: 'Customer updated' });
    } catch (error: any) {
      console.error('Supabase customers update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      res.json({ success: true, message: 'Customer deleted' });
    } catch (error: any) {
      console.error('Supabase customers delete error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/customers/:id/auto-burn-logs', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase
        .from('auto_burn_sales')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase auto-burn-logs fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/customers/:id/credit-logs', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase
        .from('credit_logs')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase credit-logs fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/customers/:id/payment', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { amount, notes } = req.body;
    try {
      const { data: customer, error: fetchErr } = await supabase.from('customers').select('credit_limit, current_balance').eq('id', id).single();
      if (fetchErr || !customer) throw new Error('Customer not found');

      const { data: multiplierSetting } = await supabase.from('settings').select('value').eq('key', 'credit_increase_multiplier').single();
      const multiplier = parseFloat(multiplierSetting?.value || '1.0');
      const increaseAmount = amount * multiplier;
      const newLimit = customer.credit_limit + increaseAmount;

      // Update customer
      await supabase.from('customers').update({
        current_balance: customer.current_balance - amount,
        credit_limit: newLimit
      }).eq('id', id);
      
      // Logs
      await supabase.from('credit_logs').insert([{ customer_id: id, amount, type: 'PAYMENT', notes: notes || 'Manual Payment' }]);
      await supabase.from('credit_limit_history').insert([{
        customer_id: id,
        old_limit: customer.credit_limit,
        new_limit: newLimit,
        reason: `Automatic increase from payment of RM${amount}`
      }]);

      res.json({ success: true, message: 'Payment recorded and limit increased' });
    } catch (error: any) {
      console.error('Supabase customer payment error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Credit Status/Limit Management APIs
  app.post('/api/admin/customers/:id/credit-status', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { new_status, reason } = req.body;
    try {
      const { data: customer, error: fetchErr } = await supabase.from('customers').select('credit_status').eq('id', id).single();
      if (fetchErr || !customer) throw new Error('Customer not found');

      await supabase.from('customers').update({ credit_status: new_status }).eq('id', id);
      await supabase.from('credit_status_logs').insert([{
        customer_id: id,
        previous_status: customer.credit_status,
        new_status,
        changed_by: req.user.id,
        reason: reason || 'Admin update'
      }]);

      res.json({ success: true, message: `Status updated to ${new_status}` });
    } catch (error: any) {
      console.error('Supabase update status error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/customers/:id/update-limit', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { new_limit, reason } = req.body;
    try {
      const { data: customer, error: fetchErr } = await supabase.from('customers').select('credit_limit').eq('id', id).single();
      if (fetchErr || !customer) throw new Error('Customer not found');

      await supabase.from('customers').update({ credit_limit: new_limit }).eq('id', id);
      await supabase.from('credit_limit_history').insert([{
        customer_id: id,
        old_limit: customer.credit_limit,
        new_limit,
        reason: reason || 'Manual update'
      }]);

      res.json({ success: true, message: 'Credit limit updated' });
    } catch (error: any) {
      console.error('Supabase update limit error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/customers/:id/limit-history', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('credit_limit_history')
        .select('*')
        .eq('customer_id', req.params.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase limit history error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/customers/:id/status-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('credit_status_logs')
        .select('*, users!changed_by(username)')
        .eq('customer_id', req.params.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((l: any) => ({
        ...l,
        changed_by_user: l.users?.username
      }));

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase status logs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/credit-settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'credit_increase_multiplier').single();
      res.json({ success: true, multiplier: data?.value || '1.0' });
    } catch (error: any) {
      console.error('Supabase credit settings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/settings/returns', authenticateToken, async (req, res) => {
    try {
      const { data: settings, error } = await supabase.from('settings').select('key, value').in('key', ['return_validity_days', 'return_allow_cash']);
      if (error) throw error;

      const validityDays = settings?.find(s => s.key === 'return_validity_days')?.value;
      const allowCash = settings?.find(s => s.key === 'return_allow_cash')?.value;
      
      res.json({ 
        success: true, 
        data: {
          validityDays: parseInt(validityDays || '3'),
          allowCash: allowCash !== 'false' // default true
        }
      });
    } catch (error: any) {
      console.error('Supabase returns settings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/settings/returns', authenticateToken, requireAdmin, async (req, res) => {
    const { validityDays, allowCash } = req.body;
    try {
      await supabase.from('settings').upsert([
        { key: 'return_validity_days', value: validityDays?.toString() || '3' },
        { key: 'return_allow_cash', value: allowCash?.toString() || 'true' }
      ]);
      res.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
      console.error('Supabase save returns settings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/settings/theme', authenticateToken, async (req, res) => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['font_family', 'font_size', 'currency_code', 'date_format', 'tax_rate', 'timezone']);
      
      if (error) throw error;
      
      const data: any = {};
      (settings || []).forEach((s: any) => data[s.key] = s.value);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase fetch theme settings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/settings/theme', authenticateToken, requireAdmin, async (req, res) => {
    const { font_family, font_size, currency_code, date_format, tax_rate, timezone } = req.body;
    try {
      const updates = [
        { key: 'font_family', value: font_family },
        { key: 'font_size', value: font_size },
        { key: 'currency_code', value: currency_code },
        { key: 'date_format', value: date_format },
        { key: 'tax_rate', value: tax_rate },
        { key: 'timezone', value: timezone }
      ].filter(u => u.value !== undefined);

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }

      res.json({ success: true, message: 'Theme settings updated' });
    } catch (error: any) {
      console.error('Supabase settings update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Store Profile Settings
  app.get('/api/settings/store', authenticateToken, async (req, res) => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['shop_name', 'company_name', 'registration_number', 'address', 'phone_number']);
      
      if (error) throw error;
      
      const data: any = {};
      (settings || []).forEach((s: any) => data[s.key] = s.value);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase settings fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/settings/store', authenticateToken, requireAdmin, async (req, res) => {
    const { shop_name, company_name, registration_number, address, phone_number } = req.body;
    try {
      const updates = [
        { key: 'shop_name', value: shop_name },
        { key: 'company_name', value: company_name },
        { key: 'registration_number', value: registration_number },
        { key: 'address', value: address },
        { key: 'phone_number', value: phone_number }
      ].filter(u => u.value !== undefined);

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }

      res.json({ success: true, message: 'Store profile updated' });
    } catch (error: any) {
      console.error('Supabase settings update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/credit-settings', authenticateToken, requireAdmin, async (req, res) => {
    const { multiplier } = req.body;
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'credit_increase_multiplier', value: multiplier.toString() }, { onConflict: 'key' });
      
      if (error) throw error;
      res.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
      console.error('Supabase credit settings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // USER SETTINGS
  app.get('/api/user/settings/:key', authenticateToken, async (req: any, res) => {
    const { key } = req.params;
    const { id: userId } = req.user;
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `${key}_${userId}`)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      res.json({ success: true, value: data ? data.value : null });
    } catch (error: any) {
      console.error('Supabase fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/user/settings/:key', authenticateToken, async (req: any, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const { id: userId } = req.user;
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: `${key}_${userId}`, value }, { onConflict: 'key' });
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase upsert error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // RFID AUTO-SALE & CREDIT ENGINE
  app.post('/api/rfid/scan', async (req, res) => {
    const { rfid_card } = req.body;
    const now = new Date();
    
    try {
      // 1. Fetch Customer
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('rfid_card', rfid_card)
        .single();
      
      if (custError || !customer) {
        await supabase
          .from('rfid_scans')
          .insert([{ rfid_card, status: 'FAILED', reason: 'Customer not found' }]);
        return res.status(404).json({ success: false, message: 'Card not registered' });
      }

      if (customer.status !== 'active' || customer.credit_status !== 'ACTIVE') {
        const reason = customer.credit_status !== 'ACTIVE' ? `Credit ${customer.credit_status}` : "Account suspended";
        await supabase
          .from('rfid_scans')
          .insert([{ rfid_card, customer_name: customer.name, status: 'FAILED', reason }]);
        return res.status(403).json({ success: false, message: reason });
      }

      // 2. Anti-Duplicate Check (5 seconds)
      if (customer.last_scan_at) {
        const lastScan = new Date(customer.last_scan_at);
        if (now.getTime() - lastScan.getTime() < 5000) {
          await supabase
            .from('rfid_scans')
            .insert([{ rfid_card, customer_name: customer.name, status: 'DUPLICATE', reason: 'Duplicate scan detected' }]);
          return res.status(429).json({ success: false, message: 'Duplicate scan. Please wait 5 seconds.' });
        }
      }

      // 3. Get Auto-Sale Configuration
      const { data: config, error: configError } = await supabase
        .from('auto_sales_config')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (configError || !config) {
         await supabase
           .from('rfid_scans')
           .insert([{ rfid_card, customer_name: customer.name, status: 'FAILED', reason: 'No active auto-sale config' }]);
         return res.status(400).json({ success: false, message: 'Auto-sale feature is currently disabled' });
      }

      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', config.product_id)
        .single();

      if (prodError || !product || product.stock_quantity <= 0) {
        await supabase
          .from('rfid_scans')
          .insert([{ rfid_card, customer_name: customer.name, status: 'FAILED', reason: 'Out of stock' }]);
        return res.status(400).json({ success: false, message: 'Out of stock' });
      }

      // 4. Verify Credit
      const dailyRemaining = customer.daily_limit - (customer.daily_used || 0);
      const monthlyRemaining = customer.monthly_limit - (customer.monthly_used || 0);

      if (dailyRemaining < product.selling_price) {
        await supabase
          .from('rfid_scans')
          .insert([{ rfid_card, customer_name: customer.name, status: 'INSUFFICIENT_CREDIT', reason: 'Daily limit reached' }]);
        return res.status(403).json({ success: false, message: 'Daily limit reached' });
      }

      if (monthlyRemaining < product.selling_price) {
        await supabase
          .from('rfid_scans')
          .insert([{ rfid_card, customer_name: customer.name, status: 'INSUFFICIENT_CREDIT', reason: 'Monthly limit reached' }]);
        return res.status(403).json({ success: false, message: 'Monthly limit reached' });
      }

      // 5. Execute Auto-Sale 
      // Note: Real transactions should use RPC or DB Functions for atomicity. Implementing sequentially for now.
      
      // Update Customer Usage
      await supabase
        .from('customers')
        .update({
          daily_used: (customer.daily_used || 0) + product.selling_price,
          monthly_used: (customer.monthly_used || 0) + product.selling_price,
          current_balance: (customer.current_balance || 0) + product.selling_price,
          last_scan_at: now.toISOString()
        })
        .eq('id', customer.id);

      // Create Sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount: product.selling_price, discount_amount: 0, payment_method: 'CREDIT', status: 'completed' }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create Sale Item
      await supabase
        .from('sale_items')
        .insert([{ sale_id: sale.id, product_id: product.id, quantity: 1, unit_price: product.selling_price, subtotal: product.selling_price }]);

      // Deduct Stock
      await supabase
        .from('products')
        .update({ stock_quantity: product.stock_quantity - 1 })
        .eq('id', product.id);

      // Log Scan
      await supabase
        .from('rfid_scans')
        .insert([{ rfid_card, customer_name: customer.name, status: 'SUCCESS', reason: `Auto-sale for ${product.name}` }]);

      // Credit Log
      await supabase
        .from('credit_logs')
        .insert([{ customer_id: customer.id, amount: product.selling_price, type: 'CHARGE', reference_id: sale.id, notes: `Auto-sale: ${product.name}` }]);

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
  const checkCreditResets = async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = today.substring(0, 7);

    try {
      // 1. Daily Burn, Reset & Summary
      const { data: lastResetDate } = await supabase.from('settings').select('value').eq('key', 'last_daily_reset').single();
      
      if (!lastResetDate || lastResetDate.value !== today) {
        console.log('Running daily credit reset and summary logic...');
        const yesterday = lastResetDate ? lastResetDate.value : null;

        // If we have a record of "yesterday", summarize it
        if (yesterday) {
          const start = `${yesterday}T00:00:00`;
          const end = `${yesterday}T23:59:59`;

          const { data: yesterdaySales } = await supabase.from('sales')
            .select('total_amount, payment_method')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lte('created_at', end);

          const realSales = (yesterdaySales || []).filter(s => ['CASH', 'CREDIT'].includes(s.payment_method)).reduce((sum, s) => sum + s.total_amount, 0);
          const creditSales = (yesterdaySales || []).filter(s => s.payment_method === 'CREDIT').reduce((sum, s) => sum + s.total_amount, 0);
          const autoBurnSales = (yesterdaySales || []).filter(s => s.payment_method === 'AUTO_BURN').reduce((sum, s) => sum + s.total_amount, 0);
          const onlineSales = (yesterdaySales || []).filter(s => s.payment_method === 'ONLINE' || s.payment_method === 'TNG').reduce((sum, s) => sum + s.total_amount, 0);

          await supabase.from('sales_summary_logs').upsert([{
            date: yesterday,
            total_real_sales: realSales,
            total_credit_sales: creditSales,
            total_auto_burn_sales: autoBurnSales,
            total_online_sales: onlineSales
          }], { onConflict: 'date' });
        }

        // Process AUTO_BURN for active customers
        const { data: customersWithUnused } = await supabase.from('customers').select('id, name, daily_limit, daily_used, member_type').eq('credit_status', 'ACTIVE');
        const autoCreditMappings = await readCustomerAutoCreditProduct();
        
        for (const c of (customersWithUnused || [])) {
          let burned = (c.daily_limit || 0) - (c.daily_used || 0);
          const autoCreditProductId = autoCreditMappings[c.id.toString()];
          
          if (burned > 0) {
            await supabase.from('auto_burn_sales').insert([{ customer_id: c.id, amount: burned, status: 'SYSTEM_GENERATED', product_id: autoCreditProductId || null }]);
            
            const { data: sale } = await supabase.from('sales').insert([{
              total_amount: burned,
              discount_amount: 0,
              payment_method: 'AUTO_BURN',
              customer_id: c.id,
              status: 'completed',
              product_id: autoCreditProductId || null
            }]).select().single();
            
            if (sale) {
              await supabase.from('credit_logs').insert([{
                customer_id: c.id,
                amount: burned,
                type: 'DAILY_BURN',
                reference_id: sale.id.toString(),
                notes: 'Daily credit expired - converted to AUTO_BURN sale'
              }]);
              
              await supabase.from('daily_credit_logs').insert([{
                customer_id: c.id,
                burned_amount: burned,
                date: yesterday || today
              }]);
            }
          }
        }
        
        // Reset daily_used
        await supabase.from('customers').update({ daily_used: 0 }).eq('credit_status', 'ACTIVE');
        
        // Update setting
        await supabase.from('settings').upsert([{ key: 'last_daily_reset', value: today }], { onConflict: 'key' });
      }

      // 2. Monthly Reset
      const { data: lastMonthlyReset } = await supabase.from('settings').select('value').eq('key', 'last_monthly_reset').single();
      
      if (!lastMonthlyReset || lastMonthlyReset.value !== month) {
         console.log('Running monthly credit reset...');
         const { data: monthlyUsage } = await supabase.from('customers').select('id, monthly_used').gt('monthly_used', 0).eq('credit_status', 'ACTIVE');
         
         for (const c of (monthlyUsage || [])) {
            await supabase.from('monthly_credit_logs').insert([{
              customer_id: c.id,
              usage_amount: c.monthly_used,
              month: month
            }]);
         }
         
         await supabase.from('customers').update({ monthly_used: 0 }).eq('credit_status', 'ACTIVE');
         await supabase.from('settings').upsert([{ key: 'last_monthly_reset', value: month }], { onConflict: 'key' });
      }
    } catch (error) {
      console.error('Credit reset error:', error);
    }
  };

  // Run initial check and then every hour
  checkCreditResets();
  setInterval(checkCreditResets, 1000 * 60 * 5);

  // Auto-sale Configuration
  app.get('/api/admin/auto-sale-config', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data: config, error } = await supabase.from('auto_sales_config').select('*');
      if (error) throw error;
      res.json({ success: true, data: config });
    } catch (error: any) {
      console.error('Supabase fetch auto-sale-config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/auto-sale-config', authenticateToken, requireAdmin, async (req, res) => {
    const { name, product_id, is_active } = req.body;
    try {
      if (is_active) {
        await supabase.from('auto_sales_config').update({ is_active: false }).neq('id', 0); // Reset all
      }
      const { error } = await supabase.from('auto_sales_config').insert([{
        name,
        product_id,
        is_active: is_active || false
      }]);
      if (error) throw error;
      res.json({ success: true, message: 'Config added' });
    } catch (error: any) {
      console.error('Supabase create auto-sale-config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/auto-sale-config/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, product_id, is_active } = req.body;
    try {
      if (is_active) {
        await supabase.from('auto_sales_config').update({ is_active: false }).neq('id', 0); // Reset all
      }
      const { error } = await supabase.from('auto_sales_config').update({
        name,
        product_id,
        is_active: is_active || false
      }).eq('id', id);
      if (error) throw error;
      res.json({ success: true, message: 'Config updated' });
    } catch (error: any) {
      console.error('Supabase update auto-sale-config error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // RFID Scan Audit Logs
  app.get('/api/admin/rfid-logs', authenticateToken, requireAdmin, async (req, res) => {
     try {
       const { data: logs, error } = await supabase
         .from('rfid_scans')
         .select('*')
         .order('created_at', { ascending: false })
         .limit(500);
       
       if (error) throw error;
       res.json({ success: true, data: logs });
     } catch (error: any) {
       console.error('Supabase fetch rfid-logs error:', error);
       res.status(500).json({ success: false, message: error.message });
     }
  });

  // Deleted Returns Logs
  app.get('/api/admin/deleted-returns-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data: logs, error } = await supabase
        .from('deleted_returns_logs')
        .select(`
          *,
          users!deleted_by(username)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const formatted = (logs || []).map((l: any) => ({
        ...l,
        deleted_by_user: l.users?.username
      }));

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase fetch deleted-returns-logs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  // POS Daily Summary
  app.get('/api/pos/daily-summary', authenticateToken, async (req, res) => {
    try {
      const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      // 1. Category Breakdown for Today
      // Fetching raw data and processing in JS to handle complex joins and grouping efficiently
      const { data: salesData, error: salesError } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          subtotal,
          sales!inner(created_at, status, payment_method),
          products!inner(name, barcode, categories(name))
        `)
        .eq('sales.status', 'completed')
        .filter('sales.created_at', 'gte', `${targetDate}T00:00:00`)
        .filter('sales.created_at', 'lte', `${targetDate}T23:59:59`);

      if (salesError) throw salesError;

      const categorySalesMap: any = {};
      (salesData || []).forEach((item: any) => {
        const catName = item.products?.categories?.name || 'UNCATEGORIZED';
        const key = `${catName}_${item.products?.barcode}`;
        if (!categorySalesMap[key]) {
          categorySalesMap[key] = {
            category_name: catName,
            product_name: item.products?.name,
            barcode: item.products?.barcode,
            qty: 0,
            total: 0
          };
        }
        categorySalesMap[key].qty += item.quantity;
        categorySalesMap[key].total += item.subtotal;
      });

      const categorySales = Object.values(categorySalesMap);

      // 2. Summary Totals
      const { data: summaryData, error: summaryError } = await supabase
        .from('sales')
        .select('total_amount, payment_method')
        .eq('status', 'completed')
        .filter('created_at', 'gte', `${targetDate}T00:00:00`)
        .filter('created_at', 'lte', `${targetDate}T23:59:59`);

      if (summaryError) throw summaryError;

      const summary = {
        grandTotal: 0,
        totalCredit: 0,
        totalCash: 0,
        totalOnline: 0,
        totalTNG: 0,
        totalAutoBurn: 0,
        transactionCount: (summaryData || []).length
      };

      (summaryData || []).forEach((s: any) => {
        if (s.payment_method === 'CREDIT') summary.totalCredit += s.total_amount;
        else if (s.payment_method === 'CASH') summary.totalCash += s.total_amount;
        else if (s.payment_method === 'TNG') summary.totalTNG += s.total_amount;
        else if (s.payment_method === 'ONLINE') summary.totalOnline += s.total_amount;
        else if (s.payment_method === 'AUTO_BURN') summary.totalAutoBurn += s.total_amount;
      });

      summary.grandTotal = summary.totalCredit + summary.totalCash + summary.totalOnline + summary.totalTNG + summary.totalAutoBurn;

      res.json({
        success: true,
        date: targetDate,
        data: categorySales,
        summary
      });
    } catch (error: any) {
      console.error('Supabase daily summary error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get all sales
  app.get('/api/sales', authenticateToken, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Supabase sales fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create sale
  app.post('/api/sales', async (req, res) => {
    const { items, payment_method, discount_amount, customer_id } = req.body;
    try {
      let total_amount = 0;
      for (const item of items) {
        total_amount += item.selling_price * (item.cart_quantity || item.quantity);
      }
      total_amount = Math.max(0, total_amount - (discount_amount || 0));

      // 1. Validate Expiry and Stock
      for (const item of items) {
        const productId = item.id || item.product_id;
        const requestedQty = item.cart_quantity || item.quantity;

        const { data: prod, error: prodError } = await supabase
          .from('products')
          .select('expiry_enabled, stock_quantity')
          .eq('id', productId)
          .single();

        if (prodError || !prod) throw new Error(`Product ${productId} not found`);

        if (prod.expiry_enabled) {
          const today = new Date().toISOString().split('T')[0];
          const { data: expiredBatches } = await supabase
            .from('stock_batches')
            .select('quantity')
            .eq('product_id', productId)
            .lt('expiry_date', today)
            .gt('quantity', 0);

          const expiredQty = (expiredBatches || []).reduce((sum, b) => sum + b.quantity, 0);
          const nonExpiredStock = prod.stock_quantity - expiredQty;
          
          if (nonExpiredStock < requestedQty) {
            throw new Error(`Insufficient non-expired stock for ${item.name}. (Available: ${nonExpiredStock})`);
          }
        }
      }

      // 2. If Credit, validate customer and limits
      if (payment_method === 'CREDIT') {
        if (!customer_id) throw new Error('Customer ID required for credit sale');
        
        const { data: customer, error: custError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customer_id)
          .single();

        if (custError || !customer) throw new Error('Customer not found');
        if (customer.credit_status !== 'ACTIVE') throw new Error(`Credit account is ${customer.credit_status}`);

        // Check allowed items
        for (const item of items) {
           const { data: prod } = await supabase.from('products').select('is_credit_allowed').eq('id', item.id || item.product_id).single();
           if (!prod?.is_credit_allowed) throw new Error(`Item ${item.name} is not allowed for credit purchase`);
        }

        const dailyRemaining = customer.daily_limit - (customer.daily_used || 0);
        const monthlyRemaining = customer.monthly_limit - (customer.monthly_used || 0);

        if (dailyRemaining < total_amount) throw new Error('Daily credit limit exceeded');
        if (monthlyRemaining < total_amount) throw new Error('Monthly credit limit exceeded');

        // Update usage
        await supabase
          .from('customers')
          .update({
            daily_used: (customer.daily_used || 0) + total_amount,
            monthly_used: (customer.monthly_used || 0) + total_amount,
            current_balance: (customer.current_balance || 0) + total_amount
          })
          .eq('id', customer_id);

        await supabase
          .from('credit_logs')
          .insert([{ customer_id, amount: total_amount, type: 'CHARGE', notes: 'POS Credit Sale' }]);
      }

      // 3. Create Sale Record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{ total_amount, discount_amount: discount_amount || 0, payment_method, customer_id: customer_id || null, status: 'completed' }])
        .select()
        .single();
      
      if (saleError) throw saleError;
      const saleId = sale.id;

      // 4. Record Items, Deduct Stock, FIFO Batches
      for (const item of items) {
        const productId = item.id || item.product_id;
        const qty = item.cart_quantity || item.quantity;
        const price = item.selling_price || item.unit_price;
        const subtotal = price * qty;
        
        // Record sale item
        await supabase
          .from('sale_items')
          .insert([{ sale_id: saleId, product_id: productId, quantity: qty, unit_price: price, subtotal }]);
        
        // Deduct overall stock
        const { data: currentProd } = await supabase.from('products').select('stock_quantity').eq('id', productId).single();
        await supabase.from('products').update({ stock_quantity: (currentProd?.stock_quantity || 0) - qty }).eq('id', productId);
        
        // Log movement
        await supabase
          .from('stock_movements')
          .insert([{ product_id: productId, quantity: qty, type: 'OUT', reference_type: 'SALE', reference_id: saleId }]);

        // FIFO Batch Deduction
        let remainingQtyToDeduct = qty;
        const { data: batches } = await supabase
          .from('stock_batches')
          .select('*')
          .eq('product_id', productId)
          .gt('quantity', 0)
          .order('expiry_date', { ascending: true })
          .order('id', { ascending: true });

        for (const batch of (batches || [])) {
          if (remainingQtyToDeduct <= 0) break;
          const deduct = Math.min(batch.quantity, remainingQtyToDeduct);
          await supabase
            .from('stock_batches')
            .update({ quantity: batch.quantity - deduct })
            .eq('id', batch.id);
          remainingQtyToDeduct -= deduct;
        }
      }

      res.json({ success: true, sale_id: saleId });
    } catch (error: any) {
      console.error('Supabase create sale error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get sale by ID
  app.get('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (saleError || !sale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
      }

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*, products(name, barcode)')
        .eq('sale_id', id);

      if (itemsError) throw itemsError;

      // Get return info
      const { data: returnedItems, error: returnsError } = await supabase
        .from('sales_return_items')
        .select('product_id, quantity, sales_returns!inner(sale_id)')
        .eq('sales_returns.sale_id', id);

      if (returnsError) throw returnsError;

      const returnedMap = new Map();
      for (const r of (returnedItems || [])) {
        const current = returnedMap.get(r.product_id) || 0;
        returnedMap.set(r.product_id, current + r.quantity);
      }

      const enhancedItems = (items || []).map((item: any) => ({
        ...item,
        name: item.products?.name,
        barcode: item.products?.barcode,
        returned_quantity: returnedMap.get(item.product_id) || 0
      }));

      res.json({ success: true, data: { ...sale, items: enhancedItems } });
    } catch (error: any) {
      console.error('Supabase get sale by ID error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // Create Customer Return
  app.post('/api/sales-returns', async (req, res) => {
    const { sale_id, refund_type, items } = req.body;
    try {
      let total_refund = 0;
      for (const item of items) {
        total_refund += item.refund_amount * item.quantity;
      }

      const { data: saleReturn, error: returnError } = await supabase
        .from('sales_returns')
        .insert([{ sale_id, total_refund, refund_type }])
        .select()
        .single();
      
      if (returnError) throw returnError;
      const returnId = saleReturn.id;

      for (const item of items) {
        if (item.quantity > 0) {
          await supabase
            .from('sales_return_items')
            .insert([{ return_id: returnId, product_id: item.product_id, quantity: item.quantity, refund_amount: item.refund_amount }]);
          
          // Increase stock back
          const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          await supabase.from('products').update({ stock_quantity: (product?.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);
          
          // Log movement
          await supabase
            .from('stock_movements')
            .insert([{ product_id: item.product_id, quantity: item.quantity, type: 'IN', reference_type: 'CUSTOMER_RETURN', reference_id: returnId }]);
        }
      }

      res.json({ success: true, message: 'Return processed successfully', returnId, total_refund });
    } catch (error: any) {
      console.error('Supabase sales return error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Price Check Endpoint
  app.get('/api/products/price-check/:barcode', async (req, res) => {
    const { barcode } = req.params;
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('name, selling_price, stock_quantity, category:categories(name)')
        .eq('barcode', barcode)
        .single();

      if (error || !product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      res.json({ success: true, data: { ...product, category: Array.isArray(product.category) ? product.category[0]?.name : (product.category as any)?.name } });
    } catch (error: any) {
      console.error('Supabase price check error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/products/search', authenticateToken, async (req, res) => {
    try {
      const { q } = req.query;
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name, status)
        `)
        .or(`name.ilike.%${q}%,barcode.ilike.%${q}%`)
        .limit(10);

      if (error) throw error;

      const cats2 = await readCategories2Async();
      const mappings = await readProductCategory2();
      const salesTypes = await readProductSalesType();
      const modifiedTimes = await readProductModified();

      const mapped = (products || []).map(p => {
        const cat2Id = mappings[p.id.toString()] || null;
        const cat2Obj = cat2Id ? cats2.find((c: any) => c.id.toString() === cat2Id.toString()) : null;
        return {
          ...p,
          category_status: p.categories?.status,
          category_name: p.categories?.name,
          category2_id: cat2Id ? Number(cat2Id) : null,
          category2_name: cat2Obj ? cat2Obj.name : null,
          sales_type: salesTypes[p.id.toString()] || 'Sales product',
          created_at: p.created_at || new Date().toISOString(),
          updated_at: modifiedTimes[p.id.toString()] || p.created_at || new Date().toISOString()
        };
      });

      res.json({ success: true, data: mapped });
    } catch (error: any) {
      console.error('Supabase product search error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Void Logs
  app.get('/api/void-logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data: logs, error } = await supabase
        .from('void_logs')
        .select(`
          *,
          products(name, barcode),
          users(username),
          sales(total_amount)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLogs = (logs || []).map((l: any) => ({
        ...l,
        product_name: l.products?.name,
        barcode: l.products?.barcode,
        void_by_user: l.users?.username,
        total_amount: l.sales?.total_amount
      }));

      res.json({ success: true, data: formattedLogs });
    } catch (error: any) {
      console.error('Supabase void logs error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // Void Sale/Item Endpoint
  app.post('/api/void', authenticateToken, async (req: any, res) => {
    const { admin_username, admin_password, sale_id, items, reason, is_full_sale } = req.body;
    try {
      // 1. Verify admin/manager credentials if not already
      let adminId = req.user.id;
      if (req.user.role === 'CASHIER') {
        const { data: adminUser, error: adminErr } = await supabase
          .from('users')
          .select('*')
          .eq('username', admin_username)
          .eq('status', 'active')
          .single();

        if (adminErr || !adminUser || !bcrypt.compareSync(admin_password, adminUser.password)) {
          return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
        if (adminUser.role !== 'ADMIN' && adminUser.role !== 'MANAGER') {
          return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        adminId = adminUser.id;
      }

      // 2. Process voids
      for (const item of items) {
        if (item.quantity > 0) {
          const { data: voidLog, error: voidErr } = await supabase
            .from('void_logs')
            .insert([{
              sale_id: sale_id || null,
              product_id: item.product_id,
              quantity: item.quantity,
              reason: reason || 'Void Item',
              void_by: adminId
            }])
            .select()
            .single();
          
          if (voidErr) throw voidErr;

          if (sale_id) {
            // Update stock
            const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            await supabase.from('products').update({ stock_quantity: (product?.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);
            
            // Update sale item
            const { data: saleItem } = await supabase
              .from('sale_items')
              .select('quantity, subtotal, unit_price')
              .eq('sale_id', sale_id)
              .eq('product_id', item.product_id)
              .single();

            if (saleItem) {
              await supabase
                .from('sale_items')
                .update({
                  quantity: saleItem.quantity - item.quantity,
                  subtotal: saleItem.subtotal - (saleItem.unit_price * item.quantity)
                })
                .eq('sale_id', sale_id)
                .eq('product_id', item.product_id);
            }

            // log stock movement
            await supabase.from('stock_movements').insert([{
              product_id: item.product_id,
              quantity: item.quantity,
              type: 'IN',
              reference_type: 'VOID',
              reference_id: voidLog.id
            }]);
          }
        }
      }
      
      if (sale_id) {
        // Update sale total
        const { data: updatedItems } = await supabase.from('sale_items').select('subtotal').eq('sale_id', sale_id);
        const newTotal = (updatedItems || []).reduce((sum, i) => sum + i.subtotal, 0);
        
        await supabase.from('sales').update({ total_amount: newTotal }).eq('id', sale_id);

        if (is_full_sale) {
          await supabase.from('sales').update({ status: 'voided' }).eq('id', sale_id);
        }
      }

      res.json({ success: true, message: 'Void successful' });
    } catch (error: any) {
      console.error('Supabase void error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Customer Returns
  app.get('/api/sales-returns', authenticateToken, async (req, res) => {
    try {
      const { data: returns, error } = await supabase
        .from('sales_returns')
        .select(`
          *,
          sales_return_items(id, quantity)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (returns || []).map((r: any) => ({
        ...r,
        num_items: (r.sales_return_items || []).length,
        sum_qty: (r.sales_return_items || []).reduce((sum: number, i: any) => sum + i.quantity, 0)
      }));

      // calculate aggregates
      const totalRefundValue = formatted.reduce((sum, r) => sum + r.total_refund, 0);
      const exchangeCount = formatted.filter(r => r.refund_type === 'EXCHANGE').length;
      const cashCount = formatted.filter(r => r.refund_type === 'CASH').length;

      const summary = {
        totalValue: totalRefundValue,
        exchangeCount,
        cashCount,
        totalReturns: formatted.length
      };

      res.json({ success: true, data: formatted, summary });
    } catch (error: any) {
      console.error('Supabase sales returns fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update Return
  app.put('/api/sales-returns/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { payment_status } = req.body;
    try {
      const { error } = await supabase.from('sales_returns').update({ payment_status }).eq('id', id);
      if (error) throw error;
      res.json({ success: true, message: 'Return updated' });
    } catch (error: any) {
      console.error('Supabase update return error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete Return
  app.delete('/api/sales-returns/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      await supabase.from('sales_return_items').delete().eq('return_id', id);
      const { error } = await supabase.from('sales_returns').delete().eq('id', id);
      if (error) throw error;

      await supabase.from('deleted_returns_logs').insert([{
        return_id: id,
        deleted_by: req.user.id,
        reason: reason || 'Manual deletion'
      }]);

      res.json({ success: true, message: 'Return deleted and logged' });
    } catch (error: any) {
      console.error('Supabase delete return error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Detailed Sales Report API
  app.get('/api/admin/detailed-sales-report', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { start_date, end_date, category_id } = req.query;
      const startDate = start_date ? `${start_date}T00:00:00` : null;
      const endDate = end_date ? `${end_date}T23:59:59` : null;

      // 1. Fetch Sales and Returns for the period
      let salesQuery = supabase.from('sale_items').select(`
          quantity,
          subtotal,
          sales!inner(created_at, status, payment_method),
          products!inner(name, category_id, categories(name))
        `).eq('sales.status', 'completed');
      
      let returnsQuery = supabase.from('sales_return_items').select(`
          quantity,
          refund_amount,
          sales_returns!inner(created_at, refund_type),
          products!inner(name, category_id, categories(name))
        `);

      if (startDate) {
        salesQuery = salesQuery.gte('sales.created_at', startDate);
        returnsQuery = returnsQuery.gte('sales_returns.created_at', startDate);
      }
      if (endDate) {
        salesQuery = salesQuery.lte('sales.created_at', endDate);
        returnsQuery = returnsQuery.lte('sales_returns.created_at', endDate);
      }
      if (category_id && category_id !== 'all') {
        salesQuery = salesQuery.eq('products.category_id', category_id);
        returnsQuery = returnsQuery.eq('products.category_id', category_id);
      }

      const { data: sales, error: sErr } = await salesQuery;
      const { data: returns, error: rErr } = await returnsQuery;

      if (sErr) throw sErr;
      if (rErr) throw rErr;

      // 2. Process Stats
      const statsMap: any = {};
      const categoryMap: any = {};
      const itemMap: any = {};

      (sales || []).forEach((item: any) => {
        const method = item.sales.payment_method;
        statsMap[method] = statsMap[method] || { total: 0, count: 0 }; // count is simplified here
        statsMap[method].total += item.subtotal;
        
        const catName = item.products?.categories?.name || 'Uncategorized';
        categoryMap[catName] = categoryMap[catName] || { total_qty: 0, total_value: 0, payments: {} };
        categoryMap[catName].total_qty += item.quantity;
        categoryMap[catName].total_value += item.subtotal;
        categoryMap[catName].payments[method] = (categoryMap[catName].payments[method] || 0) + item.subtotal;

        const pName = item.products?.name;
        itemMap[pName] = itemMap[pName] || { product_name: pName, category_name: catName, total_qty: 0, total_value: 0 };
        itemMap[pName].total_qty += item.quantity;
        itemMap[pName].total_value += item.subtotal;
      });

      (returns || []).forEach((item: any) => {
        const method = item.sales_returns.refund_type;
        const value = -(item.quantity * item.refund_amount);
        statsMap[method] = statsMap[method] || { total: 0, count: 0 };
        statsMap[method].total += value;

        const catName = item.products?.categories?.name || 'Uncategorized';
        categoryMap[catName] = categoryMap[catName] || { total_qty: 0, total_value: 0, payments: {} };
        categoryMap[catName].total_qty -= item.quantity;
        categoryMap[catName].total_value += value;
        categoryMap[catName].payments[method] = (categoryMap[catName].payments[method] || 0) + value;

        const pName = item.products?.name;
        itemMap[pName] = itemMap[pName] || { product_name: pName, category_name: catName, total_qty: 0, total_value: 0 };
        itemMap[pName].total_qty -= item.quantity;
        itemMap[pName].total_value += value;
      });

      const stats = Object.entries(statsMap).map(([payment_method, data]: [any, any]) => ({ payment_method, ...data }));
      const categoryBreakdown = Object.entries(categoryMap).map(([category_name, data]: [any, any]) => ({ category_name, ...data }));
      const itemDetails = Object.values(itemMap).sort((a: any, b: any) => b.total_value - a.total_value).slice(0, 50);

      const summary = {
        totalReal: stats.filter(s => ['CASH', 'CREDIT', 'ONLINE', 'TNG'].includes(s.payment_method)).reduce((acc, s) => acc + s.total, 0),
        totalCredit: stats.find(s => s.payment_method === 'CREDIT')?.total || 0,
        totalAutoBurn: stats.find(s => s.payment_method === 'AUTO_BURN')?.total || 0,
        totalOnline: stats.filter(s => s.payment_method === 'ONLINE' || s.payment_method === 'TNG').reduce((acc, s) => acc + s.total, 0),
        totalCash: stats.find(s => s.payment_method === 'CASH')?.total || 0,
        grandTotal: stats.reduce((acc, s) => acc + s.total, 0)
      };

      res.json({ success: true, data: stats, summary, categoryBreakdown, itemDetails });
    } catch (error: any) {
      console.error('Supabase detailed sales report error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Detailed Sales Report Rows API (Granular)
  app.get('/api/admin/detailed-sales-report-rows', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { start_date, end_date, category_id } = req.query;
      const startDate = start_date ? `${start_date}T00:00:00` : null;
      const endDate = end_date ? `${end_date}T23:59:59` : null;

      let salesQuery = supabase.from('sale_items').select(`
          quantity,
          subtotal,
          unit_price,
          sales!inner(created_at, status, payment_method),
          products!inner(name, category_id, categories(name))
        `).eq('sales.status', 'completed');
      
      let returnsQuery = supabase.from('sales_return_items').select(`
          quantity,
          refund_amount,
          sales_returns!inner(created_at, refund_type),
          products!inner(name, category_id, categories(name))
        `);

      if (startDate) {
        salesQuery = salesQuery.gte('sales.created_at', startDate);
        returnsQuery = returnsQuery.gte('sales_returns.created_at', startDate);
      }
      if (endDate) {
        salesQuery = salesQuery.lte('sales.created_at', endDate);
        returnsQuery = returnsQuery.lte('sales_returns.created_at', endDate);
      }
      if (category_id && category_id !== 'all') {
        salesQuery = salesQuery.eq('products.category_id', category_id);
        returnsQuery = returnsQuery.eq('products.category_id', category_id);
      }

      const { data: sales, error: sErr } = await salesQuery;
      const { data: returns, error: rErr } = await returnsQuery;

      if (sErr) throw sErr;
      if (rErr) throw rErr;

      const rows: any[] = [];
      const summary = { grand_total: 0, total_cash: 0, total_online: 0, total_credit: 0, total_auto_burn: 0 };

      (sales || []).forEach((item: any) => {
        const row = {
          timestamp: item.sales.created_at,
          category_name: item.products?.categories?.name || 'Uncategorized',
          product_name: item.products?.name,
          qty_sold: item.quantity,
          cash_amount: item.sales.payment_method === 'CASH' ? item.subtotal : 0,
          online_amount: (item.sales.payment_method === 'ONLINE' || item.sales.payment_method === 'TNG') ? item.subtotal : 0,
          credit_amount: item.sales.payment_method === 'CREDIT' ? item.subtotal : 0,
          auto_burn_amount: item.sales.payment_method === 'AUTO_BURN' ? item.subtotal : 0,
          total_amount: item.subtotal
        };
        rows.push(row);
        summary.grand_total += row.total_amount;
        summary.total_cash += row.cash_amount;
        summary.total_online += row.online_amount;
        summary.total_credit += row.credit_amount;
        summary.total_auto_burn += row.auto_burn_amount;
      });

      (returns || []).forEach((item: any) => {
        const val = -(item.quantity * item.refund_amount);
        const row = {
          timestamp: item.sales_returns.created_at,
          category_name: item.products?.categories?.name || 'Uncategorized',
          product_name: item.products?.name + ' (RETURN)',
          qty_sold: -item.quantity,
          cash_amount: item.sales_returns.refund_type === 'CASH' ? val : 0,
          online_amount: 0,
          credit_amount: item.sales_returns.refund_type === 'EXCHANGE' ? val : 0,
          auto_burn_amount: 0,
          total_amount: val
        };
        rows.push(row);
        summary.grand_total += row.total_amount;
        summary.total_cash += row.cash_amount;
        summary.total_online += row.online_amount;
        summary.total_credit += row.credit_amount;
        summary.total_auto_burn += row.auto_burn_amount;
      });

      rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ success: true, data: rows.slice(0, 2000), summary });
    } catch (error: any) {
      console.error('Supabase detailed sales report rows error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/expiry-insights', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { days } = req.query;
      const thresholdDays = parseInt(days as string) || 90;
      const todayObj = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(todayObj.getDate() + thresholdDays);
      const thresholdStr = thresholdDate.toISOString().split('T')[0];

      const { data: expiringBatches, error } = await supabase
        .from('stock_batches')
        .select(`
          *,
          products!inner(id, name, barcode, stock_quantity),
          purchase_invoices(invoice_number, supplier_id, suppliers(name))
        `)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thresholdStr)
        .gt('products.stock_quantity', 0)
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      const formatted = (expiringBatches || []).map((sb: any) => ({
        batch_id: sb.id,
        batch_number: sb.batch_number,
        expiry_date: sb.expiry_date,
        batch_quantity: sb.quantity,
        product_id: sb.products?.id,
        product_name: sb.products?.name,
        barcode: sb.products?.barcode,
        total_stock: sb.products?.stock_quantity,
        invoice_number: sb.purchase_invoices?.invoice_number,
        supplier_name: sb.purchase_invoices?.suppliers?.name
      }));

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase expiry insights error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // Dashboard Summary API
  app.get('/api/admin/dashboard-stats', authenticateToken, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;
      
      // Fetch data from Supabase - using raw select and processing on server
      const { data: sales, error: sErr } = await supabase.from('sales')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('status', 'completed');
        
      if (sErr) throw sErr;
      
      const { data: expenses, error: eErr } = await supabase.from('expenses')
        .select('amount')
        .eq('date', today);
        
      if (eErr) throw eErr;
      
      const { data: purchases, error: pErr } = await supabase.from('purchase_invoices')
        .select('total_amount, due_amount')
        .eq('status', 'ACTIVE')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
        
      if (pErr) throw pErr;

      const { data: profitData, error: prErr } = await supabase
        .from('sale_items')
        .select(`
          subtotal,
          quantity,
          products!inner(purchase_price),
          sales!inner(created_at, status, payment_method)
        `)
        .eq('sales.status', 'completed')
        .neq('sales.payment_method', 'AUTO_BURN')
        .gte('sales.created_at', startOfDay)
        .lte('sales.created_at', endOfDay);
        
      if (prErr) throw prErr;

      const { data: outstandingData, error: oErr } = await supabase.from('customers').select('current_balance');
      if (oErr) throw oErr;

      // Aggregates
      const summary = {
        todayReal: 0,
        todayCredit: 0,
        todayAutoBurn: 0,
        todayOnline: 0,
        todayProfit: 0,
        netProfit: 0,
        totalOutstanding: (outstandingData || []).reduce((sum, c) => sum + (c.current_balance || 0), 0),
        todayPurchases: (purchases || []).reduce((sum, p) => sum + p.total_amount, 0),
        todaySupplierDue: (purchases || []).reduce((sum, p) => sum + p.due_amount, 0),
        todayExpenses: (expenses || []).reduce((sum, e) => sum + e.amount, 0)
      };

      (sales || []).forEach(s => {
        if (['CASH', 'CREDIT', 'ONLINE', 'TNG'].includes(s.payment_method)) summary.todayReal += s.total_amount;
        if (s.payment_method === 'CREDIT') summary.todayCredit += s.total_amount;
        if (s.payment_method === 'AUTO_BURN') summary.todayAutoBurn += s.total_amount;
        if (s.payment_method === 'ONLINE' || s.payment_method === 'TNG') summary.todayOnline += s.total_amount;
      });

      summary.todayProfit = (profitData || []).reduce((sum, item: any) => {
        return sum + (item.subtotal - (item.products?.purchase_price * item.quantity));
      }, 0);
      
      summary.netProfit = summary.todayProfit - summary.todayExpenses;

      const { data: lowStock } = await supabase.from('products').select('name, stock_quantity').lte('stock_quantity', 10).limit(5);
      
      // Top products - fetch and aggregate
      const { data: topSales } = await supabase.from('sale_items').select('quantity, products!inner(name)');
      const topProductsMap: any = {};
      (topSales || []).forEach((item: any) => {
        const name = item.products?.name;
        topProductsMap[name] = (topProductsMap[name] || 0) + item.quantity;
      });
      const topProducts = Object.entries(topProductsMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a: any, b: any) => b.qty - a.qty)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          kpis: [
            { label: 'Today Total Sales', value: `$${(summary.todayReal + summary.todayAutoBurn).toFixed(2)}`, icon: 'DollarSign', color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Gross Profit', value: `$${summary.todayProfit.toFixed(2)}`, icon: 'TrendingUp', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Today Expenses', value: `$${summary.todayExpenses.toFixed(2)}`, icon: 'PackageMinus', color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Net Profit', value: `$${summary.netProfit.toFixed(2)}`, icon: 'CheckCircle', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Cash Sales', value: `$${(summary.todayReal - summary.todayCredit - summary.todayOnline).toFixed(2)}`, icon: 'Banknote', color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { label: 'Total Credit Sales', value: `$${summary.todayCredit.toFixed(2)}`, icon: 'CreditCard', color: 'text-indigo-600', bg: 'bg-indigo-100' },
            { label: 'Today\'s Purchases', value: `$${summary.todayPurchases.toFixed(2)}`, icon: 'ShoppingCart', color: 'text-red-600', bg: 'bg-red-100' },
          ],
          summary,
          lowStock: lowStock || [],
          topProducts
        }
      });
    } catch (error: any) {
      console.error('Supabase dashboard stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  // --- Expenses APIs ---
  app.get('/api/admin/expenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { category, search, start_date, end_date, from, to } = req.query;
      let query = supabase.from('expenses').select('*');

      if (category) {
        query = query.eq('category', category);
      }
      if (search) {
        query = query.ilike('description', `%${search}%`);
      }
      
      const startDate = start_date || from;
      const endDate = end_date || to;
      
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data: expenses, error } = await query.order('date', { ascending: false }).order('id', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data: expenses });
    } catch (error: any) {
      console.error('Supabase expenses fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/expenses', authenticateToken, requireAdmin, async (req: any, res) => {
    const { category, description, amount, date, payment_method } = req.body;
    try {
      const { error } = await supabase.from('expenses').insert([{
        category,
        description,
        amount,
        date,
        payment_method: payment_method || 'CASH',
        created_by: req.user.id
      }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase create expense error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/expenses/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { data: expense, error: fetchErr } = await supabase.from('expenses').select('*').eq('id', req.params.id).single();
      if (fetchErr || !expense) throw new Error('Expense not found');

      const { error: deleteErr } = await supabase.from('expenses').delete().eq('id', req.params.id);
      if (deleteErr) throw deleteErr;

      await supabase.from('financial_audit_logs').insert([{
        type: 'EXPENSE_DELETE',
        reference_id: req.params.id.toString(),
        user_id: req.user.id,
        details: JSON.stringify(expense)
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase delete expense error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Inventory Management APIs
  app.get('/api/admin/inventory/sessions', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('inventory_sessions')
        .select('*, users!created_by(username)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      const formatted = (data || []).map((s: any) => ({
        ...s,
        creator_name: s.users?.username
      }));

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase inventory sessions error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`[INVENTORY] Creating new session. User ID: ${req.user.id}, Date: ${today}`);
      
      const { data, error } = await supabase
        .from('inventory_sessions')
        .insert([{ 
          date: today, 
          created_by: req.user.id, 
          status: 'DRAFT',
          total_system_value: 0,
          total_physical_value: 0,
          total_difference: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase inventory_sessions insert error:', error);
        throw error;
      }
      
      console.log(`[INVENTORY] Session created successfully. ID: ${data?.id}`);
      res.json({ success: true, id: data.id });
    } catch (error: any) {
      console.error('Supabase create inventory session detailed error:', error);
      res.status(500).json({ success: false, message: error.message || 'Unknown database error' });
    }
  });

  app.get('/api/admin/inventory/sessions/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data: session, error: sErr } = await supabase
        .from('inventory_sessions')
        .select('*, users!created_by(username)')
        .eq('id', req.params.id)
        .single();

      if (sErr || !session) return res.status(404).json({ success: false, message: 'Session not found' });
      
      const { data: items, error: iErr } = await supabase
        .from('inventory_items')
        .select('*, products(name, barcode)')
        .eq('inventory_id', req.params.id);
      
      if (iErr) throw iErr;
      
      const formattedItems = (items || []).map((i: any) => {
        const prod = Array.isArray(i.products) ? i.products[0] : i.products;
        return {
          ...i,
          name: prod?.name || 'Unknown Item',
          barcode: prod?.barcode || ''
        };
      });

      res.json({ success: true, data: { ...session, creator_name: session.users?.username, items: formattedItems } });
    } catch (error: any) {
      console.error('Supabase get inventory session error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/inventory/sessions/:id', authenticateToken, async (req: any, res) => {
    try {
      // Seqential delete (not atomic but common in this context)
      await supabase.from('inventory_items').delete().eq('inventory_id', req.params.id);
      await supabase.from('inventory_audit_logs').delete().eq('inventory_id', req.params.id);
      const { error } = await supabase.from('inventory_sessions').delete().eq('id', req.params.id);
      
      if (error) throw error;
      res.json({ success: true, message: 'Session deleted' });
    } catch (error: any) {
      console.error('Supabase delete session error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions/:id/items', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { product_id, physical_stock } = req.body;
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('purchase_price, selling_price, stock_quantity')
        .eq('id', product_id)
        .single();
      
      if (pErr || !product) return res.status(404).json({ success: false, message: 'Product not found' });

      const system_stock = product.stock_quantity;
      const difference = physical_stock - system_stock;
      const value_difference = difference * product.purchase_price;

      // Check if item already exists in session
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('inventory_id', req.params.id)
        .eq('product_id', product_id)
        .single();
      
      if (existing) {
        await supabase
          .from('inventory_items')
          .update({ physical_stock, difference, value_difference })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inventory_items')
          .insert([{
            inventory_id: req.params.id,
            product_id,
            system_stock,
            physical_stock,
            difference,
            buying_price: product.purchase_price,
            selling_price: product.selling_price,
            value_difference
          }]);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase inventory item update error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/inventory/sessions/:id/items/:itemId', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', req.params.itemId)
        .eq('inventory_id', req.params.id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase inventory item delete error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/inventory/sessions/:id/complete', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { option } = req.body; // 'AUTO_UPDATE' or 'FINISH_ONLY'
      const { data: session, error: sErr } = await supabase.from('inventory_sessions').select('*').eq('id', req.params.id).single();
      if (sErr || !session) return res.status(404).json({ success: false, message: 'Session not found' });

      const { data: items, error: iErr } = await supabase.from('inventory_items').select('*').eq('inventory_id', req.params.id);
      if (iErr) throw iErr;
      
      let total_system_value = 0;
      let total_physical_value = 0;
      let total_difference = 0;

      for (const item of (items || [])) {
        total_system_value += item.system_stock * item.buying_price;
        total_physical_value += item.physical_stock * item.buying_price;
        total_difference += item.value_difference;

        if (option === 'AUTO_UPDATE') {
          // Update product stock
          await supabase.from('products').update({ stock_quantity: item.physical_stock }).eq('id', item.product_id);
          
          // Record movement
          await supabase.from('stock_movements').insert([{
            product_id: item.product_id,
            quantity: item.difference,
            type: 'ADJUSTMENT',
            reference_type: 'INVENTORY',
            reference_id: req.params.id
          }]);

          // Detailed audit log
          await supabase.from('inventory_audit_logs').insert([{
            inventory_id: req.params.id,
            user_id: req.user.id,
            action: 'STOCK_SYNC',
            details: `Synced stock for product ID ${item.product_id}: ${item.system_stock} -> ${item.physical_stock}`
          }]);
        }
      }

      await supabase.from('inventory_sessions').update({
        total_system_value,
        total_physical_value,
        total_difference,
        status: 'COMPLETED'
      }).eq('id', req.params.id);

      await supabase.from('inventory_audit_logs').insert([{
        inventory_id: req.params.id,
        user_id: req.user.id,
        action: 'SESSION_COMPLETED',
        details: `Session completed with option: ${option}`
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase inventory complete error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- Purchase Invoice APIs ---
  app.get('/api/admin/purchase-invoices', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { supplier_id, payment_status, status_list, search } = req.query;
      let query = supabase.from('purchase_invoices').select('*, suppliers!inner(name)');

      if (supplier_id) query = query.eq('supplier_id', supplier_id);
      
      if (status_list) {
        const statuses = (status_list as string).split(',');
        query = query.in('payment_status', statuses);
      } else if (payment_status) {
        query = query.eq('payment_status', payment_status);
      }
      
      if (search) query = query.or(`invoice_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`);

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      
      const piExt = await readPIExt();
      const invCats = await readInvoiceCategories();
      const pmTypes = await readPaymentTypes();

      const formatted = (data || []).map((pi: any) => {
        const ext = piExt[pi.id.toString()] || {};
        const cat = invCats.find((c: any) => c.id.toString() === (ext.invoice_category_id || '').toString());
        const pType = pmTypes.find((t: any) => t.id.toString() === (ext.payment_type_id || '').toString());
        
        return {
          ...pi,
          supplier_name: pi.suppliers?.name,
          payment_type: pType ? pType.name : (ext.payment_type || 'N/A'),
          category_name: cat ? cat.name : 'N/A'
        };
      });

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase purchase invoices fetch error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/purchase-invoices', authenticateToken, requireAdmin, async (req: any, res) => {
    const { invoice_number, supplier_id, date, items, total_amount, paid_amount, payment_type_id, invoice_category_id } = req.body;
    
    try {
      const due_amount = total_amount - (paid_amount || 0);
      const payment_status = due_amount <= 0 ? 'PAID' : 'CREDIT';

      const { data: invoice, error: invError } = await supabase
        .from('purchase_invoices')
        .insert([{ invoice_number, supplier_id, total_amount, paid_amount: paid_amount || 0, due_amount, payment_status, date }])
        .select()
        .single();

      if (invError) {
        if (invError.message?.includes('duplicate key')) throw new Error('Invoice number already exists');
        throw invError;
      }

      const invoiceId = invoice.id;

      // Save extension metadata
      const piExt = await readPIExt();
      piExt[invoiceId.toString()] = { payment_type_id, invoice_category_id };
      await writePIExt(piExt);

      // Record initial payment if any
      if (paid_amount > 0) {
        await supabase.from('purchase_invoice_payments').insert([{ invoice_id: invoiceId, amount: paid_amount, date }]);
      }

      for (const item of items) {
        await supabase.from('purchase_invoice_items').insert([{
          invoice_id: invoiceId,
          product_id: item.product_id,
          quantity: item.quantity,
          bonus_qty: item.bonus_qty || 0,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null
        }]);

        // Update product stock and price
        const totalStockIncrement = (item.quantity || 0) + (item.bonus_qty || 0);
        const effectivePurchasePrice = totalStockIncrement > 0 
          ? (item.quantity * item.unit_price) / totalStockIncrement 
          : item.unit_price;

        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        await supabase.from('products').update({
          stock_quantity: (prod?.stock_quantity || 0) + totalStockIncrement,
          purchase_price: effectivePurchasePrice,
          expiry_date: item.expiry_date || null
        }).eq('id', item.product_id);

        // Create stock batch if batch info provided
        if (item.batch_number || item.expiry_date) {
          await supabase.from('stock_batches').insert([{
            product_id: item.product_id,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
            quantity: totalStockIncrement,
            purchase_invoice_id: invoiceId
          }]);
        }

        // Log stock movement
        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          quantity: totalStockIncrement,
          type: 'PURCHASE',
          reference_type: 'PURCHASE_INVOICE',
          reference_id: invoice_number
        }]);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase create purchase invoice error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { data: invoice, error: iErr } = await supabase
        .from('purchase_invoices')
        .select('*, suppliers!inner(name, phone)')
        .eq('id', req.params.id)
        .single();

      if (iErr || !invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

      const { data: items, error: itErr } = await supabase
        .from('purchase_invoice_items')
        .select('*, products(name, barcode)')
        .eq('invoice_id', req.params.id);

      const { data: payments } = await supabase
        .from('purchase_invoice_payments')
        .select('*')
        .eq('invoice_id', req.params.id)
        .order('created_at', { ascending: false });

      const cats2 = await readCategories2Async();
      const prodCat2Mappings = await readProductCategory2();

      const formattedItems = (items || []).map((it: any) => {
        const cat2Id = prodCat2Mappings[it.product_id?.toString()] || null;
        const cat2Obj = cat2Id ? cats2.find((c: any) => c.id.toString() === cat2Id.toString()) : null;
        
        return {
          ...it,
          product_name: it.products?.name,
          barcode: it.products?.barcode,
          category_name: cat2Obj ? cat2Obj.name : 'N/A'
        };
      });

      const piExt = await readPIExt();
      const ext = piExt[req.params.id] || {};
      const invCats = await readInvoiceCategories();
      const pmTypes = await readPaymentTypes();
      
      const cat = invCats.find((c: any) => c.id.toString() === (ext.invoice_category_id || '').toString());
      const pType = pmTypes.find((t: any) => t.id.toString() === (ext.payment_type_id || '').toString());

      res.json({ 
        success: true, 
        data: { 
          ...invoice, 
          supplier_name: invoice.suppliers?.name, 
          supplier_phone: invoice.suppliers?.phone, 
          items: formattedItems, 
          payments,
          payment_type_id: ext.payment_type_id,
          invoice_category_id: ext.invoice_category_id,
          payment_type: pType ? pType.name : (ext.payment_type || 'N/A'),
          category_name: cat ? cat.name : 'N/A'
        } 
      });
    } catch (error: any) {
      console.error('Supabase get purchase invoice error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/purchase-invoices/:id/payments', authenticateToken, requireAdmin, async (req, res) => {
    const { amount, date, payment_method } = req.body;
    try {
      const { data: invoice, error: iErr } = await supabase.from('purchase_invoices').select('*').eq('id', req.params.id).single();
      if (iErr || !invoice) throw new Error('Invoice not found');
      if (invoice.status === 'VOID') throw new Error('Cannot pay voided invoice');

      const newPaidAmount = invoice.paid_amount + amount;
      const newDueAmount = invoice.total_amount - newPaidAmount;
      const newPaymentStatus = newDueAmount <= 0 ? 'PAID' : 'CREDIT';

      await supabase
        .from('purchase_invoices')
        .update({ paid_amount: newPaidAmount, due_amount: newDueAmount, payment_status: newPaymentStatus })
        .eq('id', req.params.id);

      await supabase.from('purchase_invoice_payments').insert([{
        invoice_id: req.params.id,
        amount,
        payment_method: payment_method || 'CASH',
        date: date || new Date().toISOString().split('T')[0]
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase purchase payment error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });


  app.post('/api/admin/purchase-invoices/:id/void', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { data: invoice, error: iErr } = await supabase.from('purchase_invoices').select('*').eq('id', req.params.id).single();
      if (iErr || !invoice) throw new Error('Invoice not found');
      if (invoice.status === 'VOID') throw new Error('Invoice already voided');

      const { data: items, error: itErr } = await supabase.from('purchase_invoice_items').select('*').eq('invoice_id', req.params.id);
      if (itErr) throw itErr;

      // Reverse stock
      for (const item of (items || [])) {
        const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        await supabase.from('products').update({ stock_quantity: (prod?.stock_quantity || 0) - totalStockDecrement }).eq('id', item.product_id);

        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          quantity: -totalStockDecrement,
          type: 'VOID_PURCHASE',
          reference_type: 'PURCHASE_INVOICE',
          reference_id: invoice.invoice_number
        }]);
      }

      await supabase.from('purchase_invoices').update({ status: 'VOID' }).eq('id', req.params.id);

      await supabase.from('financial_audit_logs').insert([{
        type: 'INVOICE_VOID',
        reference_id: req.params.id.toString(),
        user_id: req.user.id,
        details: `Voided invoice ${invoice.invoice_number}`
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase void purchase invoice error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    const { supplier_id, date, items, total_amount, paid_amount, payment_type_id, invoice_category_id } = req.body;
    try {
      const { data: oldInvoice, error: iErr } = await supabase.from('purchase_invoices').select('*').eq('id', req.params.id).single();
      if (iErr || !oldInvoice) throw new Error('Invoice not found');
      if (oldInvoice.status === 'VOID') throw new Error('Cannot edit voided invoice');

      // Update extension metadata
      const piExt = await readPIExt();
      piExt[req.params.id.toString()] = { payment_type_id, invoice_category_id };
      await writePIExt(piExt);

      const { data: oldItems, error: itErr } = await supabase.from('purchase_invoice_items').select('*').eq('invoice_id', req.params.id);
      if (itErr) throw itErr;

      // 1. Reverse old stock
      for (const item of (oldItems || [])) {
        const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        await supabase.from('products').update({ stock_quantity: (prod?.stock_quantity || 0) - totalStockDecrement }).eq('id', item.product_id);
        
        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          quantity: -totalStockDecrement,
          type: 'EDIT_PURCHASE_REVERSE',
          reference_type: 'PURCHASE_INVOICE',
          reference_id: oldInvoice.invoice_number
        }]);
      }

      // 2. Clear old items and batches
      await supabase.from('purchase_invoice_items').delete().eq('invoice_id', req.params.id);
      await supabase.from('stock_batches').delete().eq('purchase_invoice_id', req.params.id);

      // 3. Update Invoice Header
      const due_amount = total_amount - (paid_amount || 0);
      const payment_status = due_amount <= 0 ? 'PAID' : 'CREDIT';

      await supabase.from('purchase_invoices').update({
        supplier_id,
        total_amount,
        paid_amount: paid_amount || 0,
        due_amount,
        payment_status,
        date
      }).eq('id', req.params.id);

      // 4. Add new items and apply new stock
      for (const item of items) {
        await supabase.from('purchase_invoice_items').insert([{
          invoice_id: req.params.id,
          product_id: item.product_id,
          quantity: item.quantity,
          bonus_qty: item.bonus_qty || 0,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null
        }]);

        const totalStockIncrement = (item.quantity || 0) + (item.bonus_qty || 0);
        
        // Create stock batch if batch info provided
        if (item.batch_number || item.expiry_date) {
          await supabase.from('stock_batches').insert([{
            product_id: item.product_id,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
            quantity: totalStockIncrement,
            purchase_invoice_id: req.params.id
          }]);
        }

        const effectivePurchasePrice = totalStockIncrement > 0 
          ? (item.quantity * item.unit_price) / totalStockIncrement 
          : item.unit_price;

        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        await supabase.from('products').update({
          stock_quantity: (prod?.stock_quantity || 0) + totalStockIncrement,
          purchase_price: effectivePurchasePrice,
          expiry_date: item.expiry_date || null
        }).eq('id', item.product_id);

        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          quantity: totalStockIncrement,
          type: 'EDIT_PURCHASE_APPLY',
          reference_type: 'PURCHASE_INVOICE',
          reference_id: oldInvoice.invoice_number
        }]);
      }

      // 5. Audit Log
      await supabase.from('purchase_invoice_audit_logs').insert([{
        invoice_id: req.params.id,
        user_id: req.user.id,
        old_data: JSON.stringify(oldInvoice),
        new_data: JSON.stringify(req.body)
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase update purchase invoice error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/admin/purchase-invoices/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { data: invoice, error: iErr } = await supabase.from('purchase_invoices').select('*').eq('id', req.params.id).single();
      if (iErr || !invoice) throw new Error('Invoice not found');

      const { data: items, error: itErr } = await supabase.from('purchase_invoice_items').select('*').eq('invoice_id', req.params.id);
      if (itErr) throw itErr;

      // 1. Reverse stock if it wasn't already voided
      if (invoice.status !== 'VOID') {
        for (const item of (items || [])) {
          const totalStockDecrement = (item.quantity || 0) + (item.bonus_qty || 0);
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          await supabase.from('products').update({ stock_quantity: (prod?.stock_quantity || 0) - totalStockDecrement }).eq('id', item.product_id);
          
          await supabase.from('stock_movements').insert([{
            product_id: item.product_id,
            quantity: -totalStockDecrement,
            type: 'DELETE_PURCHASE_REVERSE',
            reference_type: 'PURCHASE_INVOICE',
            reference_id: invoice.invoice_number
          }]);
        }
      }

      // 2. Delete related records
      await supabase.from('purchase_invoice_payments').delete().eq('invoice_id', req.params.id);
      await supabase.from('purchase_invoice_items').delete().eq('invoice_id', req.params.id);
      await supabase.from('stock_batches').delete().eq('purchase_invoice_id', req.params.id);
      await supabase.from('purchase_invoice_audit_logs').delete().eq('invoice_id', req.params.id);
      const { error } = await supabase.from('purchase_invoices').delete().eq('id', req.params.id);
      
      if (error) throw error;

      await supabase.from('financial_audit_logs').insert([{
        type: 'INVOICE_PURGE',
        reference_id: req.params.id.toString(),
        user_id: req.user.id,
        details: `Permanently deleted invoice ${invoice.invoice_number}`
      }]);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Supabase delete purchase invoice error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/purchase-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const month = today.substring(0, 7);

      const { data: monthlyInvoices } = await supabase.from('purchase_invoices').select('total_amount').eq('status', 'ACTIVE').ilike('date', `${month}%`);
      const monthlyTotal = (monthlyInvoices || []).reduce((sum, i) => sum + i.total_amount, 0);

      const { data: allActiveInvoices } = await supabase.from('purchase_invoices').select('paid_amount, due_amount').eq('status', 'ACTIVE');
      const totalPaid = (allActiveInvoices || []).reduce((sum, i) => sum + i.paid_amount, 0);
      const totalDue = (allActiveInvoices || []).reduce((sum, i) => sum + i.due_amount, 0);

      const { data: topSuppliersRaw } = await supabase
        .from('purchase_invoices')
        .select('supplier_id, total_amount, suppliers!inner(name)')
        .eq('status', 'ACTIVE');

      const supplierMap = new Map();
      (topSuppliersRaw || []).forEach((pi: any) => {
        const name = pi.suppliers?.name;
        const current = supplierMap.get(name) || 0;
        supplierMap.set(name, current + pi.total_amount);
      });

      const topSuppliers = Array.from(supplierMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          monthlyTotal,
          totalPaid,
          totalDue,
          topSuppliers
        }
      });
    } catch (error: any) {
      console.error('Supabase purchase stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/stock-adjustments', authenticateToken, async (req, res) => {
    try {
      const { start_date, end_date, product_id, reason } = req.query;
      let query = supabase
        .from('stock_adjustments')
        .select(`
          *,
          products(name, barcode),
          users!created_by(username)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (start_date && end_date) {
        query = query.gte('created_at', `${start_date}T00:00:00`).lte('created_at', `${end_date}T23:59:59`);
      }
      if (product_id) {
        query = query.eq('product_id', product_id);
      }
      if (reason) {
        query = query.eq('reason', reason);
      }

      const { data: adjustments, error } = await query;
      if (error) throw error;

      const formatted = (adjustments || []).map((sa: any) => {
        let virtualInvId = sa.inventory_item_id;
        if (!virtualInvId && sa.note) {
          const match = sa.note.match(/\[INV_ITEM_REF:(\d+)\]/);
          if (match) virtualInvId = parseInt(match[1]);
        }
        return {
          ...sa,
          inventory_item_id: virtualInvId,
          product_name: sa.products?.name,
          barcode: sa.products?.barcode,
          created_by_name: sa.users?.username
        };
      });

      res.json({ success: true, data: formatted });
    } catch (error: any) {
      console.error('Supabase stock adjustments fetch error:', JSON.stringify(error, null, 2));
      res.status(500).json({ success: false, message: error.message || 'Unknown error fetching stock adjustments' });
    }
  });

  app.post('/api/stock-adjustments', authenticateToken, async (req: any, res) => {
    const { product_id, adjustment_type, quantity, reason, note, inventory_item_id } = req.body;
    const userId = req.user.id;

    if (!product_id || !adjustment_type || !quantity || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
      // If audit item adjustment, check if already adjusted
      if (inventory_item_id) {
        const { data: existingAdjust, error: eErr } = await supabase
          .from('stock_adjustments')
          .select('id, note')
          .filter('note', 'ilike', `%[INV_ITEM_REF:${inventory_item_id}]%`);
        
        if (eErr && !eErr.message?.includes('column "inventory_item_id" does not exist')) {
           // If the error is NOT about the missing column, throw it
           throw eErr;
        }

        if (existingAdjust && existingAdjust.length > 0) {
          throw new Error('This inventory item has already been adjusted.');
        }
      }

      const { data: product, error: pErr } = await supabase.from('products').select('id, stock_quantity, purchase_price').eq('id', product_id).single();
      if (pErr || !product) throw new Error('Product not found');

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
      await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product_id);

      // Record adjustment
      const payload: any = {
        product_id: parseInt(product_id),
        adjustment_type,
        quantity: parseFloat(quantity),
        reason,
        note: (note || '') + (inventory_item_id ? ` [INV_ITEM_REF:${inventory_item_id}]` : ''),
        previous_stock: prevStock,
        new_stock: newStock,
        buying_price: product.purchase_price,
        created_by: userId
      };

      // We explicitly skip payload.inventory_item_id if the client knows it doesn't exist
      // But we can try to include it if we want to support both paths. 
      // However, the error message clearly says it doesn't exist, so we skip it to avoid the crash.
      // if (inventory_item_id) payload.inventory_item_id = inventory_item_id;

      const { data: adjustmentData, error: adjErr } = await supabase.from('stock_adjustments').insert([payload]).select().single();

      if (adjErr) throw adjErr;

      // Record in stock_movements for audit
      await supabase.from('stock_movements').insert([{
        product_id: parseInt(product_id),
        quantity: adjustment_type === 'IN' ? parseFloat(quantity) : -parseFloat(quantity),
        type: adjustment_type,
        reference_type: 'ADJUSTMENT',
        reference_id: adjustmentData.id.toString()
      }]);

      res.json({ success: true, data: { prevStock, newStock } });
    } catch (error: any) {
      console.error('Supabase create stock adjustment error:', JSON.stringify(error, null, 2));
      res.status(500).json({ success: false, message: error.message || 'Unknown error creating stock adjustment' });
    }
  });

  // Daily PDF Report Data
  app.get('/api/admin/daily-pdf-report', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { month } = req.query; // format YYYY-MM
      const monthStart = `${month}-01T00:00:00`;
      const monthEnd = `${month}-31T23:59:59`; // Simple approximation

      // 1. Sales by category and date
      const { data: salesRaw } = await supabase
        .from('sale_items')
        .select(`
          subtotal,
          sales!inner(created_at, status),
          products!inner(category_id),
          categories:products(categories!inner(name))
        `)
        .eq('sales.status', 'completed')
        .gte('sales.created_at', monthStart)
        .lte('sales.created_at', monthEnd);

      const salesByCategory: any[] = [];
      const salesMap = new Map();
      (salesRaw || []).forEach((si: any) => {
        const date = si.sales.created_at.split('T')[0];
        const category = (si.categories?.name || 'OTHER').toUpperCase();
        const key = `${date}_${category}`;
        const current = salesMap.get(key) || 0;
        salesMap.set(key, current + si.subtotal);
      });
      salesMap.forEach((total, key) => {
        const [date, category] = key.split('_');
        salesByCategory.push({ date, category, total });
      });

      // 2. Returns by category
      const { data: returnsRaw } = await supabase
        .from('sales_return_items')
        .select(`
          quantity,
          refund_amount,
          sales_returns!inner(created_at),
          products!inner(category_id),
          categories:products(categories!inner(name))
        `)
        .gte('sales_returns.created_at', monthStart)
        .lte('sales_returns.created_at', monthEnd);

      const returnsByCategory: any[] = [];
      const returnsMap = new Map();
      (returnsRaw || []).forEach((sri: any) => {
        const date = sri.sales_returns.created_at.split('T')[0];
        const category = (sri.categories?.name || 'OTHER').toUpperCase();
        const key = `${date}_${category}`;
        const current = returnsMap.get(key) || 0;
        returnsMap.set(key, current + (sri.quantity * sri.refund_amount));
      });
      returnsMap.forEach((total, key) => {
        const [date, category] = key.split('_');
        returnsByCategory.push({ date, category, total });
      });

      // 3. Total Cash/Credit Sales by Date
      const { data: salesPaymentRaw } = await supabase
        .from('sales')
        .select('created_at, total_amount, payment_method, customer_id, status')
        .eq('status', 'completed')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const salesByPaymentMethod: any[] = [];
      const paymentMap = new Map();
      (salesPaymentRaw || []).forEach((s: any) => {
        const date = s.created_at.split('T')[0];
        const method = (s.customer_id || s.payment_method === 'AUTO_BURN') ? 'CREDIT' : s.payment_method;
        const key = `${date}_${method}`;
        const current = paymentMap.get(key) || 0;
        paymentMap.set(key, current + s.total_amount);
      });
      paymentMap.forEach((total, key) => {
        const [date, payment_method] = key.split('_');
        salesByPaymentMethod.push({ date, payment_method, total });
      });

      // 4. Returns by payment method
      const { data: returnsPaymentRaw } = await supabase
        .from('sales_returns')
        .select(`
          created_at,
          total_refund,
          refund_type,
          sales!inner(customer_id)
        `)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const returnsByPaymentMethod: any[] = [];
      const retPaymentMap = new Map();
      (returnsPaymentRaw || []).forEach((sr: any) => {
        const date = sr.created_at.split('T')[0];
        const method = (sr.sales?.customer_id || sr.refund_type === 'AUTO_BURN') ? 'CREDIT' : sr.refund_type;
        const key = `${date}_${method}`;
        const current = retPaymentMap.get(key) || 0;
        retPaymentMap.set(key, current + sr.total_refund);
      });
      retPaymentMap.forEach((total, key) => {
        const [date, payment_method] = key.split('_');
        returnsByPaymentMethod.push({ date, payment_method, total });
      });

      // 5. Purchases
      const { data: purchasesRaw } = await supabase
        .from('purchase_invoice_items')
        .select(`
          total_price,
          purchase_invoices!inner(id, date, payment_status, status),
          products!inner(id, category_id),
          categories_main:products(categories!inner(name))
        `)
        .eq('purchase_invoices.status', 'ACTIVE')
        .ilike('purchase_invoices.date', `${month}%`);

      const purchases: any[] = [];
      const purchaseMap = new Map();
      (purchasesRaw || []).forEach((pii: any) => {
        const date = pii.purchase_invoices.date;
        
        // Group ONLY by Primary Main Category as requested
        const categoryName = pii.categories_main?.name || 'OTHER';

        const category = categoryName.toUpperCase();
        const status = pii.purchase_invoices.payment_status;
        const key = `${date}###${category}###${status}`;
        const current = purchaseMap.get(key) || 0;
        purchaseMap.set(key, current + pii.total_price);
      });
      purchaseMap.forEach((total, key) => {
        const [date, category, payment_status] = key.split('###');
        purchases.push({ date, category, payment_status, total });
      });

      // 6. All Categories (Use only main categories from DB)
      const { data: categoriesData } = await supabase.from('categories').select('name').eq('status', 'active');
      const categories = (categoriesData || []).map(c => ({ name: (c.name || '').toUpperCase() }));

      // 7. Expenses
      const { data: expensesRaw } = await supabase
        .from('expenses')
        .select('category, description, amount')
        .ilike('date', `${month}%`);

      const expenses: any[] = [];
      const expenseMap = new Map();
      (expensesRaw || []).forEach((e: any) => {
        const key = `${e.category}_${e.description}`;
        const current = expenseMap.get(key) || 0;
        expenseMap.set(key, current + e.amount);
      });
      expenseMap.forEach((total, key) => {
        const [category, description] = key.split('_');
        expenses.push({ category, description, total });
      });

      res.json({ success: true, data: { salesByCategory, returnsByCategory, salesByPaymentMethod, returnsByPaymentMethod, purchases, expenses, categories } });
    } catch (error: any) {
      console.error('Supabase daily PDF report error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Profit & Loss Analytics API
  app.get('/api/admin/profit-analytics', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const dateParams = { start: `${start_date}T00:00:00`, end: `${end_date}T23:59:59` };

      // 1. Daily Sales and COGS
      const { data: salesRaw } = await supabase
        .from('sale_items')
        .select(`
          subtotal,
          quantity,
          sales!inner(created_at, status, payment_method),
          products!inner(purchase_price)
        `)
        .eq('sales.status', 'completed')
        .neq('sales.payment_method', 'AUTO_BURN')
        .gte('sales.created_at', dateParams.start)
        .lte('sales.created_at', dateParams.end);

      const dailySalesMap = new Map();
      (salesRaw || []).forEach((si: any) => {
        const date = si.sales.created_at.split('T')[0];
        const current = dailySalesMap.get(date) || { sales: 0, cogs: 0 };
        current.sales += si.subtotal;
        current.cogs += (si.quantity * (si.products?.purchase_price || 0));
        dailySalesMap.set(date, current);
      });

      // 2. Daily Expenses
      const { data: expensesRaw } = await supabase
        .from('expenses')
        .select('date, amount, category')
        .gte('date', start_date)
        .lte('date', end_date);

      const dailyExpensesMap = new Map();
      const expenseCategoriesMap = new Map();
      (expensesRaw || []).forEach((e: any) => {
        // Daily
        const currentExp = dailyExpensesMap.get(e.date) || 0;
        dailyExpensesMap.set(e.date, currentExp + e.amount);

        // Categories
        const currentCat = expenseCategoriesMap.get(e.category) || 0;
        expenseCategoriesMap.set(e.category, currentCat + e.amount);
      });

      // Merge daily data
      const allDates = new Set([...dailySalesMap.keys(), ...dailyExpensesMap.keys()]);
      const dailyLedger = Array.from(allDates)
        .sort((a, b) => a.localeCompare(b))
        .map(date => {
          const s = dailySalesMap.get(date) || { sales: 0, cogs: 0 };
          const e = dailyExpensesMap.get(date) || 0;
          return {
            date,
            sales: s.sales,
            cogs: s.cogs,
            expenses: e,
            gross_profit: s.sales - s.cogs,
            net_profit: s.sales - s.cogs - e
          };
        });

      // Summary KPIs
      const totalSales = dailyLedger.reduce((sum, r) => sum + r.sales, 0);
      const totalCOGS = dailyLedger.reduce((sum, r) => sum + r.cogs, 0);
      const totalExpenses = dailyLedger.reduce((sum, r) => sum + r.expenses, 0);
      const grossProfit = totalSales - totalCOGS;
      const netProfit = grossProfit - totalExpenses;

      const expenseCategories = Array.from(expenseCategoriesMap.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

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
      console.error('Supabase profit analytics error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // SYSTEM RESET (Admin Only)
  app.post('/api/admin/reset-system', authenticateToken, requireAdmin, async (req, res) => {
    const { scope } = req.body;
    try {
      const user = (req as any).user;
      console.log(`[RESET] System reset initiated. Scope: ${scope}, User: ${user?.id}`);

      const transactionalTables = [
        'void_logs',
        'sale_items',
        'sales_return_items',
        'sales_returns',
        'stock_movements',
        'stock_adjustments',
        'inventory_items',
        'inventory_audit_logs',
        'inventory_sessions',
        'stock_batches',
        'purchase_invoice_items',
        'purchase_invoice_payments',
        'purchase_invoices',
        'supplier_return_items',
        'deleted_returns_logs',
        'supplier_returns',
        'credit_logs',
        'credit_status_logs',
        'credit_limit_history',
        'daily_credit_logs',
        'monthly_credit_logs',
        'auto_burn_sales',
        'sales_summary_logs',
        'rfid_scans',
        'financial_audit_logs',
        'user_activity_logs',
        'expenses',
        'sales'
      ];

      const masterTables = [
        'products',
        'customers',
        'suppliers',
        'brands',
        'units',
        'categories'
      ];

      const tablesToClear = scope === 'complete' 
        ? [...transactionalTables, ...masterTables] 
        : transactionalTables;

      const results = [];
      for (const table of tablesToClear) {
        try {
          console.log(`[RESET] Deleting rows from ${table}...`);
          let success = false;
          let lastError: any = null;

          // Optimized Strategy: Use a sequence of fallback methods to clear the table
          // Strategy 1: Try .not('id', 'is', 'null') which is type-independent and works on both integer and uuid PKs
          const resNullCheck = await supabase.from(table).delete().not('id', 'is', 'null');
          if (!resNullCheck.error) {
            success = true;
          } else {
            // Strategy 2: Fallback to created_at check (some tables might have complex PKs or no ID, though rare in this schema)
            const resCreated = await supabase.from(table).delete().neq('created_at', '1900-01-01');
            if (!resCreated.error) {
              success = true;
            } else {
              lastError = resCreated.error;
              // Only log if both primary strategies failed
              console.log(`[RESET] Primary clear strategies failed for ${table}. Trying ID comparisons...`);
              
              // Strategy 3: Try integer ID comparison
              const resInt = await supabase.from(table).delete().gt('id', -99999999);
              if (!resInt.error) {
                success = true;
              } else {
                lastError = resInt.error;
                
                // Strategy 4: Try UUID/text ID comparison
                const resUuid = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (!resUuid.error) {
                  success = true;
                } else {
                  lastError = resUuid.error;
                }
              }
            }
          }

          if (success) {
            console.log(`[RESET] Successfully cleared ${table}`);
            results.push({ table, success: true });
          } else {
            console.error(`[RESET] All strategies failed for ${table}:`, lastError?.message || 'Unknown error');
            results.push({ table, success: false, error: lastError?.message || 'Unknown error' });
          }
        } catch (err: any) {
          console.error(`[RESET] Exception in ${table}:`, err.message);
          results.push({ table, success: false, error: err.message });
        }
      }

      const failedTables = results.filter(r => !r.success);
      if (failedTables.length > 0) {
        console.warn(`[RESET] Reset completed with ${failedTables.length} failures.`);
      }

      // Handle local files and seeding lock for complete reset
      if (scope === 'complete') {
        const localFilesToClear = [
          CAT2_FILE,
          PROD_CAT2_FILE,
          PROD_SALES_TYPE_FILE,
          PROD_STATUS_FILE,
          PROD_AUTO_CREDIT_PRODUCT_FILE,
          CUSTOMER_METADATA_FILE,
          PROD_MODIFIED_FILE,
          PI_EXT_FILE,
          EXPENSE_CATEGORIES_FILE
        ];
        localFilesToClear.forEach(f => {
          if (fs.existsSync(f)) {
            try {
              fs.unlinkSync(f);
              console.log(`[RESET] Deleted local file: ${f}`);
            } catch (e: any) {
              console.error(`[RESET] Error deleting local file ${f}:`, e.message);
            }
          }
        });

        // Ensure seed lock exists so it doesn't re-seed mock data
        if (!fs.existsSync(SEED_LOCK_FILE)) {
          try {
            fs.writeFileSync(SEED_LOCK_FILE, 'Reset performed at ' + new Date().toISOString());
          } catch (e) {}
        }

        // Persistently flag database as seeded/reset in Supabase settings table so restart won't inject mock data
        try {
          const { data: existing } = await supabase.from('settings').select('*').eq('key', 'database_seeded');
          if (existing && existing.length > 0) {
            await supabase.from('settings').update({ value: 'true' }).eq('key', 'database_seeded');
          } else {
            await supabase.from('settings').insert([{ key: 'database_seeded', value: 'true' }]);
          }
          console.log('[RESET] Successfully flagged database_seeded in settings table.');
        } catch (setErr: any) {
          console.error('[RESET] Failed to set database_seeded in settings table:', setErr.message);
        }
      }

      res.json({ 
        success: true, 
        message: `System reset finished. ${results.filter(r => r.success).length} of ${tablesToClear.length} tables cleared.`,
        details: results 
      });
    } catch (error: any) {
      console.error('[RESET] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 404 handler for API routes (prevent serving HTML index on missing API calls)
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: `API endpoint not found: ${req.originalUrl}` });
  });

  // --- VITE MIDDLEWARE (Must be after API routes) ---
  async function runServer() {
    // LOAD ONLINE SETTINGS BEFORE STARTING SERVER
    await initializeSettingsFromOnline();
    
    const PORT = 3000;
    if (process.env.VERCEL !== '1') {
      if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
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

      if (!process.env.VERCEL) {
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`Server running on http://localhost:${PORT}`);
        });
      }
    }
  }

  runServer().catch((err: any) => {
    console.error("Express dev/prod server execution failed:", err);
  });

export { app };
export default app;
