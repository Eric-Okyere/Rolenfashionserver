require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    const line = '─'.repeat(46);
    console.log(line);
    console.log(`🚀 Rolen API server ready at http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(line);
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
