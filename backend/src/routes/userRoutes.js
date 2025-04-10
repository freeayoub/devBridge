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
// Gestion compte utilisateur
router.put("/deactivateself", userController.deactivateSelf);
router.post("/logout", userController.logout);
// ==================== Routes Admin ==================== 
router.use(verifyTokenAdmin);
// Gestion des utilisateurs
router.get("/getall", userController.getAllUsers);
router.post(
    "/add",
    validationUserMiddleware(true),
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