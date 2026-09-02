const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri);
    const { host, name, port } = mongoose.connection;
    console.log('✅ MongoDB connected');
    console.log(`   Host:     ${host}${port ? `:${port}` : ''}`);
    console.log(`   Database: ${name}`);
  } catch (err) {
    console.error('❌ MongoDB connection FAILED:', err.message);
    console.error('   The server will not start until this is fixed — check MONGODB_URI in server/.env.');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
  });
}

module.exports = connectDB;
