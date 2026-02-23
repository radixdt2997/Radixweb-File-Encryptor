import { useState, useCallback, useMemo } from "react";
import type { RecipientInfo, SenderState } from "../types";
import { api } from "../api/client";
import { useAuthStore } from "../stores/authStore";
import { crypto } from "../utils/crypto";
import { generateOTP, copyToClipboard, formatFileSize } from "../utils/file";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { env } from "../config/env";

const RADIX_EMAIL_REGEX = new RegExp(
  `^[a-zA-Z0-9._%+-]+@${env.email.allowedDomain.replace(/\./g, "\\.")}$`,
);

interface SenderProps {
  onMessage: (text: string, type: "info" | "success" | "error") => void;
}

export const Sender = ({ onMessage }: SenderProps) => {
  const token = useAuthStore((s) => s.token);
  const [state, setState] = useState<SenderState>({ file: null, key: null });
  const [emailsText, setEmailsText] = useState("");
  const [result, setResult] = useState<{
    link: string;
    otps: { email: string; otp: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [expiryMinutes, setExpiryMinutes] = useState(
    env.ui.defaultExpiryMinutes,
  );
  const [expiryType, setExpiryType] = useState<"one-time" | "time-based">(
    "time-based",
  );

  const isEncrypted = state.key !== null;
  const hasFile = state.file !== null;

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setState({ file, key: null });
      if (file) {
        onMessage(
          `Selected: ${file.name} (${formatFileSize(file.size)})`,
          "info",
        );
      }
    },
    [onMessage],
  );

  const handleEncrypt = useCallback(async () => {
    if (!state.file) return;
    try {
      setLoading(true);
      onMessage("🔐 Encrypting file...", "info");
      const key = await crypto.generateKey();
      setState((prev) => ({ ...prev, key }));
      onMessage("File encrypted! Now enter recipient emails.", "success");
    } catch (error) {
      onMessage(`Encryption failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [state.file, onMessage]);

  const validateEmails = useCallback(
    (emails: string[]): { valid: string[]; invalid: string[] } => {
      const valid = emails.filter((email) => RADIX_EMAIL_REGEX.test(email));
      const invalid = emails.filter((email) => !RADIX_EMAIL_REGEX.test(email));
      return { valid, invalid };
    },
    [],
  );

  const parseEmails = useCallback((text: string): string[] => {
    return text
      .split(/[,\n;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!state.file || !state.key) {
      onMessage("Select a file and encrypt it first", "error");
      return;
    }

    if (
      expiryMinutes < env.ui.minExpiryMinutes ||
      expiryMinutes > env.ui.maxExpiryMinutes
    ) {
      onMessage(
        `Expiry time must be between ${env.ui.minExpiryMinutes} and ${env.ui.maxExpiryMinutes} minutes`,
        "error",
      );
      return;
    }

    const recipientEmails = parseEmails(emailsText);

    if (recipientEmails.length === 0) {
      onMessage("Enter at least one recipient email", "error");
      return;
    }

    const { valid, invalid } = validateEmails(recipientEmails);

    if (invalid.length > 0) {
      onMessage(
        `Invalid emails (must be @radixweb.com): ${invalid.join(", ")}`,
        "error",
      );
      return;
    }

    try {
      setLoading(true);
      onMessage("📤 Uploading and encrypting for recipients...", "info");

      const fileData = new Uint8Array(await state.file.arrayBuffer());
      const encryptedData = await crypto.encryptWithKey(fileData, state.key);

      const recipientsPayload: Array<{
        email: string;
        otp: string;
        otpHash: string;
        wrappedKey: string;
        wrappedKeySalt: string;
      }> = [];

      for (const email of valid) {
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
      formData.append("wrappedKey", new Blob());
      formData.append("wrappedKeySalt", new Blob());
      formData.append("recipients", JSON.stringify(recipientsPayload));
      formData.append("expiryMinutes", expiryMinutes.toString());
      formData.append("expiryType", expiryType);

      const uploadResult = await api.uploadFile(formData, token);
      setResult({
        link: uploadResult.downloadUrl,
        otps: recipientsPayload.map(({ email, otp }) => ({ email, otp })),
      });
      setUploadedFileId(uploadResult.fileId);
      onMessage("Upload successful! Share link and OTPs.", "success");
    } catch (error) {
      onMessage(`Upload failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [
    state.file,
    state.key,
    expiryMinutes,
    parseEmails,
    emailsText,
    validateEmails,
    onMessage,
    expiryType,
    token,
  ]);

  const handleReset = useCallback(() => {
    setState({ file: null, key: null });
    setEmailsText("");
    setResult(null);
    setUploadedFileId(null);
    setRecipients([]);
    onMessage("Reset complete", "info");
  }, [onMessage]);

  const handleCopy = useCallback(
    async (text: string, label: string = "text") => {
      await copyToClipboard(text);
      onMessage(`${label} copied!`, "success");
    },
    [onMessage],
  );

  const loadRecipients = useCallback(async () => {
    if (!uploadedFileId) {
      onMessage("No uploaded file to manage", "error");
      return;
    }
    try {
      setLoadingRecipients(true);
      const data = await api.getRecipients(uploadedFileId, token);
      setRecipients(data);
      onMessage("Recipients loaded", "success");
    } catch (error) {
      onMessage(`Failed to load: ${(error as Error).message}`, "error");
    } finally {
      setLoadingRecipients(false);
    }
  }, [uploadedFileId, token, onMessage]);

  const handleRevoke = useCallback(
    async (recipientId: string, email: string) => {
      if (!uploadedFileId) return;
      try {
        await api.revokeRecipient(uploadedFileId, recipientId, token);
        setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
        onMessage(`Access revoked for ${email}`, "success");
      } catch (error) {
        onMessage(`Revocation failed: ${(error as Error).message}`, "error");
      }
    },
    [uploadedFileId, token, onMessage],
  );

  const getRecipientStatus = (recipient: RecipientInfo): string => {
    if (recipient.downloadedAt) return "Downloaded";
    if (recipient.otpVerifiedAt) return "Verified";
    return "Invited";
  };

  const recipientEmailList = useMemo(
    () => parseEmails(emailsText),
    [emailsText, parseEmails],
  );
  const emailValidationStatus = useMemo(
    () => validateEmails(recipientEmailList),
    [recipientEmailList, validateEmails],
  );

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <Card title="Step 1: Select File" subtitle="Choose a file to encrypt">
        <div className="space-y-4">
          <Input
            type="file"
            onChange={handleFileSelect}
            className="block w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg bg-gray-700/50 text-white hover:border-blue-500 transition-colors cursor-pointer"
          />
          {hasFile && (
            <div className="flex items-center justify-between bg-green-950/40 p-3 rounded-lg border border-green-600/50">
              <div className="text-sm">
                <p className="font-semibold text-green-300">
                  {state.file?.name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(state.file?.size || 0)}
                </p>
              </div>
              <span className="text-2xl">✓</span>
            </div>
          )}
        </div>
      </Card>

      {/* Encryption */}
      <Card title="Step 2: Encrypt" subtitle="Generate a unique encryption key">
        <Button
          onClick={handleEncrypt}
          disabled={!hasFile || loading || isEncrypted}
          isLoading={loading && isEncrypted === false}
          fullWidth
          size="lg"
        >
          {isEncrypted ? "File Encrypted" : "Encrypt File"}
        </Button>
      </Card>

      {/* Recipients */}
      {isEncrypted && (
        <Card
          title="Step 3: Add Recipients"
          subtitle="Enter @radixweb.com emails"
        >
          <div className="space-y-4">
            <Input
              type="email"
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="alice@radixweb.com, bob@radixweb.com, or paste comma/newline separated"
              label="Recipient Emails"
              hint="Each recipient gets a unique OTP"
              fullWidth
            />

            {recipientEmailList.length > 0 && (
              <div className="space-y-2">
                {emailValidationStatus.valid.length > 0 && (
                  <div className="text-xs text-green-400">
                    ✓ {emailValidationStatus.valid.length} valid email(s)
                  </div>
                )}
                {emailValidationStatus.invalid.length > 0 && (
                  <div className="text-xs text-red-400">
                    ✕ {emailValidationStatus.invalid.length} invalid email(s)
                  </div>
                )}
              </div>
            )}

            {/* Expiry Settings */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Expiry Type
                </label>
                <select
                  value={expiryType}
                  onChange={(e) =>
                    setExpiryType(e.target.value as "one-time" | "time-based")
                  }
                  className="w-full px-3 py-2 rounded bg-gray-600 text-white text-sm border border-gray-500"
                >
                  <option value="time-based">Time-based</option>
                  <option value="one-time">One-time Download</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Expires In (minutes)
                </label>
                <Input
                  type="number"
                  min={env.ui.minExpiryMinutes}
                  max={env.ui.maxExpiryMinutes}
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-gray-600 text-white text-sm border border-gray-500"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Upload Actions */}
      {isEncrypted && (
        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={emailValidationStatus.valid.length === 0 || loading}
            isLoading={loading}
            fullWidth
            size="lg"
            variant="success"
          >
            Upload & Send
          </Button>
          <Button onClick={handleReset} variant="secondary" fullWidth size="lg">
            Reset
          </Button>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <Card
          title="✓ File Sent Successfully!"
          subtitle={`Shared with ${result.otps.length} recipient(s)`}
          className="border-green-600/50 bg-green-950/20"
        >
          <div className="space-y-4">
            {/* Download Link */}
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <p className="text-xs font-semibold text-gray-400 mb-2">
                SHARE THIS LINK:
              </p>
              <div className="flex items-center gap-2 bg-gray-800 p-3 rounded border border-gray-600">
                <code className="text-xs text-gray-300 flex-1 truncate">
                  {result.link}
                </code>
                <Button
                  onClick={() => handleCopy(result.link, "Link")}
                  variant="ghost"
                  size="sm"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* OTPs per Recipient */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400">
                RECIPIENT OTPs (send separately):
              </p>
              {result.otps.map(({ email, otp }) => (
                <div
                  key={email}
                  className="bg-gray-700/50 p-3 rounded border border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{email}</p>
                    </div>
                    <Button
                      onClick={() => handleCopy(otp, "OTP")}
                      variant="ghost"
                      size="sm"
                    >
                      Copy
                    </Button>
                  </div>
                  <code className="text-lg font-bold text-yellow-300 tracking-widest">
                    {otp}
                  </code>
                </div>
              ))}
            </div>

            {/* Recipient Management */}
            {uploadedFileId && (
              <div className="border-t border-gray-600 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">Recipient Access</h4>
                  <Button
                    onClick={loadRecipients}
                    isLoading={loadingRecipients}
                    variant="secondary"
                    size="sm"
                  >
                    Refresh
                  </Button>
                </div>

                {recipients.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Click Refresh to view recipient status
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between bg-gray-800/50 p-3 rounded border border-gray-600"
                      >
                        <div className="text-sm flex-1">
                          <p className="font-medium text-white">
                            {recipient.email}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {getRecipientStatus(recipient)} • Attempts:{" "}
                            {recipient.otpAttempts}
                          </p>
                        </div>
                        <Button
                          onClick={() =>
                            handleRevoke(recipient.id, recipient.email)
                          }
                          variant="danger"
                          size="sm"
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
