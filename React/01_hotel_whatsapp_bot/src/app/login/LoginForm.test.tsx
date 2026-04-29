// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

vi.mock("./actions", () => ({
  loginAction: vi.fn().mockResolvedValue(null),
}));

describe("LoginForm", () => {
  it("renderuje tytuł panelu", () => {
    render(<LoginForm />);

    expect(
      screen.getByRole("heading", { name: /panel recepcji/i }),
    ).toBeTruthy();
  });

  it("renderuje pole email", () => {
    render(<LoginForm />);

    expect(screen.getByTestId("email-input")).toBeTruthy();
  });

  it("renderuje pole hasła", () => {
    render(<LoginForm />);

    expect(screen.getByTestId("password-input")).toBeTruthy();
  });

  it("renderuje przycisk Zaloguj", () => {
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: /zaloguj/i })).toBeTruthy();
  });

  it("nie wyświetla alertu błędu przy inicjalnym renderze", () => {
    render(<LoginForm />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
