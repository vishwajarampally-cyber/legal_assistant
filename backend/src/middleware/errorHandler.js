/**
 * Global Express Error Handling Middleware.
 * Captures all unhandled controller errors and formats them into a clean JSON structure.
 */
export function errorHandler(err, req, res, next) {
  console.error('[EXPRESS GLOBAL ERROR]:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const clientMessage = err.message || 'An unexpected error occurred in the RAG application backend.';

  return res.status(statusCode).json({
    success: false,
    error: clientMessage,
    // Provide stack details in local/development mode only
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
