import React from "react";
import { cn } from "../../utils/tailwind";

type InputType = "text" | "email" | "password" | "number";

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
  type?: InputType;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      type = "text",
      error,
      hint,
      icon,
      fullWidth = true,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn(fullWidth && "w-full")}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            disabled={disabled}
            className={cn(
              "px-4 py-2.5 rounded-lg border-2 transition-all duration-200 focus:outline-none w-full",
              error
                ? "border-red-500 bg-red-50 dark:bg-red-950 dark:text-red-100 focus:ring-red-200"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:border-blue-500 focus:ring-blue-200",
              disabled && "opacity-50 cursor-not-allowed",
              icon && "pl-10",
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        )}
        {hint && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
