const express = require('express');
const router = express.Router();
const { auth, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Import controllers
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject
} = require('../controllers/projectController');

const {
  createTask,
  getProjectTasks,
  getTaskById,
  getUserTasks,
  updateTask,
  deleteTask,
  addTaskComment
} = require('../controllers/taskController');

const {
  createSubmission,
  getProjectSubmissions,
  getSubmissionById,
  addFeedback,
  gradeSubmission
} = require('../controllers/submissionController');

// Project routes
router.post('/', auth, authorizeRoles('teacher', 'admin'), createProject);
router.get('/', auth, getAllProjects);
router.get('/:id', auth, getProjectById);
router.put('/:id', auth, authorizeRoles('teacher', 'admin'), updateProject);
router.delete('/:id', auth, authorizeRoles('teacher', 'admin'), deleteProject);

// Task routes
router.post('/:projectId/tasks', auth, authorizeRoles('teacher', 'admin'), createTask);
router.get('/:projectId/tasks', auth, getProjectTasks);
router.get('/tasks/:id', auth, getTaskById);
router.get('/user/tasks', auth, getUserTasks); // Get tasks assigned to current user
router.put('/tasks/:id', auth, updateTask);
router.delete('/tasks/:id', auth, authorizeRoles('teacher', 'admin'), deleteTask);
router.post('/tasks/:id/comments', auth, addTaskComment);

// Submission routes
router.post(
  '/:projectId/submissions',
  auth,
  upload.array('files', 5), // Allow up to 5 files per submission
  createSubmission
);
router.get('/:projectId/submissions', auth, getProjectSubmissions);
router.get('/submissions/:id', auth, getSubmissionById);
router.post('/submissions/:id/feedback', auth, authorizeRoles('teacher', 'admin'), addFeedback);
router.post('/submissions/:id/grade', auth, authorizeRoles('teacher', 'admin'), gradeSubmission);

module.exports = router;
