const { userValidationSchema } = require('../utils/validators');

function validationUserMiddleware(req, res, next) {
    userValidationSchema.validate(req.body)
        .then(() => next())
        .catch(err => res.status(400).json({ error: err.errors }));
}

module.exports = validationUserMiddleware;