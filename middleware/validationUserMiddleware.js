// --- validationUserMiddleware.js ---
const yup = require('yup');

function validationUserMiddleware(req, res, next) {
    const schema = yup.object().shape({
        username: yup.string().required().trim(),
        email: yup.string().email().required().trim(),
        password: yup.string().required().min(6),
        role: yup.string().oneOf(['student', 'tutor', 'admin']),
    });

    schema.validate(req.body)
        .then(() => next())
        .catch(err => res.status(400).json({ error: err.errors }));
}

module.exports = validationUserMiddleware;