const User = require("../models/User");
const Group = require("../models/Group");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendAccountCredentialsEmail } = require("../utils/sendEmail");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  console.log("Admin Access by:", req.user);

  try {
    const users = await User.find()
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/admin/users - Create new user
exports.createUser = async (req, res) => {
  try {
    const { fullName, email, role = "student" } = req.body;

    // Validation
    if (!fullName || !email) {
      return res.status(400).json({
        message: "Full name and email are required"
      });
    }

    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Must be student, teacher, or admin"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User with this email already exists"
      });
    }

    // Generate a random password
    const generatedPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Create new user
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      verified: true, // Admin-created users are automatically verified
      isActive: true,
      isOnline: false,
      profileImage: process.env.DEFAULT_IMAGE || 'uploads/default.png'
    });

    await newUser.save();

    // Get the created user without sensitive data
    const createdUser = await User.findById(newUser._id)
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description");

    console.log(`User created successfully by admin: ${email}`);
    console.log(`Generated password: ${generatedPassword}`); // For development - remove in production

    // Send account credentials email
    try {
      await sendAccountCredentialsEmail(email, fullName, generatedPassword, role);
      console.log(`Account credentials email sent successfully to ${email}`);
    } catch (emailError) {
      console.error(`Failed to send credentials email to ${email}:`, emailError);
      // Don't fail the user creation if email fails, just log the error
    }

    res.status(201).json({
      message: "User created successfully and credentials have been sent to their email",
      user: createdUser,
      emailSent: true
    });

  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      message: "Failed to create user",
      error: err.message
    });
  }
};

// PUT /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["student", "teacher", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(id)
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description");

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT /api/admin/users/:id/activation
exports.toggleUserActivation = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: "isActive must be a boolean value" });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent admin from deactivating themselves
    if (req.user.id === id && !isActive) {
      return res.status(400).json({
        message: "You cannot deactivate your own account"
      });
    }

    user.isActive = isActive;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(id)
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description");

    const action = isActive ? "activated" : "deactivated";
    res.json({
      message: `User ${action} successfully`,
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
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
        return res.status(404).json({ message: "Group not found" });
      }
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Set group or remove if null
    user.group = groupId || null;
    await user.save();

    // Get updated user with group info
    const updatedUser = await User.findById(id)
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description");

    res.json({
      message: "User group updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/admin/users/export - Export users to file
exports.exportUsers = async (req, res) => {
  try {
    const { format = 'csv', search = '' } = req.query;

    console.log("Export request by:", req.user);
    console.log("Export format:", format);
    console.log("Search filter:", search);

    // Build query based on search filter
    let query = {};
    if (search) {
      query = {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { role: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get users data
    const users = await User.find(query)
      .select("-password -verificationCode -resetCode")
      .populate("group", "name description")
      .sort({ createdAt: -1 });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found to export" });
    }

    // Prepare data for export
    const exportData = users.map(user => ({
      id: user._id,
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || '',
      group: user.group ? user.group.name : '',
      isActive: user.isActive ? 'Active' : 'Inactive',
      verified: user.verified ? 'Yes' : 'No',
      isOnline: user.isOnline ? 'Online' : 'Offline',
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
      lastActive: user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'
    }));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      // Export as JSON
      const filename = `users-export-${timestamp}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      return res.json({
        exportInfo: {
          totalUsers: exportData.length,
          exportDate: new Date().toISOString(),
          exportedBy: req.user.email || req.user.username
        },
        users: exportData
      });
    } else {
      // Export as CSV (default)
      const filename = `users-export-${timestamp}.csv`;
      const tempFilePath = path.join(__dirname, '../../temp', filename);

      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Define CSV headers
      const csvWriter = createCsvWriter({
        path: tempFilePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'fullName', title: 'Full Name' },
          { id: 'username', title: 'Username' },
          { id: 'email', title: 'Email' },
          { id: 'role', title: 'Role' },
          { id: 'group', title: 'Group' },
          { id: 'isActive', title: 'Status' },
          { id: 'verified', title: 'Verified' },
          { id: 'isOnline', title: 'Online Status' },
          { id: 'createdAt', title: 'Created Date' },
          { id: 'lastActive', title: 'Last Active' }
        ]
      });

      // Write CSV file
      await csvWriter.writeRecords(exportData);

      // Send file as download
      res.download(tempFilePath, filename, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error downloading file" });
          }
        }

        // Clean up temp file after download
        setTimeout(() => {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`Temp file ${filename} cleaned up`);
          }
        }, 5000);
      });
    }

  } catch (err) {
    console.error("Export users error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
