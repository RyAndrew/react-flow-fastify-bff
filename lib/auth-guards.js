/**
 * Requires a valid access token in the session.
 * Used by routes that proxy to the downstream Okta API.
 */
export async function requireAccessToken(request, reply) {
  if (!request.session?.tokens?.access_token) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }
}

/**
 * Requires an authenticated session (user present).
 * Used by routes that only need to know who is logged in, not a live token.
 */
export async function requireSession(request, reply) {
  if (!request.session?.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }
}
