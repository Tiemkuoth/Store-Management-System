import logger from './logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request logging middleware
 * Logs all incoming requests and response times
 */
export const requestLogger = (req, res, next) => {
  // Generate unique request ID
  req.id = req.get('x-request-id') || uuidv4();
  res.setHeader('X-Request-ID', req.id);

  // Record start time
  const startTime = Date.now();

  // Log incoming request
  logger.info(
    {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    },
    `→ ${req.method} ${req.originalUrl}`
  );

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    logger.info(
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
      },
      `← ${statusCode} ${req.method} ${req.originalUrl} (${duration}ms)`
    );

    return originalJson.call(this, data);
  };

  next();
};
