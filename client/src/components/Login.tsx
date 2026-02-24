/**
 * Login (and optional register) form. Phase 6.
 * Shown when user tries to access Send or Transactions without being logged in.
 */

import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { env } from '../config/env';
import { useAuthStore } from '../stores/authStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

interface LoginProps {
    onMessage: (text: string, type: 'info' | 'success' | 'error') => void;
}

export function Login({ onMessage }: LoginProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const returnUrl = searchParams.get('returnUrl');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);

    const setAuth = useAuthStore((s) => s.setAuth);

    const handleSubmit = useCallback(
        async (e: React.SubmitEvent) => {
            e.preventDefault();
            if (!email.trim() || !password) {
                onMessage('Enter email and password', 'error');
                return;
            }
            setLoading(true);
            try {
                const res = isRegister
                    ? await api.register(email.trim().toLowerCase(), password)
                    : await api.login(email.trim().toLowerCase(), password);
                setAuth(res.token, res.user);
                onMessage(isRegister ? 'Account created. Welcome!' : 'Logged in.', 'success');
                const target = returnUrl ? decodeURIComponent(returnUrl) : '/send-file';
                navigate(target, { replace: true });
            } catch (err) {
                onMessage((err as Error).message, 'error');
            } finally {
                setLoading(false);
            }
        },
        [email, password, isRegister, setAuth, onMessage, returnUrl, navigate],
    );

    return (
        <Card
            title="Log in to send files"
            subtitle={`Use your @${env.email.allowedDomain} email`}
            className="max-w-md mx-auto"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`you@${env.email.allowedDomain}`}
                    fullWidth
                    required
                />
                <Input
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? 'Min 8 characters' : 'Password'}
                    minLength={isRegister ? 8 : undefined}
                    fullWidth
                    required
                />
                <div className="flex gap-3 pt-2">
                    <Button
                        type="submit"
                        variant="success"
                        fullWidth
                        isLoading={loading}
                        disabled={loading}
                    >
                        {isRegister ? 'Create account' : 'Log in'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => setIsRegister((r) => !r)}
                        disabled={loading}
                    >
                        {isRegister ? 'Log in instead' : 'Register'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
