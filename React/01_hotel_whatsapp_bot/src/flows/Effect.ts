export type Effect =
  | {
      kind: "sendListPicker";
      to: string;
      templateSid: string;
      variables: Record<string, string>;
    }
  | {
      kind: "sendFlow";
      to: string;
      flowId: string;
      flowToken: string;
      cta: string;
      templateSid: string;
    }
  | {
      kind: "sendCard";
      to: string;
      templateSid: string;
      variables: Record<string, string>;
    }
  | {
      kind: "sendCtaButton";
      to: string;
      templateSid: string;
      url: string;
      variables: Record<string, string>;
    }
  | {
      kind: "sendTextTemplate";
      to: string;
      templateSid: string;
      variables: Record<string, string>;
    }
  | {
      kind: "searchAvailability";
      checkIn: Date;
      checkOut: Date;
      guests: { adults: number; children: number };
    }
  | {
      kind: "holdReservation";
      conversationId: string;
      roomId: string;
      checkIn: Date;
      checkOut: Date;
      guests: { adults: number; children: number };
      breakfast: boolean;
      guest: { name: string; email: string; phone: string };
    }
  | { kind: "createPaymentLink"; reservationId: string }
  | { kind: "sendBookingConfirmEmail"; reservationId: string }
  | {
      kind: "persistFlowState";
      conversationId: string;
      nextState: FlowState;
      flowToken?: string;
      mergedSlots?: Partial<FlowSlots>;
    };

import { FlowSlots } from "./FlowSlots";
import { FlowState } from "./FlowState";
