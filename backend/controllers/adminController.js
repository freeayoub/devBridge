const User = require('../models/User');
const Group = require('../models/Group');
const { formatUserResponse, formatUsersResponse } = require('../utils/formatUserResponse');
const moment = require('moment');

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  console.log('User Access by:', req.user);

  try {
    // Check if role filter is provided
    const { role } = req.query;
    let query = {};

    // If user is a teacher, they can only see students
    if (req.user.role === 'teacher') {
      query.role = 'student';
      // Only return active and verified students
      query.isActive = true;
      query.verified = true;
    } else {
      // Admin can see all users or filter by role
      query = role ? { role } : {};
    }

    const users = await User.find(query)
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

// GET /api/admin/user-growth
exports.getUserGrowth = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    // Get all users with their creation dates
    const users = await User.find().select('createdAt');

    let groupedData = [];
    const now = moment();

    if (period === 'daily') {
      // Last 30 days
      const startDate = moment().subtract(30, 'days').startOf('day');

      // Initialize data array with zeros for all days
      for (let i = 0; i < 30; i++) {
        const date = moment(startDate).add(i, 'days');
        groupedData.push({
          label: date.format('MMM DD'),
          count: 0,
          date: date.toDate()
        });
      }

      // Count users for each day
      users.forEach(user => {
        const createdAt = moment(user.createdAt);
        if (createdAt.isAfter(startDate)) {
          const dayIndex = createdAt.diff(startDate, 'days');
          if (dayIndex >= 0 && dayIndex < 30) {
            groupedData[dayIndex].count++;
          }
        }
      });
    } else if (period === 'weekly') {
      // Last 12 weeks
      const startDate = moment().subtract(12, 'weeks').startOf('week');

      // Initialize data array with zeros for all weeks
      for (let i = 0; i < 12; i++) {
        const date = moment(startDate).add(i, 'weeks');
        groupedData.push({
          label: `Week ${date.format('W')}`,
          count: 0,
          date: date.toDate()
        });
      }

      // Count users for each week
      users.forEach(user => {
        const createdAt = moment(user.createdAt);
        if (createdAt.isAfter(startDate)) {
          const weekIndex = createdAt.diff(startDate, 'weeks');
          if (weekIndex >= 0 && weekIndex < 12) {
            groupedData[weekIndex].count++;
          }
        }
      });
    } else {
      // Monthly (default) - Last 12 months
      const startDate = moment().subtract(12, 'months').startOf('month');

      // Initialize data array with zeros for all months
      for (let i = 0; i < 12; i++) {
        const date = moment(startDate).add(i, 'months');
        groupedData.push({
          label: date.format('MMM YYYY'),
          count: 0,
          date: date.toDate()
        });
      }

      // Count users for each month
      users.forEach(user => {
        const createdAt = moment(user.createdAt);
        if (createdAt.isAfter(startDate)) {
          const monthIndex = createdAt.diff(startDate, 'months');
          if (monthIndex >= 0 && monthIndex < 12) {
            groupedData[monthIndex].count++;
          }
        }
      });
    }

    // Calculate cumulative growth
    let cumulativeData = [];
    let cumulativeCount = 0;

    groupedData.forEach(item => {
      cumulativeCount += item.count;
      cumulativeData.push({
        ...item,
        cumulativeCount
      });
    });

    res.json({
      period,
      data: groupedData,
      cumulativeData
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
