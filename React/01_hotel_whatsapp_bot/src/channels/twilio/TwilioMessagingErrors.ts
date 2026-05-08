  export type TwilioSendErrorCode =
    | "TIMEOUT"
    | "CLIENT_ERROR"
    | "SERVER_ERROR"
    | "NETWORK_ERROR";

  export class TwilioSendError extends Error {
    public readonly code: TwilioSendErrorCode;
    public readonly attempts: number;
    public readonly status: number | undefined;

    constructor(args: {
      code: TwilioSendErrorCode;
      message: string;
      attempts: number;
      status?: number;
      cause?: unknown;
    }) {
      super(args.message, { cause: args.cause });
      this.name = "TwilioSendError";
      this.code = args.code;
      this.attempts = args.attempts;
      this.status = args.status;
    }
  }