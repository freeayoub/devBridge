const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
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
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'review', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: { 
    type: Date
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  completedDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0
  },
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
  comments: [{
    text: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
taskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If status is changed to completed, set completedDate
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = Date.now();
  }
  
  next();
});

// After saving a task, update the project's progress
taskSchema.post('save', async function() {
  try {
    const Project = mongoose.model('Project');
    const project = await Project.findById(this.project);
    
    if (project) {
      await project.calculateProgress();
      await project.save();
    }
  } catch (err) {
    console.error('Error updating project progress:', err);
  }
});

module.exports = mongoose.model('Task', taskSchema);
