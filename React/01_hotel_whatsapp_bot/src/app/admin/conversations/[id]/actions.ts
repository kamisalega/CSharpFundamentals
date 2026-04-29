"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/db/prisma";

const schema = z.object({
  conversationId: z.string().min(1),
  paused: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function toggleBotAction(formData: FormData) {
  const parsed = schema.safeParse({
    conversationId: formData.get("conversationId"),
    paused: formData.get("paused"),
  });

  if (!parsed.success) return;

  await prisma.conversation.update({
    where: { id: parsed.data.conversationId },
    data: { botPaused: parsed.data.paused },
  });

  revalidatePath(`/admin/conversations/${parsed.data.conversationId}`);
}
