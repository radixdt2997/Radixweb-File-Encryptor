import type { MessageType } from "../types";

interface MessageProps {
  text: string;
  type: MessageType;
}

export const Message = ({ text, type }: MessageProps) => {
  const baseClasses = "p-3 mb-4 rounded";
  const typeClasses = {
    info: "bg-blue-900 text-blue-100",
    success: "bg-green-900 text-green-100",
    error: "bg-red-900 text-red-100",
  };

  return <div className={`${baseClasses} ${typeClasses[type]}`}>{text}</div>;
};
