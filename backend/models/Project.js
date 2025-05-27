const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    required: true,
    trim: true
  },
  startDate: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  endDate: { 
    type: Date, 
    required: true
  },
  status: { 
    type: String, 
    enum: ['planning', 'in-progress', 'completed', 'on-hold'],
    default: 'planning'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignedGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    name: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field on save
projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to calculate progress based on completed tasks
projectSchema.methods.calculateProgress = async function() {
  const Task = mongoose.model('Task');
  
  if (!this.tasks || this.tasks.length === 0) {
    this.progress = 0;
    return;
  }
  
  const tasks = await Task.find({ _id: { $in: this.tasks } });
  const completedTasks = tasks.filter(task => task.status === 'completed');
  
  this.progress = Math.round((completedTasks.length / tasks.length) * 100);
};

module.exports = mongoose.model('Project', projectSchema);
