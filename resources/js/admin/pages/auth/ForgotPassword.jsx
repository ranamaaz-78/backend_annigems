import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Alert } from '../../components/ui';
import AuthBox from './AuthBox';

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState(null);
    const [error, setError] = useState(null);
    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const { data } = await api.post('/auth/forgot-password', { email });
            setMsg(data.message);
        } catch (err) {
            setError(fieldErrors(err).email || errorMessage(err));
        }
    };
    return (
        <AuthBox message="Forgot your password? We will email you a reset link.">
            <Alert type="success">{msg}</Alert>
            <Alert>{error}</Alert>
            <form onSubmit={submit}>
                <input type="email" className="form-control mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <div className="d-grid"><button className="btn btn-primary">Send reset link</button></div>
            </form>
            <p className="mt-3 mb-0"><Link to="/login">Back to sign in</Link></p>
        </AuthBox>
    );
}

export function ResetPassword() {
    const [params] = useSearchParams();
    const [form, setForm] = useState({ email: params.get('email') || '', password: '', password_confirmation: '' });
    const [msg, setMsg] = useState(null);
    const [errors, setErrors] = useState({});
    const submit = async (e) => {
        e.preventDefault();
        setErrors({});
        try {
            const { data } = await api.post('/auth/reset-password', { ...form, token: params.get('token') });
            setMsg(data.message);
        } catch (err) {
            setErrors({ ...fieldErrors(err), _: errorMessage(err) });
        }
    };
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    return (
        <AuthBox message="Choose a new password">
            <Alert type="success">{msg}</Alert>
            {!msg && (
                <form onSubmit={submit}>
                    {errors._ && <Alert>{errors.email || errors.password || errors._}</Alert>}
                    <input type="email" className="form-control mb-2" placeholder="Email" value={form.email} onChange={set('email')} required />
                    <input type="password" className="form-control mb-2" placeholder="New password (min 8)" value={form.password} onChange={set('password')} required />
                    <input type="password" className="form-control mb-3" placeholder="Confirm password" value={form.password_confirmation} onChange={set('password_confirmation')} required />
                    <div className="d-grid"><button className="btn btn-primary">Reset password</button></div>
                </form>
            )}
            <p className="mt-3 mb-0"><Link to="/login">Back to sign in</Link></p>
        </AuthBox>
    );
}
