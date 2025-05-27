/**
 * Script to create a teacher user
 * 
 * Usage: 
 * 1. Make sure MongoDB is running
 * 2. Run: node scripts/createTeacherUser.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Teacher user details - change these as needed
const teacherUser = {
  fullName: 'Teacher User',
  email: 'teacher@devbridge.com',
  password: 'Teacher123!',
  role: 'teacher'
};

async function createTeacherUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if teacher user already exists
    const existingUser = await User.findOne({ email: teacherUser.email });
    if (existingUser) {
      console.log(`Teacher user with email ${teacherUser.email} already exists`);
      
      // Update the user to teacher role if not already
      if (existingUser.role !== 'teacher') {
        existingUser.role = 'teacher';
        existingUser.verified = true;
        await existingUser.save();
        console.log(`Updated user ${teacherUser.email} to teacher role`);
      }
    } else {
      // Create new teacher user
      const hashedPassword = await bcrypt.hash(teacherUser.password, 10);
      
      const user = new User({
        fullName: teacherUser.fullName,
        email: teacherUser.email,
        password: hashedPassword,
        role: teacherUser.role,
        verified: true // Teacher is automatically verified
      });
      
      await user.save();
      console.log(`Teacher user created successfully with email: ${teacherUser.email}`);
    }
    
    console.log('Teacher credentials:');
    console.log(`Email: ${teacherUser.email}`);
    console.log(`Password: ${teacherUser.password}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating teacher user:', error);
  }
}

// Run the function
createTeacherUser();
