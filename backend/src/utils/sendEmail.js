const nodemailer = require("nodemailer");

// Créer le transporteur avec gestion des erreurs
const createTransporter = () => {
  // Vérifier si les variables d'environnement sont définies
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      "EMAIL_USER or EMAIL_PASS environment variables are not set. Email sending will be disabled."
    );
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail", // or use Mailgun, SendGrid etc
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Initialiser le transporteur
const transporter = createTransporter();

// Professional email template base
const getEmailTemplate = (title, content, buttonText = null, buttonUrl = null) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
            }
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #4f5fad 0%, #7826b5 100%);
                padding: 30px 20px;
                text-align: center;
            }
            .logo {
                color: #ffffff;
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            .header-subtitle {
                color: #e8e9ff;
                font-size: 14px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .title {
                color: #2c3e50;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 20px;
                text-align: center;
            }
            .message {
                color: #5a6c7d;
                font-size: 16px;
                line-height: 1.8;
                margin-bottom: 30px;
            }
            .code-container {
                background: linear-gradient(135deg, #f8f9ff 0%, #e8e9ff 100%);
                border: 2px dashed #4f5fad;
                border-radius: 12px;
                padding: 25px;
                text-align: center;
                margin: 30px 0;
            }
            .code {
                font-size: 36px;
                font-weight: bold;
                color: #4f5fad;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                margin: 10px 0;
            }
            .code-label {
                color: #7f8c8d;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 10px;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #4f5fad 0%, #7826b5 100%);
                color: #ffffff;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: 600;
                text-align: center;
                margin: 20px 0;
                transition: transform 0.2s ease;
            }
            .button:hover {
                transform: translateY(-2px);
            }
            .warning {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .warning-text {
                color: #856404;
                font-size: 14px;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            .footer-text {
                color: #6c757d;
                font-size: 14px;
                margin-bottom: 15px;
            }
            .social-links {
                margin: 20px 0;
            }
            .social-link {
                display: inline-block;
                margin: 0 10px;
                color: #4f5fad;
                text-decoration: none;
            }
            .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e9ecef, transparent);
                margin: 30px 0;
            }
            @media (max-width: 600px) {
                .email-container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .content {
                    padding: 30px 20px;
                }
                .code {
                    font-size: 28px;
                    letter-spacing: 4px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">DevBridge</div>
                <div class="header-subtitle">Professional Project Management Platform</div>
            </div>
            <div class="content">
                <h1 class="title">${title}</h1>
                ${content}
                ${buttonText && buttonUrl ? `
                <div style="text-align: center;">
                    <a href="${buttonUrl}" class="button">${buttonText}</a>
                </div>
                ` : ''}
            </div>
            <div class="footer">
                <div class="footer-text">
                    This email was sent from DevBridge, your trusted project management platform.
                </div>
                <div class="divider"></div>
                <div class="footer-text">
                    © ${new Date().getFullYear()} DevBridge. All rights reserved.
                </div>
                <div class="footer-text" style="font-size: 12px; margin-top: 10px;">
                    If you didn't request this email, please ignore it or contact our support team.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

exports.sendVerificationEmail = async (email, code) => {
  // Si le transporteur n'est pas configuré, simuler l'envoi d'email
  if (!transporter) {
    console.log(
      `[MOCK EMAIL] Verification code ${code} would be sent to ${email}`
    );
    return;
  }

  const content = `
    <div class="message">
      <p>Welcome to <strong>DevBridge</strong>! We're excited to have you join our professional project management platform.</p>
      <p>To complete your account setup and ensure the security of your account, please verify your email address using the verification code below:</p>
    </div>

    <div class="code-container">
      <div class="code-label">Your Verification Code</div>
      <div class="code">${code}</div>
      <div style="color: #7f8c8d; font-size: 14px; margin-top: 10px;">
        Enter this code in the verification form to activate your account
      </div>
    </div>

    <div class="warning">
      <div class="warning-text">
        <strong>Important:</strong> This verification code will expire in 1 hour for security reasons.
        If you didn't create an account with DevBridge, please ignore this email.
      </div>
    </div>

    <div class="message">
      <p>Once verified, you'll have access to:</p>
      <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
        <li>Project management tools</li>
        <li>Team collaboration features</li>
        <li>Real-time notifications</li>
        <li>File sharing and storage</li>
        <li>Advanced reporting and analytics</li>
      </ul>
      <p>If you have any questions or need assistance, our support team is here to help.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DevBridge Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Verify Your DevBridge Account - Action Required",
      html: getEmailTemplate("Account Verification", content),
    });
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error; // Rethrow to handle in the calling function
  }
};

// Professional password reset email
exports.sendPasswordResetEmail = async (email, code) => {
  // Si le transporteur n'est pas configuré, simuler l'envoi d'email
  if (!transporter) {
    console.log(
      `[MOCK EMAIL] Password reset code ${code} would be sent to ${email}`
    );
    return;
  }

  const content = `
    <div class="message">
      <p>We received a request to reset the password for your <strong>DevBridge</strong> account.</p>
      <p>If you made this request, please use the security code below to reset your password:</p>
    </div>

    <div class="code-container">
      <div class="code-label">Password Reset Code</div>
      <div class="code">${code}</div>
      <div style="color: #7f8c8d; font-size: 14px; margin-top: 10px;">
        Enter this code on the password reset page to continue
      </div>
    </div>

    <div class="warning">
      <div class="warning-text">
        <strong>Security Notice:</strong> This reset code will expire in 1 hour. If you didn't request a password reset,
        please ignore this email and consider changing your password as a precaution.
      </div>
    </div>

    <div class="message">
      <p><strong>For your security:</strong></p>
      <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
        <li>Never share this code with anyone</li>
        <li>DevBridge will never ask for your password via email</li>
        <li>Always access your account through our official website</li>
        <li>Contact support if you notice any suspicious activity</li>
      </ul>
      <p>If you continue to have trouble accessing your account, please contact our support team for assistance.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DevBridge Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔒 Password Reset Request - DevBridge Account",
      html: getEmailTemplate("Password Reset Request", content),
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send password reset email to ${email}:`, error);
    throw error;
  }
};

// Welcome email for new users
exports.sendWelcomeEmail = async (email, userName) => {
  if (!transporter) {
    console.log(`[MOCK EMAIL] Welcome email would be sent to ${email}`);
    return;
  }

  const content = `
    <div class="message">
      <p>🎉 <strong>Welcome to DevBridge, ${userName}!</strong></p>
      <p>Your account has been successfully verified and you're now part of our professional project management community.</p>
    </div>

    <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8e9ff 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="color: #4f5fad; margin-bottom: 15px;">🚀 Ready to Get Started?</h3>
      <p style="color: #5a6c7d; margin-bottom: 20px;">Explore all the powerful features DevBridge has to offer</p>
    </div>

    <div class="message">
      <p><strong>What you can do now:</strong></p>
      <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
        <li>📊 Create and manage projects</li>
        <li>👥 Invite team members and collaborate</li>
        <li>📅 Set up project timelines and milestones</li>
        <li>💬 Use real-time messaging and notifications</li>
        <li>📁 Share files and documents securely</li>
        <li>📈 Track progress with advanced analytics</li>
      </ul>
    </div>

    <div class="message">
      <p>Need help getting started? Check out our <a href="#" style="color: #4f5fad; text-decoration: none;">Quick Start Guide</a> or contact our support team.</p>
      <p>We're here to help you succeed! 🌟</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DevBridge Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Welcome to DevBridge - Let's Get Started!",
      html: getEmailTemplate("Welcome to DevBridge!", content, "Start Your First Project", process.env.FRONTEND_URL || "http://localhost:4200"),
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send welcome email to ${email}:`, error);
    throw error;
  }
};

// Function to preview email templates (for testing)
exports.getEmailPreview = (type, code = "123456", userName = "John Doe") => {
  let content = "";
  let title = "";

  switch (type) {
    case "verification":
      title = "Account Verification";
      content = `
        <div class="message">
          <p>Welcome to <strong>DevBridge</strong>! We're excited to have you join our professional project management platform.</p>
          <p>To complete your account setup and ensure the security of your account, please verify your email address using the verification code below:</p>
        </div>

        <div class="code-container">
          <div class="code-label">Your Verification Code</div>
          <div class="code">${code}</div>
          <div style="color: #7f8c8d; font-size: 14px; margin-top: 10px;">
            Enter this code in the verification form to activate your account
          </div>
        </div>

        <div class="warning">
          <div class="warning-text">
            <strong>Important:</strong> This verification code will expire in 1 hour for security reasons.
            If you didn't create an account with DevBridge, please ignore this email.
          </div>
        </div>

        <div class="message">
          <p>Once verified, you'll have access to:</p>
          <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
            <li>Project management tools</li>
            <li>Team collaboration features</li>
            <li>Real-time notifications</li>
            <li>File sharing and storage</li>
            <li>Advanced reporting and analytics</li>
          </ul>
          <p>If you have any questions or need assistance, our support team is here to help.</p>
        </div>
      `;
      break;

    case "reset":
      title = "Password Reset Request";
      content = `
        <div class="message">
          <p>We received a request to reset the password for your <strong>DevBridge</strong> account.</p>
          <p>If you made this request, please use the security code below to reset your password:</p>
        </div>

        <div class="code-container">
          <div class="code-label">Password Reset Code</div>
          <div class="code">${code}</div>
          <div style="color: #7f8c8d; font-size: 14px; margin-top: 10px;">
            Enter this code on the password reset page to continue
          </div>
        </div>

        <div class="warning">
          <div class="warning-text">
            <strong>Security Notice:</strong> This reset code will expire in 1 hour. If you didn't request a password reset,
            please ignore this email and consider changing your password as a precaution.
          </div>
        </div>

        <div class="message">
          <p><strong>For your security:</strong></p>
          <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
            <li>Never share this code with anyone</li>
            <li>DevBridge will never ask for your password via email</li>
            <li>Always access your account through our official website</li>
            <li>Contact support if you notice any suspicious activity</li>
          </ul>
          <p>If you continue to have trouble accessing your account, please contact our support team for assistance.</p>
        </div>
      `;
      break;

    case "welcome":
      title = "Welcome to DevBridge!";
      content = `
        <div class="message">
          <p>🎉 <strong>Welcome to DevBridge, ${userName}!</strong></p>
          <p>Your account has been successfully verified and you're now part of our professional project management community.</p>
        </div>

        <div style="background: linear-gradient(135deg, #f8f9ff 0%, #e8e9ff 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
          <h3 style="color: #4f5fad; margin-bottom: 15px;">🚀 Ready to Get Started?</h3>
          <p style="color: #5a6c7d; margin-bottom: 20px;">Explore all the powerful features DevBridge has to offer</p>
        </div>

        <div class="message">
          <p><strong>What you can do now:</strong></p>
          <ul style="margin: 15px 0; padding-left: 20px; color: #5a6c7d;">
            <li>📊 Create and manage projects</li>
            <li>👥 Invite team members and collaborate</li>
            <li>📅 Set up project timelines and milestones</li>
            <li>💬 Use real-time messaging and notifications</li>
            <li>📁 Share files and documents securely</li>
            <li>📈 Track progress with advanced analytics</li>
          </ul>
        </div>

        <div class="message">
          <p>Need help getting started? Check out our <a href="#" style="color: #4f5fad; text-decoration: none;">Quick Start Guide</a> or contact our support team.</p>
          <p>We're here to help you succeed! 🌟</p>
        </div>
      `;
      break;
  }

  return getEmailTemplate(title, content, type === "welcome" ? "Start Your First Project" : null, type === "welcome" ? "#" : null);
};
