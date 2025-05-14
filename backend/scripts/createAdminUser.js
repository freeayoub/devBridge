/**
 * Script to create an admin user
 * 
 * Usage: 
 * 1. Make sure MongoDB is running
 * 2. Run: node scripts/createAdminUser.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Admin user details - change these as needed
const adminUser = {
  fullName: 'Admin User',
  email: 'admin@devbridge.com',
  password: 'Admin123!',
  role: 'admin'
};

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingUser = await User.findOne({ email: adminUser.email });
    if (existingUser) {
      console.log(`Admin user with email ${adminUser.email} already exists`);
      
      // Update the user to admin role if not already
      if (existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        existingUser.verified = true;
        await existingUser.save();
        console.log(`Updated user ${adminUser.email} to admin role`);
      }
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);
      
      const user = new User({
        fullName: adminUser.fullName,
        email: adminUser.email,
        password: hashedPassword,
        role: adminUser.role,
        verified: true // Admin is automatically verified
      });
      
      await user.save();
      console.log(`Admin user created successfully with email: ${adminUser.email}`);
    }
    
    console.log('Admin credentials:');
    console.log(`Email: ${adminUser.email}`);
    console.log(`Password: ${adminUser.password}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the function
createAdminUser();
