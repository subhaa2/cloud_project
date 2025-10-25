const successResponse = (data, message = 'Success') => {
    return {
      success: true,
      message,
      data
    };
  };
  
  const errorResponse = (error, statusCode = 500) => {
    return {
      success: false,
      error: error.message || error,
      statusCode
    };
  };
  
  module.exports = { successResponse, errorResponse };