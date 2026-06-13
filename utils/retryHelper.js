const retry = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    shouldRetry = (err) => true,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
};

module.exports = { retry };
