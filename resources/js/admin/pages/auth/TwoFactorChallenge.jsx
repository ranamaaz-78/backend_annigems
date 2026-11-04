import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert } from '../../components/ui';
import AuthBox from './AuthBox';

export default function TwoFactorChallenge() {
    const { setUser, logout } = useAuth();
    const [recovery, setRecovery] = useState(false);
    const [value, setValue] = useState('');
    const [error, setError] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const { data } = await api.post('/auth/two-factor/challenge', recovery ? { recovery_code: value } : { code: value });
            setUser(data.data);
        } catch (err) {
            const fe = fieldErrors(err);
            setError(fe.code || fe.recovery_code || errorMessage(err));
        }
    };

    return (
        <AuthBox message={recovery ? 'Enter one of your recovery codes' : 'Enter the code from your authenticator app'}>
            <Alert>{error}</Alert>
            <form onSubmit={submit}>
                <input className="form-control form-control-lg text-center mb-3" value={value} onChange={(e) => setValue(e.target.value)} autoFocus
                    {...(recovery ? { placeholder: 'xxxxx-xxxxx' } : { inputMode: 'numeric', maxLength: 6, placeholder: '123456', autoComplete: 'one-time-code' })} />
                <div className="d-grid"><button className="btn btn-primary">Verify</button></div>
            </form>
            <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-link btn-sm p-0" onClick={() => { setRecovery(!recovery); setValue(''); setError(null); }}>
                    {recovery ? 'Use authenticator code' : 'Use a recovery code'}
                </button>
                <button className="btn btn-link btn-sm p-0" onClick={logout}>Sign out</button>
            </div>
        </AuthBox>
    );
}
