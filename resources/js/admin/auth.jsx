import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get('/auth/me');
            setUser(data.data);
            return data.data;
        } catch {
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        refresh();
        const onAuth = () => refresh();
        window.addEventListener('admin:auth', onAuth);
        return () => window.removeEventListener('admin:auth', onAuth);
    }, [refresh]);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        setUser(data.data);
        return data.data;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } finally {
            setUser(null);
        }
    };

    const can = useCallback(
        (perm) => {
            if (!user) return false;
            if (user.permissions.includes('*')) return true;
            if (!perm) return true;
            return [].concat(perm).some((p) => user.permissions.includes(p));
        },
        [user],
    );

    useIdleLogout(user, logout);

    return <AuthContext.Provider value={{ user, setUser, refresh, login, logout, can }}>{children}</AuthContext.Provider>;
}

/** Client-side idle timeout (the server enforces the same limit). */
function useIdleLogout(user, logout) {
    const timer = useRef();
    useEffect(() => {
        if (!user?.two_factor?.passed) return undefined;
        const minutes = user.idle_timeout_minutes || 30;
        const reset = () => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => logout(), minutes * 60 * 1000);
        };
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
        reset();
        return () => {
            clearTimeout(timer.current);
            events.forEach((e) => window.removeEventListener(e, reset));
        };
    }, [user, logout]);
}

export function useAuth() {
    return useContext(AuthContext);
}

export function Can({ perm, children, fallback = null }) {
    const { can } = useAuth();
    return can(perm) ? children : fallback;
}
