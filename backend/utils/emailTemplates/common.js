/**
 * Common email template components
 */

// App colors from tailwind.config.js
const colors = {
  primary: '#7826b5',
  secondary: '#4f5fad',
  background: '#edf1f4',
  card: '#ffffff',
  text: '#333333',
  accent: '#9747FF'
};

/**
 * Get common email header
 * @param {string} appName - Application name
 * @returns {string} - HTML header
 */
function getEmailHeader(appName = 'DevBridge') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Email</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: ${colors.text};
      background-color: ${colors.background};
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
      background-color: ${colors.card};
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      text-align: center;
      padding: 30px 0;
      background-color: ${colors.primary};
      margin-bottom: 20px;
    }
    .logo-container {
      display: inline-block;
    }
    .content {
      padding: 20px 30px;
    }
    h2 {
      color: ${colors.primary};
      margin-top: 0;
    }
    .highlight {
      color: ${colors.primary};
      font-weight: 600;
    }
    .code {
      font-family: monospace;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px 20px;
      display: inline-block;
      color: ${colors.primary};
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid ${colors.primary};
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      background-color: #f8f9fa;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
    .social-links {
      margin: 15px 0;
    }
    .social-link {
      color: ${colors.primary};
      text-decoration: none;
      margin: 0 5px;
    }
    a {
      color: ${colors.primary};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-container">
        <img src="https://via.placeholder.com/150x50/7826b5/FFFFFF?text=DevBridge" alt="${appName} Logo" style="max-width: 150px;">
      </div>
    </div>
    <div class="content">
`;
}

/**
 * Get common email footer
 * @param {string} appName - Application name
 * @returns {string} - HTML footer
 */
function getEmailFooter(appName = 'DevBridge') {
  return `
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      <p>This is an automated email, please do not reply.</p>

      <div class="social-links">
        <a href="#" class="social-link">Facebook</a> •
        <a href="#" class="social-link">Twitter</a> •
        <a href="#" class="social-link">LinkedIn</a> •
        <a href="#" class="social-link">Instagram</a>
      </div>

      <p style="margin-top: 15px; font-size: 11px; color: #999;">
        DevBridge - Academic Project Management Platform<br>
        Esprit School of Engineering, Tunisia
      </p>
    </div>
  </div>
</body>
</html>
`;
}

module.exports = {
  getEmailHeader,
  getEmailFooter
};
