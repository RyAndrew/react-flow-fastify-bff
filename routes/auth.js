export default async function authRoutes(fastify) {
  const { oidc, appConfig } = fastify;
  const { config: oidcConfig, client } = oidc;

  const callbackUrl = `${appConfig.APP_URL}/api/v1/auth/callback`;

  // Redirect to Okta authorize endpoint
  fastify.get('/login', async (request, reply) => {
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    request.session.codeVerifier = codeVerifier;
    request.session.state = state;

    const redirectTo = client.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: callbackUrl,
      scope: 'openid profile email offline_access',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    return reply.redirect(redirectTo.href);
  });

  // Handle Okta OAuth callback
  fastify.get('/callback', async (request, reply) => {
    const codeVerifier = request.session.codeVerifier;
    const expectedState = request.session.state;

    if (!codeVerifier) {
      fastify.log.error('No code_verifier found in session');
      return reply.status(400).send({ error: 'Invalid authentication state' });
    }

    const currentUrl = new URL(request.url, appConfig.APP_URL);

    let tokens;
    try {
      tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: client.skipNonceCheck,
        expectedState,
      });
    } catch (err) {
      fastify.log.error(err, 'OAuth token exchange failed');
      return reply.status(500).send({ error: 'Authentication failed' });
    }

    const claims = tokens.claims();

    // Store tokens server-side in session — never sent to browser
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    request.session.tokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      expires_in: tokens.expires_in,
      expires_at: expiresAt,
    };

    // User profile from ID token claims (no extra userinfo call needed)
    request.session.user = {
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
    };

    delete request.session.codeVerifier;
    delete request.session.state;

    return reply.redirect('/');
  });

  // Return current auth status (no tokens exposed)
  // 200 = authenticated, 401 = no session, 419 = session expired
  fastify.get('/status', async (request, reply) => {
    const user = request.session?.user || null;
    const expiresAt = request.session?.tokens?.expires_at || null;

    // Access token expired — destroy session, signal expired
    if (expiresAt && Date.now() >= expiresAt) {
      await new Promise((resolve, reject) => {
        request.session.destroy((err) => { if (err) reject(err); else resolve(); });
      });
      return reply.status(419).send({ error: 'Session expired' });
    }

    // No session at all
    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return { user, expiresAt };
  });

  // Refresh access token using the refresh token
  fastify.post('/refresh', async (request, reply) => {
    const sessionTokens = request.session?.tokens;

    if (!sessionTokens?.refresh_token) {
      return reply.status(401).send({ error: 'No refresh token available' });
    }

    let tokens;
    try {
      tokens = await client.refreshTokenGrant(oidcConfig, sessionTokens.refresh_token);
    } catch (err) {
      fastify.log.error(err, 'Token refresh failed');
      // Refresh token is invalid/expired — destroy session
      await new Promise((resolve, reject) => {
        request.session.destroy((err) => { if (err) reject(err); else resolve(); });
      });
      return reply.status(401).send({ error: 'Token refresh failed' });
    }

    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    request.session.tokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || sessionTokens.refresh_token,
      id_token: tokens.id_token || sessionTokens.id_token,
      expires_in: tokens.expires_in,
      expires_at: expiresAt,
    };

    return { ok: true, expiresAt };
  });

  // Destroy session and revoke tokens
  fastify.post('/logout', async (request, reply) => {
    const sessionTokens = request.session?.tokens;

    if (sessionTokens?.access_token) {
      try {
        await client.tokenRevocation(oidcConfig, sessionTokens.access_token);
      } catch (err) {
        fastify.log.warn(err, 'Token revocation failed');
      }
    }

    await new Promise((resolve, reject) => {
      request.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return { ok: true };
  });
}
