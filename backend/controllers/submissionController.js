const Submission = require('../models/Submission');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Create a new submission
exports.createSubmission = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      projectId, 
      taskId,
      links
    } = req.body;
    
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is assigned to this project
    const isAssignedToProject = project.assignedTo.includes(req.user.id);
    const isInAssignedGroup = project.assignedGroup && 
      await User.findOne({ _id: req.user.id, group: project.assignedGroup });
    
    if (!isAssignedToProject && !isInAssignedGroup) {
      return res.status(403).json({ 
        message: 'Not authorized to submit to this project' 
      });
    }
    
    // Verify task exists if taskId is provided
    let task = null;
    if (taskId) {
      task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Check if task belongs to the specified project
      if (task.project.toString() !== projectId) {
        return res.status(400).json({ 
          message: 'Task does not belong to the specified project' 
        });
      }
    }
    
    // Process uploaded files
    const files = [];
    if (req.files && req.files.length > 0) {
      files = req.files.map(file => ({
        name: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype
      }));
    }
    
    // Create new submission
    const submission = new Submission({
      title,
      description,
      project: projectId,
      task: taskId || null,
      submittedBy: req.user.id,
      files,
      links: links || []
    });
    
    await submission.save();
    
    // If this is a task submission, update task status
    if (task) {
      task.status = 'review';
      await task.save();
    }
    
    // Populate submission details
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('submittedBy', 'fullName email profileImage')
      .populate('project', 'title')
      .populate('task', 'title');
    
    res.status(201).json({ 
      message: 'Submission created successfully', 
      submission: populatedSubmission 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error creating submission', 
      error: err.message 
    });
  }
};

// Get all submissions for a project
exports.getProjectSubmissions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user has access to this project
    const isCreator = project.createdBy.toString() === req.user.id;
    const isAssigned = project.assignedTo.includes(req.user.id);
    const isInAssignedGroup = project.assignedGroup && 
      await User.findOne({ _id: req.user.id, group: project.assignedGroup });
    
    if (req.user.role !== 'admin' && !isCreator && !isAssigned && !isInAssignedGroup) {
      return res.status(403).json({ 
        message: 'Access denied to this project\'s submissions' 
      });
    }
    
    // Build query
    const query = { project: projectId };
    if (status) query.status = status;
    
    // Students can only see their own submissions
    if (req.user.role === 'student') {
      query.submittedBy = req.user.id;
    }
    
    const submissions = await Submission.find(query)
      .populate('submittedBy', 'fullName email profileImage')
      .populate('project', 'title')
      .populate('task', 'title')
      .sort({ submittedAt: -1 });
    
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching submissions', 
      error: err.message 
    });
  }
};

// Get a specific submission by ID
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('submittedBy', 'fullName email profileImage')
      .populate('project', 'title createdBy assignedTo assignedGroup')
      .populate('task', 'title')
      .populate('feedback.givenBy', 'fullName email profileImage')
      .populate('grade.gradedBy', 'fullName email profileImage');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Check if user has access to this submission
    const project = submission.project;
    const isCreator = project.createdBy.toString() === req.user.id;
    const isSubmitter = submission.submittedBy._id.toString() === req.user.id;
    const isAssigned = project.assignedTo.some(user => 
      user.toString() === req.user.id
    );
    
    if (req.user.role !== 'admin' && !isCreator && !isSubmitter && !isAssigned) {
      return res.status(403).json({ message: 'Access denied to this submission' });
    }
    
    res.json(submission);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching submission', 
      error: err.message 
    });
  }
};

// Add feedback to a submission
exports.addFeedback = async (req, res) => {
  try {
    const { comment, rating } = req.body;
    
    const submission = await Submission.findById(req.params.id)
      .populate('project', 'createdBy');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Check if user is authorized to add feedback
    // Only teachers who created the project or admins can add feedback
    const isCreator = submission.project.createdBy.toString() === req.user.id;
    
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ 
        message: 'Not authorized to add feedback' 
      });
    }
    
    if (req.user.role === 'teacher' && !isCreator) {
      return res.status(403).json({ 
        message: 'Only the project creator can add feedback' 
      });
    }
    
    // Add the feedback
    submission.feedback.push({
      comment,
      rating: rating || null,
      givenBy: req.user.id
    });
    
    await submission.save();
    
    // Get the updated submission with populated feedback
    const updatedSubmission = await Submission.findById(req.params.id)
      .populate('feedback.givenBy', 'fullName email profileImage');
    
    res.json({ 
      message: 'Feedback added successfully', 
      submission: updatedSubmission 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error adding feedback', 
      error: err.message 
    });
  }
};

// Grade a submission
exports.gradeSubmission = async (req, res) => {
  try {
    const { value, comments } = req.body;
    
    const submission = await Submission.findById(req.params.id)
      .populate('project', 'createdBy')
      .populate('task');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Check if user is authorized to grade
    // Only teachers who created the project or admins can grade
    const isCreator = submission.project.createdBy.toString() === req.user.id;
    
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ 
        message: 'Not authorized to grade submissions' 
      });
    }
    
    if (req.user.role === 'teacher' && !isCreator) {
      return res.status(403).json({ 
        message: 'Only the project creator can grade submissions' 
      });
    }
    
    // Add the grade
    submission.grade = {
      value,
      comments: comments || '',
      gradedBy: req.user.id,
      gradedAt: Date.now()
    };
    
    // Update submission status
    submission.status = value >= 50 ? 'approved' : 'needs-revision';
    
    await submission.save();
    
    // If submission is approved and linked to a task, mark task as completed
    if (submission.status === 'approved' && submission.task) {
      const task = await Task.findById(submission.task._id);
      if (task) {
        task.status = 'completed';
        task.completedDate = Date.now();
        await task.save();
      }
    }
    
    // Get the updated submission with populated grade
    const updatedSubmission = await Submission.findById(req.params.id)
      .populate('grade.gradedBy', 'fullName email profileImage');
    
    res.json({ 
      message: 'Submission graded successfully', 
      submission: updatedSubmission 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error grading submission', 
      error: err.message 
    });
  }
};
