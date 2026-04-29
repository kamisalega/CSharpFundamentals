import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { toggleBotAction } from "./actions";
import Button from "@mui/material/Button";

type Props = { conversationId: string; botPaused: boolean };

export function HandoffControls({ conversationId, botPaused }: Props) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
      {botPaused && (
        <Chip label="BOT WSTRZYMANY" color="warning" size="small" />
      )}
      <form action={toggleBotAction}>
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="paused" value={String(!botPaused)} />
        <Button
          type="submit"
          variant="outlined"
          color={botPaused ? "success" : "warning"}
          size="small"
        >
          {botPaused ? "Wznów bota" : "Wstrzymaj bota"}
        </Button>
      </form>
    </Box>
  );
}
