import { FlowKey, TemplateKey } from "../MessagingPort";

export const DEFAULT_TIMEOUT_MS = 5_000;
export const DEFAULT_RETRY_DELAYS_MS = [500, 1_500, 4_500] as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export function isTwilioRestError(
  error: unknown,
): error is { status: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  );
}

export const FLOW_TEMPLATE_KEY: Record<FlowKey, TemplateKey> = {
  DATE_PICKER: "DATE_PICKER_FLOW",
  GUESTS_PICKER: "GUESTS_PICKER_FLOW",
  GUEST_INFO: "GUEST_INFO_FLOW",
};
