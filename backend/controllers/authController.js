const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const generateCode = require('../utils/generateCode');
const { formatUserResponse } = require('../utils/formatUserResponse');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} = require('../utils/sendEmail');

exports.signup = async (req, res) => {
  const { fullName, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      role: 'student',
      profileImage: 'uploads/default.png',
      verificationCode: code,
      verified: false
    });

    await user.save();
    await sendVerificationEmail(email, code, fullName);

    res.status(201).json({ message: 'Signup successful. Verification code sent to email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email }).populate('group', 'name description');
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      if (!user.verified) {
        return res.status(403).json({ message: 'Email not verified' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          group: user.group ? {
            id: user.group._id,
            name: user.group.name,
            description: user.group.description
          } : null
        }
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('group', 'name description');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Format the response to include the full profile image URL
    const userResponse = formatUserResponse(user, req);

    res.json(userResponse);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
    try {
      const { fullName, email } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (fullName) user.fullName = fullName;
      if (email) user.email = email;

      // Check if an image was uploaded
      if (req.file) {
        user.profileImage = req.file.path;
      }

      await user.save();

      // Get the group information if user belongs to a group
      let groupInfo = null;
      if (user.group) {
        const Group = require('../models/Group');
        const group = await Group.findById(user.group);
        if (group) {
          groupInfo = {
            id: group._id,
            name: group.name
          };
        }
      }

      // Format the user response with proper profile image URL
      const formattedUser = formatUserResponse(user, req);

      // Add group info
      formattedUser.group = groupInfo;

      res.json({
        message: 'Profile updated successfully',
        user: formattedUser
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };


exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (user.verified) return res.status(400).json({ message: 'Email already verified' });

      if (user.verificationCode === code) {
        user.verified = true;
        user.verificationCode = null;
        await user.save();

        // Send welcome email after successful verification
        await sendWelcomeEmail(email, user.fullName);

        res.json({ message: 'Email verified successfully' });
      } else {
        res.status(400).json({ message: 'Invalid verification code' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };

  exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.resetCode = code;
      await user.save();
      await sendPasswordResetEmail(email, code, user.fullName);

      res.json({ message: 'Reset code sent to email' });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };

  exports.resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user || user.resetCode !== code) {
        return res.status(400).json({ message: 'Invalid code or email' });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      user.resetCode = null;

      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }



  };
  exports.resendCode = async (req, res) => {
    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

      // Generate new code
      const code = generateCode();
      user.verificationCode = code;
      await user.save();

      // Send email with user's name
      await sendVerificationEmail(email, code, user.fullName);

      res.json({ message: 'Un nouveau code a été envoyé à votre email.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erreur lors de l\'envoi du code.', error: err.message });
    }
  };
