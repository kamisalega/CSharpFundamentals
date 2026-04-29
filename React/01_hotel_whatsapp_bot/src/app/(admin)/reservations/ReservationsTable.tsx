"use client";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { maskEmail } from "@/security/maskPII";

const STATUS_COLOR = {
  PENDING: "default",
  PAYMENT_SENT: "warning",
  CONFIRMED: "success",
  CANCELLED: "error",
  EXPIRED: "error",
} as const satisfies Record<
  string,
  "default" | "warning" | "success" | "error"
>;

export type ReservationRow = {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string;
  checkIn: Date;
  checkOut: Date;
  total: number;
  status: string;
};

function formatTotal(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export function ReservationsTable({
  reservations,
}: {
  reservations: ReservationRow[];
}) {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Kod</TableCell>
            <TableCell>Gość</TableCell>
            <TableCell>Check-in</TableCell>
            <TableCell>Check-out</TableCell>
            <TableCell align="right">Kwota</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reservations.map((res) => (
            <TableRow key={res.id}>
              <TableCell sx={{ fontFamily: "monospace" }}>{res.code}</TableCell>
              <TableCell>
                <div>{res.guestName}</div>
                <div style={{ fontSize: "0.75rem", color: "gray" }}>
                  {maskEmail(res.guestEmail)}
                </div>
              </TableCell>
              <TableCell>{formatDate(res.checkIn)}</TableCell>
              <TableCell>{formatDate(res.checkOut)}</TableCell>
              <TableCell align="right">{formatTotal(res.total)}</TableCell>
              <TableCell>
                <Chip
                  label={res.status}
                  color={
                    STATUS_COLOR[res.status as keyof typeof STATUS_COLOR] ??
                    "default"
                  }
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
