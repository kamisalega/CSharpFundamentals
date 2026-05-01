import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/hotel_bot_test",
    },
  },
});

export async function resetTestDb(): Promise<void> {
  await testPrisma.$transaction([
    testPrisma.paymentLink.deleteMany(),
    testPrisma.roomNight.deleteMany(),
    testPrisma.reservation.deleteMany(),
    testPrisma.message.deleteMany(),
    testPrisma.outboxMessage.deleteMany(),
    testPrisma.conversation.deleteMany(),
    testPrisma.processedWebhookEvent.deleteMany(),
    testPrisma.ratePlan.deleteMany(),
    testPrisma.room.deleteMany(),
    testPrisma.adminUser.deleteMany(),
  ]);
}

export type SeedRoomOpts = Readonly<{
  name?: string;
  capacity?: number;
  basePrice?: number;
  from: Date;
  days: number;
}>;

export async function seedTestRoom(opts: SeedRoomOpts) {
  const room = await testPrisma.room.create({
    data: {
      name: opts.name ?? "Test Room",
      description: "Test room",
      capacity: opts.capacity ?? 2,
      basePrice: opts.basePrice ?? 12000,
    },
  });

  const start = new Date(
    Date.UTC(
      opts.from.getUTCFullYear(),
      opts.from.getUTCMonth(),
      opts.from.getUTCDate(),
    ),
  );
  const ratePlans = [];
  for (let i = 0; i < opts.days; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    ratePlans.push({
      roomId: room.id,
      date,
      price: room.basePrice,
      available: true,
    });
  }
  await testPrisma.ratePlan.createMany({ data: ratePlans });

  return room;
}
