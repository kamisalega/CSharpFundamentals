// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Page from "./page";

describe("Home Page", () => {
  it("renders the welcome header", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { name: /hotel whatsapp bot/i }),
    ).toBeInTheDocument();
  });
});
