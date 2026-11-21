// Eric: "All products except ready categories must be pre-order" and then
// "Allow MoMo pay for pre-order. They have to pay some amount. It varies but
// ready to wear price is fixed." — Ready-to-Wear is charged its full price;
// every other line is made to order, so a MoMo payment there is a deposit.
// The deposit varies per product: an admin sets `depositAmount` on the
// product, and if it's left blank it falls back to 70% of the price — the
// rule already printed on the Shop page ("Pre-order pieces take 3 working
// days to prepare after a 70% deposit is paid"). The client mirrors this
// same logic in GalleryItem.js so the button shows the same figure the
// server will actually charge; the server's number is the one that counts.
const READY_CATEGORIES = ['Rolen Ready-to-Wear', 'Ready-to-Wear'];
const DEFAULT_DEPOSIT_RATE = 0.7;

function isPreOrderCategory(category) {
  return !READY_CATEGORIES.includes(category);
}

// The amount (GHS) a shopper pays online for this product right now, or
// null if nothing can be charged yet (no price and no deposit set).
function payableAmount(item) {
  if (!isPreOrderCategory(item.category)) return item.price || null;
  if (item.depositAmount) return item.depositAmount;
  if (item.price) return Math.round(item.price * DEFAULT_DEPOSIT_RATE);
  return null;
}

module.exports = { READY_CATEGORIES, DEFAULT_DEPOSIT_RATE, isPreOrderCategory, payableAmount };
