export default async function handler(req: any, res: any) {
  try {
    // Dynamically import the Express server to catch any import-time or initialization errors
    const serverModule = await import('../server.js');
    const app = serverModule.default || serverModule.app;
    
    if (!app) {
      throw new Error("Express application instance not found in exported module.");
    }
    
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel backend bootstrap error:", err);
    res.status(500).json({
      success: false,
      error: "Bootstrap Error",
      message: err?.message || String(err),
      stack: err?.stack || null
    });
  }
}

