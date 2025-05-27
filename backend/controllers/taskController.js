const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      priority,
      dueDate,
      estimatedHours
    } = req.body;

    console.log('Creating task with data:', {
      title,
      projectId,
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [assignedTo],
    });

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is authorized to add tasks to this project
    if (req.user.role === 'student' ||
        (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to add tasks to this project' });
    }

    // Process assignedTo to ensure it's always an array of valid user IDs
    let assignedUsers = [];
    if (assignedTo) {
      // Handle both single ID and array of IDs
      if (Array.isArray(assignedTo)) {
        assignedUsers = assignedTo.filter(id => id && id.trim() !== '');
      } else if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
        assignedUsers = [assignedTo];
      }
    }

    console.log('Processed assignedUsers:', assignedUsers);

    // Verify that the assigned users exist
    if (assignedUsers.length > 0) {
      const users = await User.find({ _id: { $in: assignedUsers } });
      console.log(`Found ${users.length} valid users out of ${assignedUsers.length} assigned users`);

      // Only include users that actually exist
      assignedUsers = users.map(user => user._id.toString());
      console.log('Final assignedUsers after validation:', assignedUsers);
    }

    // Create new task
    const task = new Task({
      title,
      description,
      project: projectId,
      assignedTo: assignedUsers,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      estimatedHours: estimatedHours || null,
      createdBy: req.user.id
    });

    await task.save();

    // Add task to project's tasks array
    project.tasks.push(task._id);
    await project.save();

    // Populate creator and assigned users
    const populatedTask = await Task.findById(task._id)
      .populate('createdBy', 'fullName email profileImage profileImageURL')
      .populate('assignedTo', 'fullName email profileImage profileImageURL')
      .populate('project', 'title status');

    console.log('Task created successfully with assignedTo:', populatedTask.assignedTo.map(u => u._id));

    res.status(201).json({
      message: 'Task created successfully',
      task: populatedTask
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({
      message: 'Error creating task',
      error: err.message
    });
  }
};

// Get all tasks assigned to the current user
exports.getUserTasks = async (req, res) => {
  try {
    const { status, priority, projectId } = req.query;
    const userId = req.user.id;

    console.log(`Fetching tasks for user ID: ${userId}`);

    // Try different query approaches to find tasks assigned to this user

    // Approach 1: Using direct equality
    const query1 = { assignedTo: userId };
    if (status) query1.status = status;
    if (priority) query1.priority = priority;
    if (projectId) query1.project = projectId;

    console.log('Task query 1:', JSON.stringify(query1));
    const tasks1Count = await Task.countDocuments(query1);
    console.log(`Approach 1: Found ${tasks1Count} tasks assigned to user ${userId}`);

    // Approach 2: Using $elemMatch
    const query2 = { assignedTo: { $elemMatch: { $eq: userId } } };
    if (status) query2.status = status;
    if (priority) query2.priority = priority;
    if (projectId) query2.project = projectId;

    console.log('Task query 2:', JSON.stringify(query2));
    const tasks2Count = await Task.countDocuments(query2);
    console.log(`Approach 2: Found ${tasks2Count} tasks assigned to user ${userId}`);

    // Approach 3: Using $in operator
    const query3 = { assignedTo: { $in: [userId] } };
    if (status) query3.status = status;
    if (priority) query3.priority = priority;
    if (projectId) query3.project = projectId;

    console.log('Task query 3:', JSON.stringify(query3));
    const tasks3Count = await Task.countDocuments(query3);
    console.log(`Approach 3: Found ${tasks3Count} tasks assigned to user ${userId}`);

    // Use the approach that found the most tasks
    let queryToUse = query1;
    if (tasks2Count > tasks1Count) {
      queryToUse = query2;
    }
    if (tasks3Count > Math.max(tasks1Count, tasks2Count)) {
      queryToUse = query3;
    }

    console.log('Using query:', JSON.stringify(queryToUse));

    const tasks = await Task.find(queryToUse)
      .populate('createdBy', 'fullName email profileImage profileImageURL')
      .populate('assignedTo', 'fullName email profileImage profileImageURL')
      .populate('project', 'title status')
      .sort({ dueDate: 1, priority: -1 }); // Sort by due date (ascending) and priority (descending)

    console.log(`Returning ${tasks.length} tasks to user ${userId}`);

    // Additional debugging: Check all tasks in the system
    const allTasks = await Task.find({});
    console.log(`Total tasks in system: ${allTasks.length}`);

    // Log the assignedTo arrays of all tasks to see if the user ID appears in any of them
    for (const task of allTasks) {
      console.log(`Task ${task._id} assignedTo:`, task.assignedTo);
    }

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching user tasks:', err);
    res.status(500).json({
      message: 'Error fetching user tasks',
      error: err.message
    });
  }
};

// Get all tasks for a project
exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, priority, assignedTo } = req.query;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has access to this project
    if (req.user.role === 'student') {
      const isAssigned = project.assignedTo.includes(req.user.id);
      const isInAssignedGroup = project.assignedGroup &&
        await User.findOne({ _id: req.user.id, group: project.assignedGroup });

      if (!isAssigned && !isInAssignedGroup) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    } else if (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id) {
      const isAssigned = project.assignedTo.includes(req.user.id);

      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    }
    // Admins can access all projects

    // Build query
    const query = { project: projectId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query)
      .populate('createdBy', 'fullName email profileImage profileImageURL')
      .populate('assignedTo', 'fullName email profileImage profileImageURL')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      message: 'Error fetching tasks',
      error: err.message
    });
  }
};

// Get a specific task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('createdBy', 'fullName email profileImage profileImageURL')
      .populate('assignedTo', 'fullName email profileImage profileImageURL')
      .populate('project', 'title status createdBy assignedTo assignedGroup');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's project
    const project = await Project.findById(task.project._id);

    if (req.user.role === 'student') {
      const isAssigned = project.assignedTo.includes(req.user.id);
      const isInAssignedGroup = project.assignedGroup &&
        await User.findOne({ _id: req.user.id, group: project.assignedGroup });

      if (!isAssigned && !isInAssignedGroup) {
        return res.status(403).json({ message: 'Access denied to this task' });
      }
    } else if (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id) {
      const isAssigned = project.assignedTo.includes(req.user.id);

      if (!isAssigned) {
        return res.status(403).json({ message: 'Access denied to this task' });
      }
    }
    // Admins can access all tasks

    res.json(task);
  } catch (err) {
    res.status(500).json({
      message: 'Error fetching task',
      error: err.message
    });
  }
};

// Update a task
exports.updateTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      estimatedHours,
      actualHours
    } = req.body;

    const task = await Task.findById(req.params.id)
      .populate('project', 'createdBy assignedTo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is authorized to update the task
    const project = await Project.findById(task.project._id);

    if (req.user.role === 'student') {
      // Students can only update status and actual hours of tasks assigned to them
      const isAssignedToTask = task.assignedTo.some(user =>
        user.toString() === req.user.id
      );

      if (!isAssignedToTask) {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }

      // Students can only update specific fields
      if (status) task.status = status;
      if (actualHours) task.actualHours = actualHours;

      // Add a comment about the status change
      if (status && status !== task.status) {
        task.comments.push({
          text: `Status changed to ${status}`,
          createdBy: req.user.id
        });
      }
    } else {
      // Teachers and admins can update all fields
      if (title) task.title = title;
      if (description) task.description = description;
      if (status) task.status = status;
      if (priority) task.priority = priority;
      if (dueDate) task.dueDate = dueDate;
      if (assignedTo) task.assignedTo = assignedTo;
      if (estimatedHours) task.estimatedHours = estimatedHours;
      if (actualHours) task.actualHours = actualHours;
    }

    await task.save();

    // Populate creator and assigned users
    const updatedTask = await Task.findById(task._id)
      .populate('createdBy', 'fullName email profileImage profileImageURL')
      .populate('assignedTo', 'fullName email profileImage profileImageURL')
      .populate('project', 'title status');

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error updating task',
      error: err.message
    });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is authorized to delete the task
    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Associated project not found' });
    }

    if (req.user.role !== 'admin' &&
        (req.user.role === 'teacher' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }

    // Remove task from project's tasks array
    project.tasks = project.tasks.filter(
      taskId => taskId.toString() !== req.params.id
    );
    await project.save();

    // Delete the task
    await Task.findByIdAndDelete(req.params.id);

    // Recalculate project progress
    await project.calculateProgress();
    await project.save();

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({
      message: 'Error deleting task',
      error: err.message
    });
  }
};

// Add a comment to a task
exports.addTaskComment = async (req, res) => {
  try {
    const { text } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Add the comment
    task.comments.push({
      text,
      createdBy: req.user.id
    });

    await task.save();

    // Get the updated task with populated comments
    const updatedTask = await Task.findById(req.params.id)
      .populate('comments.createdBy', 'fullName email profileImage profileImageURL');

    res.json({
      message: 'Comment added successfully',
      task: updatedTask
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error adding comment',
      error: err.message
    });
  }
};
