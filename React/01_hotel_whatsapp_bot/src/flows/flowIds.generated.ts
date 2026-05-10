import { FlowKey } from "@/channels/MessagingPort";

  export const flowIds: Record<"datePicker" | "guestsPicker" | "guestInfo", FlowKey> = {
    datePicker: "DATE_PICKER",
    guestsPicker: "GUESTS_PICKER",
    guestInfo: "GUEST_INFO",
  };