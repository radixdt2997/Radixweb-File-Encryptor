export interface FileMetadata {
  fileName: string;
  fileSize: number;
  expiryTime: string;
  expiryType: string;
  uploadedAt: string;
}

export interface UploadResult {
  downloadUrl: string;
  fileId: string;
  message: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface VerifyOTPResult {
  wrappedKey: string;
  wrappedKeySalt: string;
  fileName: string;
  fileSize: number;
  verifiedAt: string;
}

export interface SenderState {
  file: File | null;
  key: CryptoKey | null;
}

export interface RecipientState {
  fileId: string | null;
  loaded: boolean;
}

export type TabType = 'sender' | 'recipient' | 'legacy';
export type MessageType = 'info' | 'success' | 'error';