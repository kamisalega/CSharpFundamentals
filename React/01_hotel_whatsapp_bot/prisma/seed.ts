 import { PrismaClient } from "@prisma/client";
  import bcrypt from "bcryptjs";

  const prisma = new PrismaClient();

  type RoomSeed = {
    name: string;
    description: string;
    capacity: number;
    basePrice: number; // centy
  };

  const ROOMS: readonly RoomSeed[] = [
    {
      name: "Chambre Standard",
      description: "Confortable, 18 m², lit double, vue jardin.",
      capacity: 2,
      basePrice: 9500,
    },
    {
      name: "Chambre Supérieure",
      description: "Spacieuse, 25 m², lit king-size, balcon.",
      capacity: 2,
      basePrice: 12000,
    },
    {
      name: "Suite Familiale",
      description: "40 m², lit king + 2 lits simples, salon.",
      capacity: 4,
      basePrice: 18000,
    },
  ];

  async function main() {
    console.log("🌱 Seeding database...");

    const passwordHash = await bcrypt.hash("admin123", 12);
    await prisma.adminUser.upsert({
      where: { email: "admin@hotel.local" },
      update: {},
      create: { email: "admin@hotel.local", passwordHash },
    });

    for (const r of ROOMS) {
      const existing = await prisma.room.findFirst({ where: { name: r.name } });
      if (!existing) {
        await prisma.room.create({ data: r });
      }
    }

    const rooms = await prisma.room.findMany();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const room of rooms) {
      for (let i = 0; i < 60; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const isWeekend = date.getDay() === 5 || date.getDay() === 6;
        const price = isWeekend
          ? Math.round(room.basePrice * 1.2)
          : room.basePrice;

        await prisma.ratePlan.upsert({
          where: { roomId_date: { roomId: room.id, date } },
          update: { price, available: true },
          create: { roomId: room.id, date, price, available: true },
        });
      }
    }

    console.log("✅ Seed done.");
  }

  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });