import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../../api';
import { Alert, Icon } from '../../components/ui';
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
        <AuthBox title="Your email" subtitle="Enter your staff email to receive a reset link">
            <Alert type="success">{msg}</Alert>
            <Alert>{error}</Alert>
            <form onSubmit={submit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <label className="kt-form-label font-normal text-mono">Email</label>
                    <input type="email" className="kt-input" placeholder="email@aanigems.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button className="kt-btn kt-btn-primary justify-center">Continue <Icon name="black-right" /></button>
            </form>
            <Link to="/login" className="kt-link text-sm mx-auto">Back to sign in</Link>
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
        <AuthBox title="Reset password" subtitle="Choose a new password (min. 8 characters)">
            <Alert type="success">{msg}</Alert>
            {!msg && (
                <form onSubmit={submit} className="flex flex-col gap-4">
                    {errors._ && <Alert>{errors.email || errors.password || errors._}</Alert>}
                    <input type="email" className="kt-input" placeholder="Email" value={form.email} onChange={set('email')} required />
                    <input type="password" className="kt-input" placeholder="New password" value={form.password} onChange={set('password')} required />
                    <input type="password" className="kt-input" placeholder="Confirm password" value={form.password_confirmation} onChange={set('password_confirmation')} required />
                    <button className="kt-btn kt-btn-primary justify-center">Reset password</button>
                </form>
            )}
            <Link to="/login" className="kt-link text-sm mx-auto">Back to sign in</Link>
        </AuthBox>
    );
}
