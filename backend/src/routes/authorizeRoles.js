// middleware/authorizeRoles.js
module.exports = function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
      }
      next();
    };
  };
  