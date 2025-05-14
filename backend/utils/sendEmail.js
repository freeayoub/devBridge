const nodemailer = require('nodemailer');
const {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getWelcomeEmailTemplate
} = require('./emailTemplates');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or use Mailgun, SendGrid etc
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send verification email with code
 * @param {string} email - Recipient email
 * @param {string} code - Verification code
 * @param {string} fullName - Optional recipient name
 */
exports.sendVerificationEmail = async (email, code, fullName = '') => {
  await transporter.sendMail({
    from: `"DevBridge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your DevBridge Account',
    html: getVerificationEmailTemplate(code, fullName)
  });
};

/**
 * Send password reset email with code
 * @param {string} email - Recipient email
 * @param {string} code - Reset code
 * @param {string} fullName - Optional recipient name
 */
exports.sendPasswordResetEmail = async (email, code, fullName = '') => {
  await transporter.sendMail({
    from: `"DevBridge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your DevBridge Password',
    html: getPasswordResetEmailTemplate(code, fullName)
  });
};

/**
 * Send welcome email after verification
 * @param {string} email - Recipient email
 * @param {string} fullName - Optional recipient name
 */
exports.sendWelcomeEmail = async (email, fullName = '') => {
  await transporter.sendMail({
    from: `"DevBridge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to DevBridge!',
    html: getWelcomeEmailTemplate(fullName)
  });
};
