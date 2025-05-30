const express = require("express");
const router = express.Router();
const { auth, authorizeRoles } = require("../middlewares/auth");
const { resendCode } = require("../controllers/authController");
const { getEmailPreview } = require("../utils/sendEmail");

const { uploadImage } = require("../middlewares/upload");

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
router.put("/update-profile", auth, uploadImage.single("image"), updateProfile);
router.put("/change-password", auth, changePassword);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-code", resendCode);

// Email preview routes (for development/testing)
router.get("/email-preview/:type", (req, res) => {
  const { type } = req.params;
  const { code, userName } = req.query;

  if (!["verification", "reset", "welcome"].includes(type)) {
    return res.status(400).json({ message: "Invalid email type" });
  }

  const html = getEmailPreview(type, code, userName);
  res.send(html);
});

// Create admin user endpoint (for development/setup)
router.post("/create-admin", async (req, res) => {
  try {
    const User = require("../models/User");
    const bcrypt = require("bcryptjs");

    // Get admin details from request body or use defaults
    const {
      fullName = "DevBridge Admin",
      email = "admin@devbridge.com",
      password = "admin123456",
      force = false
    } = req.body;

    // Check if admin with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User with this email already exists",
        user: {
          email: existingUser.email,
          fullName: existingUser.fullName,
          role: existingUser.role
        }
      });
    }



    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role: 'admin',
      verified: true,
      isActive: true,
      isOnline: false,
      profileImage: process.env.DEFAULT_IMAGE || 'uploads/default.png'
    });

    await adminUser.save();

    res.status(201).json({
      message: "Admin user created successfully!",
      admin: {
        id: adminUser._id,
        fullName: adminUser.fullName,
        email: adminUser.email,
        role: adminUser.role
      },
      loginInfo: {
        email: adminUser.email,
        password: password, // Only show in response for setup purposes
        loginUrl: "http://localhost:4200/login"
      }
    });

  } catch (error) {
    console.error("Error creating admin user:", error);
    res.status(500).json({
      message: "Error creating admin user",
      error: error.message
    });
  }
});

// EXAMPLE: Only admins can access this
router.get("/admin-area", auth, authorizeRoles("admin"), (req, res) => {
  res.json({ message: "Welcome Admin!" });
});

module.exports = router;
