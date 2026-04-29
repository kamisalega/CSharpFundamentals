// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoffControls } from "./HandoffControls";

vi.mock("./actions", () => ({ toggleBotAction: vi.fn() }));

describe("HandoffControls", () => {
  it("pokazuje 'Wstrzymaj bota' gdy bot działa", () => {
    render(<HandoffControls conversationId="conv-1" botPaused={false} />);

    expect(
      screen.getByRole("button", { name: /wstrzymaj bota/i }),
    ).toBeTruthy();
  });

  it("pokazuje 'Wznów bota' gdy bot wstrzymany", () => {
    render(<HandoffControls conversationId="conv-1" botPaused={true} />);

    expect(screen.getByRole("button", { name: /wznów bota/i })).toBeTruthy();
  });

  it("pokazuje chip BOT WSTRZYMANY gdy botPaused=true", () => {
    render(<HandoffControls conversationId="conv-1" botPaused={true} />);

    expect(screen.getByText("BOT WSTRZYMANY")).toBeTruthy();
  });

  it("nie pokazuje chipa gdy botPaused=false", () => {
    render(<HandoffControls conversationId="conv-1" botPaused={false} />);

    expect(screen.queryByText("BOT WSTRZYMANY")).toBeNull();
  });

  it("hidden input 'paused' ma wartość 'true' gdy bot działa (toggle)", () => {
    render(<HandoffControls conversationId="conv-1" botPaused={false} />);

    const input = document.querySelector(
      'input[name="paused"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("true");
  });

  it("hidden input 'conversationId' ma prawidłową wartość", () => {
    render(<HandoffControls conversationId="conv-abc" botPaused={false} />);

    const input = document.querySelector(
      'input[name="conversationId"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("conv-abc");
  });
});
