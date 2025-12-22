/**
 * GitHub App Authentication Utilities
 *
 * Shared utilities for generating GitHub App installation tokens.
 * Uses jose library for JWT signing with PKCS#8 key format.
 */

import { SignJWT, importPKCS8 } from 'jose'

/**
 * Environment variables required for GitHub App authentication.
 * These should be available in the worker's env binding.
 */
export interface GitHubAuthEnv {
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

/**
 * Convert PKCS#1 (RSA PRIVATE KEY) to PKCS#8 (PRIVATE KEY) format.
 * GitHub App keys are in PKCS#1 but jose's importPKCS8 requires PKCS#8.
 *
 * @param pkcs1Pem - PEM-encoded PKCS#1 RSA private key
 * @returns PEM-encoded PKCS#8 private key
 */
function convertPkcs1ToPkcs8(pkcs1Pem: string): string {
  // Check if already PKCS#8
  if (pkcs1Pem.includes('-----BEGIN PRIVATE KEY-----')) {
    return pkcs1Pem
  }

  // Remove PEM headers and decode
  const pkcs1Base64 = pkcs1Pem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/[\s\n\r]/g, '')

  const pkcs1Binary = Uint8Array.from(atob(pkcs1Base64), (c) => c.charCodeAt(0))

  // RSA AlgorithmIdentifier: SEQUENCE { OID 1.2.840.113549.1.1.1, NULL }
  const rsaAlgorithmId = new Uint8Array([
    0x30, 0x0d, // SEQUENCE (13 bytes)
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // OID rsaEncryption
    0x05, 0x00, // NULL
  ])

  // version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00])

  // Wrap PKCS#1 key in OCTET STRING
  const pkcs1Len = pkcs1Binary.length
  let octetStringHeader: Uint8Array
  if (pkcs1Len < 128) {
    octetStringHeader = new Uint8Array([0x04, pkcs1Len])
  } else if (pkcs1Len < 256) {
    octetStringHeader = new Uint8Array([0x04, 0x81, pkcs1Len])
  } else {
    octetStringHeader = new Uint8Array([0x04, 0x82, (pkcs1Len >> 8) & 0xff, pkcs1Len & 0xff])
  }

  // Build inner content: version + algorithmId + octetString(pkcs1Key)
  const innerLen = version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  let sequenceHeader: Uint8Array
  if (innerLen < 128) {
    sequenceHeader = new Uint8Array([0x30, innerLen])
  } else if (innerLen < 256) {
    sequenceHeader = new Uint8Array([0x30, 0x81, innerLen])
  } else {
    sequenceHeader = new Uint8Array([0x30, 0x82, (innerLen >> 8) & 0xff, innerLen & 0xff])
  }

  // Combine all parts
  const pkcs8Binary = new Uint8Array(
    sequenceHeader.length + version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  )
  let offset = 0
  pkcs8Binary.set(sequenceHeader, offset)
  offset += sequenceHeader.length
  pkcs8Binary.set(version, offset)
  offset += version.length
  pkcs8Binary.set(rsaAlgorithmId, offset)
  offset += rsaAlgorithmId.length
  pkcs8Binary.set(octetStringHeader, offset)
  offset += octetStringHeader.length
  pkcs8Binary.set(pkcs1Binary, offset)

  // Encode as base64 with 64-char line breaks
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(pkcs8Binary)))
  const lines = base64.match(/.{1,64}/g) || []

  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

/**
 * Normalize the GitHub private key from various formats.
 *
 * Handles:
 * - Base64 encoded PEM
 * - PEM with escaped newlines (\\n)
 * - Raw PEM format
 *
 * @param privateKey - Private key in any supported format
 * @returns Normalized PEM-format private key
 */
function normalizePrivateKey(privateKey: string): string {
  let pemKey = privateKey

  // Handle base64 encoded PEM
  if (!pemKey.includes('-----BEGIN')) {
    try {
      pemKey = atob(pemKey)
    } catch {
      // Not valid base64, try as-is
    }
  }

  // Convert escaped newlines to actual newlines
  pemKey = pemKey.replace(/\\n/g, '\n')

  return pemKey
}

/**
 * Generate a GitHub App JWT for authentication.
 *
 * The JWT is used to authenticate as the GitHub App itself,
 * which can then be exchanged for an installation access token.
 *
 * @param env - Environment variables containing GITHUB_APP_ID and GITHUB_PRIVATE_KEY
 * @returns Signed JWT string valid for 10 minutes
 */
export async function generateGitHubAppJWT(env: GitHubAuthEnv): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Normalize and convert private key
  let privateKeyPEM = normalizePrivateKey(env.GITHUB_PRIVATE_KEY)

  // GitHub App keys are PKCS#1 (RSA PRIVATE KEY), but jose requires PKCS#8
  privateKeyPEM = convertPkcs1ToPkcs8(privateKeyPEM)

  const key = await importPKCS8(privateKeyPEM, 'RS256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 600) // 10 minutes
    .setIssuer(env.GITHUB_APP_ID)
    .sign(key)
}

/**
 * Get an installation access token for a GitHub App installation.
 *
 * This token can be used to make API calls on behalf of the installation.
 * Tokens are valid for 1 hour.
 *
 * @param installationId - The GitHub App installation ID
 * @param env - Environment variables containing GITHUB_APP_ID and GITHUB_PRIVATE_KEY
 * @returns Installation access token
 * @throws Error if token generation fails
 */
export async function getInstallationToken(
  installationId: number,
  env: GitHubAuthEnv
): Promise<string> {
  const jwt = await generateGitHubAppJWT(env)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'todo.mdx-worker',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation token: ${response.status} ${error}`)
  }

  const data = (await response.json()) as { token: string }
  return data.token
}
