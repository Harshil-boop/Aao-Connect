import sanitizeHtml from 'sanitize-html';
import { getTransporter, resetTransporter, isSmtpConfigured } from './mailer.js';

/**
 * Sanitize HTML content to prevent script injection while preserving safe formatting
 */
export const sanitizeBodyHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'hr', 'span', 'div'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'],
      span: ['style', 'class'],
      div: ['style', 'class'],
      p: ['style', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  });
};

/**
 * Replace dynamic placeholders with real applicant information
 * Dynamic tags supported: {{name}}, {{email}}, {{mobile}}
 */
export const replacePlaceholders = (text = '', applicant = {}) => {
  if (!text) return '';
  const name = applicant.recipient_name || applicant.full_name || 'Applicant';
  const email = applicant.recipient_email || applicant.email || 'your email';
  const mobile = applicant.recipient_mobile || applicant.mobile_number || 'your mobile number';

  return text
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*mobile\s*\}\}/gi, mobile);
};

/**
 * Render a responsive, clean, professional HTML email wrapper
 */
export const renderBrandedHtmlEmail = ({ subject, bodyHtml, applicant = {} }) => {
  const personalizedSubject = replacePlaceholders(subject, applicant);
  const personalizedBody = replacePlaceholders(sanitizeBodyHtml(bodyHtml), applicant);
  const applicantName = applicant.recipient_name || applicant.full_name || 'Applicant';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .top-bar {
      height: 6px;
      background: linear-gradient(90deg, #f59e0b 0%, #f43f5e 35%, #9333ea 70%, #4f46e5 100%);
    }
    .header {
      padding: 28px 32px;
      background-color: #0f172a;
      color: #ffffff;
      display: flex;
      align-items: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #94a3b8;
      margin: 3px 0 0 0;
      font-weight: 500;
    }
    .content {
      padding: 36px 32px;
      line-height: 1.65;
      font-size: 15px;
      color: #334155;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content ul, .content ol {
      margin-top: 0;
      margin-bottom: 16px;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
    }
    .content a {
      color: #4f46e5;
      text-decoration: underline;
    }
    .content strong {
      color: #0f172a;
    }
    .content blockquote {
      border-left: 4px solid #6366f1;
      padding-left: 16px;
      margin: 16px 0;
      color: #475569;
      font-style: italic;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="top-bar"></div>
      <div class="header">
        <div>
          <h1 class="brand-title">Aao Seekhe</h1>
          <p class="brand-subtitle">Official Candidate Notification</p>
        </div>
      </div>
      <div class="content">
        ${personalizedBody}
      </div>
      <div class="footer">
        <p><strong>Aao Seekhe</strong> &bull; Candidate Portal &bull; Verified Communication</p>
        <p style="margin-top: 10px; color: #94a3b8; font-size: 11px;">&copy; ${new Date().getFullYear()} Aao Seekhe. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Plain text alternative for email clients that do not render HTML
 */
export const renderPlainTextEmail = ({ subject, bodyHtml, applicant = {} }) => {
  const personalizedSubject = replacePlaceholders(subject, applicant);
  const personalizedBody = replacePlaceholders(bodyHtml, applicant);

  // Strip HTML tags for plain text
  const plainBody = personalizedBody
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .trim();

  return `========================================
Aao Seekhe - Official Candidate Notification
Subject: ${personalizedSubject}
========================================

${plainBody}

----------------------------------------
Aao Seekhe Candidate Portal
© ${new Date().getFullYear()} Aao Seekhe. All rights reserved.
`;
};

/**
 * Send an individual email through the verified Nodemailer transporter with auto-reconnect & rate-limit resilience
 */
export const sendSingleEmail = async ({ to, subject, html, text }, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = getTransporter();

      if (!transporter) {
        throw new Error('SMTP transporter is not configured or offline.');
      }

      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@Aao Seekhe.com';
      const fromHeader = `"Aao Seekhe" <${fromEmail.trim()}>`;

      const mailOptions = {
        from: fromHeader,
        to: to.trim(),
        subject: subject.trim(),
        html,
        text,
      };

      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (err) {
      lastError = err;
      const isTransient =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ESOCKET' ||
        err.code === 'EPIPE' ||
        err.responseCode === 421 ||
        err.responseCode === 450 ||
        err.responseCode === 451 ||
        err.responseCode === 452 ||
        err.message?.includes('rate limit');

      if (isTransient && attempt < maxRetries) {
        const delay = attempt * 1200;
        console.warn(`⚠️ SMTP socket reset on attempt ${attempt} for ${to}. Reconnecting and retrying in ${delay}ms...`);
        resetTransporter();
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
};

