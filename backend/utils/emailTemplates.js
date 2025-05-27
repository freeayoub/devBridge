/**
 * Email templates for the application
 * Using the app's color scheme from tailwind.config.js
 */

const { getLogoHtml } = require('./emailLogo');
const { getEmailHeader, getEmailFooter } = require('./emailTemplates/common');

// Verification email template
exports.getVerificationEmailTemplate = (code, fullName = '') => {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';

  return `${getEmailHeader()}
      <h2>Email Verification</h2>
      <p>${greeting}</p>
      <p>Thank you for registering with <span class="highlight">DevBridge</span>. To complete your registration, please use the verification code below:</p>

      <div style="text-align: center; margin: 35px 0;">
        <div class="code">${code}</div>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">This code will expire in 30 minutes</p>
      </div>

      <div class="info-box">
        <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> If you did not request this verification, please ignore this email or contact support if you have concerns.</p>
      </div>

      <p>We're excited to have you join our platform for academic project management. Once verified, you'll have access to all the features DevBridge has to offer.</p>

      <p>Best regards,<br><span style="color: ${colors.primary}; font-weight: 500;">The DevBridge Team</span></p>
  ${getEmailFooter()}`;
};

// Password reset email template
exports.getPasswordResetEmailTemplate = (code, fullName = '') => {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';

  return `${getEmailHeader()}
      <h2>Password Reset Request</h2>
      <p>${greeting}</p>
      <p>We received a request to reset your password for your <span class="highlight">DevBridge</span> account. Please use the code below to reset your password:</p>

      <div style="text-align: center; margin: 35px 0;">
        <div class="code">${code}</div>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">This code will expire in 30 minutes</p>
      </div>

      <div class="info-box" style="border-left-color: ${colors.secondary};">
        <p style="margin: 0; font-size: 14px;"><strong>Security Tip:</strong> Never share this code with anyone. DevBridge representatives will never ask for your verification code.</p>
      </div>

      <p>After entering this code, you'll be able to create a new password for your account. For security reasons, we recommend using a strong password that you don't use on other websites.</p>

      <p>If you did not request a password reset, please ignore this email or contact our support team immediately if you have concerns.</p>

      <p>Best regards,<br><span style="color: ${colors.primary}; font-weight: 500;">The DevBridge Team</span></p>
  ${getEmailFooter()}`;
};

// Welcome email template
exports.getWelcomeEmailTemplate = (fullName = '') => {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';

  return `${getEmailHeader()}
      <h2>Welcome to DevBridge! 🎉</h2>
      <p>${greeting}</p>
      <p>Thank you for joining <span class="highlight">DevBridge</span>. We're excited to have you on board!</p>

      <p>Your account has been successfully verified and is now ready to use. You can now log in to access all the features of our platform.</p>

      <div style="background-color: ${colors.background}; border-radius: 8px; padding: 25px; margin: 30px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h3 style="color: ${colors.primary}; margin-top: 0; font-size: 18px;">Getting Started</h3>
        <p>DevBridge is designed to help you manage your academic projects efficiently. Here are some features you might want to explore:</p>
        <ul style="padding-left: 20px; margin-bottom: 0;">
          <li style="margin-bottom: 10px;"><span style="color: ${colors.primary}; font-weight: bold;">Create Groups</span> - Organize your team and projects</li>
          <li style="margin-bottom: 10px;"><span style="color: ${colors.primary}; font-weight: bold;">Collaborate</span> - Work together with your team members</li>
          <li style="margin-bottom: 10px;"><span style="color: ${colors.primary}; font-weight: bold;">Track Progress</span> - Monitor your project's advancement</li>
          <li style="margin-bottom: 0px;"><span style="color: ${colors.primary}; font-weight: bold;">Share Resources</span> - Exchange documents and materials</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}" class="button">Go to Dashboard</a>
      </div>

      <div class="info-box">
        <p style="margin: 0; font-size: 14px;"><strong>Need Help?</strong> If you have any questions or need assistance, feel free to contact our support team at <a href="mailto:support@devbridge.com" style="color: ${colors.primary}; text-decoration: none;">support@devbridge.com</a>.</p>
      </div>

      <p>We hope you enjoy using DevBridge for your academic projects!</p>

      <p>Best regards,<br><span style="color: ${colors.primary}; font-weight: 500;">The DevBridge Team</span></p>
  ${getEmailFooter()}`;
};
