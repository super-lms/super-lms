const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-lms-development-secret-change-before-production";

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      error: "Authentication token required",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token",
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    return next();
  };
}

module.exports = {
  authenticateJWT,
  requireRole,
};
