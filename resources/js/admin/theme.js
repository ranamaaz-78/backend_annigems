// Light / dark / system theme (Metronic stores it in localStorage "kt-theme").
export function getThemeMode() {
    try {
        return localStorage.getItem('kt-theme') || 'light';
    } catch {
        return 'light';
    }
}

export function setThemeMode(mode) {
    try {
        localStorage.setItem('kt-theme', mode);
    } catch {
        // ignore
    }
    const resolved = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
}
