"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export type TranscriptMessage = {
  id: string;
  direction: string;
  body: string;
  createdAt: Date;
};

export function ConversationTranscript({
  messages,
}: {
  messages: TranscriptMessage[];
}) {
  if (messages.length === 0) {
    return <Typography color="text.secondary">Brak wiadomości</Typography>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {messages.map((msg) => (
        <Box
          key={msg.id}
          data-direction={msg.direction}
          sx={{
            display: "flex",
            justifyContent:
              msg.direction === "OUTBOUND" ? "flex-end" : "flex-start",
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 1.5,
              maxWidth: "70%",
              bgcolor:
                msg.direction === "OUTBOUND" ? "primary.light" : "grey.100",
            }}
          >
            <Typography variant="body2">{msg.body}</Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(msg.createdAt).toLocaleTimeString("fr-FR")}
            </Typography>
          </Paper>
        </Box>
      ))}
    </Box>
  );
}
