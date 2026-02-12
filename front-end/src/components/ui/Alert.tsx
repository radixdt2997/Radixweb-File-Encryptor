import React, { useEffect } from "react";
import { cn } from "../../utils/tailwind";

type CardVariant = "default" | "success" | "error" | "warning" | "info";

interface AlertProps {
  text: string;
  type: CardVariant;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ text, type, onClose, autoClose = true, duration = 5000 }, ref) => {
    useEffect(() => {
      if (!autoClose || !onClose) return;

      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }, [autoClose, duration, onClose]);

    const bgClasses = {
      info: "bg-blue-50 dark:bg-blue-950",
      success: "bg-green-50 dark:bg-green-950",
      error: "bg-red-50 dark:bg-red-950",
      warning: "bg-amber-50 dark:bg-amber-950",
      default: "bg-gray-50 dark:bg-gray-900",
    };

    const textClasses = {
      info: "text-blue-800 dark:text-blue-100",
      success: "text-green-800 dark:text-green-100",
      error: "text-red-800 dark:text-red-100",
      warning: "text-amber-800 dark:text-amber-100",
      default: "text-gray-800 dark:text-gray-100",
    };

    const borderClasses = {
      info: "border-l-4 border-blue-500",
      success: "border-l-4 border-green-500",
      error: "border-l-4 border-red-500",
      warning: "border-l-4 border-amber-500",
      default: "border-l-4 border-gray-500",
    };

    const icons = {
      info: "ℹ️",
      success: "✓",
      error: "✕",
      warning: "⚠",
      default: "ℹ️",
    };

    return (
      <div
        ref={ref}
        className={cn(
          bgClasses[type],
          textClasses[type],
          borderClasses[type],
          "p-4 rounded-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 shadow-xl max-w-sm",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icons[type]}</span>
          <p className="text-sm font-medium">{text}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xl leading-none opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
            aria-label="Close alert"
          >
            ×
          </button>
        )}
      </div>
    );
  },
);

Alert.displayName = "Alert";
