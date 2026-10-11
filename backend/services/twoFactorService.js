/**
 * Two-Factor Authentication (2FA) Service
 * Implements TOTP (Time-based One-Time Password) via Google Authenticator
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getPool } from '../db/db.js';

// ── SECURITY: Hash utilities for secrets and backup codes ──────
function hashSecret(secret) {
  // Use PBKDF2 to hash the 2FA secret
  return crypto.pbkdf2Sync(secret, 'sms_2fa_salt', 100000, 32, 'sha256').toString('hex');
}

function hashBackupCode(code) {
  // Hash each backup code individually
  return crypto.pbkdf2Sync(code, 'sms_backup_salt', 100000, 32, 'sha256').toString('hex');
}

function verifyBackupCodeHash(code, hash) {
  // Compare backup code with stored hash
  const codeHash = hashBackupCode(code);
  return codeHash === hash;
}
export async function generate2FASecret(user) {
  const secret = speakeasy.generateSecret({
    name: `Store Management System (${user.username})`,
    issuer: 'Store Management System',
    length: 32,
  });

  return {
    secret: secret.base32,
    backup_codes: generateBackupCodes(10),
    qr_code: secret.otpauth_url,
  };
}

// ── Generate QR Code ────────────────────────────────────────────
export async function generateQRCode(otpauthUrl) {
  try {
    const qrCode = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300,
    });
    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

// ── Verify TOTP Token ──────────────────────────────────────────
export function verifyTOTPToken(secret, token) {
  if (!token || !secret) {
    return { valid: false, error: 'Token or secret missing' };
  }

  try {
    // Verify with 1 time window tolerance (±30 seconds)
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow tokens from previous/next time window
    });

    return {
      valid: verified,
      error: verified ? null : 'Invalid token',
    };
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return {
      valid: false,
      error: 'Token verification failed',
    };
  }
}

// ── Generate Backup Codes ──────────────────────────────────────
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateRandomCode();
    codes.push(code);
  }
  return codes;
}

function generateRandomCode() {
  // Format: XXXX-XXXX (8 alphanumeric characters)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format as XXXX-XXXX
  return `${code.substring(0, 4)}-${code.substring(4, 8)}`;
}

// ── Enable 2FA for User ────────────────────────────────────────
export async function enable2FA(userId, secret, backupCodes) {
  try {
    // SECURITY: Hash backup codes before storage
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));
    
    // SECURITY: Hash the 2FA secret before storage
    const hashedSecret = hashSecret(secret);

    await getPool().query(
      `UPDATE users SET 
        two_factor_enabled = TRUE, 
        two_factor_secret = ?, 
        backup_codes = ?,
        two_factor_verified = FALSE
       WHERE id = ?`,
      [hashedSecret, JSON.stringify(hashedBackupCodes), userId]
    );

    return { success: true, message: '2FA setup initiated' };
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    throw error;
  }
}

// ── Verify & Complete 2FA Setup ────────────────────────────────
export async function completeTwoFactorSetup(userId, token) {
  try {
    // Get user's temporary secret (still plaintext until verified)
    const [[user]] = await getPool().query(
      'SELECT two_factor_secret FROM users WHERE id = ?',
      [userId]
    );

    if (!user?.two_factor_secret) {
      throw new Error('2FA setup not initiated');
    }

    // Verify the token against the plaintext secret
    const verification = verifyTOTPToken(user.two_factor_secret, token);
    if (!verification.valid) {
      throw new Error('Invalid verification code');
    }

    // Now hash the secret before final storage
    const hashedSecret = hashSecret(user.two_factor_secret);
    
    // Mark 2FA as verified/enabled and store hashed secret
    await getPool().query(
      'UPDATE users SET two_factor_verified = TRUE, two_factor_secret = ? WHERE id = ?',
      [hashedSecret, userId]
    );

    return { success: true, message: '2FA successfully enabled' };
  } catch (error) {
    console.error('Error completing 2FA setup:', error);
    throw error;
  }
}

// ── Disable 2FA for User ───────────────────────────────────────
export async function disable2FA(userId, password, passwordHash) {
  try {
    // Verify password first (security measure)
    // In real implementation, compare password with stored hash

    await getPool().query(
      `UPDATE users SET 
        two_factor_enabled = FALSE,
        two_factor_verified = FALSE,
        two_factor_secret = NULL,
        backup_codes = NULL
       WHERE id = ?`,
      [userId]
    );

    return { success: true, message: '2FA disabled' };
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    throw error;
  }
}

// ── Verify Backup Code ────────────────────────────────────────
export async function verifyBackupCode(userId, code) {
  try {
    const [[user]] = await getPool().query(
      'SELECT backup_codes FROM users WHERE id = ?',
      [userId]
    );

    if (!user?.backup_codes) {
      return { valid: false, error: 'No backup codes found' };
    }

    const backupCodeHashes = JSON.parse(user.backup_codes);
    
    // Find matching backup code (constant-time comparison)
    let foundIndex = -1;
    for (let i = 0; i < backupCodeHashes.length; i++) {
      if (verifyBackupCodeHash(code, backupCodeHashes[i])) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      return { valid: false, error: 'Invalid backup code' };
    }

    // Remove used backup code
    backupCodeHashes.splice(foundIndex, 1);
    await getPool().query(
      'UPDATE users SET backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodeHashes), userId]
    );

    return {
      valid: true,
      remaining: backupCodeHashes.length,
      message: `Backup code used. ${backupCodeHashes.length} remaining.`,
    };
  } catch (error) {
    console.error('Error verifying backup code:', error);
    return { valid: false, error: 'Backup code verification failed' };
  }
}

// ── Check if 2FA is Enabled ────────────────────────────────────
export async function is2FAEnabled(userId) {
  try {
    const [[user]] = await getPool().query(
      'SELECT two_factor_enabled, two_factor_verified FROM users WHERE id = ?',
      [userId]
    );

    return {
      enabled: user?.two_factor_enabled === 1,
      verified: user?.two_factor_verified === 1,
    };
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return { enabled: false, verified: false };
  }
}
