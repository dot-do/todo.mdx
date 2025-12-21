import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { type AccessToken, type AuthenticationResponse, WorkOS } from "@workos-inc/node";
import { Hono } from "hono";
import * as jose from "jose";
import type { Props } from "./props";
import type { Env } from "../types";
import { getPayloadClient } from "../payload";
import {
	addApprovedClient,
	bindStateToSession,
	createOAuthState,
	generateCSRFProtection,
	isClientApproved,
	OAuthError,
	renderApprovalDialog,
	validateCSRFToken,
	validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{
	Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers };
	Variables: { workOS: WorkOS };
}>();

app.use(async (c, next) => {
	// WorkOS SDK requires the API key (sk_xxx), not client secret
	c.set("workOS", new WorkOS(c.env.WORKOS_API_KEY));
	await next();
});

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	// Check if client is already approved
	if (await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
		// Skip approval dialog but still create secure state and bind to session
		const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);
		return redirectToAuthKit(c, stateToken, { "Set-Cookie": sessionBindingCookie });
	}

	// Generate CSRF protection for the approval form
	const { token: csrfToken, setCookie } = generateCSRFProtection();

	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		csrfToken,
		server: {
			name: "todo.mdx",
			description: "MCP Server for managing todos, issues, and roadmaps.",
		},
		setCookie,
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	try {
		// Read form data once
		const formData = await c.req.raw.formData();

		// Validate CSRF token
		validateCSRFToken(formData, c.req.raw);

		// Extract state from form data
		const encodedState = formData.get("state");
		if (!encodedState || typeof encodedState !== "string") {
			return c.text("Missing state in form data", 400);
		}

		let state: { oauthReqInfo?: AuthRequest };
		try {
			state = JSON.parse(atob(encodedState));
		} catch (_e) {
			return c.text("Invalid state data", 400);
		}

		if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
			return c.text("Invalid request", 400);
		}

		// Add client to approved list
		const approvedClientCookie = await addApprovedClient(
			c.req.raw,
			state.oauthReqInfo.clientId,
			c.env.COOKIE_ENCRYPTION_KEY,
		);

		// Create OAuth state and bind it to this user's session
		const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

		// Set both cookies: approved client list + session binding
		const headers = new Headers();
		headers.append("Set-Cookie", approvedClientCookie);
		headers.append("Set-Cookie", sessionBindingCookie);

		return redirectToAuthKit(c, stateToken, Object.fromEntries(headers));
	} catch (error: any) {
		console.error("POST /authorize error:", error);
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		return c.text(`Internal server error: ${error.message}`, 500);
	}
});

function redirectToAuthKit(c: any, stateToken: string, headers: Record<string, string> = {}) {
	const workOS = c.get("workOS");
	return new Response(null, {
		headers: {
			...headers,
			location: workOS.userManagement.getAuthorizationUrl({
				provider: "authkit",
				clientId: c.env.WORKOS_CLIENT_ID,
				redirectUri: new URL("/callback", c.req.url).href,
				state: stateToken,
			}),
		},
		status: 302,
	});
}

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from WorkOS AuthKit after user authentication.
 * It validates the state parameter, exchanges the temporary code for an access token,
 * then stores user metadata & the auth token as part of the 'props' on the token passed
 * down to the client.
 */
app.get("/callback", async (c) => {
	// Validate OAuth state with session binding
	let oauthReqInfo: AuthRequest;
	let clearSessionCookie: string;

	try {
		const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
		oauthReqInfo = result.oauthReqInfo;
		clearSessionCookie = result.clearCookie;
	} catch (error: any) {
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		return c.text("Internal server error", 500);
	}

	if (!oauthReqInfo.clientId) {
		return c.text("Invalid OAuth request data", 400);
	}

	// Exchange the code for an access token
	const code = c.req.query("code");
	if (!code) {
		return c.text("Missing code", 400);
	}

	const workOS = c.get("workOS");
	let response: AuthenticationResponse;
	try {
		response = await workOS.userManagement.authenticateWithCode({
			clientId: c.env.WORKOS_CLIENT_ID,
			code,
		});
	} catch (error) {
		console.error("Authentication error:", error);
		return c.text("Invalid authorization code", 400);
	}

	const { accessToken, organizationId, refreshToken, user } = response;
	const { permissions = [] } = jose.decodeJwt<AccessToken>(accessToken);

	// Ensure user exists in Payload (create or update)
	try {
		const payload = await getPayloadClient(c.env);
		const existingUser = await payload.find({
			collection: "users",
			where: { workosUserId: { equals: user.id } },
			limit: 1,
			overrideAccess: true,
		});

		if (!existingUser.docs?.length) {
			// Create new user in Payload
			await payload.create({
				collection: "users",
				data: {
					email: user.email,
					workosUserId: user.id,
					name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
					roles: ["user"],
				},
				overrideAccess: true,
			});
			console.log(`Created Payload user for WorkOS user ${user.id}`);
		} else {
			// Optionally update existing user's email/name if changed
			const payloadUser = existingUser.docs[0] as any;
			const newName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
			if (payloadUser.email !== user.email || (newName && payloadUser.name !== newName)) {
				await payload.update({
					collection: "users",
					id: payloadUser.id,
					data: {
						email: user.email,
						...(newName ? { name: newName } : {}),
					},
					overrideAccess: true,
				});
			}
		}
	} catch (error) {
		console.error("Failed to sync user to Payload:", error);
		// Continue with OAuth flow even if Payload sync fails
	}

	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		request: oauthReqInfo,
		userId: user.id,
		metadata: {},
		scope: permissions,

		// This will be available on this.props inside the MCP agent
		props: {
			accessToken,
			organizationId,
			permissions,
			refreshToken,
			user,
		} satisfies Props,
	});

	// Clear the session binding cookie (one-time use)
	const headers = new Headers({ Location: redirectTo });
	if (clearSessionCookie) {
		headers.set("Set-Cookie", clearSessionCookie);
	}

	return new Response(null, {
		status: 302,
		headers,
	});
});

export const AuthkitHandler = app;
