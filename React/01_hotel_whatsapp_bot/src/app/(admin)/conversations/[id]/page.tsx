import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { prisma } from "@/db/prisma";
import { ConversationTranscript } from "./ConversationTranscript";
import { HandoffControls } from "./HandoffControls";

type Props = { params: Promise<{ id: string }> };

export default async function ConversationDetailPage({ params }: Props) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) notFound();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h5">Konwersacja #{id.slice(-8)}</Typography>
        <HandoffControls
          conversationId={conversation.id}
          botPaused={conversation.botPaused}
        />
      </Box>
      <ConversationTranscript messages={conversation.messages} />
    </Box>
  );
}
