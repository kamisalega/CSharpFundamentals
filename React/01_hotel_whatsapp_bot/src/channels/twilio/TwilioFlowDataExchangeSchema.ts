  import { z } from "zod";

  export const encryptedFlowPayloadSchema = z.object({
    encrypted_aes_key: z.string().min(1),
    encrypted_flow_data: z.string().min(1),
    initial_vector: z.string().min(1),
  });

  export type EncryptedFlowPayload = z.infer<typeof encryptedFlowPayloadSchema>;

  export const flowRequestSchema = z.object({
    version: z.string(),
    action: z.enum(["ping", "INIT", "data_exchange", "BACK", "CANCEL"]),
    screen: z.string().default(""),
    data: z.record(z.string(), z.unknown()).default({}),
    flow_token: z.string().default(""),
  });

  export type FlowRequest = z.infer<typeof flowRequestSchema>;

  export const datePickerSubmitSchema = z.object({
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  export const guestsPickerSubmitSchema = z.object({
    adults: z.coerce.number().int().min(1).max(9),
    children: z.coerce.number().int().min(0).max(9),
  });

  export const guestInfoSubmitSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
  });

  export const extrasSubmitSchema = z.object({
    breakfast: z.union([z.boolean(), z.enum(["true", "false"])]).transform(
      (v) => v === true || v === "true",
    ),
  });