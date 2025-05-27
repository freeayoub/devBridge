const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Log all requests to help with debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const projectRoutes = require('./routes/projectRoutes');
// Note: Task and submission routes are included in projectRoutes.js

// API endpoints
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/projects', projectRoutes); // This includes task and submission routes

// Direct route for user tasks to avoid any routing issues
const { auth } = require('./middleware/auth');
const { getUserTasks } = require('./controllers/taskController');
app.get('/api/user/tasks', auth, getUserTasks);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
