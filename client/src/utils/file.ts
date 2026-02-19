/**
 * File utilities for encryption app
 */

/** Download file to client browser */
export const downloadFile = (data: Uint8Array, filename: string): void => {
  const blob = new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Generate cryptographically secure 6-digit OTP */
export const generateOTP = (): string => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
};

/** Format bytes to human-readable file size */
export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/** Copy text to clipboard with async support */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    console.log("Error copying to clipboard:", error);
  }
};

/** Format ISO date string to readable format */
export const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Get time remaining until expiry */
export const getTimeRemaining = (expiryTime: string): string => {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const diff = expiry.getTime() - now.getTime();

  if (diff < 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};
