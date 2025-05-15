const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CallSchema = new Schema({
  _id: {
    type: String,
    required: true
  },
  caller: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['audio', 'video', 'video_only'],
    default: 'video'
  },
  status: {
    type: String,
    enum: ['ringing', 'connected', 'ended', 'missed', 'rejected', 'failed'],
    default: 'ringing'
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  offer: {
    type: String,
    required: function() {
      return this.status === 'ringing';
    }
  },
  answer: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes pour optimiser les requêtes
CallSchema.index({ caller: 1, startTime: -1 });
CallSchema.index({ recipient: 1, startTime: -1 });
CallSchema.index({ conversationId: 1 });
CallSchema.index({ status: 1 });

module.exports = mongoose.model('Call', CallSchema);


