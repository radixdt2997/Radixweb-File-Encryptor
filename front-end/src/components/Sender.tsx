import { useState } from "react";
import type { RecipientInfo, SenderState } from "../types";
import { api } from "../api/client";
import { crypto } from "../utils/crypto";
import { generateOTP, copyToClipboard } from "../utils/file";

const RADIX_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@radixweb\.com$/;

interface SenderProps {
  onMessage: (text: string, type: "info" | "success" | "error") => void;
}

export const Sender = ({ onMessage }: SenderProps) => {
  const [state, setState] = useState<SenderState>({ file: null, key: null });
  const [emailsText, setEmailsText] = useState("");
  const [result, setResult] = useState<
    { link: string; otps: { email: string; otp: string }[] } | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setState({ file, key: null });
    if (file) onMessage(`Selected: ${file.name}`, "info");
  };

  const handleEncrypt = async () => {
    if (!state.file) return;
    try {
      setLoading(true);
      onMessage("Encrypting...", "info");
      const key = await crypto.generateKey();
      setState((prev) => ({ ...prev, key }));
      onMessage("File encrypted! Enter recipient email.", "success");
    } catch (error) {
      onMessage(`Error: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!state.file || !state.key) {
      onMessage("Select a file and encrypt it first", "error");
      return;
    }

    const recipientEmails = emailsText
      .split(/[,\n;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (recipientEmails.length === 0) {
      onMessage("Enter at least one recipient email", "error");
      return;
    }

    const invalidEmails = recipientEmails.filter(
      (email) => !RADIX_EMAIL_REGEX.test(email),
    );
    if (invalidEmails.length > 0) {
      onMessage(
        `Only @radixweb.com emails are allowed. Invalid: ${invalidEmails.join(", ")}`,
        "error",
      );
      return;
    }

    try {
      setLoading(true);
      onMessage("Uploading...", "info");

      const fileData = new Uint8Array(await state.file.arrayBuffer());
      const encryptedData = await crypto.encryptWithKey(fileData, state.key);

      const recipientsPayload: {
        email: string;
        otp: string;
        otpHash: string;
        wrappedKey: string;
        wrappedKeySalt: string;
      }[] = [];

      for (const email of recipientEmails) {
        const otp = generateOTP();
        const { wrappedKey, salt } = await crypto.wrapKey(state.key, otp);
        const otpHash = await crypto.hashOTP(otp);

        recipientsPayload.push({
          email,
          otp,
          otpHash,
          wrappedKey: btoa(
            String.fromCharCode(...new Uint8Array(wrappedKey as Uint8Array)),
          ),
          wrappedKeySalt: btoa(
            String.fromCharCode(...new Uint8Array(salt as Uint8Array)),
          ),
        });
      }

      const formData = new FormData();
      formData.append("fileName", state.file.name);
      formData.append("encryptedData", new Blob([encryptedData as BlobPart]));
      // Legacy single-recipient fields are no longer needed when using recipients payload,
      // but kept for backward compatibility if the server expects them.
      formData.append("wrappedKey", new Blob());
      formData.append("wrappedKeySalt", new Blob());
      formData.append("recipients", JSON.stringify(recipientsPayload));
      formData.append("expiryMinutes", "60");
      formData.append("expiryType", "time-based");

      const uploadResult = await api.uploadFile(formData);
      setResult({
        link: uploadResult.downloadUrl,
        otps: recipientsPayload.map(({ email, otp }) => ({ email, otp })),
      });
      setUploadedFileId(uploadResult.fileId);
      onMessage("Upload successful!", "success");
    } catch (error) {
      onMessage(`Upload failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setState({ file: null, key: null });
    setEmailsText("");
    setResult(null);
    setUploadedFileId(null);
    setRecipients([]);
    onMessage("Reset complete", "info");
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    onMessage("Copied!", "success");
  };

  const loadRecipients = async () => {
    if (!uploadedFileId) {
      onMessage("No uploaded file to manage recipients for", "error");
      return;
    }
    try {
      setLoadingRecipients(true);
      const data = await api.getRecipients(uploadedFileId);
      setRecipients(data);
      onMessage("Loaded recipients", "success");
    } catch (error) {
      onMessage(
        `Failed to load recipients: ${(error as Error).message}`,
        "error",
      );
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleRevoke = async (recipientId: string) => {
    if (!uploadedFileId) return;
    try {
      await api.revokeRecipient(uploadedFileId, recipientId);
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
      onMessage("Recipient access revoked", "success");
    } catch (error) {
      onMessage(
        `Failed to revoke recipient: ${(error as Error).message}`,
        "error",
      );
    }
  };

  const getRecipientStatus = (recipient: RecipientInfo): string => {
    if (recipient.downloadedAt) return "Downloaded";
    if (recipient.otpVerifiedAt) return "OTP Verified";
    return "Invited";
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={handleFileSelect}
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />

      <input
        type="text"
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        placeholder="Recipient email(s) (comma or newline separated)"
        disabled={!state.key}
        className="block w-full p-2 bg-gray-700 text-white rounded disabled:bg-gray-800"
      />

      <div className="space-x-2">
        <button
          onClick={handleEncrypt}
          disabled={!state.file || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-600"
        >
          Encrypt File
        </button>

        <button
          onClick={handleUpload}
          disabled={!state.key || !emailsText || loading}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-600"
        >
          Upload & Send
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-600 text-white rounded"
        >
          Reset
        </button>
      </div>

      {result && (
        <div className="bg-green-900 p-4 rounded">
          <h3 className="text-lg font-bold mb-2">File Sent Successfully!</h3>
          <div className="space-y-2">
            <div>
              Link: <span className="font-mono">{result.link}</span>
              <button
                onClick={() => handleCopy(result.link)}
                className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Copy
              </button>
            </div>
            {result.otps.map(({ email, otp }) => (
              <div key={email}>
                <div>
                  Recipient: <span className="font-mono">{email}</span>
                </div>
                <div>
                  OTP: <span className="font-mono">{otp}</span>
                  <button
                    onClick={() => handleCopy(otp)}
                    className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
            {uploadedFileId && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-semibold">
                    Recipient Access (file: {uploadedFileId})
                  </h4>
                  <button
                    onClick={loadRecipients}
                    disabled={loadingRecipients}
                    className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-600 text-sm"
                  >
                    {loadingRecipients ? "Loading..." : "Refresh Recipients"}
                  </button>
                </div>
                {recipients.length === 0 ? (
                  <p className="text-sm text-gray-200">
                    No recipient status loaded yet. Click &quot;Refresh
                    Recipients&quot; to view.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between bg-green-950/60 p-2 rounded"
                      >
                        <div className="text-sm">
                          <div>
                            <span className="font-mono">{recipient.email}</span>
                          </div>
                          <div className="text-xs text-gray-200">
                            Status: {getRecipientStatus(recipient)} · Attempts:{" "}
                            {recipient.otpAttempts}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(recipient.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
