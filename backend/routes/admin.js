import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { dbService } from '../db.js';
import { generateToken, requireAdminAuth } from '../middleware/auth.js';
import { submissionSchema } from '../validation/submissionSchema.js';

const router = express.Router();

// Strict brute-force protection on Admin Login
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 failed login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Access blocked for 15 minutes to protect account security.',
  },
});

/**
 * POST /api/admin/login
 * Authenticate administrator with brute-force protection
 */
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const admin = await dbService.findAdminByEmail(email);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(admin);

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error.',
    });
  }
});

/**
 * GET /api/admin/me
 * Verify current session
 */
router.get('/me', requireAdminAuth, async (req, res) => {
  try {
    const admin = await dbService.findAdminById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    return res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error checking session.' });
  }
});

/**
 * PUT /api/admin/change-password
 * Change admin password
 */
router.put('/change-password', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const admin = await dbService.findAdminByEmail(req.admin.email);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrator record not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await dbService.updateAdminPassword(admin.id, newHash);

    return res.json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password.',
    });
  }
});

/**
 * GET /api/admin/stats
 * Dashboard metrics
 */
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await dbService.getDashboardStats();
    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats.',
    });
  }
});

/**
 * GET /api/admin/applicants
 * Paginated, filtered, sorted applicants list
 */
router.get('/applicants', requireAdminAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'newest';
    const dateFilter = req.query.dateFilter || '';
    const monthFilter = req.query.monthFilter || '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const data = await dbService.getApplicants({
      search,
      sortBy,
      dateFilter,
      monthFilter,
      page,
      limit,
    });

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('Error fetching applicants:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applicants.',
    });
  }
});

/**
 * GET /api/admin/applicants/:id
 * Retrieve single applicant
 */
router.get('/applicants/:id', requireAdminAuth, async (req, res) => {
  try {
    const applicant = await dbService.getApplicantById(req.params.id);
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: 'Applicant record not found.',
      });
    }
    return res.json({
      success: true,
      data: applicant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching applicant record.',
    });
  }
});

/**
 * PUT /api/admin/applicants/:id
 * Update applicant record
 */
router.put('/applicants/:id', requireAdminAuth, async (req, res) => {
  try {
    const parseResult = submissionSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errors = {};
      parseResult.error.errors.forEach((err) => {
        const field = err.path[0] || 'general';
        if (!errors[field]) errors[field] = err.message;
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
    }

    const updated = await dbService.updateApplicant(req.params.id, parseResult.data);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Applicant record not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Applicant updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating applicant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update applicant.',
    });
  }
});

/**
 * DELETE /api/admin/applicants/:id
 * Delete applicant record
 */
router.delete('/applicants/:id', requireAdminAuth, async (req, res) => {
  try {
    const deleted = await dbService.deleteApplicant(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Applicant record not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Applicant deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting applicant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete applicant.',
    });
  }
});

/**
 * GET /api/admin/export
 * Download CSV of applicants
 */
router.get('/export', requireAdminAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const dateFilter = req.query.dateFilter || '';
    const monthFilter = req.query.monthFilter || '';
    const sortBy = req.query.sortBy || 'newest';

    const records = await dbService.getAllApplicantsForExport({
      search,
      dateFilter,
      monthFilter,
      sortBy,
    });

    // Escape CSV cell helper
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const formatIST = (dateVal) => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
    };

    const headers = ['ID', 'Full Name', 'Email', 'Mobile Number', 'Description', 'Submitted At (IST)'];
    const rows = records.map((r) => [
      escapeCsv(r.id),
      escapeCsv(r.full_name),
      escapeCsv(r.email),
      escapeCsv(r.mobile_number),
      escapeCsv(r.description || ''),
      escapeCsv(formatIST(r.created_at)),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    const filename = `applicants_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (error) {
    console.error('Error exporting applicants:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export CSV.',
    });
  }
});

export default router;

