class CustomError extends Error {
    constructor(statusCode, message, functionName) {
      super(message ||  "Internal Server Error");
      this.status = statusCode || 500;
      this.functionName = functionName || '';
    }
  }
  
module.exports = {CustomError};
  