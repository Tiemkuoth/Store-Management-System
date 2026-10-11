import express from 'express';
import { getPool } from '../db/db.js';
import { checkTokenBlacklist } from '../middleware/tokenCheck.js';
import { getAuthUrl, getTokensFromCode, getUserEmail, fetchRecentEmails, sendEmail } from '../services/gmailService.js';
import { asyncHandler, errorHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Generate Auth URL
router.get('/auth-url', checkTokenBlacklist, asyncHandler(async (req, res) => {
  // Check that Google OAuth credentials are configured before proceeding
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({
      success: false,
      error: 'Gmail integration is not configured on this server. Please contact your administrator to set up Google OAuth credentials.'
    });
  }
  const url = getAuthUrl();
  res.json({ url });
}));

// Handle OAuth Callback
router.get('/callback', checkTokenBlacklist, asyncHandler(async (req, res) => {
  const { code } = req.query;
  const userId = req.user.id; // From checkTokenBlacklist
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  const tokens = await getTokensFromCode(code);
  const email = await getUserEmail(tokens.access_token);
  
  const pool = await getPool();
  
  await pool.query(`
    INSERT INTO user_integrations 
      (user_id, provider, provider_email, access_token, refresh_token, expiry_date)
    VALUES (?, 'google', ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      provider_email = VALUES(provider_email),
      access_token = VALUES(access_token),
      refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
      expiry_date = VALUES(expiry_date),
      updated_at = CURRENT_TIMESTAMP
  `, [userId, email, tokens.access_token, tokens.refresh_token, tokens.expiry_date]);

  res.json({ success: true, email });
}));

// Get Integration Status
router.get('/status', checkTokenBlacklist, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pool = await getPool();
  
  const [rows] = await pool.query('SELECT * FROM user_integrations WHERE user_id = ? AND provider = ?', [userId, 'google']);
  
  if (rows.length > 0) {
    res.json({ connected: true, email: rows[0].provider_email });
  } else {
    res.json({ connected: false });
  }
}));

// Disconnect Gmail
router.post('/disconnect', checkTokenBlacklist, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pool = await getPool();
  
  await pool.query('DELETE FROM user_integrations WHERE user_id = ? AND provider = ?', [userId, 'google']);
  
  res.json({ success: true, message: 'Disconnected successfully' });
}));

// Get Recent Emails
router.get('/messages', checkTokenBlacklist, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pool = await getPool();
  
  const [rows] = await pool.query('SELECT * FROM user_integrations WHERE user_id = ? AND provider = ?', [userId, 'google']);
  
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Google account not connected' });
  }

  const tokens = rows[0];
  // Note: For production, we should handle token refreshing here if expired.
  // googleapis does it automatically if we pass refresh_token, but it depends on setup.
  const emails = await fetchRecentEmails({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  res.json(emails);
}));

// Send Email
router.post('/send', checkTokenBlacklist, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { to, subject, body } = req.body;
  
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM user_integrations WHERE user_id = ? AND provider = ?', [userId, 'google']);
  
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Google account not connected' });
  }

  const tokens = rows[0];
  const result = await sendEmail({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  }, { to, subject, body });

  res.json({ success: true, messageId: result.id });
}));

export default router;
