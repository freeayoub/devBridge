const express = require("express");
const router = express.Router();
const validationUserMiddleware = require("../middlewares/validationUserMiddleware");
const { 
    verifyTokenAdmin, 
    verifyToken, 
    verifySecretClient 
} = require("../middlewares/authUserMiddleware");
const userController = require("../controllers/userController");
const rateLimit = require('express-rate-limit');
const multer = require('multer');
// Configure Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), 
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});
// Configuration du rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par fenêtre
    standardHeaders: true,
    legacyHeaders: false
});

// ==================== Routes Publiques ====================
router.post("/register", apiLimiter, validationUserMiddleware(false), userController.register);
router.post("/login", apiLimiter, userController.login);
// ==================== Routes Utilisateur ====================
router.use(verifyToken, verifySecretClient);
// Profil utilisateur
router.get("/profile", userController.getProfile);
router.put(
    "/updateself/:id",
    validationUserMiddleware(true),
    userController.updateSelf
);
router.post(
    '/upload-profile-image',
    upload.single('image'),
    userController.uploadProfileImage
  );
  router.delete(
    '/remove-profile-image',
    userController.removeProfileImage
  );
// Gestion compte utilisateur
router.put("/deactivateself", userController.deactivateSelf);
router.put("/logout", userController.logout);
// ==================== Routes Admin ==================== 

router.use(verifyTokenAdmin);
// Gestion des utilisateurs
router.get("/getall", userController.getAllUsers);
router.post(
    "/add",
    validationUserMiddleware(false),
    userController.createUser
);
// Opérations sur un utilisateur spécifique
router.get("/getone/:id", userController.getUserById);
router.put(
    "/update/:id",
    validationUserMiddleware(true),
    userController.updateUser
);
router.delete("/delete/:id", userController.deleteUser);
// Gestion du statut
router.put("/update/:id/reactivate", userController.reactivateUser);
router.put("/update/:id/deactivate", userController.deactivateUser);


module.exports = router;