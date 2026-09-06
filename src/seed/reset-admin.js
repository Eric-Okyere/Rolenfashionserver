// Resets the school's admin login (name/email/password) — use this whenever
// Eric wants to change who can log in to Admin, instead of editing seed.js
// and re-running `npm run seed`.
//
// Why this is a separate script from seed.js: `npm run seed` deliberately
// only ever CREATES the admin account if none exists yet — on every later
// run it just logs "Admin account already exists" and leaves it untouched,
// on purpose, so redeploying/reseeding a live site can never silently wipe
// out a password someone's since changed. That's also exactly why editing
// SEED_ADMIN_EMAIL/PASSWORD in seed.js and re-running `npm run seed` looked
// like it did nothing: the account already existed, so the new values were
// never applied.
//
// This script does the opposite on purpose — it finds the school's one
// admin/CEO account and overwrites its name/email/password to whatever is
// set below (or in your .env, which takes priority). Run it any time you
// want to change the login:
//   npm run reset-admin   (from /server, with .env configured)
//
// Uses `.save()` rather than a direct database update so Mongoose's
// pre-save hook still runs and the password is properly hashed — never
// stored as plain text.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

// Change these (or, better, set the matching env vars in your .env so a
// real password never has to live in a file you might share or commit)
// to whatever you want the admin login to be, then run `npm run reset-admin`.
const NEW_NAME = process.env.SEED_ADMIN_NAME || 'Rolen';
const NEW_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'ababryan3@gmail.com').toLowerCase();
const NEW_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'rolen123';

async function run() {
  await connectDB();

  // Find the existing admin account to update — prefer the one flagged as
  // CEO (there's only ever one, see User.isCEO), since that's reliably
  // "the" admin account regardless of what email it currently has. Falls
  // back to the oldest 'admin'-role account, then to creating a brand new
  // one if somehow neither exists yet.
  let admin = await User.findOne({ isCEO: true }).select('+password');
  if (!admin) {
    admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('+password');
  }

  if (admin) {
    // If the target email belongs to a *different* existing account (e.g. a
    // leftover second admin from an earlier seed run under the new email),
    // remove that duplicate first so the unique-email index doesn't reject
    // this update.
    if (admin.email !== NEW_EMAIL) {
      const clash = await User.findOne({ email: NEW_EMAIL, _id: { $ne: admin._id } });
      if (clash) {
        await User.deleteOne({ _id: clash._id });
        console.log(`Removed a duplicate account that was already using ${NEW_EMAIL}.`);
      }
    }
    admin.name = NEW_NAME;
    admin.email = NEW_EMAIL;
    admin.password = NEW_PASSWORD; // re-hashed by the pre-save hook below
    admin.isCEO = true;
    admin.role = 'admin';
    admin.active = true;
    await admin.save();
    console.log(`Updated the admin login → ${NEW_EMAIL} (log in with the new password now).`);
  } else {
    await User.create({ name: NEW_NAME, email: NEW_EMAIL, password: NEW_PASSWORD, role: 'admin', isCEO: true });
    console.log(`No admin account existed yet — created one: ${NEW_EMAIL}.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Reset admin failed:', err);
  process.exit(1);
});