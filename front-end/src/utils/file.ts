export const downloadFile = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const generateOTP = (): string => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
};

export const formatFileSize = (bytes: number): string => {
  return `${(bytes / 1024).toFixed(2)} KB`;
};

export const copyToClipboard = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
};