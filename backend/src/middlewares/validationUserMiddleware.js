// validationUserMiddleware.js
const {
  userValidationSchema,
  userUpdateSchema,
} = require("../validators/user.validators");

async function validateRequest(schema, req, res, next) {
  try {
    // Clone the request body to avoid mutation
    const dataToValidate = { ...req.body };

    // Special handling for updateSelf route
    if (req.originalUrl.includes("updateself")) {
      // Remove empty fields to avoid validation errors
      Object.keys(dataToValidate).forEach((key) => {
        if (dataToValidate[key] === "" || dataToValidate[key] === null) {
          delete dataToValidate[key];
        }
      });
    }

    // Validate with Yup schema
    const validatedData = await schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Attach validated data to request
    req.validatedBody = validatedData;
    next();
  } catch (err) {
    console.error("Validation error:", err);

    // Initialize errors object
    const errors = {};

    // Handle Yup validation errors
    if (err.name === "ValidationError") {
      if (err.inner && Array.isArray(err.inner)) {
        // Process Yup validation errors with paths
        err.inner.forEach((error) => {
          if (error.path) {
            const field = error.path.split(".").pop();
            errors[field] = error.message;
          }
        });
      } else if (err.errors) {
        // Fallback for simple Yup errors
        errors.general = err.errors.join(", ");
      }
    } else {
      // Handle other types of errors
      errors.general = err.message;
    }

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.keys(errors).length
        ? errors
        : { general: "Invalid request data" },
    });
  }
}

function validationUserMiddleware(isUpdate = false) {
  return (req, res, next) => {
    const schema = isUpdate ? userUpdateSchema : userValidationSchema;
    return validateRequest(schema, req, res, next);
  };
}

module.exports = validationUserMiddleware;
