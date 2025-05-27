const express = require('express');
const router = express.Router();
const { auth, authorizeRoles } = require('../middleware/auth');
const {
  getAllUsers,
  updateUserRole,
  updateUserGroup,
  getUserGrowth
} = require('../controllers/adminController');
const User = require('../models/User'); // ✅ required

// GET all users - admins can see all users, teachers can only see students for project assignment
router.get('/users', auth, authorizeRoles('admin', 'teacher'), getAllUsers);

// Create a new user (admin only)
router.post('/users', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { fullName, email, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Validate role
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Generate a random password
    const generatePassword = require('../utils/generatePassword');
    const randomPassword = generatePassword(12, true, true, true, true);

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Create new user
    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      profileImage: 'uploads/default-avatar.png',
      verified: true // Admin-created users are automatically verified
    });

    await user.save();

    // Send email with the new password
    const { sendAdminPasswordResetEmail } = require('../utils/sendEmail');
    await sendAdminPasswordResetEmail(email, randomPassword, fullName);

    // Get user with populated fields
    const newUser = await User.findById(user._id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const { formatUserResponse } = require('../utils/formatUserResponse');
    const formattedUser = formatUserResponse(newUser, req);

    res.status(201).json({
      message: `User created successfully. A password has been generated and sent to ${email}`,
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
});

// Update a user (admin only)
router.put('/users/:id', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { fullName, email, role } = req.body;
    const userId = req.params.id;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it's already in use
    if (email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another user' });
      }
    }

    // Validate role
    if (role && !['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Update user fields
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.role = role || user.role;

    await user.save();

    // Get updated user with populated fields
    const updatedUser = await User.findById(userId)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const { formatUserResponse } = require('../utils/formatUserResponse');
    const formattedUser = formatUserResponse(updatedUser, req);

    res.json({
      message: 'User updated successfully',
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
});

// GET user growth data
router.get('/user-growth', auth, authorizeRoles('admin'), getUserGrowth);

// Update user role
router.put('/users/:id/role', auth, authorizeRoles('admin'), updateUserRole);

// Update user group
router.put('/users/:id/group', auth, authorizeRoles('admin'), updateUserGroup);

// Toggle user activation
router.put('/users/:id/activation', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = isActive;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(req.params.id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const { formatUserResponse } = require('../utils/formatUserResponse');
    const formattedUser = formatUserResponse(updatedUser, req);

    const action = isActive ? 'activated' : 'deactivated';
    res.json({
      message: `User ${action} successfully`,
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user activation status', error: err.message });
  }
});

// Toggle user email verification
router.put('/users/:id/verification', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.verified = verified;
    // Clear verification code if verifying
    if (verified) {
      user.verificationCode = null;
    }
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(req.params.id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const { formatUserResponse } = require('../utils/formatUserResponse');
    const formattedUser = formatUserResponse(updatedUser, req);

    const action = verified ? 'verified' : 'unverified';
    res.json({
      message: `User email ${action} successfully`,
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user verification status', error: err.message });
  }
});

// Trigger password reset for a user
router.post('/users/:id/reset-password', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate a random password
    const generatePassword = require('../utils/generatePassword');
    const newPassword = generatePassword(12, true, true, true, true);

    // Hash the new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedPassword;
    // Clear any existing reset code
    user.resetCode = null;
    await user.save();

    // Send email with the new password
    const { sendAdminPasswordResetEmail } = require('../utils/sendEmail');
    await sendAdminPasswordResetEmail(user.email, newPassword, user.fullName);

    // Get updated user with group info (without sensitive data)
    const updatedUser = await User.findById(req.params.id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const { formatUserResponse } = require('../utils/formatUserResponse');
    const formattedUser = formatUserResponse(updatedUser, req);

    res.json({
      message: `Password has been reset and sent to ${user.email}`,
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
});

// Delete user
router.delete('/users/:id', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
});

module.exports = router;
