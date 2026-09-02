const Application = require('../models/Application');

// Generates a human-friendly, sequential-looking application number: ROLEN-<year>-<seq>
async function nextApplicationNumber() {
  const year = new Date().getFullYear();
  const count = await Application.countDocuments({
    applicationNumber: new RegExp(`^ROLEN-${year}-`),
  });
  const seq = String(count + 1).padStart(5, '0');
  return `ROLEN-${year}-${seq}`;
}

module.exports = nextApplicationNumber;
