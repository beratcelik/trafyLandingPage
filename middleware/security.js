const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

function securityMiddleware(app) {
  // Helmet -- HTTP guvenlik header'lari
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'", "https://*.param.com.tr", "https://*.ew.com.tr"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS -- sadece kendi domain'imiz
  app.use(cors({
    origin: process.env.DOMAIN || 'https://trafy.tr',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Admin-Secret']
  }));

  // Trust proxy (nginx arkasinda)
  app.set('trust proxy', 1);
}

// Genel API rate limiter
const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla istek. Lutfen biraz bekleyin.' }
});

// Siparis olusturma icin daha siki rate limit
const orderRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla siparis denemesi. Lutfen biraz bekleyin.' }
});

module.exports = { securityMiddleware, rateLimiter, orderRateLimiter };
