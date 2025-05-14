const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'admin', 'teacher'],
    default: 'student'
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  profileImage: { type: String, default: 'uploads/default-avatar.png' },
  createdAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  verificationCode: { type: String },
  resetCode: { type: String }
});

module.exports = mongoose.model('User', userSchema);
