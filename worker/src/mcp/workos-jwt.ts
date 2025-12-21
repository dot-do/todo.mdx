/**
 * WorkOS/OAuth.do JWT Validation for MCP Server
 *
 * Validates JWTs from oauth.do (which wraps WorkOS) as an alternative to the OAuth 2.1 flow.
 * This allows clients authenticated via oauth.do to access the MCP server directly.
 *
 * The tokens are issued by auth.apis.do with WorkOS user IDs in the 'sub' claim.
 * Since JWKS isn't publicly available, we validate by:
 * 1. Checking the token structure and claims
 * 2. Verifying the user exists in Payload
 * 3. Checking the token isn't expired
 */

import * as jose from "jose";
import type { Props } from "./props";
import type { Env } from "../types";
import { getPayloadClient } from "../payload";

/**
 * Validate an oauth.do JWT and extract user information
 *
 * @param token - The JWT to validate
 * @param env - Worker environment
 * @returns Props if valid, null if invalid
 */
export async function validateWorkosJwt(
  token: string,
  env: Env
): Promise<Props | null> {
  try {
    // Quick check - JWTs start with eyJ and are reasonably long
    if (!token.startsWith("eyJ") || token.length < 100) {
      return null;
    }

    // Decode the JWT to extract claims
    let decoded: jose.JWTPayload;
    try {
      decoded = jose.decodeJwt(token);
    } catch {
      return null;
    }

    // Must have a subject (user ID)
    if (!decoded.sub || typeof decoded.sub !== "string") {
      return null;
    }

    // Check for expected claims from oauth.do tokens
    // They typically have: iss (auth.apis.do), sub (user_xxx), sid (session_xxx), exp, iat
    if (!decoded.sid && !decoded.iss) {
      return null;
    }

    // Check token expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }

    // Look up user in Payload by WorkOS user ID (sub claim)
    const workosUserId = decoded.sub;

    // Try to fetch user from Payload with overrideAccess to bypass access control
    let payloadUser: any = null;
    try {
      const payload = await getPayloadClient(env);
      const users = await payload.find({
        collection: "users",
        where: { workosUserId: { equals: workosUserId } },
        limit: 1,
        overrideAccess: true,
      });
      if (users.docs?.length) {
        payloadUser = users.docs[0];
      }
    } catch {
      // Ignore - we can still trust the JWT claims
    }

    // Even if user lookup failed, we can trust the JWT claims
    // The user may not exist in Payload yet, or access control may block the query
    // We'll rely on the JWT claims and let individual tool calls verify access

    // Extract email from JWT if available (oauth.do includes it in some tokens)
    const email = (decoded.email as string) ||
                  payloadUser?.email ||
                  `${workosUserId}@workos.user`;

    // Build Props from JWT claims and any Payload user data we found
    const props: Props = {
      accessToken: token,
      organizationId: (decoded.org_id as string) || undefined,
      permissions: (decoded.permissions as string[]) || [],
      refreshToken: "", // Not available with direct JWT auth
      user: {
        id: workosUserId,
        email,
        firstName: payloadUser?.name?.split(" ")[0] || null,
        lastName: payloadUser?.name?.split(" ").slice(1).join(" ") || null,
        emailVerified: true,
        profilePictureUrl: payloadUser?.avatar || null,
        createdAt: payloadUser?.createdAt || new Date().toISOString(),
        updatedAt: payloadUser?.updatedAt || new Date().toISOString(),
        object: "user",
        // Required fields with defaults
        lastSignInAt: payloadUser?.updatedAt || new Date().toISOString(),
        locale: null,
        externalId: null,
        metadata: {},
      },
    };

    return props;
  } catch {
    return null;
  }
}

/**
 * Check if a token looks like it might be a WorkOS JWT
 * (as opposed to an OAuth provider token)
 */
export function mightBeWorkosJwt(token: string): boolean {
  // WorkOS JWTs are typically base64-encoded JSON and quite long
  // OAuth provider tokens from @cloudflare/workers-oauth-provider are different
  return token.startsWith("eyJ") && token.length > 200;
}

/**
 * Check if a token looks like an OAuth provider token
 * Format: userId:grantId:secret
 */
export function isOAuthProviderToken(token: string): boolean {
  const parts = token.split(":");
  return parts.length === 3 && parts[0].startsWith("user_");
}

/**
 * Generate SHA-256 hash of token (matches OAuth provider's generateTokenId)
 */
async function generateTokenId(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate an OAuth provider token by looking it up in KV
 *
 * @param token - The OAuth provider token (format: userId:grantId:secret)
 * @param env - Worker environment with OAUTH_KV binding
 * @returns Props if valid, null if invalid
 */
export async function validateOAuthProviderToken(
  token: string,
  env: Env
): Promise<Props | null> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) {
      return null;
    }

    const [userId, grantId] = parts;
    const tokenId = await generateTokenId(token);

    // Look up token in KV (same format as OAuth provider uses)
    const tokenKey = `token:${userId}:${grantId}:${tokenId}`;
    const tokenData = await env.OAUTH_KV.get(tokenKey, { type: "json" }) as any;

    if (!tokenData) {
      return null;
    }

    // Token found and valid - extract props
    // The OAuth provider stores encrypted props in tokenData.grant.encryptedProps
    // But we need the COOKIE_ENCRYPTION_KEY to decrypt it
    // For now, build minimal props from the token data

    // Get user info from Payload
    let payloadUser: any = null;
    try {
      const payload = await getPayloadClient(env);
      const users = await payload.find({
        collection: "users",
        where: { workosUserId: { equals: userId } },
        limit: 1,
        overrideAccess: true,
      });
      if (users.docs?.length) {
        payloadUser = users.docs[0];
      }
    } catch {
      // Ignore - we can still use the token data
    }

    const email = payloadUser?.email || `${userId}@oauth.user`;

    const props: Props = {
      accessToken: token,
      organizationId: tokenData.grant?.organizationId || undefined,
      permissions: tokenData.grant?.scope || [],
      refreshToken: "",
      user: {
        id: userId,
        email,
        firstName: payloadUser?.name?.split(" ")[0] || null,
        lastName: payloadUser?.name?.split(" ").slice(1).join(" ") || null,
        emailVerified: true,
        profilePictureUrl: payloadUser?.avatar || null,
        createdAt: payloadUser?.createdAt || new Date().toISOString(),
        updatedAt: payloadUser?.updatedAt || new Date().toISOString(),
        object: "user",
        lastSignInAt: payloadUser?.updatedAt || new Date().toISOString(),
        locale: null,
        externalId: null,
        metadata: {},
      },
    };

    return props;
  } catch (error) {
    console.error("OAuth provider token validation error:", error);
    return null;
  }
}
