const Group = require('../models/Group');
const User = require('../models/User');

// Create a new group
exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const group = new Group({
      name,
      description,
      createdBy: req.user.id
    });
    
    await group.save();
    
    res.status(201).json({ 
      message: 'Group created successfully', 
      group 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error creating group', 
      error: err.message 
    });
  }
};

// Get all groups
exports.getAllGroups = async (req, res) => {
  try {
    const groups = await Group.find().populate('createdBy', 'fullName email');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching groups', 
      error: err.message 
    });
  }
};

// Get a specific group by ID
exports.getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'fullName email');
    
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    res.json(group);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching group', 
      error: err.message 
    });
  }
};

// Update a group
exports.updateGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Optional: Check if the user is the creator of the group or an admin
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }
    
    if (name) group.name = name;
    if (description) group.description = description;
    
    await group.save();
    
    res.json({ 
      message: 'Group updated successfully', 
      group 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error updating group', 
      error: err.message 
    });
  }
};

// Delete a group
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    // Optional: Check if the user is the creator of the group or an admin
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this group' });
    }
    
    await Group.findByIdAndDelete(req.params.id);
    
    // Remove group reference from all users in this group
    await User.updateMany(
      { group: req.params.id },
      { $set: { group: null } }
    );
    
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error deleting group', 
      error: err.message 
    });
  }
};

// Add a user to a group
exports.addUserToGroup = async (req, res) => {
  try {
    const { userId } = req.body;
    const groupId = req.params.id;
    
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.group = groupId;
    await user.save();
    
    res.json({ 
      message: 'User added to group successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        group: user.group
      }
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error adding user to group', 
      error: err.message 
    });
  }
};

// Remove a user from a group
exports.removeUserFromGroup = async (req, res) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is in the specified group
    if (user.group && user.group.toString() !== req.params.id) {
      return res.status(400).json({ message: 'User is not in this group' });
    }
    
    user.group = null;
    await user.save();
    
    res.json({ 
      message: 'User removed from group successfully' 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error removing user from group', 
      error: err.message 
    });
  }
};

// Get all users in a group
exports.getGroupUsers = async (req, res) => {
  try {
    const users = await User.find({ group: req.params.id })
      .select('-password -verificationCode -resetCode');
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching group users', 
      error: err.message 
    });
  }
};
