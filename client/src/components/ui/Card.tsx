import React from "react";
import { cn } from "../../utils/tailwind";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, subtitle, children, className = "", noPadding = false }, ref) => {
    const paddingClass = noPadding ? "" : "p-6";

    return (
      <div
        ref={ref}
        className={cn(
          "bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-lg",
          paddingClass,
          className,
        )}
      >
        {(title || subtitle) && (
          <div
            className={
              noPadding
                ? "px-6 pt-6 pb-3"
                : "mb-4 pb-4 border-b border-gray-200 dark:border-gray-700"
            }
          >
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";
