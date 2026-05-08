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
