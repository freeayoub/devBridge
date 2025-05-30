const express = require("express");
const router = express.Router();
const {
    verifyTokenAdmin,
    verifyToken,
    verifySecretClient
} = require("../middlewares/authUserMiddleware");
const userController = require("../controllers/userController");
const rateLimit = require('express-rate-limit');
const { uploadImage } = require('../middlewares/upload');
// Configuration du rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par fenêtre
    standardHeaders: true,
    legacyHeaders: false
});
// ==================== Routes Utilisateur ====================
router.use(verifyToken, verifySecretClient);
// Profil utilisateur
router.get("/profile", userController.getProfile);
router.post(
    '/upload-profile-image',
    uploadImage.single('image'),
    userController.uploadProfileImage
  );
  router.delete(
    '/remove-profile-image',
    userController.removeProfileImage
  );

router.put("/logout", userController.logout);
// ==================== Routes Admin ====================
// Opérations sur un utilisateur spécifique
router.use(verifyTokenAdmin);
router.get("/getone/:id", userController.getUserById);
// Gestion des utilisateurs
router.get("/getall", userController.getAllUsers);

// Gestion du statut
module.exports = router;