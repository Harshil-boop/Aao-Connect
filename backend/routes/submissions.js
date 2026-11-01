import express from 'express';
import { submissionSchema } from '../validation/submissionSchema.js';
import { dbService, isDatabaseConfigured, testConnection } from '../db.js';
import { sendConfirmationEmail, isSmtpConfigured } from '../services/mailer.js';

const router = express.Router();

/**
 * GET /api/submissions/status
 * Health check & database/SMTP connection status
 */
router.get('/status', async (req, res) => {
  const configured = isDatabaseConfigured();
  const smtpConfigured = isSmtpConfigured();

  if (!configured) {
    return res.json({
      status: 'ready_for_db',
      configured: false,
      smtpConfigured,
      message: 'Backend is running. Waiting for Neon Database connection URL in .env (DATABASE_URL).',
    });
  }

  const conn = await testConnection();
  return res.json({
    status: conn.connected ? 'connected' : 'error',
    configured: true,
    smtpConfigured,
    details: conn,
  });
});

/**
 * POST /api/submissions
 * Public Form Submission:
 * 1. Validates input
 * 2. Prevents rapid duplicates
 * 3. Saves to Neon database
 * 4. Automatically triggers SMTP confirmation email
 */
router.post('/', async (req, res) => {
  // 1. Validate payload using Zod schema
  const parseResult = submissionSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errors = {};
    parseResult.error.errors.forEach((err) => {
      const field = err.path[0] || 'general';
      if (!errors[field]) {
        errors[field] = err.message;
      }
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors,
    });
  }

  const { fullName, email, mobileNumber, description } = parseResult.data;

  try {
    // 2. Prevent duplicate submissions within the last 60 seconds
    const isDuplicate = await dbService.checkRecentDuplicate(email, mobileNumber);
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'A submission with this email and mobile number was already received recently. Please wait a moment.',
      });
    }

    // 3. Save to database
    const savedRecord = await dbService.createSubmission({
      fullName,
      email,
      mobileNumber,
      description,
    });

    // 4. Send automated confirmation notification via SMTP
    let emailStatus = null;
    try {
      emailStatus = await sendConfirmationEmail({
        to: savedRecord.email,
        fullName: savedRecord.full_name,
      });
    } catch (mailErr) {
      console.error('Error during confirmation email trigger:', mailErr);
      emailStatus = { sent: false, error: mailErr.message };
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your information has been successfully submitted and stored.',
      data: {
        id: savedRecord.id,
        fullName: savedRecord.full_name,
        email: savedRecord.email,
        createdAt: savedRecord.created_at,
      },
      notification: emailStatus,
    });
  } catch (error) {
    console.error('Submission handling error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error saving submission. Please try again.',
      error: error.message,
    });
  }
});

export default router;
