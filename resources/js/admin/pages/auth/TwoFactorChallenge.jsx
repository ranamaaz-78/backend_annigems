import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Icon } from '../../components/ui';
import AuthBox from './AuthBox';

export default function TwoFactorChallenge() {
    const { setUser, logout } = useAuth();
    const [recovery, setRecovery] = useState(false);
    const [value, setValue] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const { data } = await api.post('/auth/two-factor/challenge', recovery ? { recovery_code: value } : { code: value });
            setUser(data.data);
        } catch (err) {
            const fe = fieldErrors(err);
            setError(fe.code || fe.recovery_code || errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthBox title="Verify your sign-in" subtitle={recovery ? 'Enter one of your recovery codes' : 'Enter the 6-digit code from your authenticator app'}>
            <div className="flex justify-center"><span className="flex items-center justify-center size-14 rounded-full bg-primary/10 border border-primary/20"><Icon name="shield-tick" className="text-3xl text-primary" /></span></div>
            <Alert>{error}</Alert>
            <form onSubmit={submit} className="flex flex-col gap-4">
                <input
                    className={`kt-input kt-input-lg text-center font-semibold ${recovery ? '' : 'tracking-[.5em]'}`}
                    value={value}
                    onChange={(e) => setValue(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    {...(recovery ? { placeholder: 'xxxxx-xxxxx' } : { inputMode: 'numeric', maxLength: 6, placeholder: '000000', autoComplete: 'one-time-code' })}
                />
                <button className="kt-btn kt-btn-primary justify-center" disabled={busy || !value}>{busy ? 'Verifying…' : 'Verify'}</button>
            </form>
            <div className="flex justify-between text-sm">
                <button type="button" className="kt-link" onClick={() => { setRecovery(!recovery); setValue(''); setError(null); }}>
                    {recovery ? 'Use authenticator code' : 'Use a recovery code'}
                </button>
                <button type="button" className="kt-link" onClick={logout}>Sign out</button>
            </div>
        </AuthBox>
    );
}
