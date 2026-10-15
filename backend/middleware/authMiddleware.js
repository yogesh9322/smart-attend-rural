const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Cross-DB ID to Email mapping (handles seamless switching between MongoDB Atlas and Local MongoDB)
const CROSS_DB_EMAIL_MAP = {
  '6a5eeca9f91baa75e384839d': 'admin@school.com',
  '6a408f11e016e611dea3d105': 'admin@school.com',
  '6a5eecaaf91baa75e38483a3': 'ysp932215@gmail.com',
  '6a409104e016e611dea3d1f6': 'ysp932215@gmail.com',
  '6a5eecaaf91baa75e38483a6': 'parent@school.com',
  '6a408f11e016e611dea3d10e': 'parent@school.com',
  '6a62fa44aa07250141da6c54': 'yp178281@gmail.com',
  '6a47f3d0f769d4ecdedf6d55': 'yp178281@gmail.com',
  '6a630b7089a71f2acb3c281a': 'yogeshpawar.pict@gmail.com',
  '6abb601cb3385555b7b5bed5': 'yogeshpawar.pict@gmail.com',
};

// Protect routes
const protect = async (req, res, next) => {
  let token;
  const headerEmail = req.headers['x-user-email'];
  const headerRole = req.headers['x-user-role'];

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_smart_attend_rural_key_998877');

      // 1. If the browser tab explicitly specifies its active user email, prefer that user
      // (prevents multi-tab localStorage token collision when Admin, Teacher, and Parent tabs are open simultaneously)
      if (headerEmail) {
        req.user = await User.findOne({ email: headerEmail }).select('-password');
      }

      // 2. Otherwise look up by token ID
      if (!req.user && decoded.id) {
        req.user = await User.findById(decoded.id).select('-password');
      }

      // 3. Fallback if DB switched between Atlas and Local MongoDB
      if (!req.user) {
        const fallbackEmail = decoded.email || CROSS_DB_EMAIL_MAP[decoded.id];
        if (fallbackEmail) {
          req.user = await User.findOne({ email: fallbackEmail }).select('-password');
        }
      }

      // 4. Role fallback if ID came from an older seed
      if (!req.user && (decoded.role || headerRole)) {
        req.user = await User.findOne({ role: decoded.role || headerRole }).select('-password');
      }

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      console.error('JWT verification error:', error.message);
      // If token failed but tab has active user email, attempt recovery
      if (headerEmail) {
        req.user = await User.findOne({ email: headerEmail }).select('-password');
        if (req.user) return next();
      }
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  // Fallback recovery if token was cleared during server restart while tab stayed open
  if (!token && headerEmail) {
    try {
      req.user = await User.findOne({ email: headerEmail }).select('-password');
      if (req.user) {
        return next();
      }
    } catch (err) {
      console.error('Header email auth recovery error:', err.message);
    }
  }

  return res.status(401).json({ success: false, message: 'Not authorized, no token' });
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
