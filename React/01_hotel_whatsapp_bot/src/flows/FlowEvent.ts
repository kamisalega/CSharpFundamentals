export type FlowEvent =
  | { kind: "inboundText"; text: string }
  | { kind: "menuSelection"; selectionId: string }
  | {
      kind: "flowDataExchange";
      screen: string;
      action: string;
      data: unknown;
      flowToken: string;
    }
  | { kind: "flowSubmitted"; flowToken: string; payload: unknown }
  | { kind: "paymentSucceeded"; reservationCode: string }
  | { kind: "paymentFailed"; reservationCode: string; reason: string }
  | { kind: "reservationHeld"; reservationId: string; total: number }
  | { kind: "reservationFailed"; reason: string }
  | { kind: "timeout" };
