/**
 * Email template for admin-triggered password reset
 */

const { getEmailHeader, getEmailFooter } = require('./common');

/**
 * Get the admin password reset email template
 * @param {string} newPassword - The new password
 * @param {string} fullName - User's full name
 * @returns {string} - HTML email template
 */
function getAdminPasswordResetTemplate(newPassword, fullName = '') {
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
  
  // App colors from tailwind.config.js
  const colors = {
    primary: '#7826b5',
    secondary: '#4f5fad',
    background: '#edf1f4',
    card: '#ffffff',
    text: '#333333',
    accent: '#9747FF'
  };

  return `${getEmailHeader()}
      <h2>Your Password Has Been Reset</h2>
      <p>${greeting}</p>
      <p>An administrator has reset your password for your <span class="highlight">DevBridge</span> account. Here is your new temporary password:</p>

      <div style="text-align: center; margin: 35px 0;">
        <div class="code">${newPassword}</div>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Please change this password immediately after logging in</p>
      </div>

      <div class="info-box" style="border-left-color: ${colors.secondary};">
        <p style="margin: 0; font-size: 14px;"><strong>Security Notice:</strong> For your security, we recommend changing this password as soon as you log in. Never share your password with anyone.</p>
      </div>

      <p>You can log in with this temporary password and then go to your profile settings to change it to a password of your choice.</p>

      <p>If you did not expect this password reset, please contact our support team immediately.</p>

      <p>Best regards,<br><span style="color: ${colors.primary}; font-weight: 500;">The DevBridge Team</span></p>
  ${getEmailFooter()}`;
}

module.exports = getAdminPasswordResetTemplate;
