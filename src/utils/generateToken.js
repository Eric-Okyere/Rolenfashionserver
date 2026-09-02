const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, isCEO: user.isCEO },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setAuthCookie(res, token) {
  const secure = process.env.COOKIE_SECURE === 'true';
  res.cookie('token', token, {
    httpOnly: true,
    secure,
    // 'lax' works for local dev (localhost:3000 -> localhost:5001 is
    // same-site despite the different port). But a frontend and backend on
    // different hosting providers (e.g. Netlify + Render) are genuinely
    // cross-site, and a cross-site cookie is only ever sent by the browser
    // with sameSite: 'none' + secure: true (which requires HTTPS — hence
    // tying this to COOKIE_SECURE, which should be 'true' in production).
    sameSite: secure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

module.exports = { generateToken, setAuthCookie };
