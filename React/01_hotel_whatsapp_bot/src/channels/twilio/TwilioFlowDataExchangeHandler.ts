import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import { type FlowEvent } from "@/flows/FlowEvent";
import { type FlowSlots } from "@/flows/FlowSlots";
import { FlowState } from "@/flows/FlowState";
import {
  interpretEffects,
  type InterpreterPorts,
} from "@/flows/EffectInterpreter";
import {
  type FlowIds,
  type TemplateSids,
  type TransitionContext,
} from "@/flows/transitions";
import { decryptFlowPayload, encryptFlowResponse } from "./TwilioFlowCrypto";
import {
  datePickerSubmitSchema,
  encryptedFlowPayloadSchema,
  extrasSubmitSchema,
  flowRequestSchema,
  guestInfoSubmitSchema,
  guestsPickerSubmitSchema,
} from "./TwilioFlowDataExchangeSchema";
import { validateTwilioJsonSignature } from "./TwilioSignature";

export type FlowDataExchangeLogger = Readonly<{
  info: (obj: object) => void;
  warn: (obj: object) => void;
  error: (obj: object) => void;
}>;

export type FlowDataExchangeDeps = Readonly<{
  privateKeyPem: string;
  authToken: string;
  publicUrl: string;
  engine: FlowConversationEngine;
  ports: InterpreterPorts;
  templateSids: TemplateSids;
  flowIds: FlowIds;
  schedule: (fn: () => void | Promise<void>) => void;
  logger: FlowDataExchangeLogger;
  getCorrelationId: () => string;
}>;

export type FlowDataExchangeHandlers = Readonly<{
  POST: (request: Request) => Promise<Response>;
}>;

export function createFlowDataExchangeHandlers(
  deps: FlowDataExchangeDeps,
): FlowDataExchangeHandlers {
  async function POST(request: Request): Promise<Response> {
    const correlationId = deps.getCorrelationId();
    const rawBody = await request.text();

    const signature = request.headers.get("x-twilio-signature");
    if (
      !validateTwilioJsonSignature({
        signature,
        url: deps.publicUrl,
        rawBody,
        authToken: deps.authToken,
      })
    ) {
      deps.logger.warn({
        event: "twilio.flow.signature.invalid",
        correlationId,
      });
      return new Response(null, { status: 401 });
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBody);
    } catch {
      return new Response(null, { status: 400 });
    }

    const encryptedParsed = encryptedFlowPayloadSchema.safeParse(rawJson);
    if (!encryptedParsed.success) {
      deps.logger.warn({
        event: "twilio.flow.payload.schema.invalid",
        correlationId,
      });
      return new Response(null, { status: 400 });
    }

    let decryptResult: ReturnType<typeof decryptFlowPayload>;
    try {
      decryptResult = decryptFlowPayload(
        encryptedParsed.data,
        deps.privateKeyPem,
      );
    } catch (err) {
      deps.logger.warn({
        event: "twilio.flow.decrypt.failed",
        err,
        correlationId,
      });
      return new Response(null, { status: 400 });
    }

    const { request: flowReq, aesKey, iv } = decryptResult;

    const reqParsed = flowRequestSchema.safeParse(flowReq);
    if (!reqParsed.success) {
      deps.logger.warn({
        event: "twilio.flow.request.schema.invalid",
        correlationId,
      });
      return Response.json(
        encryptFlowResponse({ data: { acknowledged: true } }, aesKey, iv),
      );
    }

    const { action, screen, data, flow_token } = reqParsed.data;

    deps.logger.info({
      event: "twilio.flow.received",
      action,
      screen,
      correlationId,
    });

    if (action === "ping") {
      return Response.json(
        encryptFlowResponse({ data: { status: "active" } }, aesKey, iv),
      );
    }

    if (action === "INIT") {
      const initResponse = buildInitScreenResponse(screen, deps.ports.now());
      return Response.json(encryptFlowResponse(initResponse, aesKey, iv));
    }

    if (action === "BACK" || action === "CANCEL") {
      return Response.json(
        encryptFlowResponse({ data: { acknowledged: true } }, aesKey, iv),
      );
    }

    // action === "data_exchange" — dispatch to flow engine async
    deps.schedule(async () => {
      try {
        await dispatchFlowSubmit(
          { flowToken: flow_token, screen, data },
          deps,
          correlationId,
        );
      } catch (err) {
        deps.logger.error({
          event: "twilio.flow.process.failed",
          err,
          correlationId,
        });
      }
    });

    return Response.json(
      encryptFlowResponse(
        {
          screen: "SUCCESS",
          data: {
            extension_message_response: {
              params: { flow_action: "complete" },
            },
          },
        },
        aesKey,
        iv,
      ),
    );
  }

  return { POST };
}

async function dispatchFlowSubmit(
  args: {
    flowToken: string;
    screen: string;
    data: Record<string, unknown>;
  },
  deps: FlowDataExchangeDeps,
  correlationId: string,
): Promise<void> {
  const conv = await deps.ports.prisma.conversation.findFirst({
    where: { flowToken: args.flowToken },
  });

  if (!conv) {
    deps.logger.warn({
      event: "twilio.flow.conversation_not_found",
      flowToken: args.flowToken,
      correlationId,
    });
    return;
  }

  const event = buildFlowEvent(args.screen, args.data);
  if (!event) {
    deps.logger.warn({
      event: "twilio.flow.unknown_screen_data",
      screen: args.screen,
      correlationId,
    });
    return;
  }

  const currentState = (conv.flowState as FlowState | null) ?? FlowState.BOOT;
  const slots = conv.flowSlots
    ? reviveDateSlots(JSON.parse(conv.flowSlots) as FlowSlots)
    : {};

  const ctx: TransitionContext = {
    conversationId: conv.id,
    phone: conv.phone,
    locale: conv.locale,
    slots,
    templateSids: deps.templateSids,
    flowIds: deps.flowIds,
  };

  const result = deps.engine.dispatch(currentState, event, ctx);
  await interpretEffects(
    result.effects,
    result.next,
    ctx,
    deps.engine,
    deps.ports,
  );

  deps.logger.info({
    event: "twilio.flow.dispatched",
    screen: args.screen,
    fromState: currentState,
    toState: result.next,
    correlationId,
  });
}

function buildFlowEvent(
  screen: string,
  data: Record<string, unknown>,
): FlowEvent | null {
  switch (screen) {
    case "DATE_PICKER": {
      const parsed = datePickerSubmitSchema.safeParse(data);
      if (!parsed.success) return null;
      return {
        kind: "flowSubmitted",
        flowToken: "",
        payload: {
          checkIn: new Date(parsed.data.check_in),
          checkOut: new Date(parsed.data.check_out),
        },
      };
    }
    case "GUESTS_PICKER": {
      const parsed = guestsPickerSubmitSchema.safeParse(data);
      if (!parsed.success) return null;
      return {
        kind: "flowSubmitted",
        flowToken: "",
        payload: {
          adults: parsed.data.adults,
          children: parsed.data.children,
        },
      };
    }
    case "GUEST_INFO": {
      const parsed = guestInfoSubmitSchema.safeParse(data);
      if (!parsed.success) return null;
      return {
        kind: "flowSubmitted",
        flowToken: "",
        payload: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
        },
      };
    }
    case "EXTRAS": {
      const parsed = extrasSubmitSchema.safeParse(data);
      if (!parsed.success) return null;
      return {
        kind: "flowSubmitted",
        flowToken: "",
        payload: { breakfast: parsed.data.breakfast },
      };
    }
    default:
      return null;
  }
}

function buildInitScreenResponse(screen: string, now: Date): object {
  const today = toDateStr(now);
  const tomorrow = toDateStr(addDays(now, 1));
  const dayAfter = toDateStr(addDays(now, 2));

  switch (screen) {
    case "DATE_PICKER":
      return {
        screen,
        data: { min_date: today, check_in: tomorrow, check_out: dayAfter },
      };
    case "GUESTS_PICKER":
      return { screen, data: { adults: 2, children: 0 } };
    case "GUEST_INFO":
      return { screen, data: {} };
    default:
      return { screen, data: {} };
  }
}

function reviveDateSlots(slots: FlowSlots): FlowSlots {
  return {
    ...slots,
    ...(slots.checkIn ? { checkIn: new Date(slots.checkIn as unknown as string) } : {}),
    ...(slots.checkOut ? { checkOut: new Date(slots.checkOut as unknown as string) } : {}),
  };
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
