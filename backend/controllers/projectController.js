const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Group = require('../models/Group');

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startDate, 
      endDate, 
      assignedTo, 
      assignedGroup,
      tags 
    } = req.body;
    
    // Validate dates
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ 
        message: 'End date cannot be before start date' 
      });
    }
    
    // Create new project
    const project = new Project({
      title,
      description,
      startDate,
      endDate,
      createdBy: req.user.id,
      assignedTo: assignedTo || [],
      assignedGroup: assignedGroup || null,
      tags: tags || []
    });
    
    await project.save();
    
    // If project is assigned to a group, add all group members to assignedTo
    if (assignedGroup) {
      const users = await User.find({ group: assignedGroup });
      if (users.length > 0) {
        const userIds = users.map(user => user._id);
        project.assignedTo = [...new Set([...project.assignedTo, ...userIds])];
        await project.save();
      }
    }
    
    // Populate creator and assigned users
    const populatedProject = await Project.findById(project._id)
      .populate('createdBy', 'fullName email profileImage')
      .populate('assignedTo', 'fullName email profileImage')
      .populate('assignedGroup', 'name description');
    
    res.status(201).json({ 
      message: 'Project created successfully', 
      project: populatedProject 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error creating project', 
      error: err.message 
    });
  }
};

// Get all projects (with filtering options)
exports.getAllProjects = async (req, res) => {
  try {
    const { status, tag, search, assignedTo, createdBy } = req.query;
    const query = {};
    
    // Apply filters if provided
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by assigned user
    if (assignedTo) query.assignedTo = assignedTo;
    
    // Filter by creator
    if (createdBy) query.createdBy = createdBy;
    
    // Role-based filtering
    if (req.user.role === 'student') {
      // Students can only see projects assigned to them or their group
      const userGroups = await Group.find({ members: req.user.id });
      const groupIds = userGroups.map(group => group._id);
      
      query.$or = [
        { assignedTo: req.user.id },
        { assignedGroup: { $in: groupIds } }
      ];
    } else if (req.user.role === 'teacher') {
      // Teachers can see projects they created or are assigned to
      query.$or = [
        { createdBy: req.user.id },
        { assignedTo: req.user.id }
      ];
    }
    // Admins can see all projects (no additional filter)
    
    const projects = await Project.find(query)
      .populate('createdBy', 'fullName email profileImage')
      .populate('assignedTo', 'fullName email profileImage')
      .populate('assignedGroup', 'name description')
      .sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching projects', 
      error: err.message 
    });
  }
};

// Get a specific project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'fullName email profileImage')
      .populate('assignedTo', 'fullName email profileImage')
      .populate('assignedGroup', 'name description')
      .populate({
        path: 'tasks',
        populate: {
          path: 'assignedTo',
          select: 'fullName email profileImage'
        }
      });
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user has access to this project
    if (req.user.role === 'student') {
      const isAssigned = project.assignedTo.some(user => 
        user._id.toString() === req.user.id
      );
      
      const isInAssignedGroup = project.assignedGroup && 
        await User.findOne({ _id: req.user.id, group: project.assignedGroup._id });
      
      if (!isAssigned && !isInAssignedGroup) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    } else if (req.user.role === 'teacher' && project.createdBy._id.toString() !== req.user.id) {
      const isAssigned = project.assignedTo.some(user => 
        user._id.toString() === req.user.id
      );
      
      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    }
    // Admins can access all projects
    
    res.json(project);
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching project', 
      error: err.message 
    });
  }
};

// Update a project
exports.updateProject = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startDate, 
      endDate, 
      status,
      assignedTo, 
      assignedGroup,
      tags 
    } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to update the project
    if (req.user.role === 'student' || 
        (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }
    
    // Update fields if provided
    if (title) project.title = title;
    if (description) project.description = description;
    if (startDate) project.startDate = startDate;
    if (endDate) project.endDate = endDate;
    if (status) project.status = status;
    if (assignedTo) project.assignedTo = assignedTo;
    if (assignedGroup) project.assignedGroup = assignedGroup;
    if (tags) project.tags = tags;
    
    // If project is assigned to a group, add all group members to assignedTo
    if (assignedGroup && assignedGroup !== project.assignedGroup) {
      const users = await User.find({ group: assignedGroup });
      if (users.length > 0) {
        const userIds = users.map(user => user._id);
        project.assignedTo = [...new Set([...project.assignedTo, ...userIds])];
      }
    }
    
    await project.save();
    
    // Populate creator and assigned users
    const updatedProject = await Project.findById(project._id)
      .populate('createdBy', 'fullName email profileImage')
      .populate('assignedTo', 'fullName email profileImage')
      .populate('assignedGroup', 'name description');
    
    res.json({ 
      message: 'Project updated successfully', 
      project: updatedProject 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error updating project', 
      error: err.message 
    });
  }
};

// Delete a project
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is authorized to delete the project
    if (req.user.role !== 'admin' && 
        (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }
    
    // Delete all tasks associated with this project
    await Task.deleteMany({ project: req.params.id });
    
    // Delete the project
    await Project.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Project and associated tasks deleted successfully' });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error deleting project', 
      error: err.message 
    });
  }
};
