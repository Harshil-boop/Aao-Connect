import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
let pool = null;

// Initial admin constants
export const DEFAULT_ADMIN_EMAIL = 'sunny260604@gmail.com';
export const DEFAULT_ADMIN_PASSWORD_PLAIN = '123123';

// Pre-seeded professional email templates for Aao Seekhe
export const DEFAULT_EMAIL_TEMPLATES = [
  {
    title: 'Candidate Selection Confirmation',
    subject: 'Congratulations {{name}}! Application Selected - Aao Seekhe',
    category: 'selection',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>Congratulations!</p>
<p>We are delighted to inform you that your application for the <strong>Aao Seekhe Candidate Program</strong> has been successfully reviewed and <strong>selected</strong>.</p>
<p>We were thoroughly impressed by your profile and credentials. Our admissions coordinator will connect with you shortly via email at <strong>{{email}}</strong> and phone at <strong>{{mobile}}</strong> to provide further details regarding next steps.</p>
<p>Thank you for choosing Aao Seekhe. We look forward to having you with us!</p>
<p>Warm regards,<br><strong>Admissions Committee, Aao Seekhe</strong></p>`,
  },
  {
    title: 'Interview Invitation',
    subject: 'Interview Invitation for {{name}} - Aao Seekhe',
    category: 'interview',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>Thank you for submitting your application to <strong>Aao Seekhe</strong>.</p>
<p>We are pleased to invite you for an interactive interview session to discuss your background, interests, and potential fit for our programs.</p>
<blockquote><strong>Notice:</strong> Please make sure your registered phone number <strong>{{mobile}}</strong> is reachable and keep an eye on <strong>{{email}}</strong> for your session link and schedule.</blockquote>
<p>We look forward to speaking with you soon!</p>
<p>Best regards,<br><strong>Interview Panel, Aao Seekhe</strong></p>`,
  },
  {
    title: 'Application Status Update',
    subject: 'Update Regarding Your Application - Aao Seekhe',
    category: 'update',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>We are writing to provide you with an update regarding your application submitted to <strong>Aao Seekhe</strong>.</p>
<p>Your application is currently under active review by our evaluation committee. We are assessing all candidate submissions carefully and will notify you of our final decision at <strong>{{email}}</strong>.</p>
<p>Thank you for your patience and interest in Aao Seekhe.</p>
<p>Sincerely,<br><strong>Review Board, Aao Seekhe</strong></p>`,
  },
  {
    title: 'Certificate Distribution Announcement',
    subject: 'Certificate Distribution Notice for {{name}} - Aao Seekhe',
    category: 'certificate',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>We are delighted to announce that your official Certificate of Completion is ready for collection and digital download.</p>
<p>Please review your registered details:</p>
<ul>
  <li><strong>Full Name:</strong> {{name}}</li>
  <li><strong>Email:</strong> {{email}}</li>
  <li><strong>Mobile:</strong> {{mobile}}</li>
</ul>
<p>If any details require correction, please notify us immediately by replying to this message.</p>
<p>Congratulations once again on reaching this significant milestone!</p>
<p>Warm regards,<br><strong>Academic Operations, Aao Seekhe</strong></p>`,
  },
  {
    title: 'Document Verification Request',
    subject: 'Action Required: Document Verification for {{name}} - Aao Seekhe',
    category: 'verification',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>As part of our formal candidate onboarding process, we request you to complete your document verification.</p>
<p>Our verification coordinator will contact you at <strong>{{mobile}}</strong> or send a secure upload link to <strong>{{email}}</strong>.</p>
<p>Please keep your identification and academic records accessible to ensure smooth verification.</p>
<p>Thank you for your prompt cooperation.</p>
<p>Kind regards,<br><strong>Verification Department, Aao Seekhe</strong></p>`,
  },
  {
    title: 'Important Candidate Notice',
    subject: 'Important Notice for Candidates - Aao Seekhe',
    category: 'general',
    body_html: `<p>Dear <strong>{{name}}</strong>,</p>
<p>Please take note of upcoming schedules, calendar events, and candidate guidelines for the upcoming session.</p>
<p>All candidates are requested to ensure their contact details ({{mobile}}) remain active and to regularly monitor notifications sent to <strong>{{email}}</strong>.</p>
<p>If you have any questions or require assistance, please reach out to our support desk.</p>
<p>Best regards,<br><strong>Aao Seekhe Administration</strong></p>`,
  },
];

// In-memory store used when DATABASE_URL is pending
const memoryStore = {
  submissions: [],
  admins: [
    {
      id: 1,
      email: DEFAULT_ADMIN_EMAIL,
      password_hash: bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD_PLAIN, 10),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ],
  emailTemplates: DEFAULT_EMAIL_TEMPLATES.map((t, idx) => ({
    id: idx + 1,
    ...t,
    created_at: new Date(),
    updated_at: new Date(),
  })),
  emailCampaigns: [],
  campaignRecipients: [],
  nextSubmissionId: 1,
  nextTemplateId: DEFAULT_EMAIL_TEMPLATES.length + 1,
  nextCampaignId: 1,
  nextRecipientId: 1,
};

export const isDatabaseConfigured = () => {
  let url = process.env.DATABASE_URL;
  if (!url) return false;
  url = url.trim().replace(/^['"]|['"]$/g, '');
  return Boolean(
    url.length > 0 &&
    !url.includes('YOUR_NEON_DATABASE_URL') &&
    url.startsWith('postgres')
  );
};

export const getPool = () => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL.trim().replace(/^['"]|['"]$/g, '');
    const isNeonOrSsl = connectionString.includes('sslmode=') || connectionString.includes('neon.tech');

    pool = new Pool({
      connectionString,
      ssl: isNeonOrSsl ? { rejectUnauthorized: false } : undefined,
      max: 5, // Optimal connection count for Neon serverless PgBouncer
      idleTimeoutMillis: 10000, // Recycle idle connections before Neon PgBouncer resets them
      connectionTimeoutMillis: 20000, // 20s allowance for serverless compute wake-up
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      // Gracefully absorb idle socket resets from Neon PgBouncer pooler
      if (err.code === 'ECONNRESET' || err.message?.includes('Connection terminated')) {
        return;
      }
      console.warn('PostgreSQL idle client notice:', err.message);
    });
  }

  return pool;
};

/**
 * Initializes database tables and default administrator in Neon PostgreSQL
 */
export const initDb = async () => {
  if (!isDatabaseConfigured()) {
    console.log('ℹ️  DATABASE_URL is pending in backend/.env. Using resilient data layer with default admin seeded.');
    return { success: false, message: 'DATABASE_URL not configured' };
  }

  try {
    const activePool = getPool();
    const client = await activePool.connect();

    try {
      // 1. Create submissions table with Indian Standard Time default
      await client.query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile_number VARCHAR(20) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
        );

        CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
      `);

      // 2. Create admin_users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Seed initial administrator if not exists
      const existingAdmin = await client.query(
        'SELECT id FROM admin_users WHERE email = $1',
        [DEFAULT_ADMIN_EMAIL]
      );

      if (existingAdmin.rows.length === 0) {
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD_PLAIN, 10);
        await client.query(
          'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
          [DEFAULT_ADMIN_EMAIL, hashedPassword]
        );
        console.log(`✅ Default administrator created: ${DEFAULT_ADMIN_EMAIL}`);
      }

      // 4. Create email_templates table and indexes
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          subject VARCHAR(500) NOT NULL,
          body_html TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'general',
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
        );

        CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
      `);

      // Seed default email templates if empty
      const tplCountRes = await client.query('SELECT COUNT(*) FROM email_templates');
      if (parseInt(tplCountRes.rows[0].count, 10) === 0) {
        for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
          await client.query(
            `INSERT INTO email_templates (title, subject, body_html, category, created_at, updated_at)
             VALUES ($1, $2, $3, $4, (NOW() AT TIME ZONE 'Asia/Kolkata'), (NOW() AT TIME ZONE 'Asia/Kolkata'))`,
            [tpl.title, tpl.subject, tpl.body_html, tpl.category]
          );
        }
        console.log(`✅ Seeded ${DEFAULT_EMAIL_TEMPLATES.length} default email templates into Neon DB.`);
      }

      // 5. Create email_campaigns table and indexes
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_campaigns (
          id SERIAL PRIMARY KEY,
          subject VARCHAR(500) NOT NULL,
          body_html TEXT NOT NULL,
          recipient_type VARCHAR(50) NOT NULL,
          filter_criteria JSONB,
          status VARCHAR(50) NOT NULL DEFAULT 'draft',
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          scheduled_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          created_by VARCHAR(255)
        );

        CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at DESC);
      `);

      // 6. Create campaign_recipients table and indexes
      await client.query(`
        CREATE TABLE IF NOT EXISTS campaign_recipients (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
          applicant_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL,
          recipient_name VARCHAR(100) NOT NULL,
          recipient_email VARCHAR(255) NOT NULL,
          recipient_mobile VARCHAR(20),
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          error_message TEXT,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
      `);

      console.log('✅ Neon Database tables (submissions, admin_users, email_templates, email_campaigns, campaign_recipients) are ready.');
      return { success: true, message: 'Database initialized successfully' };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Failed to connect/initialize Neon Database:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Test DB Connection
 */
export const testConnection = async () => {
  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      message: 'DATABASE_URL is not set in backend/.env',
    };
  }

  try {
    const activePool = getPool();
    const res = await activePool.query('SELECT NOW() as current_time, current_database() as database');
    return {
      connected: true,
      database: res.rows[0].database,
      serverTime: res.rows[0].current_time,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};

// ==========================================
// UNIFIED DATA ACCESS FUNCTIONS
// (Works with Neon DB, gracefully falls back)
// ==========================================

export const dbService = {
  // Admin lookup
  async findAdminByEmail(email) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query('SELECT * FROM admin_users WHERE email = $1 LIMIT 1', [email.toLowerCase().trim()]);
      return res.rows[0] || null;
    }
    return memoryStore.admins.find((a) => a.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },

  async findAdminById(id) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query('SELECT id, email, created_at, updated_at FROM admin_users WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    }
    const admin = memoryStore.admins.find((a) => a.id === Number(id));
    if (!admin) return null;
    return { id: admin.id, email: admin.email, created_at: admin.created_at, updated_at: admin.updated_at };
  },

  async updateAdminPassword(id, newHash) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      await pool.query(
        'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, id]
      );
      return true;
    }
    const admin = memoryStore.admins.find((a) => a.id === Number(id));
    if (admin) {
      admin.password_hash = newHash;
      admin.updated_at = new Date();
      return true;
    }
    return false;
  },

  // Submissions (Applicant Form)
  async checkRecentDuplicate(email, mobileNumber) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT id FROM submissions
         WHERE email = $1 AND mobile_number = $2 AND created_at > (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 minute'
         LIMIT 1`,
        [email, mobileNumber]
      );
      return res.rows.length > 0;
    }
    const oneMinAgo = new Date(Date.now() - 60000);
    return memoryStore.submissions.some(
      (s) =>
        s.email.toLowerCase() === email.toLowerCase() &&
        s.mobile_number === mobileNumber &&
        new Date(s.created_at) > oneMinAgo
    );
  },

  async createSubmission({ fullName, email, mobileNumber, description }) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `INSERT INTO submissions (full_name, email, mobile_number, description, created_at)
         VALUES ($1, $2, $3, $4, (NOW() AT TIME ZONE 'Asia/Kolkata'))
         RETURNING id, full_name, email, mobile_number, description, created_at`,
        [fullName, email, mobileNumber, description || null]
      );
      return res.rows[0];
    }
    // Indian Standard Time in memory
    const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const newRecord = {
      id: memoryStore.nextSubmissionId++,
      full_name: fullName,
      email,
      mobile_number: mobileNumber,
      description: description || null,
      created_at: istNow.toISOString(),
    };
    memoryStore.submissions.unshift(newRecord);
    return newRecord;
  },

  // Admin Dashboard Statistics
  async getDashboardStats() {
    if (isDatabaseConfigured()) {
      const pool = getPool();

      const totalRes = await pool.query('SELECT COUNT(*) as count FROM submissions');
      const todayRes = await pool.query(
        "SELECT COUNT(*) as count FROM submissions WHERE DATE(created_at) = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')"
      );
      const monthRes = await pool.query(
        "SELECT COUNT(*) as count FROM submissions WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')"
      );
      const latestRes = await pool.query(
        'SELECT id, full_name, email, created_at FROM submissions ORDER BY created_at DESC LIMIT 1'
      );

      return {
        totalApplications: parseInt(totalRes.rows[0].count, 10),
        todayApplications: parseInt(todayRes.rows[0].count, 10),
        monthApplications: parseInt(monthRes.rows[0].count, 10),
        latestApplication: latestRes.rows[0] || null,
      };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const subs = memoryStore.submissions;
    const totalApplications = subs.length;
    const todayApplications = subs.filter((s) => new Date(s.created_at) >= todayStart).length;
    const monthApplications = subs.filter((s) => new Date(s.created_at) >= monthStart).length;
    const latestApplication = subs[0] || null;

    return {
      totalApplications,
      todayApplications,
      monthApplications,
      latestApplication,
    };
  },

  // Admin Applicants List (Search, Sort, Filter, Paginate)
  async getApplicants({ search = '', sortBy = 'newest', dateFilter = '', monthFilter = '', page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;

    if (isDatabaseConfigured()) {
      const pool = getPool();

      let query = 'SELECT id, full_name, email, mobile_number, description, created_at FROM submissions WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as count FROM submissions WHERE 1=1';
      const params = [];
      let paramIdx = 1;

      if (search && search.trim()) {
        const s = `%${search.trim().toLowerCase()}%`;
        query += ` AND (LOWER(full_name) LIKE $${paramIdx} OR LOWER(email) LIKE $${paramIdx} OR mobile_number LIKE $${paramIdx})`;
        countQuery += ` AND (LOWER(full_name) LIKE $${paramIdx} OR LOWER(email) LIKE $${paramIdx} OR mobile_number LIKE $${paramIdx})`;
        params.push(s);
        paramIdx++;
      }

      if (dateFilter) {
        query += ` AND DATE(created_at) = $${paramIdx}`;
        countQuery += ` AND DATE(created_at) = $${paramIdx}`;
        params.push(dateFilter);
        paramIdx++;
      }

      if (monthFilter) {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${paramIdx}`;
        countQuery += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${paramIdx}`;
        params.push(monthFilter);
        paramIdx++;
      }

      // Sorting
      if (sortBy === 'oldest') {
        query += ' ORDER BY created_at ASC';
      } else if (sortBy === 'name_asc') {
        query += ' ORDER BY full_name ASC';
      } else if (sortBy === 'name_desc') {
        query += ' ORDER BY full_name DESC';
      } else {
        query += ' ORDER BY created_at DESC';
      }

      // Pagination
      const countRes = await pool.query(countQuery, params);
      const totalCount = parseInt(countRes.rows[0].count, 10);

      query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      params.push(limit, offset);

      const dataRes = await pool.query(query, params);

      return {
        records: dataRes.rows,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      };
    }

    // Memory store filtering
    let list = [...memoryStore.submissions];

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          r.mobile_number.includes(s)
      );
    }

    if (dateFilter) {
      list = list.filter((r) => {
        const d = new Date(r.created_at).toISOString().split('T')[0];
        return d === dateFilter;
      });
    }

    if (monthFilter) {
      list = list.filter((r) => {
        const m = new Date(r.created_at).toISOString().slice(0, 7);
        return m === monthFilter;
      });
    }

    if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sortBy === 'name_desc') {
      list.sort((a, b) => b.full_name.localeCompare(a.full_name));
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const total = list.length;
    const paginated = list.slice(offset, offset + limit);

    return {
      records: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getApplicantById(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        'SELECT id, full_name, email, mobile_number, description, created_at FROM submissions WHERE id = $1',
        [numericId]
      );
      return res.rows[0] || null;
    }
    return memoryStore.submissions.find((s) => s.id === numericId) || null;
  },

  async updateApplicant(id, { fullName, email, mobileNumber, description }) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE submissions
         SET full_name = $1, email = $2, mobile_number = $3, description = $4
         WHERE id = $5
         RETURNING id, full_name, email, mobile_number, description, created_at`,
        [fullName, email, mobileNumber, description || null, numericId]
      );
      return res.rows[0] || null;
    }
    const idx = memoryStore.submissions.findIndex((s) => s.id === numericId);
    if (idx === -1) return null;
    memoryStore.submissions[idx] = {
      ...memoryStore.submissions[idx],
      full_name: fullName,
      email,
      mobile_number: mobileNumber,
      description: description || null,
    };
    return memoryStore.submissions[idx];
  },

  async deleteApplicant(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query('DELETE FROM submissions WHERE id = $1 RETURNING id', [numericId]);
      return res.rowCount > 0;
    }
    const prevLen = memoryStore.submissions.length;
    memoryStore.submissions = memoryStore.submissions.filter((s) => s.id !== numericId);
    return memoryStore.submissions.length < prevLen;
  },

  async getAllApplicantsForExport({ search = '', dateFilter = '', monthFilter = '', sortBy = 'newest' }) {
    const result = await this.getApplicants({
      search,
      dateFilter,
      monthFilter,
      sortBy,
      page: 1,
      limit: 10000,
    });
    return result.records;
  },

  // ----------------------------------------------------
  // EMAIL TEMPLATES
  // ----------------------------------------------------
  async getEmailTemplates() {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        'SELECT id, title, subject, body_html, category, created_at, updated_at FROM email_templates ORDER BY id ASC'
      );
      return res.rows;
    }
    return [...memoryStore.emailTemplates];
  },

  async getEmailTemplateById(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        'SELECT id, title, subject, body_html, category, created_at, updated_at FROM email_templates WHERE id = $1',
        [numericId]
      );
      return res.rows[0] || null;
    }
    return memoryStore.emailTemplates.find((t) => t.id === numericId) || null;
  },

  async createEmailTemplate({ title, subject, bodyHtml, category = 'general' }) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `INSERT INTO email_templates (title, subject, body_html, category, created_at, updated_at)
         VALUES ($1, $2, $3, $4, (NOW() AT TIME ZONE 'Asia/Kolkata'), (NOW() AT TIME ZONE 'Asia/Kolkata'))
         RETURNING id, title, subject, body_html, category, created_at, updated_at`,
        [title.trim(), subject.trim(), bodyHtml.trim(), category || 'general']
      );
      return res.rows[0];
    }
    const newTpl = {
      id: memoryStore.nextTemplateId++,
      title: title.trim(),
      subject: subject.trim(),
      body_html: bodyHtml.trim(),
      category: category || 'general',
      created_at: new Date(),
      updated_at: new Date(),
    };
    memoryStore.emailTemplates.push(newTpl);
    return newTpl;
  },

  async updateEmailTemplate(id, { title, subject, bodyHtml, category }) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE email_templates
         SET title = COALESCE($1, title),
             subject = COALESCE($2, subject),
             body_html = COALESCE($3, body_html),
             category = COALESCE($4, category),
             updated_at = (NOW() AT TIME ZONE 'Asia/Kolkata')
         WHERE id = $5
         RETURNING id, title, subject, body_html, category, created_at, updated_at`,
        [title ? title.trim() : null, subject ? subject.trim() : null, bodyHtml ? bodyHtml.trim() : null, category || null, numericId]
      );
      return res.rows[0] || null;
    }
    const idx = memoryStore.emailTemplates.findIndex((t) => t.id === numericId);
    if (idx === -1) return null;
    if (title) memoryStore.emailTemplates[idx].title = title.trim();
    if (subject) memoryStore.emailTemplates[idx].subject = subject.trim();
    if (bodyHtml) memoryStore.emailTemplates[idx].body_html = bodyHtml.trim();
    if (category) memoryStore.emailTemplates[idx].category = category;
    memoryStore.emailTemplates[idx].updated_at = new Date();
    return memoryStore.emailTemplates[idx];
  },

  async deleteEmailTemplate(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query('DELETE FROM email_templates WHERE id = $1 RETURNING id', [numericId]);
      return res.rowCount > 0;
    }
    const prev = memoryStore.emailTemplates.length;
    memoryStore.emailTemplates = memoryStore.emailTemplates.filter((t) => t.id !== numericId);
    return memoryStore.emailTemplates.length < prev;
  },

  // ----------------------------------------------------
  // RECIPIENTS RESOLVER
  // ----------------------------------------------------
  async resolveRecipients({ recipientType = 'selected', selectedIds = [], filterCriteria = {} }) {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      if (recipientType === 'selected') {
        const ids = (Array.isArray(selectedIds) ? selectedIds : []).map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
        if (ids.length === 0) return [];
        const res = await pool.query(
          `SELECT id, full_name, email, mobile_number
           FROM submissions
           WHERE id = ANY($1::int[])
           ORDER BY id ASC`,
          [ids]
        );
        return res.rows;
      }

      if (recipientType === 'all') {
        const res = await pool.query(
          `SELECT id, full_name, email, mobile_number
           FROM submissions
           ORDER BY id ASC`
        );
        return res.rows;
      }

      if (recipientType === 'filtered') {
        const { search = '', dateFilter = '', monthFilter = '' } = filterCriteria || {};
        let query = 'SELECT id, full_name, email, mobile_number FROM submissions WHERE 1=1';
        const params = [];
        let paramIdx = 1;

        if (search && search.trim()) {
          const s = `%${search.trim()}%`;
          query += ` AND (full_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR mobile_number ILIKE $${paramIdx})`;
          params.push(s);
          paramIdx++;
        }

        if (dateFilter) {
          query += ` AND (created_at::date = $${paramIdx}::date)`;
          params.push(dateFilter);
          paramIdx++;
        }

        if (monthFilter) {
          query += ` AND (TO_CHAR(created_at, 'YYYY-MM') = $${paramIdx})`;
          params.push(monthFilter);
          paramIdx++;
        }

        query += ' ORDER BY id ASC';
        const res = await pool.query(query, params);
        return res.rows;
      }

      return [];
    }

    // Memory fallback
    let list = [...memoryStore.submissions];
    if (recipientType === 'selected') {
      const ids = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(Number));
      return list.filter((s) => ids.has(s.id));
    }
    if (recipientType === 'filtered') {
      const { search = '', dateFilter = '', monthFilter = '' } = filterCriteria || {};
      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        list = list.filter(
          (r) =>
            r.full_name.toLowerCase().includes(s) ||
            r.email.toLowerCase().includes(s) ||
            r.mobile_number.includes(s)
        );
      }
      if (dateFilter) {
        list = list.filter((r) => {
          const d = new Date(r.created_at).toISOString().split('T')[0];
          return d === dateFilter;
        });
      }
      if (monthFilter) {
        list = list.filter((r) => {
          const m = new Date(r.created_at).toISOString().slice(0, 7);
          return m === monthFilter;
        });
      }
      return list;
    }
    return list;
  },

  // ----------------------------------------------------
  // EMAIL CAMPAIGNS & CAMPAIGN RECIPIENTS
  // ----------------------------------------------------
  async createCampaign({
    subject,
    bodyHtml,
    recipientType = 'selected',
    filterCriteria = null,
    status = 'queued',
    scheduledAt = null,
    selectedIds = [],
    createdBy = 'Administrator',
  }) {
    const recipients = await this.resolveRecipients({
      recipientType,
      selectedIds,
      filterCriteria,
    });

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const campaignRes = await client.query(
          `INSERT INTO email_campaigns (
            subject, body_html, recipient_type, filter_criteria,
            status, total_recipients, sent_count, failed_count,
            scheduled_at, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8, NOW())
          RETURNING *`,
          [
            subject.trim(),
            bodyHtml.trim(),
            recipientType,
            filterCriteria ? JSON.stringify(filterCriteria) : null,
            status,
            recipients.length,
            scheduledAt || null,
            createdBy,
          ]
        );

        const campaign = campaignRes.rows[0];

        if (recipients.length > 0) {
          const values = [];
          const placeholders = [];
          let pIdx = 1;

          for (const r of recipients) {
            placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, 'pending', (NOW() AT TIME ZONE 'Asia/Kolkata'))`);
            values.push(campaign.id, r.id || null, r.full_name, r.email, r.mobile_number || null);
            pIdx += 5;
          }

          await client.query(
            `INSERT INTO campaign_recipients (
              campaign_id, applicant_id, recipient_name, recipient_email, recipient_mobile, status, created_at
            ) VALUES ${placeholders.join(', ')}`,
            values
          );
        }

        await client.query('COMMIT');
        return {
          ...campaign,
          recipientsCount: recipients.length,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Memory store fallback
    const campaignId = memoryStore.nextCampaignId++;
    const campaign = {
      id: campaignId,
      subject: subject.trim(),
      body_html: bodyHtml.trim(),
      recipient_type: recipientType,
      filter_criteria: filterCriteria,
      status,
      total_recipients: recipients.length,
      sent_count: 0,
      failed_count: 0,
      scheduled_at: scheduledAt || null,
      started_at: null,
      completed_at: null,
      created_by: createdBy,
      created_at: new Date(),
    };
    memoryStore.emailCampaigns.push(campaign);

    for (const r of recipients) {
      memoryStore.campaignRecipients.push({
        id: memoryStore.nextRecipientId++,
        campaign_id: campaignId,
        applicant_id: r.id || null,
        recipient_name: r.full_name,
        recipient_email: r.email,
        recipient_mobile: r.mobile_number || null,
        status: 'pending',
        error_message: null,
        sent_at: null,
        created_at: new Date(),
      });
    }

    return campaign;
  },

  async getCampaigns({ page = 1, limit = 10, status = '' } = {}) {
    const offset = (page - 1) * limit;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      let whereClause = '';
      const params = [];

      if (status) {
        whereClause = 'WHERE status = $1';
        params.push(status);
      }

      const countRes = await pool.query(`SELECT COUNT(*) FROM email_campaigns ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const listParams = [...params];
      listParams.push(limit, offset);
      const query = `
        SELECT
          c.*,
          (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'sent') as actual_sent,
          (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'failed') as actual_failed,
          (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'pending') as actual_pending
        FROM email_campaigns c
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
      `;

      const dataRes = await pool.query(query, listParams);

      return {
        campaigns: dataRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let list = [...memoryStore.emailCampaigns];
    if (status) {
      list = list.filter((c) => c.status === status);
    }
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);

    return {
      campaigns: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getCampaignById(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT
           c.*,
           (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'sent') as actual_sent,
           (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'failed') as actual_failed,
           (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'pending') as actual_pending
         FROM email_campaigns c
         WHERE c.id = $1`,
        [numericId]
      );
      return res.rows[0] || null;
    }

    return memoryStore.emailCampaigns.find((c) => c.id === numericId) || null;
  },

  async getCampaignRecipients(campaignId, { page = 1, limit = 50, status = '', search = '' } = {}) {
    const numericId = parseInt(campaignId, 10);
    if (isNaN(numericId)) return { recipients: [], total: 0 };
    const offset = (page - 1) * limit;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      let query = 'SELECT * FROM campaign_recipients WHERE campaign_id = $1';
      const params = [numericId];
      let pIdx = 2;

      if (status) {
        query += ` AND status = $${pIdx}`;
        params.push(status);
        pIdx++;
      }

      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        query += ` AND (recipient_name ILIKE $${pIdx} OR recipient_email ILIKE $${pIdx} OR recipient_mobile ILIKE $${pIdx})`;
        params.push(s);
        pIdx++;
      }

      const countRes = await pool.query(
        query.replace('SELECT *', 'SELECT COUNT(*)'),
        params
      );
      const total = parseInt(countRes.rows[0].count, 10);

      query += ` ORDER BY id ASC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
      params.push(limit, offset);

      const dataRes = await pool.query(query, params);
      return {
        recipients: dataRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let list = memoryStore.campaignRecipients.filter((r) => r.campaign_id === numericId);
    if (status) list = list.filter((r) => r.status === status);
    if (search && search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r) => r.recipient_name.toLowerCase().includes(s) || r.recipient_email.toLowerCase().includes(s));
    }
    const total = list.length;
    return {
      recipients: list.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async updateScheduledCampaign(id, { subject, bodyHtml, scheduledAt }) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE email_campaigns
         SET subject = COALESCE($1, subject),
             body_html = COALESCE($2, body_html),
             scheduled_at = COALESCE($3, scheduled_at)
         WHERE id = $4 AND status = 'scheduled'
         RETURNING *`,
        [subject ? subject.trim() : null, bodyHtml ? bodyHtml.trim() : null, scheduledAt || null, numericId]
      );
      return res.rows[0] || null;
    }

    const c = memoryStore.emailCampaigns.find((item) => item.id === numericId && item.status === 'scheduled');
    if (!c) return null;
    if (subject) c.subject = subject.trim();
    if (bodyHtml) c.body_html = bodyHtml.trim();
    if (scheduledAt) c.scheduled_at = scheduledAt;
    return c;
  },

  async cancelScheduledCampaign(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE email_campaigns
         SET status = 'cancelled',
             completed_at = (NOW() AT TIME ZONE 'Asia/Kolkata')
         WHERE id = $1 AND status IN ('scheduled', 'queued', 'processing')
         RETURNING id`,
        [numericId]
      );
      return res.rowCount > 0;
    }

    const c = memoryStore.emailCampaigns.find((item) => item.id === numericId && (item.status === 'scheduled' || item.status === 'queued' || item.status === 'processing'));
    if (c) {
      c.status = 'cancelled';
      c.completed_at = new Date();
      return true;
    }
    return false;
  },

  async deleteCampaign(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      // Halt any active scheduler loops first
      await pool.query(
        `UPDATE email_campaigns SET status = 'cancelled' WHERE id = $1 AND status IN ('scheduled', 'queued', 'processing')`,
        [numericId]
      );
      // Delete from email_campaigns (campaign_recipients cascades automatically)
      const res = await pool.query('DELETE FROM email_campaigns WHERE id = $1 RETURNING id', [numericId]);
      return res.rowCount > 0;
    }

    const prev = memoryStore.emailCampaigns.length;
    memoryStore.emailCampaigns = memoryStore.emailCampaigns.filter((c) => c.id !== numericId);
    memoryStore.campaignRecipients = memoryStore.campaignRecipients.filter((r) => r.campaign_id !== numericId);
    return memoryStore.emailCampaigns.length < prev;
  },

  async getDueScheduledCampaigns() {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT * FROM email_campaigns
         WHERE status = 'scheduled'
           AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 5`
      );
      return res.rows;
    }

    const now = new Date();
    return memoryStore.emailCampaigns.filter(
      (c) => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= now
    );
  },

  async claimCampaignForProcessing(campaignId) {
    const numericId = parseInt(campaignId, 10);
    if (isNaN(numericId)) return null;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE email_campaigns
         SET status = 'processing',
             started_at = NOW()
         WHERE id = $1 AND status IN ('scheduled', 'queued')
         RETURNING *`,
        [numericId]
      );
      return res.rows[0] || null;
    }

    const c = memoryStore.emailCampaigns.find((item) => item.id === numericId && (item.status === 'scheduled' || item.status === 'queued'));
    if (!c) return null;
    c.status = 'processing';
    c.started_at = new Date();
    return c;
  },

  async getPendingRecipientsForCampaign(campaignId) {
    const numericId = parseInt(campaignId, 10);
    if (isNaN(numericId)) return [];

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT * FROM campaign_recipients
         WHERE campaign_id = $1 AND status = 'pending'
         ORDER BY id ASC`,
        [numericId]
      );
      return res.rows;
    }

    return memoryStore.campaignRecipients.filter((r) => r.campaign_id === numericId && r.status === 'pending');
  },

  async updateRecipientStatus(recipientId, { status, errorMessage = null }) {
    const numericId = parseInt(recipientId, 10);
    if (isNaN(numericId)) return null;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE campaign_recipients
         SET status = $1::varchar,
             error_message = $2,
             sent_at = CASE WHEN $1::varchar = 'sent' THEN NOW() ELSE NULL END
         WHERE id = $3
         RETURNING *`,
        [status, errorMessage, numericId]
      );
      return res.rows[0] || null;
    }

    const r = memoryStore.campaignRecipients.find((item) => item.id === numericId);
    if (r) {
      r.status = status;
      r.error_message = errorMessage;
      if (status === 'sent') r.sent_at = new Date();
    }
    return r;
  },

  async finalizeCampaignProgress(campaignId) {
    const numericId = parseInt(campaignId, 10);
    if (isNaN(numericId)) return null;

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const statsRes = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
           COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
           COUNT(*) as total_count
         FROM campaign_recipients
         WHERE campaign_id = $1`,
        [numericId]
      );

      const stats = statsRes.rows[0] || { sent_count: 0, failed_count: 0, pending_count: 0, total_count: 0 };
      const sentCount = parseInt(stats.sent_count, 10);
      const failedCount = parseInt(stats.failed_count, 10);
      const pendingCount = parseInt(stats.pending_count, 10);
      const totalCount = parseInt(stats.total_count, 10);

      let finalStatus = 'processing';

      if (pendingCount === 0) {
        if (failedCount === 0) {
          finalStatus = 'completed';
        } else if (sentCount > 0) {
          finalStatus = 'partially_failed';
        } else {
          finalStatus = 'failed';
        }
      }

      const res = await pool.query(
        `UPDATE email_campaigns
         SET sent_count = $1,
             failed_count = $2,
             total_recipients = $3,
             status = CASE WHEN $4::varchar != 'processing' THEN $4::varchar ELSE status END,
             completed_at = CASE WHEN $4::varchar != 'processing' THEN NOW() ELSE completed_at END
         WHERE id = $5
         RETURNING *`,
        [sentCount, failedCount, totalCount, finalStatus, numericId]
      );
      return res.rows[0] || null;
    }

    const c = memoryStore.emailCampaigns.find((item) => item.id === numericId);
    if (!c) return null;
    const recs = memoryStore.campaignRecipients.filter((r) => r.campaign_id === numericId);
    c.sent_count = recs.filter((r) => r.status === 'sent').length;
    c.failed_count = recs.filter((r) => r.status === 'failed').length;
    const pending = recs.filter((r) => r.status === 'pending').length;
    if (pending === 0) {
      c.completed_at = new Date();
      if (c.failed_count === 0) c.status = 'completed';
      else if (c.sent_count > 0) c.status = 'partially_failed';
      else c.status = 'failed';
    }
    return c;
  },

  async resetFailedRecipientsForRetry(campaignId) {
    const numericId = parseInt(campaignId, 10);
    if (isNaN(numericId)) return { success: false, message: 'Invalid campaign ID' };

    if (isDatabaseConfigured()) {
      const pool = getPool();
      const updateRecs = await pool.query(
        `UPDATE campaign_recipients
         SET status = 'pending',
             error_message = NULL
         WHERE campaign_id = $1 AND status = 'failed'
         RETURNING id`,
        [numericId]
      );

      if (updateRecs.rowCount === 0) {
        return { success: false, message: 'No failed recipients found to retry' };
      }

      await pool.query(
        `UPDATE email_campaigns
         SET status = 'queued',
             completed_at = NULL
         WHERE id = $1`,
        [numericId]
      );

      return {
        success: true,
        retryingCount: updateRecs.rowCount,
      };
    }

    let count = 0;
    for (const r of memoryStore.campaignRecipients) {
      if (r.campaign_id === numericId && r.status === 'failed') {
        r.status = 'pending';
        r.error_message = null;
        count++;
      }
    }
    const c = memoryStore.emailCampaigns.find((item) => item.id === numericId);
    if (c && count > 0) {
      c.status = 'queued';
      c.completed_at = null;
    }
    return { success: count > 0, retryingCount: count };
  },

  async recoverInterruptedCampaigns() {
    if (isDatabaseConfigured()) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE email_campaigns
         SET status = 'queued'
         WHERE status = 'processing'
         RETURNING id`
      );
      if (res.rowCount > 0) {
        console.log(`🔄 Recovered ${res.rowCount} interrupted campaign(s) on startup.`);
      }
      return res.rowCount;
    }
    return 0;
  },
};
