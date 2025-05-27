const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
  files: [{
    name: String,
    path: String,
    size: Number,
    mimeType: String
  }],
  links: [{
    title: String,
    url: String
  }],
  status: { 
    type: String, 
    enum: ['pending-review', 'approved', 'needs-revision', 'rejected'],
    default: 'pending-review'
  },
  feedback: [{
    comment: String,
    rating: {
      type: Number,
      min: 0,
      max: 5
    },
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    givenAt: {
      type: Date,
      default: Date.now
    }
  }],
  grade: {
    value: {
      type: Number,
      min: 0,
      max: 100
    },
    comments: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: {
      type: Date
    }
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field on save
submissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// After saving a submission, update the task status if needed
submissionSchema.post('save', async function() {
  try {
    if (this.status === 'approved' && this.task) {
      const Task = mongoose.model('Task');
      const task = await Task.findById(this.task);
      
      if (task && task.status !== 'completed') {
        task.status = 'completed';
        task.completedDate = Date.now();
        await task.save();
      }
    }
  } catch (err) {
    console.error('Error updating task status:', err);
  }
});

module.exports = mongoose.model('Submission', submissionSchema);
