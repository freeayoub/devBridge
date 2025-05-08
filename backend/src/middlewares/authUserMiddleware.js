const jwt = require("jsonwebtoken");
const privatekey = process.env.JWT_SECRET;
const secretkey = process.env.SECRET_KEY;
const clientkey = process.env.CLIENT_KEY;

if (!privatekey || !secretkey || !clientkey) {
  throw new Error("Missing required environment variables for authentication");
}

const verifyToken = (req, res, next) => {
  try {
     // 1. Vérifier le header Authorization
     const authHeader = req.headers.authorization;

     if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({ message: "Authentification requise" });
     }
      // 2. Extraire le token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }

    // Basic token format validation
    if (typeof token !== 'string' || token.length < 30) {
      return res.status(401).json({ message: "Invalid token format" });
    }
    const decoded = jwt.verify(token, privatekey);
      // 4. Ajouter les infos utilisateur à la requête
      req.userId = decoded.id;
      req.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
        username: decoded.username,
        image:decoded.image
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return res.status(500).json({ message: "Authentication failed", error: error.message });
  }
};

const verifyTokenAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const role = req.headers.role;
    
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }
    
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid token format - should be 'Bearer <token>'" });
    }
    
    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Token not provided" });
    }
    
    if (role !== 'admin') {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    const decoded = jwt.verify(token, privatekey);
    req.userId = decoded.id;
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username,
      image:decoded.image
  };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return res.status(500).json({ message: "Authentication failed", error: error.message });
  }
};

const verifySecretClient = (req, res, next) => {
  try {
    const sk = req.query.secret;
    const ck = req.query.client;

    if (!sk || !ck) {
      return res.status(400).json({ message: "Both secret and client keys are required" });
    }
    
    if (sk !== secretkey || ck !== clientkey) {
      return res.status(403).json({ 
        message: "Access denied: invalid credentials",
        hint: "Check your secret and client keys"
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authentication failed", error: error.message });
  }
};
const verifyTokenGraphql = async (token) => {
  if (!token || typeof token !== "string" || token.split('.').length !== 3) {
    throw new Error("Invalid or missing token");
  }

  const decoded = jwt.verify(token, privatekey);
  return {
    id: decoded.id,
    role: decoded.role,
    email: decoded.email,
    username: decoded.username,
  };
};
module.exports = {
  verifyToken,
  verifyTokenAdmin,
  verifySecretClient,
  verifyTokenGraphql
};