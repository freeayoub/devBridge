/**
 * Script to test API endpoints
 * 
 * Usage: 
 * 1. Make sure MongoDB is running
 * 2. Run: node scripts/testEndpoints.js
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Test user details
const teacherUser = {
  email: 'teacher@devbridge.com',
  password: 'Teacher123!'
};

async function testEndpoints() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the teacher user
    const user = await User.findOne({ email: teacherUser.email });
    if (!user) {
      console.log(`Teacher user with email ${teacherUser.email} not found`);
      return;
    }

    // Generate a token for the teacher
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('Generated token for teacher user');

    // Test the admin/users endpoint
    console.log('\nTesting GET /api/admin/users?role=student endpoint...');
    try {
      const response = await axios.get('http://localhost:5000/api/admin/users?role=student', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Response status:', response.status);
      console.log('Number of students returned:', response.data.length);
      console.log('First student:', response.data[0] ? {
        id: response.data[0]._id,
        name: response.data[0].fullName,
        email: response.data[0].email,
        role: response.data[0].role
      } : 'No students found');
    } catch (error) {
      console.error('Error testing admin/users endpoint:', error.response ? error.response.data : error.message);
    }

    // Test the groups endpoint
    console.log('\nTesting GET /api/groups endpoint...');
    try {
      const response = await axios.get('http://localhost:5000/api/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Response status:', response.status);
      console.log('Number of groups returned:', response.data.length);
      console.log('First group:', response.data[0] ? {
        id: response.data[0]._id,
        name: response.data[0].name,
        description: response.data[0].description
      } : 'No groups found');
    } catch (error) {
      console.error('Error testing groups endpoint:', error.response ? error.response.data : error.message);
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
}

// Run the function
testEndpoints();
