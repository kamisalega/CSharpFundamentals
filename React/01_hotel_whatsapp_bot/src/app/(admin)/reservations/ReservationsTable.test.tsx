// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservationsTable, type ReservationRow } from "./ReservationsTable";

function makeReservation(
  overrides: Partial<ReservationRow> = {},
): ReservationRow {
  return {
    id: "res-1",
    code: "RES-ABC123",
    guestName: "Jean Dupont",
    guestEmail: "jean.dupont@email.com",
    checkIn: new Date("2026-08-12"),
    checkOut: new Date("2026-08-15"),
    total: 36000,
    status: "CONFIRMED",
    ...overrides,
  };
}

describe("ReservationsTable", () => {
  it("renderuje kod rezerwacji", () => {
    render(<ReservationsTable reservations={[makeReservation()]} />);

    expect(screen.getByText("RES-ABC123")).toBeTruthy();
  });

  it("renderuje imię gościa", () => {
    render(<ReservationsTable reservations={[makeReservation()]} />);

    expect(screen.getByText("Jean Dupont")).toBeTruthy();
  });

  it("renderuje zamaskowany email gościa", () => {
    render(<ReservationsTable reservations={[makeReservation()]} />);

    expect(screen.getByText("j***@email.com")).toBeTruthy();
  });

  it("przelicza kwotę z centów na euro", () => {
    render(
      <ReservationsTable reservations={[makeReservation({ total: 36000 })]} />,
    );

    expect(screen.getByText("360.00 €")).toBeTruthy();
  });

  it("renderuje status jako chip", () => {
    render(
      <ReservationsTable
        reservations={[makeReservation({ status: "CONFIRMED" })]}
      />,
    );

    expect(screen.getByText("CONFIRMED")).toBeTruthy();
  });

  it("renderuje status CANCELLED", () => {
    render(
      <ReservationsTable
        reservations={[makeReservation({ status: "CANCELLED" })]}
      />,
    );

    expect(screen.getByText("CANCELLED")).toBeTruthy();
  });

  it("renderuje nagłówki tabeli", () => {
    render(<ReservationsTable reservations={[]} />);

    expect(screen.getByText("Kod")).toBeTruthy();
    expect(screen.getByText("Gość")).toBeTruthy();
    expect(screen.getByText("Kwota")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
  });

  it("renderuje wiele rezerwacji", () => {
    render(
      <ReservationsTable
        reservations={[
          makeReservation({ id: "1", code: "RES-001" }),
          makeReservation({ id: "2", code: "RES-002" }),
        ]}
      />,
    );

    expect(screen.getByText("RES-001")).toBeTruthy();
    expect(screen.getByText("RES-002")).toBeTruthy();
  });
});
