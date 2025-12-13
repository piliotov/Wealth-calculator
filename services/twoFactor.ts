import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

// Generate a new TOTP secret for a user
export function generateTOTPSecret(username: string): { secret: string; uri: string } {
  const totp = new OTPAuth.TOTP({
    issuer: 'ProsperPilot',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString()
  };
}

// Generate QR code as data URL for displaying to user
export async function generateQRCode(uri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(uri);
  } catch (error) {
    console.error('QR Code generation failed:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Verify a TOTP token
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    // Validate token with 1 period window (allows for clock drift)
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

// Store 2FA status in localStorage
const TOTP_ENABLED_KEY = 'totp_enabled';
const TOTP_SECRET_KEY = 'totp_secret_encrypted';

export function is2FAEnabled(): boolean {
  return localStorage.getItem(TOTP_ENABLED_KEY) === 'true';
}

export function enable2FA(encryptedSecret: string): void {
  localStorage.setItem(TOTP_ENABLED_KEY, 'true');
  localStorage.setItem(TOTP_SECRET_KEY, encryptedSecret);
}

export function disable2FA(): void {
  localStorage.removeItem(TOTP_ENABLED_KEY);
  localStorage.removeItem(TOTP_SECRET_KEY);
}

export function getEncrypted2FASecret(): string | null {
  return localStorage.getItem(TOTP_SECRET_KEY);
}
