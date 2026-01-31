import { useState } from 'react';
import { crypto } from '../utils/crypto';
import { downloadFile } from '../utils/file';

interface LegacyProps {
  onMessage: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const Legacy = ({ onMessage }: LegacyProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const isValid = file && password.length >= 8;

  const handleEncrypt = async () => {
    if (!isValid) return;

    try {
      setLoading(true);
      onMessage('Encrypting...', 'info');

      const fileData = new Uint8Array(await file.arrayBuffer());
      const encrypted = await crypto.encryptWithPassword(fileData, password);

      downloadFile(encrypted, `${file.name}.enc`);
      onMessage('Encrypted and downloaded!', 'success');
    } catch (error) {
      onMessage(`Encryption failed: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!isValid) return;

    try {
      setLoading(true);
      onMessage('Decrypting...', 'info');

      const fileData = new Uint8Array(await file.arrayBuffer());
      const decrypted = await crypto.decryptWithPassword(fileData, password);

      downloadFile(decrypted, file.name.replace('.enc', ''));
      onMessage('Decrypted and downloaded!', 'success');
    } catch (error) {
      onMessage(`Decryption failed: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPassword('');
    onMessage('Cleared', 'info');
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={handleFileSelect}
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 chars)"
        className="block w-full p-2 bg-gray-700 text-white rounded"
      />

      <div className="space-x-2">
        <button
          onClick={handleEncrypt}
          disabled={!isValid || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-600"
        >
          Encrypt
        </button>
        
        <button
          onClick={handleDecrypt}
          disabled={!isValid || loading}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-600"
        >
          Decrypt
        </button>
        
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-600 text-white rounded"
        >
          Clear
        </button>
      </div>
    </div>
  );
};