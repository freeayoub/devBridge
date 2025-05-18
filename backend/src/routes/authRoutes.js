const express = require("express");
const router = express.Router();
const { auth, authorizeRoles } = require("../middlewares/auth");
const { resendCode } = require("../controllers/authController");

const upload = require("../middlewares/upload");

const {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/login", login);
router.get("/profile", auth, getProfile);
router.put("/update-profile", auth, upload.single("image"), updateProfile);
router.put("/change-password", auth, changePassword);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-code", resendCode);

// EXAMPLE: Only admins can access this
router.get("/admin-area", auth, authorizeRoles("admin"), (req, res) => {
  res.json({ message: "Welcome Admin!" });
});

module.exports = router;
