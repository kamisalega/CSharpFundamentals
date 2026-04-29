import Typography from "@mui/material/Typography";
import { prisma } from "@/db/prisma";
import { ReservationsTable } from "./ReservationsTable";

export default async function ReservationsPage() {
  const reservations = await prisma.reservation.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      guestName: true,
      guestEmail: true,
      checkIn: true,
      checkOut: true,
      total: true,
      status: true,
    },
  });

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Rezerwacje
      </Typography>
      <ReservationsTable reservations={reservations} />
    </>
  );
}
