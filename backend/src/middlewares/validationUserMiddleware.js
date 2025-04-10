const { userValidationSchema, userUpdateSchema } = require('../models/validators/user.validators');

async function validateRequest(schema, req, res, next) {
    try {
        const validatedData = await schema.validate(req.body, { 
            abortEarly: false,
            stripUnknown: true
        });
        
        req.validatedBody = validatedData;
        next();
    } catch (err) {
        const errors = err.inner.reduce((acc, curr) => {
            // Gestion des chemins imbriqués si nécessaire
            const path = curr.path.split('.').pop();
            acc[path] = curr.message;
            return acc;
        }, {});
        
        res.status(400).json({ 
            success: false,
            message: 'Validation failed',
            errors 
        });
    }
}

function validationUserMiddleware(isUpdate = false) {
    return (req, res, next) => {
        const schema = isUpdate ? userUpdateSchema : userValidationSchema;
        validateRequest(schema, req, res, next);
    };
}

module.exports = validationUserMiddleware;