const SessionAuthContext = React.createContext();

const WARNING_BEFORE_MS = 2 * 60 * 1000; // show warning 2 minutes before expiry

const SessionAuthProvider = ({ children }) => {
    // Capture before App's useState initializer calls history.replaceState and clears it.
    // useRef persists the value across re-renders without triggering effects.
    const initialError = React.useRef(new URLSearchParams(window.location.search).get('error'));

    const [authState, setAuthState] = React.useState({
        isAuthenticated: false, isLoading: true, user: null, expiresAt: null,
    });
    const [showExpiry, setShowExpiry] = React.useState(false);
    const [loggedOut, setLoggedOut] = React.useState(false);
    const [countdown, setCountdown] = React.useState(0);
    const warningTimer = React.useRef(null);
    const logoutTimer = React.useRef(null);
    const countdownTimer = React.useRef(null);

    const clearTimers = () => {
        clearTimeout(warningTimer.current);
        clearTimeout(logoutTimer.current);
        clearInterval(countdownTimer.current);
    };

    const handleSessionExpired = React.useCallback(() => {
        clearTimers();
        setShowExpiry(false);
        setAuthState(prev => ({ ...prev, isAuthenticated: false }));
        fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
            .then(r => r.json())
            .catch(() => ({}));
        setLoggedOut(true);
    }, []);

    const scheduleTimers = React.useCallback((expiresAt) => {
        clearTimers();
        if (!expiresAt) return;

        const now = Date.now();
        const msUntilExpiry = expiresAt - now;
        const msUntilWarning = msUntilExpiry - WARNING_BEFORE_MS;

        if (msUntilExpiry <= 0) {
            handleSessionExpired();
            return;
        }

        if (msUntilWarning <= 0) {
            setShowExpiry(true);
            setCountdown(Math.ceil(msUntilExpiry / 1000));
            countdownTimer.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) { clearInterval(countdownTimer.current); return 0; }
                    return prev - 1;
                });
            }, 1000);
        } else {
            warningTimer.current = setTimeout(() => {
                setShowExpiry(true);
                setCountdown(Math.ceil(WARNING_BEFORE_MS / 1000));
                countdownTimer.current = setInterval(() => {
                    setCountdown(prev => {
                        if (prev <= 1) { clearInterval(countdownTimer.current); return 0; }
                        return prev - 1;
                    });
                }, 1000);
            }, msUntilWarning);
        }

        logoutTimer.current = setTimeout(handleSessionExpired, msUntilExpiry);
    }, [handleSessionExpired]);

    React.useEffect(() => {
        // If redirected back with an auth error, skip the status check entirely —
        // the error modal will handle the next action.
        if (initialError.current) {
            setAuthState(prev => ({ ...prev, isLoading: false }));
            return clearTimers;
        }

        fetch('/auth/status', { credentials: 'same-origin' })
            .then(async r => {
                if (r.ok) {
                    const data = await r.json();
                    setAuthState({ isAuthenticated: true, isLoading: false, user: data.user, expiresAt: data.expiresAt });
                    scheduleTimers(data.expiresAt);
                } else if (r.status === 419) {
                    setAuthState(prev => ({ ...prev, isLoading: false }));
                    setLoggedOut(true);
                } else {
                    window.location.href = '/auth/login';
                }
            })
            .catch(() => { window.location.href = '/auth/login'; });

        return clearTimers;
    }, [scheduleTimers]);

    const refresh = React.useCallback(async () => {
        const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        const data = await res.json();
        if (res.ok && data.expiresAt) {
            setAuthState(prev => ({ ...prev, expiresAt: data.expiresAt }));
            setShowExpiry(false);
            scheduleTimers(data.expiresAt);
        } else {
            handleSessionExpired();
        }
    }, [scheduleTimers, handleSessionExpired]);

    const logout = React.useCallback(() => {
        clearTimers();
        fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => { window.location.href = data.endSessionUrl || '/auth/login'; })
            .catch(() => { window.location.href = '/auth/login'; });
    }, []);

    const login = React.useCallback(() => {
        window.location.href = '/auth/login';
    }, []);

    return (
        <SessionAuthContext.Provider value={{ ...authState, logout, refresh, login, showExpiry, loggedOut, countdown }}>
            {children}
        </SessionAuthContext.Provider>
    );
};

const useAuth = () => React.useContext(SessionAuthContext);
