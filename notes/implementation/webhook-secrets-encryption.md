# Webhook Secrets Encryption Implementation

## Summary

Implemented encryption for webhook secrets stored in the LinearIntegrations collection using AES-256-GCM authenticated encryption.

## Files Created

1. **apps/admin/src/collections/LinearIntegrations.ts**
   - New Payload collection for Linear integrations
   - Includes webhook secret encryption in `beforeChange` hook
   - Includes webhook secret decryption in `afterRead` hook
   - Hidden from admin UI for security

2. **apps/admin/src/lib/encryption.ts**
   - Reusable encryption utility functions
   - `encrypt(plainText, secret)` - Encrypts using AES-256-GCM
   - `decrypt(encryptedText, secret)` - Decrypts using AES-256-GCM
   - `isEncrypted(value)` - Checks if value is encrypted

3. **apps/admin/tests/linear-integrations-encryption.test.ts**
   - Unit tests for encryption/decryption
   - Tests create, read, update operations
   - Tests handling of missing webhook secrets

## Files Modified

1. **apps/admin/src/payload.config.ts**
   - Added LinearIntegrations to collections array
   - Added import for LinearIntegrations

## How It Works

### Encryption (beforeChange hook)

When a LinearIntegration document is created or updated:
1. Check if `webhookSecret` field has a value
2. Check if it's not already encrypted (using `isEncrypted()`)
3. Derive a 32-byte key from `PAYLOAD_SECRET` using SHA-256
4. Generate a random 16-byte IV (initialization vector)
5. Encrypt using AES-256-GCM with the key and IV
6. Store in format: `iv:authTag:encryptedData` (all hex-encoded)

### Decryption (afterRead hook)

When a LinearIntegration document is read:
1. Check if `webhookSecret` field has a value and is encrypted
2. Parse the three components: IV, auth tag, encrypted data
3. Derive the same 32-byte key from `PAYLOAD_SECRET`
4. Decrypt using AES-256-GCM
5. Return the plain text secret
6. On failure, return `***decryption-failed***` instead of throwing

### Security Features

- **AES-256-GCM**: Authenticated encryption prevents tampering
- **Random IV**: Each encryption uses a unique IV
- **Auth tag**: Ensures data integrity and authenticity
- **Hidden from admin UI**: Secret field is not displayed
- **Access control**: Users can only access their own integrations

## Database Schema

The migration already created the `linear_integrations` table with a `webhook_secret` text column. The encrypted format fits in this column:
- IV: 32 hex chars (16 bytes)
- Auth tag: 32 hex chars (16 bytes)
- Encrypted data: Variable length
- Total: ~70+ characters with separators

## Environment Variables

Required: `PAYLOAD_SECRET` - Used as the encryption key (hashed to 32 bytes)

## Security Considerations

1. **Key Rotation**: To rotate the encryption key:
   - Read all integrations (triggers decryption with old key)
   - Change `PAYLOAD_SECRET`
   - Update all integrations (triggers re-encryption with new key)

2. **Backup Security**: Database backups contain encrypted secrets, but require `PAYLOAD_SECRET` to decrypt

3. **GitHub Webhook Secret**: Currently stored as environment variable `GITHUB_WEBHOOK_SECRET`, which is secure for a global webhook secret

## Testing

Run tests with:
```bash
cd apps/admin
PAYLOAD_SECRET=test-secret pnpm test tests/linear-integrations-encryption.test.ts
```

## Current Usage

Linear webhook verification in `worker/src/api/linear.ts` currently uses `LINEAR_WEBHOOK_SECRET` from environment variables (line 84). This is appropriate for a global webhook secret shared across all Linear webhooks.

If per-integration webhook secrets are needed in the future:
1. Store per-integration secrets in the database (encrypted)
2. Query the integration by `webhookId` from the webhook payload
3. Use the decrypted secret for verification

## Related Issues

- Fixes: todo-ga5 (Encrypt webhook secrets at rest)
- Related: LINEAR_WEBHOOK_SECRET environment variable usage in worker

## Next Steps

1. Add migration to encrypt existing plain-text secrets (if any)
2. Consider adding similar encryption for other sensitive fields
3. Document key rotation procedure
4. Add monitoring for decryption failures
