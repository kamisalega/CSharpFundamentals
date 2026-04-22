const MAX_NIGHTS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function eachNightBetween(
  checkIn: Date,
  checkOut: Date,
): readonly Date[] {
  const nights: Date[] = [];
  const start = startOfDayUtc(checkIn);
  const end = startOfDayUtc(checkOut);

  for (let cur = start; cur < end; cur = new Date(cur.getTime() + MS_PER_DAY)) {
    nights.push(new Date(cur));
  }
  return nights;
}

export function validateStay(input: StayInput): void {
  const checkIn = startOfDayUtc(input.checkIn);
  const checkOut = startOfDayUtc(input.checkOut);
  const today = startOfDayUtc(input.now);

  if (checkOut <= checkIn) {
    throw new Error("checkOut must be after checkIn");
  }
  if (checkIn < today) {
    throw new Error("checkIn must not be in the past");
  }
  const nights = (checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY;
  if (nights > MAX_NIGHTS) {
    throw new Error(`stay must not exceed ${MAX_NIGHTS} nights`);
  }
}

export type StayInput = Readonly<{
  checkIn: Date;
  checkOut: Date;
  now: Date;
}>;
