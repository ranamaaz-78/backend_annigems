import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Spinner } from '../../components/ui';
import AuthBox from './AuthBox';

/** Forced on first login: no other screen is reachable until TOTP is confirmed. */
export default function TwoFactorSetup() {
    const { setUser, logout } = useAuth();
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    const [codes, setCodes] = useState(null);
    const [pendingUser, setPendingUser] = useState(null);

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
            <AuthBox message="Save your recovery codes" wide>
                <p className="small">Each code works once if you lose access to your authenticator app. Store them somewhere safe; they will not be shown again.</p>
                <pre className="bg-body-tertiary p-3 rounded text-center">{codes.join('\n')}</pre>
                <div className="d-grid gap-2">
                    <button className="btn btn-outline-secondary" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}><i className="bi bi-clipboard" /> Copy</button>
                    <button className="btn btn-primary" onClick={() => setUser(pendingUser)}>I saved them, continue</button>
                </div>
            </AuthBox>
        );
    }

    return (
        <AuthBox message="Two-factor authentication is required" wide>
            <p className="small">Scan this QR code with Google Authenticator, 1Password, Authy or a similar app, then enter the 6-digit code.</p>
            <Alert>{error}</Alert>
            {!setup && !error && <Spinner />}
            {setup && (
                <>
                    <div className="text-center mb-2 bg-white p-2 rounded" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} />
                    <p className="small text-center text-break">Key: <code>{setup.secret}</code></p>
                    <form onSubmit={confirm}>
                        <input className="form-control form-control-lg text-center mb-3" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
                        <div className="d-grid"><button className="btn btn-primary">Confirm & enable</button></div>
                    </form>
                </>
            )}
            <p className="mt-3 mb-0 text-center"><button className="btn btn-link btn-sm" onClick={logout}>Sign out</button></p>
        </AuthBox>
    );
}
