import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace proxy definition to import shopContext and shopsRegistry
const importSupabasePattern = "import { getSupabase } from './src/lib/supabaseClient.js';";
const newImportSupabase = "import { getSupabase, shopContext, shopsRegistry } from './src/lib/supabaseClient.js';";

content = content.replace(importSupabasePattern, newImportSupabase);

// Define SHOPS_FILE and load it
const defineDataDirPattern = "const SEED_LOCK_FILE = path.join(DATA_DIR, 'seed.lock');";
const defineShopsFile = "const SEED_LOCK_FILE = path.join(DATA_DIR, 'seed.lock');\nconst SHOPS_FILE = path.join(DATA_DIR, 'shops.json');";

content = content.replace(defineDataDirPattern, defineShopsFile);

// Load shops.json on startup
const setupShops = `
// --- MULTI-TENANT SHOPS SETUP ---
function loadShops() {
  try {
    if (fs.existsSync(SHOPS_FILE)) {
      const shopsData = JSON.parse(fs.readFileSync(SHOPS_FILE, 'utf8'));
      if (Array.isArray(shopsData)) {
        shopsData.forEach(shop => {
           if (shop.id && shop.supabaseUrl && shop.supabaseKey) {
             shopsRegistry[shop.id] = { supabaseUrl: shop.supabaseUrl, supabaseKey: shop.supabaseKey };
           }
        });
      }
    }
  } catch (err) {
    console.error('Failed to load shops.json', err);
  }
}
function saveShops(shops: any[]) {
  fs.writeFileSync(SHOPS_FILE, JSON.stringify(shops, null, 2), 'utf8');
}
loadShops();
`;

// Insert after syncSettingOnline or so.
const insertShopsLoadPattern = "const settingsCache: { [key: string]: any } = {};";
content = content.replace(insertShopsLoadPattern, `${setupShops}\nconst settingsCache: { [key: string]: any } = {};`);

// Add Express middleware for shopContext
const appMiddlewarePattern = "app.use(express.json({ limit: '50mb' }));";
const newAppMiddleware = `app.use(express.json({ limit: '50mb' }));

// Shop Context Middleware
app.use((req, res, next) => {
  const shopId = req.headers['x-shop-id'] as string;
  if (shopId) {
    shopContext.run(shopId, () => next());
  } else {
    next();
  }
});
`;

content = content.replace(appMiddlewarePattern, newAppMiddleware);

if (content.includes("app.get('/api/shops'")) {
  // skip
} else {
// Add endpoints for shops
const shopsEndpoints = `
  // -- SHOPS MANAGEMENT ENDPOINTS --
  app.get('/api/shops', (req, res) => {
    let shopsList: any[] = [];
    try {
      if (fs.existsSync(SHOPS_FILE)) {
        shopsList = JSON.parse(fs.readFileSync(SHOPS_FILE, 'utf8'));
      }
    } catch(e) {}
    
    // Add default shop if configured via env
    if (process.env.SUPABASE_URL) {
       shopsList.unshift({
         id: 'default',
         name: 'Main Server (Default)',
         isDefault: true
       });
    }

    res.json({
      success: true,
      data: shopsList.map(s => ({ id: s.id, name: s.name, isDefault: s.isDefault }))
    });
  });

  app.post('/api/shops', (req, res) => {
    // Basic protection; ideally should be behind master token but we allow local creation if unconfigured or master secret match
    // Actually we will just create it locally
    const { name, supabaseUrl, supabaseKey } = req.body;
    if (!name || !supabaseUrl || !supabaseKey) return res.status(400).json({success: false, message: 'Missing fields'});

    let shopsList: any[] = [];
    try {
      if (fs.existsSync(SHOPS_FILE)) shopsList = JSON.parse(fs.readFileSync(SHOPS_FILE, 'utf8'));
    } catch(e) {}

    const newShop = {
      id: 'shop_' + Date.now(),
      name,
      supabaseUrl,
      supabaseKey
    };
    shopsList.push(newShop);
    saveShops(shopsList);
    loadShops(); // Refresh memory registry

    res.json({ success: true, shopId: newShop.id });
  });
`;

const loginPattern = "app.post('/api/auth/login', async (req, res) => {";
content = content.replace(loginPattern, `${shopsEndpoints}\n\n${loginPattern}`);
}

fs.writeFileSync(file, content, 'utf8');
