export const notFound = (req, res) => {
  res.status(404).json({ message: 'Resource not found' });
};

export const errorHandler = (error, req, res, next) => {
  const status = error.status || error.statusCode || 500;

  if (error.code === 11000) {
    res.status(409).json({ message: 'A record with these details already exists' });
    return;
  }

  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message
  });
};
