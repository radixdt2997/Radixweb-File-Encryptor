import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { env } from '../config/env';
import type { FileMetadata, MessageType } from '../types';
import { useAuthStore } from '../stores/authStore';
import { crypto } from '../utils/crypto';
import { downloadFile, formatDate, formatFileSize, getTimeRemaining } from '../utils/file';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

const RECIPIENT_EMAIL_REGEX = new RegExp(
    `^[a-zA-Z0-9._%+-]+@${env.email.allowedDomain.replace(/\./g, '\\.')}$`,
);

interface RecipientProps {
    fileId: string | null;
    onMessage: (text: string, type: MessageType) => void;
    onReset: () => void;
}

export const Recipient = ({ fileId, onMessage, onReset }: RecipientProps) => {
    const navigate = useNavigate();
    const userEmail = useAuthStore((s) => s.user?.email);
    const [metadata, setMetadata] = useState<FileMetadata | null>(null);
    const [otp, setOtp] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const loadedFileIdRef = useRef<string | null>(null);

    // Pre-fill email when logged in
    useEffect(() => {
        if (userEmail) setRecipientEmail(userEmail.trim().toLowerCase());
    }, [userEmail]);

    /* ────────────────────────────
     Load file metadata (once)
     ──────────────────────────── */
    const loadFileInfo = useCallback(
        async (id: string) => {
            try {
                onMessage('📂 Loading file info...', 'info');
                const data = await api.getFileMetadata(id);
                setMetadata(data);
                onMessage('Enter your email and OTP to download.', 'success');
            } catch (error) {
                loadedFileIdRef.current = null;
                const message = (error as Error).message;
                // Only pass message in state; Layout will show toast once after redirect
                navigate('/send-file', {
                    state: { flashMessage: message, flashType: 'error' as const },
                    replace: true,
                });
            }
        },
        [onMessage, navigate],
    );

    useEffect(() => {
        if (!fileId) return;
        if (loadedFileIdRef.current === fileId) return;

        loadedFileIdRef.current = fileId;
        loadFileInfo(fileId);
    }, [fileId, loadFileInfo]);

    /* ────────────────────────────
     Input handlers
     ──────────────────────────── */
    const handleOtpChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
    }, []);

    const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setRecipientEmail(e.target.value.trim().toLowerCase());
    }, []);

    /* ────────────────────────────
     Validation
     ──────────────────────────── */
    const emailError = useMemo(() => {
        if (!recipientEmail) return '';
        if (!RECIPIENT_EMAIL_REGEX.test(recipientEmail)) {
            return `Email must be @${env.email.allowedDomain}`;
        }
        return '';
    }, [recipientEmail]);

    const timeRemaining = useMemo(() => {
        if (!metadata) return '';
        return getTimeRemaining(metadata.expiryTime);
    }, [metadata]);

    /* ────────────────────────────
     Verify OTP & download
     ──────────────────────────── */
    const handleVerifyAndDownload = useCallback(async () => {
        if (!fileId || otp.length !== 6 || emailError) return;

        try {
            setLoading(true);
            onMessage('🔐 Verifying OTP...', 'info');

            const verifyData = await api.verifyOTP(fileId, otp, recipientEmail);

            const wrappedKey = Uint8Array.from(atob(verifyData.wrappedKey), (c) => c.charCodeAt(0));
            const wrappedKeySalt = Uint8Array.from(atob(verifyData.wrappedKeySalt), (c) =>
                c.charCodeAt(0),
            );

            const fileKey = await crypto.unwrapKey(wrappedKey, wrappedKeySalt, otp);

            onMessage('📥 Downloading file...', 'info');
            const encryptedData = new Uint8Array(await api.downloadFile(fileId));

            onMessage('🔓 Decrypting...', 'info');
            const decryptedData = await crypto.decryptWithKey(encryptedData, fileKey);

            downloadFile(decryptedData, verifyData.fileName);
            onMessage('File downloaded successfully!', 'success');
        } catch (error) {
            onMessage(`Failed: ${(error as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [fileId, otp, recipientEmail, emailError, onMessage]);

    /* ────────────────────────────
     Reset
     ──────────────────────────── */
    const handleReset = useCallback(() => {
        setOtp('');
        setRecipientEmail('');
        setMetadata(null);
        loadedFileIdRef.current = null;
        onReset();
    }, [onReset]);

    /* ────────────────────────────
     Render
     ──────────────────────────── */
    if (!fileId) {
        return (
            <Card title="Invalid Link">
                <p className="text-slate-300 text-sm">
                    No file ID provided. Please check your download link.
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {metadata && (
                <Card
                    title="📄 File Information"
                    subtitle={`Expires in: ${timeRemaining}`}
                    className="border-blue-600/50 bg-blue-950/20"
                >
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-slate-400">File Name</p>
                            <p className="font-medium break-all">{metadata.fileName}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Size</p>
                                <p className="text-sm font-medium text-white">
                                    {formatFileSize(metadata.fileSize)}
                                </p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded-lg">
                                <p className="text-xs text-gray-400 mb-1">Expires</p>
                                <p className="text-sm font-medium text-white">
                                    {formatDate(metadata.expiryTime)}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="🔐 Verify & Download">
                <div className="space-y-4">
                    <Input
                        type="email"
                        label="Your Email"
                        value={recipientEmail}
                        onChange={handleEmailChange}
                        error={emailError}
                        placeholder={`name@${env.email.allowedDomain}`}
                        fullWidth
                        disabled={!!userEmail}
                    />

                    <Input
                        type="text"
                        label="6-Digit OTP"
                        value={otp}
                        onChange={handleOtpChange}
                        placeholder="000000"
                        maxLength={6}
                        error={otp && otp.length < 6 ? 'OTP must be 6 digits' : ''}
                        hint={`${otp.length}/6 digits entered`}
                        fullWidth
                    />

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleVerifyAndDownload}
                            disabled={otp.length !== 6 || !!emailError || loading}
                            isLoading={loading}
                            variant="success"
                            fullWidth
                        >
                            Verify & Download
                        </Button>

                        <Button onClick={handleReset} variant="secondary" fullWidth>
                            Reset
                        </Button>
                    </div>
                </div>
            </Card>

            <Card className="bg-blue-900/30 border-blue-700">
                <p className="text-xs text-blue-200">
                    All decryption happens in your browser. We never access your files or OTP.
                </p>
            </Card>
        </div>
    );
};
