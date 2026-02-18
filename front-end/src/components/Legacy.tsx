import { useState } from "react";
import { crypto } from "../utils/crypto";
import { downloadFile } from "../utils/file";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface LegacyProps {
  onMessage: (text: string, type: "info" | "success" | "error") => void;
}

export const Legacy = ({ onMessage }: LegacyProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = !!file && password.length >= 8;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleEncrypt = async () => {
    if (!isValid || !file) return;

    try {
      setLoading(true);
      onMessage("🔐 Encrypting file...", "info");

      const fileData = new Uint8Array(await file.arrayBuffer());
      const encrypted = await crypto.encryptWithPassword(fileData, password);

      downloadFile(encrypted, `${file.name}.enc`);
      onMessage("Encrypted and downloaded!", "success");
    } catch (error) {
      onMessage(`Encryption failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!isValid || !file) return;

    try {
      setLoading(true);
      onMessage("🔓 Decrypting file...", "info");

      const fileData = new Uint8Array(await file.arrayBuffer());
      const decrypted = await crypto.decryptWithPassword(fileData, password);

      downloadFile(decrypted, file.name.replace(/\.enc$/, ""));
      onMessage("Decrypted and downloaded!", "success");
    } catch (error) {
      onMessage(`Decryption failed: ${(error as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPassword("");
    onMessage("↻ Cleared", "info");
  };

  return (
    <div className="space-y-6">
      <Card
        title="🔑 Legacy Password-Based Encryption"
        subtitle="Encrypt or decrypt files using a shared password"
      >
        <div className="space-y-4">
          <Input
            type="file"
            label="Select File"
            onChange={handleFileSelect}
            hint={
              file
                ? `Selected: ${file.name}`
                : "Choose a file to encrypt or decrypt"
            }
            className="block w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg bg-gray-700/50 text-white hover:border-blue-500 transition-colors cursor-pointer"
            fullWidth
          />

          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            error={
              password && password.length < 8
                ? "Password must be at least 8 characters"
                : ""
            }
            fullWidth
          />

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleEncrypt}
              disabled={!isValid || loading}
              isLoading={loading}
              variant="primary"
              fullWidth
            >
              Encrypt
            </Button>

            <Button
              onClick={handleDecrypt}
              disabled={!isValid || loading}
              isLoading={loading}
              variant="success"
              fullWidth
            >
              Decrypt
            </Button>

            <Button onClick={handleClear} variant="secondary" fullWidth>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-yellow-900/20 border-yellow-700">
        <p className="text-xs text-yellow-200">
          ⚠️ Legacy mode uses a shared password. For better security and
          passwordless access, prefer the OTP-based sharing flow.
        </p>
      </Card>
    </div>
  );
};
