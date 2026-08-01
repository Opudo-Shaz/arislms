// Validates that one or more route params are positive integers before
// they reach a controller/service (and ultimately an integer-PK lookup like
// Model.findByPk). Prevents malformed ids (e.g. "6jhk") from causing a
// database-level error that gets reported as a 500 instead of a 400.
const validateIdParam = (...paramNames) => {
  const names = paramNames.length ? paramNames : ['id'];

  return (req, res, next) => {
    for (const paramName of names) {
      const value = req.params[paramName];
      if (!/^\d+$/.test(String(value))) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName}`
        });
      }
    }
    next();
  };
};

module.exports = { validateIdParam };
