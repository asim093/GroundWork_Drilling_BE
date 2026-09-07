export const notFound = (req, res) => {
  res.status(404).json({ message: 'Resource not found' });
};

export const errorHandler = (error, req, res, next) => {
  const status = error.status || error.statusCode || 500;

  if (error.code === 11000) {
    res.status(409).json({ message: 'A record with these details already exists' });
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(422).json({
      message: 'Validation failed',
      errors: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message
      }))
    });
    return;
  }

  if (error.name === 'CastError') {
    res.status(422).json({ message: `Invalid value for ${error.path}` });
    return;
  }

  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message
  });
};
