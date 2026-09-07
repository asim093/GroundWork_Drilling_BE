import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    res.status(422).json({
      message: 'Validation failed',
      errors: result.array().map((item) => ({ field: item.path, message: item.msg }))
    });
    return;
  }

  next();
};
