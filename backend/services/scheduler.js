import { dbService } from '../db.js';
import {
  renderBrandedHtmlEmail,
  renderPlainTextEmail,
  replacePlaceholders,
  sendSingleEmail,
} from './customEmailService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let isSchedulerRunning = false;
let schedulerInterval = null;
const activeProcessingSet = new Set();

/**
 * Process all pending recipients for a campaign sequentially with rate-limit pacing
 */
export const processCampaign = async (campaignId) => {
  const numericId = parseInt(campaignId, 10);
  if (isNaN(numericId)) return null;

  if (activeProcessingSet.has(numericId)) {
    console.log(`Campaign #${numericId} is already being actively processed.`);
    return null;
  }

  activeProcessingSet.add(numericId);

  try {
    const campaign = await dbService.claimCampaignForProcessing(numericId);
    if (!campaign) {
      // Either already claimed, completed, or cancelled
      return null;
    }

    console.log(`🚀 Starting execution of email campaign #${numericId}: "${campaign.subject}"`);

    const pendingRecipients = await dbService.getPendingRecipientsForCampaign(numericId);
    console.log(`📋 Found ${pendingRecipients.length} pending recipient(s) for campaign #${numericId}`);

    for (let i = 0; i < pendingRecipients.length; i++) {
      const recipient = pendingRecipients[i];

      // Re-verify campaign hasn't been cancelled by admin mid-flight
      const currentCampaign = await dbService.getCampaignById(numericId);
      if (!currentCampaign || currentCampaign.status === 'cancelled') {
        console.log(`⚠️ Campaign #${numericId} was cancelled by administrator. Halting dispatch loop.`);
        break;
      }

      const applicantData = {
        recipient_name: recipient.recipient_name,
        recipient_email: recipient.recipient_email,
        recipient_mobile: recipient.recipient_mobile,
      };

      const personalizedSubject = replacePlaceholders(campaign.subject, applicantData);
      const html = renderBrandedHtmlEmail({
        subject: campaign.subject,
        bodyHtml: campaign.body_html,
        applicant: applicantData,
      });
      const text = renderPlainTextEmail({
        subject: campaign.subject,
        bodyHtml: campaign.body_html,
        applicant: applicantData,
      });

      try {
        await sendSingleEmail({
          to: recipient.recipient_email,
          subject: personalizedSubject,
          html,
          text,
        });

        await dbService.updateRecipientStatus(recipient.id, {
          status: 'sent',
          errorMessage: null,
        });
        console.log(`[Campaign #${numericId}] Sent (${i + 1}/${pendingRecipients.length}) to ${recipient.recipient_email}`);
      } catch (sendError) {
        console.error(`[Campaign #${numericId}] Failed to send to ${recipient.recipient_email}:`, sendError.message);
        await dbService.updateRecipientStatus(recipient.id, {
          status: 'failed',
          errorMessage: sendError.message || 'Unknown SMTP error',
        });
      }

      // Pacing delay (1000ms) to strictly comply with Gmail SMTP rate limits and avoid socket drops
      if (i < pendingRecipients.length - 1) {
        await sleep(1000);
      }
    }

    const finalCampaign = await dbService.finalizeCampaignProgress(numericId);
    console.log(`🏁 Completed email campaign #${numericId}. Final status: ${finalCampaign?.status}`);
    return finalCampaign;
  } catch (err) {
    console.error(`❌ Unexpected error processing campaign #${numericId}:`, err);
    await dbService.finalizeCampaignProgress(numericId).catch(() => {});
    return null;
  } finally {
    activeProcessingSet.delete(numericId);
  }
};

/**
 * Check for due scheduled campaigns and initiate processing
 */
export const checkScheduledCampaigns = async () => {
  try {
    const dueCampaigns = await dbService.getDueScheduledCampaigns();
    if (dueCampaigns && dueCampaigns.length > 0) {
      console.log(`⏰ Found ${dueCampaigns.length} scheduled campaign(s) ready for execution.`);
      for (const campaign of dueCampaigns) {
        // Fire-and-forget in background without blocking the check loop
        processCampaign(campaign.id).catch((err) => {
          console.error(`Error executing scheduled campaign #${campaign.id}:`, err);
        });
      }
    }
  } catch (err) {
    // Silence transient Neon serverless auto-suspend / DNS blips so they auto-recover without log spam
    if (
      err.code === 'ECONNRESET' ||
      err.code === 'ENOTFOUND' ||
      err.message?.includes('timeout') ||
      err.message?.includes('Connection terminated')
    ) {
      return;
    }
    console.error('Error checking scheduled campaigns:', err.message);
  }
};

/**
 * Initialize persistent background scheduler
 */
export const startScheduler = async () => {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  console.log('🔄 Initializing Email Campaign Scheduler & Recovery Daemon...');

  // 1. Recover any campaigns left in 'processing' from previous crash / restart
  try {
    await dbService.recoverInterruptedCampaigns();
  } catch (err) {
    console.error('Failed to run crash recovery on startup:', err.message);
  }

  // 2. Immediate check for any pending or due campaigns
  await checkScheduledCampaigns();

  // 3. Persistent recurring check every 20 seconds
  schedulerInterval = setInterval(checkScheduledCampaigns, 20000);
  console.log('✅ Email Campaign Scheduler active (polling every 20s for Asia/Kolkata scheduled tasks).');
};

/**
 * Stop scheduler gracefully (used during shutdown / testing)
 */
export const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
};

