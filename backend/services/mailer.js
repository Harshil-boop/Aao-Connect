import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

let transporter = null;

export const resetTransporter = () => {
  if (transporter && typeof transporter.close === 'function') {
    try {
      transporter.close();
    } catch (_) {}
  }
  transporter = null;
};

export const isSmtpConfigured = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(
    SMTP_HOST &&
    SMTP_HOST.trim() !== '' &&
    SMTP_PORT &&
    SMTP_USER &&
    SMTP_USER.trim() !== '' &&
    SMTP_PASS &&
    SMTP_PASS.trim() !== ''
  );
};

export const getTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!transporter) {
    // Configure robust connection pool to handle Gmail SMTP rate limits and avoid socket drops
    transporter = nodemailer.createTransport({
      pool: true, // Reuse verified connections across multiple emails
      maxConnections: 1, // Standard Gmail allows 1 concurrent SMTP connection
      maxMessages: 100, // Reconnect after 100 messages
      rateLimit: 1, // Maximum 1 message per second to respect Gmail rate limit
      rateDelta: 1000,
      host: process.env.SMTP_HOST.trim(),
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });

    transporter.on('error', (err) => {
      // Re-create transporter on socket drop
      if (err.code === 'ECONNRESET' || err.code === 'ESOCKET') {
        transporter = null;
      }
    });
  }

  return transporter;
};

/**
 * Generates responsive, clean, professional HTML email
 */
const generateEmailHtml = (fullName) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Your Submission!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
    }
    .content {
      padding: 36px 32px;
      font-size: 15px;
      line-height: 1.65;
      color: #334155;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
    }
    .message-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px 20px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: #475569;
    }
    .signature {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
      color: #475569;
    }
    .signature strong {
      color: #0f172a;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        border-radius: 12px !important;
      }
      .header {
        padding: 28px 20px !important;
      }
      .content {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Thank You for Your Submission!</h1>
        <p>Confirmation of Receipt</p>
      </div>
      <div class="content">
        <div class="greeting">Hello ${fullName},</div>
        
        <p>Thank you for taking the time to submit your details. We have successfully received your information.</p>
        
        <p>We truly appreciate your interest and the time you have invested in reaching out to us.</p>
        
        <div class="message-box">
          Our team will review your submission and get back to you if any further information or action is required.
        </div>
        
        <p>Thank you once again!</p>
        
        <div class="signature">
          Best Regards,<br>
          <strong>Team</strong>
        </div>
      </div>
      <div class="footer">
        This is an automated confirmation email. Please do not reply directly to this message.
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Sends a confirmation email to the user
 */
export const sendConfirmationEmail = async ({ to, fullName }) => {
  if (!isSmtpConfigured()) {
    console.log('ℹ️  SMTP is not configured in .env. Skipping confirmation email.');
    return {
      sent: false,
      reason: 'smtp_not_configured',
      message: 'SMTP credentials not configured in backend/.env',
    };
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const activeTransporter = getTransporter();
      const fromAddress = process.env.SMTP_FROM || `"Notifications" <${process.env.SMTP_USER}>`;

      const mailOptions = {
        from: fromAddress,
        to,
        subject: 'Thank You for Your Submission!',
        text: `Hello ${fullName},\n\nThank you for taking the time to submit your details. We have successfully received your information.\n\nWe truly appreciate your interest and the time you have invested in reaching out to us.\n\nOur team will review your submission and get back to you if any further information or action is required.\n\nThank you once again!\n\nBest Regards,\nTeam`,
        html: generateEmailHtml(fullName),
      };

      const info = await activeTransporter.sendMail(mailOptions);

      const isAccepted = Array.isArray(info.accepted) && info.accepted.length > 0;

      if (isAccepted) {
        console.log(`✉️ Confirmation email sent successfully to ${to} (Message ID: ${info.messageId})`);
        return {
          sent: true,
          messageId: info.messageId,
          accepted: info.accepted,
        };
      } else {
        console.warn(`⚠️ SMTP server responded but email was not accepted for ${to}:`, info);
        return {
          sent: false,
          reason: 'not_accepted',
          response: info.response,
        };
      }
    } catch (error) {
      if (attempt < maxAttempts && (error.code === 'ECONNRESET' || error.code === 'ESOCKET')) {
        console.warn(`⚠️ SMTP socket reset (${error.message}). Reconnecting and retrying...`);
        resetTransporter();
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      console.error('❌ Failed to deliver SMTP confirmation email:', error.message);
      return {
        sent: false,
        reason: 'delivery_error',
        error: error.message,
      };
    }
  }
};

