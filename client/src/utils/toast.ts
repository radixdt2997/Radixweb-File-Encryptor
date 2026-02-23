import { toast as sonner } from "sonner";
import { env } from "../config/env";

export type MessageType = "info" | "success" | "error";

/**
 * Show a toast message. Use this instead of the legacy Alert/useMessage.
 */
export function showMessage(text: string, type: MessageType): void {
  const duration =
    type === "error" ? env.toast.durationError : env.toast.durationDefault;

  switch (type) {
    case "success":
      sonner.success(text, { duration });
      break;
    case "error":
      sonner.error(text, { duration });
      break;
    default:
      sonner.info(text, { duration });
  }
}
