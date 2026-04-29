import { prisma } from "@/db/prisma";
import { verifyCredentials } from "./verifyCredentials";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export async function authorize(
  credentials: Partial<Record<string, unknown>>,
): Promise<{ id: string; email: string } | null> {
  return verifyCredentials(prisma, credentials);
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize,
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
};
