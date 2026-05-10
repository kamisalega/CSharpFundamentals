  import { createHmac, timingSafeEqual } from "crypto";
  import { validateRequest } from "twilio";

  export type ValidateTwilioSignatureArgs = Readonly<{
    signature: string | null;
    url: string;
    params: Record<string, string>;
    authToken: string;
  }>;

  export function validateTwilioSignature(
    args: ValidateTwilioSignatureArgs,
  ): boolean {
    if (!args.signature) return false;
    return validateRequest(args.authToken, args.signature, args.url, args.params);
  }

  export type ValidateTwilioJsonSignatureArgs = Readonly<{
    signature: string | null;
    url: string;
    rawBody: string;
    authToken: string;
  }>;

  export function validateTwilioJsonSignature(
    args: ValidateTwilioJsonSignatureArgs,
  ): boolean {
    if (!args.signature) return false;
    try {
      const expected = createHmac("sha1", args.authToken)
        .update(args.url + args.rawBody, "utf8")
        .digest("base64");
      const sigBuf = Buffer.from(args.signature, "base64");
      const expBuf = Buffer.from(expected, "base64");
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }