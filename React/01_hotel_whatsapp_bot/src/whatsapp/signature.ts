import { createHmac, timingSafeEqual } from "crypto";

const HEADER_PREFIX = "sha256=";

export type VerifyMetaSignatureArgs = Readonly<{
  rawBody: string | Buffer;
  signatureHeader: string | null;
  secret: string;
}>;

export function verifyMetaSignature(args: VerifyMetaSignatureArgs): boolean {
  if (!args.signatureHeader?.startsWith(HEADER_PREFIX)) {
    return false;
  }

  const providedHex = args.signatureHeader?.slice("sha256=".length) ?? "";
  const expectedHex = createHmac("sha256", args.secret)
    .update(args.rawBody)
    .digest("hex");
  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
