import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Icon, Spinner } from '../../components/ui';
import AuthBox from './AuthBox';

/** Forced on first login: no other screen is reachable until TOTP is confirmed. */
export default function TwoFactorSetup() {
    const { setUser, logout } = useAuth();
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    const [codes, setCodes] = useState(null);
    const [pendingUser, setPendingUser] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.post('/auth/two-factor/setup').then(({ data }) => setSetup(data.data)).catch((e) => setError(errorMessage(e)));
    }, []);

    const confirm = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const { data } = await api.post('/auth/two-factor/confirm', { code });
            setCodes(data.recovery_codes);
            setPendingUser(data.data);
        } catch (err) {
            setError(fieldErrors(err).code || errorMessage(err));
        }
    };

    if (codes) {
        return (
            <AuthBox title="Save your recovery codes" subtitle="Each code works once if you lose your authenticator. They will not be shown again." wide>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm text-mono text-center">
                    {codes.map((c) => <span key={c}>{c}</span>)}
                </div>
                <button type="button" className="kt-btn kt-btn-outline justify-center" onClick={() => { navigator.clipboard?.writeText(codes.join('\n')); setCopied(true); }}>
                    <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy codes'}
                </button>
                <button type="button" className="kt-btn kt-btn-primary justify-center" onClick={() => setUser(pendingUser)}>I saved them, continue</button>
            </AuthBox>
        );
    }

    return (
        <AuthBox title="Set up two-factor authentication" subtitle="Required for every staff account" wide>
            <div className="text-sm text-secondary-foreground text-center">Scan the QR code with Google Authenticator, 1Password, Authy or a similar app, then enter the 6-digit code.</div>
            <Alert>{error}</Alert>
            {!setup && !error && <Spinner />}
            {setup && (
                <form onSubmit={confirm} className="flex flex-col gap-4">
                    <div className="mx-auto rounded-xl border border-border bg-white p-3" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
                    <div className="text-xs text-center text-secondary-foreground break-all">Key: <code className="text-mono">{setup.secret}</code></div>
                    <input className="kt-input kt-input-lg text-center tracking-[.5em] font-semibold" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
                    <button className="kt-btn kt-btn-primary justify-center" disabled={code.length !== 6}>Confirm & enable</button>
                </form>
            )}
            <button type="button" className="kt-link text-sm mx-auto" onClick={logout}>Sign out</button>
        </AuthBox>
    );
}
