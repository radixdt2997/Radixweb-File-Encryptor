import { useState, useEffect } from "react";
import type { RecipientState, FileMetadata } from "../types";
import { api } from "../api/client";
import { crypto } from "../utils/crypto";
import { downloadFile, formatFileSize } from "../utils/file";

const RADIX_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@radixweb\.com$/;

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

  const loadFileInfo = async (id: string) => {
    if (state.loaded) return;
    setState((prev) => ({ ...prev, loaded: true }));

    try {
      onMessage("Loading file info...", "info");
      const data = await api.getFileMetadata(id);
      setMetadata(data);
      onMessage("Ready. Enter OTP.", "success");
    } catch (error) {
      onMessage(`Load failed: ${(error as Error).message}`, "error");
      setState((prev) => ({ ...prev, loaded: false }));
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipientEmail(e.target.value.trim());
  };

  const handleVerifyAndDownload = async () => {
    if (!fileId || otp.length !== 6) return;

    if (!RADIX_EMAIL_REGEX.test(recipientEmail)) {
      onMessage("Only @radixweb.com emails are allowed", "error");
      return;
    }

    try {
      setLoading(true);
      onMessage("Verifying OTP...", "info");

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

      onMessage("Downloading file...", "info");
      const encryptedData = new Uint8Array(await api.downloadFile(fileId));

      onMessage("Decrypting...", "info");
      const decryptedData = await crypto.decryptWithKey(encryptedData, fileKey);

      downloadFile(decryptedData, verifyData.fileName);
      onMessage("File downloaded successfully!", "success");
    } catch (error) {
      onMessage(`Failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setOtp("");
    setRecipientEmail("");
    setMetadata(null);
    setState({ fileId: state.fileId, loaded: false });
    onMessage("Reset complete", "info");
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-700 p-4 rounded">
        <div>
          File: <span>{metadata?.fileName || "-"}</span>
        </div>
        <div>
          Size:{" "}
          <span>{metadata ? formatFileSize(metadata.fileSize) : "-"}</span>
        </div>
        <div>
          Expires:{" "}
          <span>
            {metadata ? new Date(metadata.expiryTime).toLocaleString() : "-"}
          </span>
        </div>
      </div>

      <input
        type="email"
        value={recipientEmail}
        onChange={handleEmailChange}
        placeholder="Your email (for multi-recipient files)"
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />

      <input
        type="text"
        value={otp}
        onChange={handleOtpChange}
        placeholder="Enter 6-digit OTP"
        maxLength={6}
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />

      <div className="space-x-2">
        <button
          onClick={handleVerifyAndDownload}
          disabled={otp.length !== 6 || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-600"
        >
          Verify & Download
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-600 text-white rounded"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
