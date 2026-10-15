/**
 * In-memory rate limiting middleware for sensitive endpoints (e.g. forgot-password).
 * Protects against credential stuffing, email bombing, and API quota exhaustion.
 * 
 * @param {Object} options
 * @param {number} [options.windowMs=900000] - Window duration in milliseconds (default 15 minutes)
 * @param {number} [options.max=5] - Maximum allowed requests per window
 * @param {string} [options.message] - Custom error message
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 mins
  const max = options.max || 5;
  const message = options.message || 'Too many requests. Please try again later.';

  const ipTracker = new Map();

  // Prune expired records every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipTracker.entries()) {
      if (now > record.resetTime) {
        ipTracker.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    // In test environment, skip rate limiting to avoid test interference
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const clientKey = String(ip).split(',')[0].trim();
    const now = Date.now();

    const record = ipTracker.get(clientKey);

    if (!record || now > record.resetTime) {
      ipTracker.set(clientKey, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSeconds,
      });
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    return next();
  };
};

module.exports = {
  createRateLimiter,
  forgotPasswordLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many password reset requests from this IP. Please try again in 15 minutes.',
  }),
};
