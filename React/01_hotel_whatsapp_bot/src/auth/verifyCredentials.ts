import { compare } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const inputSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
});

const DUMMY_HASH =
  "$2b$12$LCKTVqDWBhG4J2kxQqJJFOeXqI8ZWJzGH3eN7mAs6LKNzpT2Dxvyy";

export type VerifiedUser = Readonly<{ id: string; email: string }>;

export async function verifyCredentials(
  prisma: PrismaClient,
  raw: Record<string, unknown>,
): Promise<VerifiedUser | null> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { email } });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await compare(password, hash);

  if (!valid || !user) return null;

  return { id: user.id, email: user.email };
}
