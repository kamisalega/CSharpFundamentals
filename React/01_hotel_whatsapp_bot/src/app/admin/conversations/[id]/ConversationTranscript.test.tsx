// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ConversationTranscript,
  type TranscriptMessage,
} from "./ConversationTranscript";

function makeMessage(
  overrides: Partial<TranscriptMessage> = {},
): TranscriptMessage {
  return {
    id: "msg-1",
    direction: "INBOUND",
    body: "Bonjour",
    createdAt: new Date("2026-04-29T10:00:00Z"),
    ...overrides,
  };
}

describe("ConversationTranscript", () => {
  it("renderuje treść wiadomości", () => {
    render(
      <ConversationTranscript messages={[makeMessage({ body: "Bonjour!" })]} />,
    );

    expect(screen.getByText("Bonjour!")).toBeTruthy();
  });

  it("wyświetla 'Brak wiadomości' dla pustej listy", () => {
    render(<ConversationTranscript messages={[]} />);

    expect(screen.getByText("Brak wiadomości")).toBeTruthy();
  });

  it("renderuje wiadomości w kolejności (pierwsza przed drugą w DOM)", () => {
    const messages = [
      makeMessage({ id: "1", body: "Pierwsza wiadomość" }),
      makeMessage({ id: "2", body: "Druga wiadomość" }),
    ];
    render(<ConversationTranscript messages={messages} />);

    const first = screen.getByText("Pierwsza wiadomość");
    const second = screen.getByText("Druga wiadomość");

    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("OUTBOUND ma atrybut data-direction='OUTBOUND'", () => {
    render(
      <ConversationTranscript
        messages={[
          makeMessage({ direction: "OUTBOUND", body: "Odpowiedź bota" }),
        ]}
      />,
    );

    const wrapper = screen
      .getByText("Odpowiedź bota")
      .closest("[data-direction]");
    expect(wrapper?.getAttribute("data-direction")).toBe("OUTBOUND");
  });

  it("INBOUND ma atrybut data-direction='INBOUND'", () => {
    render(
      <ConversationTranscript
        messages={[
          makeMessage({ direction: "INBOUND", body: "Wiadomość gościa" }),
        ]}
      />,
    );

    const wrapper = screen
      .getByText("Wiadomość gościa")
      .closest("[data-direction]");
    expect(wrapper?.getAttribute("data-direction")).toBe("INBOUND");
  });

  it("renderuje oba kierunki wiadomości", () => {
    const messages = [
      makeMessage({ id: "1", direction: "INBOUND", body: "Wiadomość gościa" }),
      makeMessage({ id: "2", direction: "OUTBOUND", body: "Odpowiedź bota" }),
    ];
    render(<ConversationTranscript messages={messages} />);

    expect(screen.getByText("Wiadomość gościa")).toBeTruthy();
    expect(screen.getByText("Odpowiedź bota")).toBeTruthy();
  });
});
