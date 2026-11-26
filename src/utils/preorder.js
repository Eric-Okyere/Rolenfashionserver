// Eric: "All products except ready categories must be pre-order" and then
// "Allow MoMo pay for pre-order. They have to pay some amount. It varies but
// ready to wear price is fixed." — Ready-to-Wear is charged its full price;
// every other line is made to order, so a MoMo payment there is a deposit.
// The deposit varies per product: an admin sets `depositAmount` on it.
// The client mirrors this logic in src/lib/product.js; the server's number
// is the one that counts.
// Eric: "change Rolen Ready-To-Wear to Ewuraba by Rolen(RTW)" — old names kept
// so any product not yet migrated is still treated as ready.
const READY_CATEGORY = 'Ewuraba by Rolen(RTW)';
const READY_CATEGORIES = [READY_CATEGORY, 'Rolen Ready-to-Wear', 'Ready-to-Wear'];

function isPreOrderCategory(category) {
  return !READY_CATEGORIES.includes(category);
}

// The amount (GHS) a shopper pays online for this product right now, or
// null if nothing can be charged yet (no price and no deposit set).
// Eric: "all categories of the products are pre order so no price is attached
// to them except ready to wear which has a price." A pre-order is charged
// only the deposit an admin set on it; there's no price to fall back on.
function payableAmount(item) {
  if (!isPreOrderCategory(item.category)) return item.price || null;
  return item.depositAmount || null;
}

module.exports = { READY_CATEGORY, READY_CATEGORIES, isPreOrderCategory, payableAmount };
