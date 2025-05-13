const rateLimit = require('express-rate-limit');


// General rate limiter
exports.generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { success: false, message: 'Too many requests, please try again later.' }
  });
  
  // Auth endpoint rate limiter (more strict)
  exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 login/register attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts, please try again later.' }
  });
  
  // Email verification rate limiter
  exports.emailLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 5 minutes
    max: 5, // limit each IP to 5 email verification requests per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many verification requests, please 10mins and try again later.' }
  });