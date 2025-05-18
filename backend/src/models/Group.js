const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // You can add more fields as needed, such as:
  // - groupType (e.g., class, project team, department)
  // - isActive
  // - maxMembers
  // - etc.
});

module.exports = mongoose.model('Group', groupSchema);
