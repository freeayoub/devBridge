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

exports.sendVerificationEmail = async (email, code) => {
  // Si le transporteur n'est pas configuré, simuler l'envoi d'email
  if (!transporter) {
    console.log(
      `[MOCK EMAIL] Verification code ${code} would be sent to ${email}`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: `"DevBridge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Votre code de vérification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4f5fad; text-align: center;">Vérification de votre compte</h2>
          <p>Merci de vous être inscrit sur DevBridge. Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4f5fad; letter-spacing: 5px; font-size: 32px; margin: 0;">${code}</h1>
          </div>
          <p>Ce code est valable pendant 1 heure. Si vous n'avez pas demandé ce code, veuillez ignorer cet email.</p>
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #888;">© ${new Date().getFullYear()} DevBridge. Tous droits réservés.</p>
        </div>
      `,
    });
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error; // Rethrow to handle in the calling function
  }
};
