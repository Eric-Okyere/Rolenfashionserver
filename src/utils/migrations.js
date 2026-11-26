const Gallery = require('../models/Gallery');
const CarouselPost = require('../models/CarouselPost');
const { READY_CATEGORY, isPreOrderCategory } = require('./preorder');

// Runs once on every server start; each step is a no-op after the first run.
async function runMigrations() {
  try {
    // Eric: "change Rolen Ready-To-Wear to Ewuraba by Rolen(RTW)".
    const old = ['Rolen Ready-to-Wear', 'Ready-to-Wear'];
    const g = await Gallery.updateMany({ category: { $in: old } }, { $set: { category: READY_CATEGORY } });
    const c = await CarouselPost.updateMany({ linkCategory: { $in: old } }, { $set: { linkCategory: READY_CATEGORY } });
    // Eric: pre-order products have no price — only Ready-to-Wear does.
    const ready = [READY_CATEGORY, ...old];
    const p = await Gallery.updateMany(
      { category: { $nin: ready }, price: { $exists: true } },
      { $unset: { price: '' } }
    );
    if (g.modifiedCount || c.modifiedCount || p.modifiedCount) {
      console.log(`🔁 Migrations: ${g.modifiedCount} products + ${c.modifiedCount} slides renamed to ${READY_CATEGORY}; prices cleared on ${p.modifiedCount} pre-order products`);
    }
  } catch (err) {
    console.error('Migration failed (server keeps running):', err.message);
  }
}

module.exports = { runMigrations, isPreOrderCategory };
