import axios from 'axios';

// CSRF: axios sends the XSRF-TOKEN cookie back as X-XSRF-TOKEN on every request.
// (Not the <meta> token: it goes stale when the session is regenerated at login.)
const api = axios.create({
    baseURL: '/api/v1/admin',
    withCredentials: true,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    withXSRFToken: true,
});

// Broadcast auth state problems so the AuthProvider can react (expired session, 2FA needed).
api.interceptors.response.use(
    (r) => r,
    (error) => {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        if (status === 401 || (status === 403 && code?.startsWith('two_factor'))) {
            window.dispatchEvent(new CustomEvent('admin:auth', { detail: { status, code } }));
        }
        if (status === 419) {
            window.location.reload();
        }
        return Promise.reject(error);
    },
);

export function errorMessage(err, fallback = 'Something went wrong.') {
    return err?.response?.data?.message || fallback;
}

export function fieldErrors(err) {
    const errors = err?.response?.data?.errors || {};
    return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/** Trigger a file download from an authenticated GET (CSV exports). */
export async function download(url, params, filename) {
    const res = await api.get(url, { params, responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
}

export default api;
