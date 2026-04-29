// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationsTable, type ConversationRow } from "./ConversationsTable";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function makeConversation(
  overrides: Partial<ConversationRow> = {},
): ConversationRow {
  return {
    id: "conv-1",
    phone: "+33612345678",
    state: "GREETING",
    botPaused: false,
    updatedAt: new Date("2026-04-29T10:00:00Z"),
    messages: [],
    ...overrides,
  };
}

describe("ConversationsTable", () => {
  it("renderuje zamaskowany numer telefonu", () => {
    render(<ConversationsTable conversations={[makeConversation()]} />);

    expect(screen.getByText("+336******78")).toBeTruthy();
  });

  it("renderuje stan konwersacji", () => {
    render(
      <ConversationsTable
        conversations={[makeConversation({ state: "COLLECT_DATES" })]}
      />,
    );

    expect(screen.getByText("COLLECT_DATES")).toBeTruthy();
  });

  it("renderuje badge BOT PAUSED gdy botPaused=true", () => {
    render(
      <ConversationsTable
        conversations={[makeConversation({ botPaused: true })]}
      />,
    );

    expect(screen.getByText("BOT PAUSED")).toBeTruthy();
  });

  it("nie renderuje badge gdy botPaused=false", () => {
    render(<ConversationsTable conversations={[makeConversation()]} />);

    expect(screen.queryByText("BOT PAUSED")).toBeNull();
  });

  it("renderuje treść ostatniej wiadomości", () => {
    const messages = [
      { body: "Bonjour, je voudrais réserver", createdAt: new Date() },
    ];
    render(
      <ConversationsTable conversations={[makeConversation({ messages })]} />,
    );

    expect(screen.getByText("Bonjour, je voudrais réserver")).toBeTruthy();
  });

  it("renderuje '—' gdy brak wiadomości", () => {
    render(<ConversationsTable conversations={[makeConversation()]} />);

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renderuje link do szczegółów z id konwersacji", () => {
    render(
      <ConversationsTable
        conversations={[makeConversation({ id: "abc-123" })]}
      />,
    );

    const link = screen.getByRole("link", { name: /szczegóły/i });
    expect(link.getAttribute("href")).toBe("/admin/conversations/abc-123");
  });

  it("renderuje nagłówki tabeli", () => {
    render(<ConversationsTable conversations={[]} />);

    expect(screen.getByText("Telefon")).toBeTruthy();
    expect(screen.getByText("Stan")).toBeTruthy();
    expect(screen.getByText("Ostatnia wiadomość")).toBeTruthy();
  });
});
