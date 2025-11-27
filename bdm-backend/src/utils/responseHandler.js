class ResponseHandler {
  
  success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  error(res, message = 'An error occurred', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  }

  badRequest(res, message = 'Bad request', errors = null) {
    return this.error(res, message, 400, errors);
  }

  notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  serverError(res, message = 'Internal server error', error = null) {
    console.error('Server Error:', error);
    return this.error(res, message, 500, error?.message);
  }

  unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  forbidden(res, message = 'Forbidden') {
    return this.error(res, message, 403);
  }
}

module.exports = new ResponseHandler();