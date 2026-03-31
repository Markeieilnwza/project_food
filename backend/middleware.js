const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token
 * Usage: router.get('/protected', verifyToken, (req, res) => {})
 */
function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Token required',
        message: 'Please provide a valid authorization token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    console.log('DEBUG JWT Decoded:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('DEBUG JWT Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Please provide a valid authorization token'
    });
  }
}

/**
 * Input validation helpers
 */
const validators = {
  // Validate if string is non-empty
  isNotEmpty: (str) => typeof str === 'string' && str.trim().length > 0,
  
  // Validate email format
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Validate password strength
  isStrongPassword: (password) => {
    return password.length >= 6;
  },
  
  // Validate username
  isValidUsername: (username) => {
    return username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(username);
  },
  
  // Sanitize input (basic)
  sanitize: (input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
  }
};

/**
 * Error response helper
 */
function errorResponse(res, statusCode, message, details = null) {
  const response = { 
    error: true,
    message 
  };
  
  if (details) {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Success response helper
 */
function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

/**
 * Validation middleware for request body
 */
function validateRequestBody(requiredFields) {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return errorResponse(res, 400, 'Missing required fields', { 
        missing: missingFields 
      });
    }
    
    next();
  };
}

module.exports = {
  verifyToken,
  validators,
  errorResponse,
  successResponse,
  validateRequestBody
};
