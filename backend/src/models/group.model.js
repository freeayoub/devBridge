// models/group.model.js
const mongoose = require('mongoose');
const Conversation = require('./conversation.model');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  photo: String,
  description: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware pour synchroniser avec Conversation
GroupSchema.post('save', async function(doc) {
  await Conversation.findByIdAndUpdate(doc.conversation, {
    $set: {
      isGroup: true,
      groupName: doc.name,
      groupPhoto: doc.photo,
      groupDescription: doc.description,
      groupAdmins: doc.admins
    }
  });
});

module.exports = mongoose.model('Group', GroupSchema);