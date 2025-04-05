const express = require("express");
const router = express.Router();
const validationUserMiddleware = require("../middlewares/validationUserMiddleware");
const {
  verifyTokenAdmin,
  verifyToken,
  verifySecretClient,
} = require("../middlewares/authUserMiddleware");
const userController = require("../controllers/userController");

// Public routes (no authentication required)
router.post(
  "/register",
  validationUserMiddleware(false),
  userController.register
);
router.post("/login", userController.login);

// Authenticated user routes
router.get(
  "/allusers",
  verifyToken,
  verifySecretClient,
  userController.getAllUsers
);

router.get(
  "/oneuser/:id",
  verifyToken,
  verifySecretClient,
  userController.getOneUser
);

// Admin-only routes
router.post(
  "/newuser",
  verifyTokenAdmin,
  verifySecretClient,
  validationUserMiddleware(false),
  userController.createUser
);

router.put(
  "/updateuser/:id",
  verifyTokenAdmin,
  verifySecretClient,
  validationUserMiddleware(true),
  userController.updateUser
);

router.delete(
  "/deleteuser/:id",
  verifyTokenAdmin,
  verifySecretClient,
  userController.deleteUser
);

module.exports = router;
