const { validationResult } = require('express-validator');

// Runs after express-validator check(...) chains; returns 400 with details on failure.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Please check the highlighted fields and try again.',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
