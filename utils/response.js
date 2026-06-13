const sendResponse = (res, statusCode, message, data = null) => {
  const response = { success: statusCode < 400, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

module.exports = { sendResponse };
