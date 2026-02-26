import { useEffect, useRef } from 'react';
import {
    Link,
    NavLink,
    Navigate,
    Outlet,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useSearchParams,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import { api, setAuthErrorHandler } from './api/client';
import { Legacy } from './components/Legacy';
import { Login } from './components/Login';
import { Recipient } from './components/Recipient';
import { Sender } from './components/Sender';
import { Transactions } from './components/Transactions';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { RequireAuth } from './RequireAuth';
import { useAuthStore } from './stores/authStore';
import { UserRole } from './types';
import { cn } from './utils/tailwind';
import { showMessage } from './utils/toast';

const navItems = [
    { path: '/send-file', label: 'Send File', icon: '📤' },
    {
        path: '/receive-file',
        label: 'Receive File',
        icon: '📥',
        title: 'Access via email link',
    },
    { path: '/my-transactions', label: 'My Transactions', icon: '📋' },
    { path: '/legacy', label: 'Legacy Mode', icon: '🔑' },
];

function RootRedirect() {
    const [searchParams] = useSearchParams();
    const fileId = searchParams.get('fileId');
    if (fileId) {
        return <Navigate to={`/receive-file?fileId=${fileId}`} replace />;
    }
    return <Navigate to="/send-file" replace />;
}

function LoginPage() {
    return <Login onMessage={showMessage} />;
}

function SendFilePage() {
    const [searchParams] = useSearchParams();
    const fileId = searchParams.get('fileId');
    return (
        <Sender
            onMessage={showMessage}
            initialFileId={fileId && fileId.trim() ? fileId : undefined}
        />
    );
}

function LegacyPage() {
    return <Legacy onMessage={showMessage} />;
}

function ReceiveFilePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const fileId = searchParams.get('fileId');

    if (!fileId) {
        return (
            <Card title="Receive File" subtitle="Open the link from your email">
                <p className="text-gray-400 text-sm mb-4">
                    To download a file, use the download link sent to your email. You will need the
                    link and the OTP code from the separate email.
                </p>
                <Link to="/send-file" className="text-blue-400 hover:underline text-sm">
                    Go to Send File
                </Link>
            </Card>
        );
    }

    const handleReset = () => {
        showMessage('Reset complete', 'info');
        navigate('/send-file', { replace: true });
    };

    return <Recipient fileId={fileId} onMessage={showMessage} onReset={handleReset} />;
}

interface FlashState {
    flashMessage?: string;
    flashType?: 'info' | 'success' | 'error';
}

function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const rehydratedRef = useRef(false);

    useEffect(() => {
        const state = location.state as FlashState | undefined;
        if (state?.flashMessage && state?.flashType) {
            showMessage(state.flashMessage, state.flashType);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate]);

    // Mount: register global 401 handler and rehydrate user from token
    useEffect(() => {
        setAuthErrorHandler(() => {
            useAuthStore.getState().logout();
            showMessage('Session expired', 'info');
        });

        if (rehydratedRef.current) return;
        const t = useAuthStore.getState().token;
        if (!t) return;
        rehydratedRef.current = true;
        api.getMe(t)
            .then((res) => {
                useAuthStore.getState().setUser(res.user);
            })
            .catch(() => {
                useAuthStore.getState().logout();
            });
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
            <header className="border-b border-gray-700 backdrop-blur-md bg-slate-900/50 sticky top-0 z-40 shrink-0">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to="/" className="flex items-center gap-3">
                                <div className="text-3xl">🔒</div>
                                <div>
                                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                        Secure File App
                                    </h1>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Zero-knowledge encrypted file sharing
                                    </p>
                                </div>
                            </Link>
                        </div>
                        {user && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400">
                                    {user.email}
                                    {user.role === UserRole.Admin && (
                                        <span className="ml-2 text-cyan-400">Admin</span>
                                    )}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        logout();
                                        showMessage('Logged out', 'info');
                                    }}
                                    className="text-sm text-gray-400 hover:text-white"
                                >
                                    Log out
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <Toaster
                position="bottom-right"
                richColors
                closeButton
                theme="dark"
                toastOptions={{
                    className: 'font-medium',
                }}
            />

            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
                <nav className="flex flex-wrap gap-2 mb-8 p-1 bg-gray-800/50 rounded-lg border border-gray-700 justify-evenly">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={item.title}
                            className={({ isActive }) =>
                                cn(
                                    'px-4 py-2.5 rounded-md font-medium transition-all duration-200 flex items-center gap-2 text-sm',
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50',
                                )
                            }
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="animate-in fade-in duration-300 pt-2">
                    <Outlet />
                </div>
            </main>

            <footer className="shrink-0 border-t border-gray-700 bg-slate-900/50 mt-auto py-6">
                <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
                    <p>
                        🔐 All encryption happens client-side. Your files are never stored
                        unencrypted.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<RootRedirect />} />
                <Route path="login" element={<LoginPage />} />
                <Route element={<RequireAuth />}>
                    <Route path="send-file" element={<SendFilePage />} />
                    <Route path="my-transactions" element={<Transactions />} />
                </Route>
                <Route path="receive-file" element={<ReceiveFilePage />} />
                <Route path="legacy" element={<LegacyPage />} />
            </Route>
        </Routes>
    );
}

export default App;
