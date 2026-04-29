import { auth } from "@/auth";
import { z } from "zod";
import { prisma } from "@/db/prisma";
import { NextRequest, NextResponse } from "next/server";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  paused: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad Request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await prisma.conversation.update({
    where: { id: parsed.data.conversationId },
    data: { botPaused: parsed.data.paused },
  });

  return NextResponse.json({ ok: true });
}
