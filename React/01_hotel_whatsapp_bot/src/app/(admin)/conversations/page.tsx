import Typography from "@mui/material/Typography";
import { ConversationsTable } from "./ConversationsTable";
import { prisma } from "@/db/prisma";

export default async function ConversationsPage() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
  });

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Konwersacje
      </Typography>
      <ConversationsTable conversations={conversations} />
    </>
  );
}
