"use client";

import Link from "next/link";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { maskPhone } from "@/security/maskPII";

export type ConversationRow = {
  id: string;
  phone: string;
  state: string;
  botPaused: boolean;
  updatedAt: Date;
  messages: { body: string; createdAt: Date }[];
};

export function ConversationsTable({
  conversations,
}: {
  conversations: ConversationRow[];
}) {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Telefon</TableCell>
            <TableCell>Stan</TableCell>
            <TableCell>Ostatnia wiadomość</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {conversations.map((conv) => (
            <TableRow key={conv.id}>
              <TableCell>{maskPhone(conv.phone)}</TableCell>
              <TableCell>{conv.state}</TableCell>
              <TableCell>
                {conv.messages[0]?.body.slice(0, 60) ?? "—"}
              </TableCell>
              <TableCell>
                {conv.botPaused && (
                  <Chip label="BOT PAUSED" color="warning" size="small" />
                )}
              </TableCell>
              <TableCell>
                <Link href={`/admin/conversations/${conv.id}`}>Szczegóły</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
