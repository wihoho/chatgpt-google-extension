/**
 * Secure Key Management System
 *
 * This module handles default/fallback API keys for the extension.
 * Keys are obfuscated using base64 encoding and XOR cipher to prevent
 * plain text exposure in the source code.
 *
 * Security measures implemented:
 * 1. Keys are not stored in plain text
 * 2. Simple XOR cipher with rotating key
 * 3. Base64 encoding for additional obfuscation
 * 4. Keys are decoded only when needed
 */

// Simple XOR cipher key (rotating pattern)
const CIPHER_KEY = [0x4A, 0x7E, 0x3F, 0x91, 0x2C, 0x8B, 0x5D, 0x76]

/**
 * Encodes a string using XOR cipher and base64
 */
function encodeKey(plaintext: string): string {
  const bytes = new TextEncoder().encode(plaintext)
  const encoded = new Uint8Array(bytes.length)

  for (let i = 0; i < bytes.length; i++) {
    encoded[i] = bytes[i] ^ CIPHER_KEY[i % CIPHER_KEY.length]
  }

  return btoa(String.fromCharCode(...encoded))
}

/**
 * Decodes a string using XOR cipher and base64
 */
function decodeKey(encoded: string): string {
  try {
    const bytes = new Uint8Array(
      atob(encoded).split('').map(char => char.charCodeAt(0))
    )
    const decoded = new Uint8Array(bytes.length)

    for (let i = 0; i < bytes.length; i++) {
      decoded[i] = bytes[i] ^ CIPHER_KEY[i % CIPHER_KEY.length]
    }

    return new TextDecoder().decode(decoded)
  } catch (error) {
    console.error('Failed to decode key:', error)
    return ''
  }
}

// Obfuscated default API keys
// Note: These are demo keys for development. In production, these would be:
// 1. Obtained from environment variables during build
// 2. Stored in a secure configuration service
// 3. Rotated regularly for security

// Current encoded keys from secure-keys.ts
const DEFAULT_OPENAI_KEY_ENCODED = 'ORUS4V7kN1sjD0bQeLk4BXkRDahD/w1DBxRU4Xi4HxooFXnbdv8NRikfRalm0hpHGzhcw2e8aAY='
const DEFAULT_GEMINI_KEY_ENCODED = 'CzdF8H/yGTQ/PF3THe1qFBU8CKcc0jshfghH6R/AMBgZCVXjfuE6'

/**
 * Gets the default OpenAI API key
 */
export function getDefaultOpenAIKey(): string {
  return decodeKey(DEFAULT_OPENAI_KEY_ENCODED)
}

/**
 * Gets the default Gemini API key
 */
export function getDefaultGeminiKey(): string {
  return decodeKey(DEFAULT_GEMINI_KEY_ENCODED)
}

/**
 * Checks if a given key is one of the default keys
 */
export function isDefaultKey(key: string): boolean {
  if (!key) return false

  const defaultOpenAI = getDefaultOpenAIKey()
  const defaultGemini = getDefaultGeminiKey()

  return key === defaultOpenAI || key === defaultGemini
}

/**
 * Gets the appropriate default key for a provider type
 */
export function getDefaultKeyForProvider(providerType: 'openai' | 'gemini'): string {
  switch (providerType) {
    case 'openai':
      return getDefaultOpenAIKey()
    case 'gemini':
      return getDefaultGeminiKey()
    default:
      return ''
  }
}

/**
 * Utility function to encode keys (for development/setup)
 * This function is used to generate the encoded keys above
 */
export function encodeKeyForStorage(plaintext: string): string {
  return encodeKey(plaintext)
}

// Development helper - remove in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).encodeKeyForStorage = encodeKeyForStorage
}