const User = require('../models/User');
const Group = require('../models/Group');
const { formatUserResponse, formatUsersResponse } = require('../utils/formatUserResponse');

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
    console.log('Admin Access by:', req.user);

  try {
    const users = await User.find()
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the response to include the full profile image URL for each user
    const formattedUsers = formatUsersResponse(users, req);

    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['student', 'teacher', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = role;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const formattedUser = formatUserResponse(updatedUser, req);

    res.json({
      message: 'User role updated successfully',
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/admin/users/:id/group
exports.updateUserGroup = async (req, res) => {
  const { id } = req.params;
  const { groupId } = req.body;

  try {
    // Check if group exists if groupId is provided
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Set group or remove if null
    user.group = groupId || null;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(id)
      .select('-password -verificationCode -resetCode')
      .populate('group', 'name description');

    // Format the user object to include the profile image URL
    const formattedUser = formatUserResponse(updatedUser, req);

    res.json({
      message: 'User group updated successfully',
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
