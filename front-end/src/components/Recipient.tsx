import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { env } from "../config/env";
import type { FileMetadata, RecipientState } from "../types";
import { crypto } from "../utils/crypto";
import {
  downloadFile,
  formatDate,
  formatFileSize,
  getTimeRemaining,
} from "../utils/file";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

const RECIPIENT_EMAIL_REGEX = new RegExp(
  `^[a-zA-Z0-9._%+-]+@${env.email.allowedDomain.replace(/\./g, "\\.")}$`,
);

interface RecipientProps {
  fileId: string | null;
  onMessage: (text: string, type: "info" | "success" | "error") => void;
}

export const Recipient = ({ fileId, onMessage }: RecipientProps) => {
  const [state, setState] = useState<RecipientState>({ fileId, loaded: false });
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  useEffect(() => {
    if (fileId && !state.loaded) {
      loadFileInfo(fileId);
    }
  }, [fileId, state.loaded]);

  const loadFileInfo = useCallback(
    async (id: string) => {
      if (state.loaded) return;
      setState((prev) => ({ ...prev, loaded: true }));

      try {
        onMessage("📂 Loading file info...", "info");
        const data = await api.getFileMetadata(id);
        setMetadata(data);
        onMessage("✓ Ready. Enter OTP to download.", "success");
      } catch (error) {
        onMessage(`✕ Load failed: ${(error as Error).message}`, "error");
        setState((prev) => ({ ...prev, loaded: false }));
      }
    },
    [state.loaded, onMessage],
  );

  const handleOtpChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "").slice(0, 6);
      setOtp(value);
    },
    [],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRecipientEmail(e.target.value.trim());
    },
    [],
  );

  const emailError = useMemo(() => {
    if (!recipientEmail) return "";
    if (!RECIPIENT_EMAIL_REGEX.test(recipientEmail)) {
      return `Email must be @${env.email.allowedDomain}`;
    }
    return "";
  }, [recipientEmail]);

  const handleVerifyAndDownload = useCallback(async () => {
    if (!fileId || otp.length !== 6 || emailError) return;

    try {
      setLoading(true);
      onMessage("🔐 Verifying OTP...", "info");

      const verifyData = await api.verifyOTP(
        fileId,
        otp,
        recipientEmail || undefined,
      );

      const wrappedKey = new Uint8Array(
        atob(verifyData.wrappedKey)
          .split("")
          .map((c) => c.charCodeAt(0)),
      );
      const wrappedKeySalt = new Uint8Array(
        atob(verifyData.wrappedKeySalt)
          .split("")
          .map((c) => c.charCodeAt(0)),
      );
      const fileKey = await crypto.unwrapKey(wrappedKey, wrappedKeySalt, otp);

      onMessage("📥 Downloading file...", "info");
      const encryptedData = new Uint8Array(await api.downloadFile(fileId));

      onMessage("🔓 Decrypting...", "info");
      const decryptedData = await crypto.decryptWithKey(encryptedData, fileKey);

      downloadFile(decryptedData, verifyData.fileName);
      onMessage("File downloaded successfully!", "success");
    } catch (error) {
      onMessage(`Failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [fileId, otp, recipientEmail, emailError, onMessage]);

  const handleReset = useCallback(() => {
    setOtp("");
    setRecipientEmail("");
    setMetadata(null);
    setState({ fileId: state.fileId, loaded: false });
    onMessage("↻ Reset complete", "info");
  }, [state.fileId, onMessage]);

  const timeRemaining = useMemo(() => {
    if (!metadata) return "";
    return getTimeRemaining(metadata.expiryTime);
  }, [metadata]);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* File Info Card */}
      {metadata && (
        <Card
          title="📄 File Information"
          subtitle={`Expires in: ${timeRemaining}`}
          className="border-blue-600/50 bg-blue-950/20"
        >
          <div className="space-y-3">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">File Name</p>
              <p className="text-sm font-medium text-white break-all">
                {metadata.fileName}
              </p>
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

      {/* Verification Form */}
      <Card title="🔐 Verify & Download" className="border-cyan-600/50">
        <div className="space-y-4">
          <Input
            type="email"
            label="Your Email"
            value={recipientEmail}
            onChange={handleEmailChange}
            placeholder="name@radixweb.com"
            error={emailError}
            hint="Multi-recipient files require your email for verification"
            fullWidth
          />

          <Input
            type="text"
            label="6-Digit OTP"
            value={otp}
            onChange={handleOtpChange}
            placeholder="000000"
            maxLength={6}
            error={
              otp.length > 0 && otp.length < 6 ? "OTP must be 6 digits" : ""
            }
            hint={`${otp.length}/6 digits entered`}
            fullWidth
          />

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleVerifyAndDownload}
              disabled={otp.length !== 6 || !!emailError || loading}
              isLoading={loading}
              fullWidth
              variant="success"
              size="lg"
            >
              Verify & Download
            </Button>
            <Button
              onClick={handleReset}
              variant="secondary"
              fullWidth
              size="lg"
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
