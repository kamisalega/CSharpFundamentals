// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("./actions", () => ({ signOutAction: vi.fn() }));

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminLayout from "./layout";

const mockAuth = vi.mocked(auth);
const mockRedirect = vi.mocked(redirect);

const session = {
  user: { email: "admin@hotel.local" },
  expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
};

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(session as never);
  });

  it("renderuje email zalogowanego użytkownika", async () => {
    const layout = await AdminLayout({ children: <div /> });
    render(layout);

    expect(screen.getByText("admin@hotel.local")).toBeTruthy();
  });

  it("renderuje dzieci komponentu", async () => {
    const layout = await AdminLayout({
      children: <div>zawartość strony</div>,
    });
    render(layout);

    expect(screen.getByText("zawartość strony")).toBeTruthy();
  });

  it("redirectuje do /login gdy brak sesji", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    await expect(AdminLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("renderuje przycisk Wyloguj", async () => {
    const layout = await AdminLayout({ children: <div /> });
    render(layout);

    expect(screen.getByRole("button", { name: /wyloguj/i })).toBeTruthy();
  });
});
