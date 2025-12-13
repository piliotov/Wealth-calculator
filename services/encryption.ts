import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

// Derive encryption key from user's password using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256 // 32 bytes for nacl secretbox
  );

  return new Uint8Array(derivedBits);
}

// Generate a random salt for key derivation
export function generateSalt(): string {
  const salt = nacl.randomBytes(16);
  return encodeBase64(salt);
}

// Encrypt data with user's password
export async function encryptData(data: any, password: string, salt: string): Promise<string> {
  const saltBytes = decodeBase64(salt);
  const key = await deriveKey(password, saltBytes);
  
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = nacl.secretbox(messageUint8, nonce, key);
  
  // Combine nonce + encrypted data
  const fullMessage = new Uint8Array(nonce.length + encrypted.length);
  fullMessage.set(nonce);
  fullMessage.set(encrypted, nonce.length);
  
  return encodeBase64(fullMessage);
}

// Decrypt data with user's password
export async function decryptData(encryptedData: string, password: string, salt: string): Promise<any> {
  try {
    const saltBytes = decodeBase64(salt);
    const key = await deriveKey(password, saltBytes);
    
    const fullMessage = decodeBase64(encryptedData);
    const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
    const message = fullMessage.slice(nacl.secretbox.nonceLength);
    
    const decrypted = nacl.secretbox.open(message, nonce, key);
    
    if (!decrypted) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - incorrect password');
  }
}

// Store encryption salt in localStorage
const SALT_KEY = 'encryption_salt';

export function getStoredSalt(): string | null {
  return localStorage.getItem(SALT_KEY);
}

export function storeSalt(salt: string): void {
  localStorage.setItem(SALT_KEY, salt);
}

// Encrypt individual fields for database storage
export async function encryptField(value: string, password: string, salt: string): Promise<string> {
  return encryptData(value, password, salt);
}

export async function decryptField(encryptedValue: string, password: string, salt: string): Promise<string> {
  return decryptData(encryptedValue, password, salt);
}
