import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Icon } from '../../components/ui';
import AuthBox from './AuthBox';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [errors, setErrors] = useState({});
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErrors({});
        setError(null);
        try {
            await login(email, password);
        } catch (err) {
            setErrors(fieldErrors(err));
            if (!err.response?.data?.errors) setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthBox title="Sign in" subtitle="Staff access to the AANI GEMAS admin panel">
            <Alert>{error}</Alert>
            <form onSubmit={submit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <label className="kt-form-label font-normal text-mono" htmlFor="loginEmail">Email</label>
                    <input id="loginEmail" type="email" className="kt-input" aria-invalid={errors.email ? 'true' : undefined} placeholder="email@aanigems.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    {errors.email && <span className="text-xs text-destructive">{errors.email}</span>}
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                        <label className="kt-form-label font-normal text-mono" htmlFor="loginPassword">Password</label>
                        <Link to="/forgot-password" className="text-sm kt-link shrink-0">Forgot Password?</Link>
                    </div>
                    <div className="kt-input">
                        <input id="loginPassword" type={show ? 'text' : 'password'} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        <button type="button" className="kt-btn kt-btn-sm kt-btn-ghost kt-btn-icon bg-transparent! -me-1.5" onClick={() => setShow(!show)} aria-label="Toggle password">
                            <Icon name={show ? 'eye-slash' : 'eye'} className="text-muted-foreground" />
                        </button>
                    </div>
                </div>
                <button type="submit" className="kt-btn kt-btn-primary flex justify-center grow" disabled={busy}>
                    {busy ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Signing in…</> : 'Sign In'}
                </button>
            </form>
        </AuthBox>
    );
}
