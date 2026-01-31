import { useState } from "react";
import type { SenderState } from "../types";
import { api } from "../api/client";
import { crypto } from "../utils/crypto";
import { generateOTP, copyToClipboard } from "../utils/file";

interface SenderProps {
  onMessage: (text: string, type: "info" | "success" | "error") => void;
}

export const Sender = ({ onMessage }: SenderProps) => {
  const [state, setState] = useState<SenderState>({ file: null, key: null });
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ link: string; otp: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

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
    if (!state.file || !state.key || !email.includes("@")) {
      onMessage("Enter valid email", "error");
      return;
    }

    try {
      setLoading(true);
      onMessage("Uploading...", "info");

      const otp = generateOTP();
      const fileData = new Uint8Array(await state.file.arrayBuffer());
      const encryptedData = await crypto.encryptWithKey(fileData, state.key);
      const { wrappedKey, salt } = await crypto.wrapKey(state.key, otp);
      const otpHash = await crypto.hashOTP(otp);

      const formData = new FormData();
      formData.append("fileName", state.file.name);
      formData.append("encryptedData", new Blob([encryptedData as BlobPart]));
      formData.append("wrappedKey", new Blob([wrappedKey as BlobPart]));
      formData.append("wrappedKeySalt", new Blob([salt as BlobPart]));
      formData.append("recipientEmail", email);
      formData.append("otpHash", otpHash);
      formData.append("otp", otp);
      formData.append("expiryMinutes", "60");
      formData.append("expiryType", "time-based");

      const uploadResult = await api.uploadFile(formData);
      setResult({ link: uploadResult.downloadUrl, otp });
      onMessage("Upload successful!", "success");
    } catch (error) {
      onMessage(`Upload failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setState({ file: null, key: null });
    setEmail("");
    setResult(null);
    onMessage("Reset complete", "info");
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    onMessage("Copied!", "success");
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={handleFileSelect}
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Recipient email"
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
          disabled={!state.key || !email || loading}
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
            <div>
              OTP: <span className="font-mono">{result.otp}</span>
              <button
                onClick={() => handleCopy(result.otp)}
                className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
