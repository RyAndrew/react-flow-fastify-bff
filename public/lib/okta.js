const FACTOR_PAYLOAD_TEMPLATES = {
    'sms':                  (f) => ({ factorType: f.factorType, provider: f.provider, profile: { phoneNumber: '+1-555-555-0100' } }),
    'call':                 (f) => ({ factorType: f.factorType, provider: f.provider, profile: { phoneNumber: '+1-555-555-0100' } }),
    'email':                (f) => ({ factorType: f.factorType, provider: f.provider, profile: { email: 'user@example.com' } }),
    'token:software:totp':  (f) => ({ factorType: f.factorType, provider: f.provider }),
    'push':                 (f) => ({ factorType: f.factorType, provider: f.provider }),
    'question':             (f) => ({ factorType: f.factorType, provider: f.provider, profile: { question: 'dispirated_food', answer: 'pizza' } }),
    'webauthn':             (f) => ({ factorType: f.factorType, provider: f.provider }),
    'u2f':                  (f) => ({ factorType: f.factorType, provider: f.provider }),
    'token:hotp':           (f) => ({ factorType: f.factorType, provider: f.provider }),
};

const buildFactorPayload = (factor) => {
    const tmpl = FACTOR_PAYLOAD_TEMPLATES[factor.factorType];
    if (tmpl) return tmpl(factor);
    return { factorType: factor.factorType, provider: factor.provider };
};

const factorDisplayName = (f) => {
    const labels = {
        'sms': 'SMS', 'call': 'Voice Call', 'email': 'Email',
        'token:software:totp': 'TOTP (Authenticator App)', 'push': 'Okta Verify Push',
        'question': 'Security Question', 'webauthn': 'WebAuthn (FIDO2)',
        'u2f': 'U2F', 'token:hotp': 'HOTP Token',
    };
    return `${labels[f.factorType] || f.factorType} — ${f.provider}`;
};

const LIFECYCLE_ACTIONS = [
    { action: 'suspend', label: 'Suspend', color: 'warning' },
    { action: 'unsuspend', label: 'Unsuspend', color: 'info' },
    { action: 'activate', label: 'Activate', color: 'success' },
    { action: 'reactivate', label: 'Reactivate', color: 'success' },
    { action: 'unlock', label: 'Unlock', color: 'info' },
    { action: 'reset_password', label: 'Reset Password', color: 'warning' },
    { action: 'expire_password', label: 'Expire Password', color: 'warning' },
    { action: 'reset_factors', label: 'Reset Factors', color: 'secondary' },
];
