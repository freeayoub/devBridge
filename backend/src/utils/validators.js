const yup = require("yup");

// Validation user Schema with Yup
const userValidationSchema = yup.object().shape({
  username: yup.string().required().trim(),
  email: yup.string().email().required().trim(),
  password: yup.string().required().min(6),
  role: yup.string().oneOf(["student", "tutor", "admin"]),
});

const messageSchema = yup.object().shape({
  senderId: yup.string().required(),
  receiverId: yup.string().required(),
  content: yup.string().required(),
});

module.exports = { userValidationSchema, messageSchema };