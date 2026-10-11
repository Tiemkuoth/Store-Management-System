/**
 * Email routes — powered by Nodemailer (SMTP)
 * Replaces the Gmail OAuth integration.
 *
 * Endpoints:
 *   GET  /api/email/status        — SMTP config status
 *   POST /api/email/send          — Send an email via SMTP
 *   GET  /api/email/sent          — Sent email history for current user
 *   GET  /api/email/contacts      — Active users list for autocomplete
 */

import express from 'express';
import { getPool } from '../db/db.js';
import { sendEmail } from '../services/notificationService.js';
import { logAudit } from '../services/auditLogger.js';

const router = express.Router();

// ── Ensure sent_emails table exists ──────────────────────────
async function ensureSentEmailsTable() {
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS sent_emails (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        sender_id     INT NOT NULL,
        sender_name   VARCHAR(255),
        recipient_to  VARCHAR(500) NOT NULL,
        subject       VARCHAR(500) NOT NULL,
        body          TEXT NOT NULL,
        status        ENUM('sent','failed') DEFAULT 'sent',
        error_message TEXT NULL,
        sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    console.warn('sent_emails table check:', e.message);
  }
}

// ── GET /status ───────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST);
  res.json({
    configured,
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || null,
    from: process.env.MAIL_FROM || null,
    message: configured
      ? 'SMTP is configured and ready.'
      : 'SMTP credentials not set. Add SMTP_HOST, SMTP_USER, SMTP_PASS to your .env file.',
  });
});

// ── POST /send ────────────────────────────────────────────────
router.post('/send', async (req, res) => {
  const { to, subject, body, html } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = String(to).split(',').map(e => e.trim()).filter(Boolean);
  const invalid = recipients.filter(e => !emailRegex.test(e));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid email address(es): ${invalid.join(', ')}` });
  }

  await ensureSentEmailsTable();

  let status = 'sent';
  let errorMessage = null;

  try {
    await sendEmail({
      to: recipients.join(', '),
      subject: String(subject).trim(),
      text: String(body).trim(),
      html: html || `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:20px">
        <p style="white-space:pre-wrap">${String(body).trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="font-size:12px;color:#94a3b8">Sent via Store Management System</p>
      </div>`,
    });
  } catch (e) {
    status = 'failed';
    errorMessage = e.message;
  }

  // Log to DB regardless of success/failure
  try {
    await getPool().query(
      `INSERT INTO sent_emails (sender_id, sender_name, recipient_to, subject, body, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.full_name || req.user.username,
       recipients.join(', '), String(subject).trim(), String(body).trim(),
       status, errorMessage]
    );
  } catch (_) { /* log failure shouldn't break the response */ }

  await logAudit(req.user.id, req.user.username, req.user.role, 'SEND_EMAIL',
    `${status === 'sent' ? 'Sent' : 'Failed to send'} email to ${recipients.join(', ')} — "${subject}"`, req);

  if (status === 'failed') {
    return res.status(502).json({ error: `Email failed to send: ${errorMessage}` });
  }

  res.json({ success: true, message: `Email sent to ${recipients.join(', ')}` });
});

// ── GET /sent ─────────────────────────────────────────────────
router.get('/sent', async (req, res) => {
  await ensureSentEmailsTable();
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const [rows] = await getPool().query(
      `SELECT id, recipient_to, subject, body, status, error_message, sent_at
       FROM sent_emails
       WHERE sender_id = ?
       ORDER BY sent_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /contacts ─────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, full_name, email, role, avatar_url
       FROM users
       WHERE status = 'Active' AND email IS NOT NULL AND email != '' AND id != ?
       ORDER BY full_name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
