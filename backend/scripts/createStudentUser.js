/**
 * Script to create a student user
 * 
 * Usage: 
 * 1. Make sure MongoDB is running
 * 2. Run: node scripts/createStudentUser.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Student user details - change these as needed
const studentUser = {
  fullName: 'Student User',
  email: 'student@devbridge.com',
  password: 'Student123!',
  role: 'student'
};

async function createStudentUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if student user already exists
    const existingUser = await User.findOne({ email: studentUser.email });
    if (existingUser) {
      console.log(`Student user with email ${studentUser.email} already exists`);
      
      // Update the user to student role if not already
      if (existingUser.role !== 'student') {
        existingUser.role = 'student';
        existingUser.verified = true;
        existingUser.isActive = true;
        await existingUser.save();
        console.log(`Updated user ${studentUser.email} to student role`);
      }
    } else {
      // Create new student user
      const hashedPassword = await bcrypt.hash(studentUser.password, 10);
      
      const user = new User({
        fullName: studentUser.fullName,
        email: studentUser.email,
        password: hashedPassword,
        role: studentUser.role,
        verified: true, // Student is automatically verified
        isActive: true
      });
      
      await user.save();
      console.log(`Student user created successfully with email: ${studentUser.email}`);
    }
    
    console.log('Student credentials:');
    console.log(`Email: ${studentUser.email}`);
    console.log(`Password: ${studentUser.password}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating student user:', error);
  }
}

// Run the function
createStudentUser();
