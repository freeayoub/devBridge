const jwt = require("jsonwebtoken");
const authMiddleware = (req, res, next) => {
   // Extract token from the Authorization header
   const authHeader = req.headers.authorization;
   if (!authHeader || !authHeader.startsWith("Bearer ")) {
     return res.status(401).json({ message: "No token provided or invalid format" });
   }
   const token = authHeader.split(" ")[1]; 
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+]+$/)) {
      return res.status(401).json({ message: "Invalid token format" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = authMiddleware;