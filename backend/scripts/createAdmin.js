const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the User model
const User = require('../src/models/User');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/project_management';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Create admin user
const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.fullName}`);
      console.log(`   Role: ${existingAdmin.role}`);
      return;
    }

    // Admin user details
    const adminData = {
      fullName: 'DevBridge Admin',
      email: 'admin@devbridge.com',
      password: 'admin123456', // You should change this password after first login
      role: 'admin',
      verified: true,
      isActive: true,
      isOnline: false,
      profileImage: process.env.DEFAULT_IMAGE || 'uploads/default.png'
    };

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);
    adminData.password = hashedPassword;

    // Create the admin user
    const adminUser = new User(adminData);
    await adminUser.save();

    console.log('🎉 Admin user created successfully!');
    console.log('📧 Email: admin@devbridge.com');
    console.log('🔑 Password: admin123456');
    console.log('⚠️  Please change the password after first login!');
    console.log('🔗 Login URL: http://localhost:4200/login');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
};

// Main function
const main = async () => {
  console.log('🚀 Creating DevBridge Admin User...\n');
  
  await connectDB();
  await createAdminUser();
  
  console.log('\n✨ Script completed!');
  process.exit(0);
};

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
