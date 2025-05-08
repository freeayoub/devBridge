const express = require('express');
const router = express.Router();
const { auth, authorizeRoles } = require('../middleware/auth');
const {
  getAllUsers,
  updateUserRole,
  updateUserGroup
} = require('../controllers/adminController');
const User = require('../models/User'); // ✅ required

// GET all users
router.get('/users', auth, authorizeRoles('admin'), getAllUsers);

// Update user role
router.put('/users/:id/role', auth, authorizeRoles('admin'), updateUserRole);

// Update user group
router.put('/users/:id/group', auth, authorizeRoles('admin'), updateUserGroup);

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
