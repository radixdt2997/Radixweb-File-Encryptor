import type {
  FileMetadata,
  RecipientInfo,
  UploadResult,
  VerifyOTPResult,
} from "../types";

const API_BASE = "http://localhost:3000/api";

export const api = {
  async uploadFile(formData: FormData): Promise<UploadResult> {
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) throw new Error("Upload failed");
    return response.json();
  },

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const response = await fetch(`${API_BASE}/metadata/${fileId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("File not found");
    return response.json();
  },

  async verifyOTP(
    fileId: string,
    otp: string,
    recipientEmail?: string,
  ): Promise<VerifyOTPResult> {
    const response = await fetch(`${API_BASE}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        recipientEmail ? { fileId, otp, recipientEmail } : { fileId, otp },
      ),
      credentials: "include",
    });
    if (!response.ok) throw new Error("OTP verification failed");
    return response.json();
  },

  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const response = await fetch(`${API_BASE}/download/${fileId}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Download failed");
    return response.arrayBuffer();
  },

  async getRecipients(fileId: string): Promise<RecipientInfo[]> {
    const response = await fetch(`${API_BASE}/files/${fileId}/recipients`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load recipients");
    const data = await response.json();
    return data.recipients;
  },

  async revokeRecipient(fileId: string, recipientId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/files/${fileId}/recipients/${recipientId}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
    if (!response.ok) throw new Error("Failed to revoke recipient");
  },
};
