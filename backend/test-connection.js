const mongoose = require('mongoose');
require('dotenv').config();

// Test MongoDB Atlas connection
async function testConnection() {
  console.log('🧪 [Test] Testing MongoDB Atlas connection...');
  console.log('=' .repeat(50));
  
  // Check environment variables
  console.log('🔧 Environment Variables:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MONGO_URI: ${process.env.MONGO_URI ? 'SET ✅' : 'NOT SET ❌'}`);
  
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set!');
    process.exit(1);
  }
  
  // Show connection string (masked)
  const maskedURI = process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`   Connection String: ${maskedURI}`);
  console.log('');
  
  // Connection options
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    connectTimeoutMS: 10000,
  };
  
  console.log('⚙️ Connection Options:');
  console.log(JSON.stringify(options, null, 2));
  console.log('');
  
  try {
    console.log('🔄 Attempting to connect to MongoDB Atlas...');
    
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log('✅ CONNECTION SUCCESSFUL!');
    console.log('📊 Connection Details:');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Port: ${conn.connection.port}`);
    console.log(`   Ready State: ${conn.connection.readyState} (1 = connected)`);
    console.log('');
    
    // Test a simple operation
    console.log('🧪 Testing database operations...');
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`   Found ${collections.length} collections`);
    
    if (collections.length > 0) {
      console.log('   Collections:');
      collections.forEach(col => {
        console.log(`     - ${col.name}`);
      });
    }
    
    console.log('');
    console.log('🎉 All tests passed! MongoDB Atlas connection is working perfectly.');
    
  } catch (error) {
    console.error('❌ CONNECTION FAILED!');
    console.error('🔍 Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Name: ${error.name}`);
    
    if (error.reason) {
      console.error(`   Reason: ${error.reason}`);
    }
    
    console.error('');
    console.error('💡 Common solutions:');
    console.error('   1. Check your MongoDB Atlas cluster is running');
    console.error('   2. Verify your IP address is whitelisted');
    console.error('   3. Confirm username/password are correct');
    console.error('   4. Ensure network connectivity');
    console.error('   5. Check if the database name exists');
    
  } finally {
    console.log('');
    console.log('🔌 Closing connection...');
    await mongoose.connection.close();
    console.log('✅ Connection closed.');
    process.exit(0);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Run the test
testConnection();
