import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert } from '../../components/ui';
import AuthBox from './AuthBox';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        <AuthBox message="Sign in to start your session">
            <Alert>{error}</Alert>
            <form onSubmit={submit}>
                <div className="input-group mb-1">
                    <div className="form-floating">
                        <input id="loginEmail" type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" required autoFocus />
                        <label htmlFor="loginEmail">Email</label>
                    </div>
                    <div className="input-group-text"><span className="bi bi-envelope" /></div>
                </div>
                {errors.email && <div className="text-danger small mb-2">{errors.email}</div>}
                <div className="input-group mb-3 mt-2">
                    <div className="form-floating">
                        <input id="loginPassword" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="" required />
                        <label htmlFor="loginPassword">Password</label>
                    </div>
                    <div className="input-group-text"><span className="bi bi-lock-fill" /></div>
                </div>
                <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
                </div>
            </form>
            <p className="mb-0 mt-3"><Link to="/forgot-password">I forgot my password</Link></p>
        </AuthBox>
    );
}
