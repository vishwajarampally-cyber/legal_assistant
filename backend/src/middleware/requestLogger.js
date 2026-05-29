export function requestLogger(req, res, next) {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
}
