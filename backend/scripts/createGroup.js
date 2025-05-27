/**
 * Script to create a group and add students to it
 * 
 * Usage: 
 * 1. Make sure MongoDB is running
 * 2. Run: node scripts/createGroup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

// Group details
const groupData = {
  name: 'Web Development Team',
  description: 'A group for web development projects'
};

async function createGroup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the teacher user
    const teacher = await User.findOne({ email: 'teacher@devbridge.com' });
    if (!teacher) {
      console.log('Teacher user not found');
      await mongoose.disconnect();
      return;
    }

    // Check if group already exists
    let group = await Group.findOne({ name: groupData.name });
    
    if (group) {
      console.log(`Group "${groupData.name}" already exists`);
    } else {
      // Create new group
      group = new Group({
        name: groupData.name,
        description: groupData.description,
        createdBy: teacher._id
      });
      
      await group.save();
      console.log(`Group "${groupData.name}" created successfully`);
    }

    // Find student users
    const students = await User.find({ role: 'student' });
    
    if (students.length === 0) {
      console.log('No student users found');
    } else {
      console.log(`Found ${students.length} student users`);
      
      // Add students to the group
      for (const student of students) {
        // Update student's group
        student.group = group._id;
        await student.save();
        
        console.log(`Added student ${student.fullName} (${student.email}) to the group`);
      }
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating group:', error);
  }
}

// Run the function
createGroup();
