function requireBearerToken(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Authorization bearer token is required.",
    });
  }

  req.accessToken = token;
  return next();
}

module.exports = { requireBearerToken };
