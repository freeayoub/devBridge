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

// GET all users
router.get('/users', auth, authorizeRoles('admin'), getAllUsers);

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
