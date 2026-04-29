import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin/conversations",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Incorrect email or password";
    }
    throw error; 
  }
  return null;
}
