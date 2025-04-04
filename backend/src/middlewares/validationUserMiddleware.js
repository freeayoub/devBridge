// middlewares/validationUserMiddleware.js
const { userValidationSchema, userUpdateSchema } = require('../utils/validators');

function validationUserMiddleware(isUpdate = false) {
    return (req, res, next) => {
        const schema = isUpdate ? userUpdateSchema : userValidationSchema;
        
        schema.validate(req.body, { abortEarly: false })
            .then(() => next())
            .catch(err => {
                res.status(400).json(err.errors);
            });
    };
}

module.exports = validationUserMiddleware;