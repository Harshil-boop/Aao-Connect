import express from 'express';
import { dbService } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import {
  renderBrandedHtmlEmail,
  renderPlainTextEmail,
  replacePlaceholders,
  sanitizeBodyHtml,
} from '../services/customEmailService.js';
import { processCampaign } from '../services/scheduler.js';

const router = express.Router();

// Require admin authentication for all email campaign routes
router.use(requireAdminAuth);

/**
 * GET /api/admin/emails/templates
 * Retrieve all saved email templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await dbService.getEmailTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve email templates' });
  }
});

/**
 * POST /api/admin/emails/templates
 * Create a new email template
 */
router.post('/templates', async (req, res) => {
  try {
    const { title, subject, bodyHtml, category } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Template title is required' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Template subject is required' });
    }
    if (!bodyHtml || !bodyHtml.trim()) {
      return res.status(400).json({ success: false, message: 'Template body is required' });
    }

    const template = await dbService.createEmailTemplate({
      title,
      subject,
      bodyHtml: sanitizeBodyHtml(bodyHtml),
      category: category || 'general',
    });

    res.status(201).json({ success: true, message: 'Template saved successfully', template });
  } catch (error) {
    console.error('Error creating email template:', error);
    res.status(500).json({ success: false, message: 'Failed to save email template' });
  }
});

/**
 * PUT /api/admin/emails/templates/:id
 * Update an existing email template
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const { title, subject, bodyHtml, category } = req.body;
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID' });
    }

    const updated = await dbService.updateEmailTemplate(templateId, {
      title,
      subject,
      bodyHtml: bodyHtml ? sanitizeBodyHtml(bodyHtml) : undefined,
      category,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, message: 'Template updated successfully', template: updated });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ success: false, message: 'Failed to update email template' });
  }
});

/**
 * DELETE /api/admin/emails/templates/:id
 * Delete an email template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ success: false, message: 'Invalid template ID' });
    }

    const deleted = await dbService.deleteEmailTemplate(templateId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting email template:', error);
    res.status(500).json({ success: false, message: 'Failed to delete email template' });
  }
});

/**
 * POST /api/admin/emails/preview
 * Generate personalized HTML and plain-text preview
 */
router.post('/preview', async (req, res) => {
  try {
    const { subject = '', bodyHtml = '', applicantId } = req.body;

    let sampleApplicant = {
      recipient_name: 'Candidate Name',
      recipient_email: 'candidate@example.com',
      recipient_mobile: '+91 98765 43210',
    };

    try {
      let candidate = null;
      if (applicantId) {
        candidate = await dbService.getApplicantById(applicantId);
      } else {
        const allCandidates = await dbService.resolveRecipients({ recipientType: 'all' });
        if (allCandidates && allCandidates.length > 0) {
          candidate = allCandidates[0];
        }
      }

      if (candidate) {
        sampleApplicant = {
          recipient_name: candidate.full_name,
          recipient_email: candidate.email,
          recipient_mobile: candidate.mobile_number,
        };
      }
    } catch {
      // Keep sample fallback
    }

    const personalizedSubject = replacePlaceholders(subject, sampleApplicant);
    const html = renderBrandedHtmlEmail({
      subject,
      bodyHtml: sanitizeBodyHtml(bodyHtml),
      applicant: sampleApplicant,
    });
    const text = renderPlainTextEmail({
      subject,
      bodyHtml,
      applicant: sampleApplicant,
    });

    res.json({
      success: true,
      preview: {
        subject: personalizedSubject,
        html,
        text,
        sampleApplicant,
      },
    });
  } catch (error) {
    console.error('Error generating email preview:', error);
    res.status(500).json({ success: false, message: 'Failed to generate preview' });
  }
});

/**
 * POST /api/admin/emails/resolve-count
 * Resolve exact recipient count before sending or scheduling
 */
router.post('/resolve-count', async (req, res) => {
  try {
    const { recipientType = 'selected', selectedIds = [], filterCriteria = {} } = req.body;
    const recipients = await dbService.resolveRecipients({
      recipientType,
      selectedIds,
      filterCriteria,
    });

    res.json({
      success: true,
      count: recipients.length,
      sampleRecipients: recipients.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.full_name,
        email: r.email,
      })),
    });
  } catch (error) {
    console.error('Error resolving recipient count:', error);
    res.status(500).json({ success: false, message: 'Failed to count recipients' });
  }
});

/**
 * POST /api/admin/emails/send
 * Create and immediately dispatch an email campaign
 */
router.post('/send', async (req, res) => {
  try {
    const {
      subject,
      bodyHtml,
      recipientType = 'selected',
      selectedIds = [],
      filterCriteria = null,
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Email subject is required' });
    }
    if (!bodyHtml || !bodyHtml.trim()) {
      return res.status(400).json({ success: false, message: 'Email message is required' });
    }
    if (recipientType === 'selected' && (!selectedIds || selectedIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'Please select at least one applicant' });
    }

    const campaign = await dbService.createCampaign({
      subject,
      bodyHtml: sanitizeBodyHtml(bodyHtml),
      recipientType,
      selectedIds,
      filterCriteria,
      status: 'queued',
      createdBy: req.admin?.email || 'Administrator',
    });

    if (campaign.recipientsCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible recipients found matching the selection or criteria',
      });
    }

    // Trigger processing immediately in background
    processCampaign(campaign.id).catch((err) => {
      console.error(`Error processing immediate campaign #${campaign.id}:`, err);
    });

    res.status(201).json({
      success: true,
      message: `Email campaign queued successfully for ${campaign.recipientsCount} recipient(s).`,
      campaignId: campaign.id,
      campaign,
    });
  } catch (error) {
    console.error('Error initiating immediate send:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to dispatch email campaign' });
  }
});

/**
 * POST /api/admin/emails/schedule
 * Schedule an email campaign for future execution
 */
router.post('/schedule', async (req, res) => {
  try {
    const {
      subject,
      bodyHtml,
      recipientType = 'selected',
      selectedIds = [],
      filterCriteria = null,
      scheduledAt,
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Email subject is required' });
    }
    if (!bodyHtml || !bodyHtml.trim()) {
      return res.status(400).json({ success: false, message: 'Email message is required' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required' });
    }

    const parsedDate = new Date(scheduledAt);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid scheduled date/time format' });
    }

    // Ensure scheduled date is in future
    const now = new Date();
    if (parsedDate.getTime() <= now.getTime() - 60000) {
      return res.status(400).json({ success: false, message: 'Scheduled time must be in the future' });
    }

    if (recipientType === 'selected' && (!selectedIds || selectedIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'Please select at least one applicant' });
    }

    const campaign = await dbService.createCampaign({
      subject,
      bodyHtml: sanitizeBodyHtml(bodyHtml),
      recipientType,
      selectedIds,
      filterCriteria,
      status: 'scheduled',
      scheduledAt: parsedDate.toISOString(),
      createdBy: req.admin?.email || 'Administrator',
    });

    if (campaign.recipientsCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible recipients found matching the selection or criteria',
      });
    }

    res.status(201).json({
      success: true,
      message: `Email campaign scheduled successfully for ${new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(parsedDate)} IST with ${campaign.recipientsCount} recipient(s).`,
      campaignId: campaign.id,
      campaign,
    });
  } catch (error) {
    console.error('Error scheduling campaign:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to schedule email campaign' });
  }
});

/**
 * GET /api/admin/emails/campaigns
 * List campaigns with pagination and status filters
 */
router.get('/campaigns', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const status = req.query.status || '';

    const result = await dbService.getCampaigns({ page, limit, status });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve email campaigns' });
  }
});

/**
 * GET /api/admin/emails/campaigns/:id
 * Get details for a single campaign
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const campaign = await dbService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve campaign details' });
  }
});

/**
 * GET /api/admin/emails/campaigns/:id/recipients
 * List recipient delivery log for a campaign
 */
router.get('/campaigns/:id/recipients', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const status = req.query.status || '';
    const search = req.query.search || '';

    const result = await dbService.getCampaignRecipients(campaignId, { page, limit, status, search });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching campaign recipients:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve recipient logs' });
  }
});

/**
 * PUT /api/admin/emails/campaigns/:id
 * Update a scheduled campaign before execution
 */
router.put('/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const { subject, bodyHtml, scheduledAt } = req.body;
    const updated = await dbService.updateScheduledCampaign(campaignId, {
      subject,
      bodyHtml: bodyHtml ? sanitizeBodyHtml(bodyHtml) : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Campaign cannot be edited (must be in scheduled status).',
      });
    }

    res.json({ success: true, message: 'Scheduled campaign updated successfully', campaign: updated });
  } catch (error) {
    console.error('Error updating scheduled campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

/**
 * POST /api/admin/emails/campaigns/:id/cancel
 * Cancel a scheduled or queued campaign
 */
router.post('/campaigns/:id/cancel', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const cancelled = await dbService.cancelScheduledCampaign(campaignId);
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        message: 'Campaign cannot be cancelled (it may already be completed).',
      });
    }

    res.json({ success: true, message: 'Campaign dispatch stopped successfully.' });
  } catch (error) {
    console.error('Error cancelling campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel campaign' });
  }
});

/**
 * DELETE /api/admin/emails/campaigns/:id
 * Permanently delete a campaign and its recipient delivery logs
 */
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const deleted = await dbService.deleteCampaign(campaignId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign and its delivery records permanently deleted.' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

/**
 * POST /api/admin/emails/campaigns/:id/retry
 * Retry only failed recipients of a campaign
 */
router.post('/campaigns/:id/retry', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ success: false, message: 'Invalid campaign ID' });
    }

    const retryResult = await dbService.resetFailedRecipientsForRetry(campaignId);
    if (!retryResult.success) {
      return res.status(400).json(retryResult);
    }

    // Trigger background processing
    processCampaign(campaignId).catch((err) => {
      console.error(`Error processing campaign retry #${campaignId}:`, err);
    });

    res.json({
      success: true,
      message: `Retrying delivery for ${retryResult.retryingCount} failed recipient(s).`,
      retryingCount: retryResult.retryingCount,
    });
  } catch (error) {
    console.error('Error retrying failed recipients:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate retry' });
  }
});

export default router;

