import { AvailableRoom } from "@/pms/PmsPort";

export interface FlowSlots {
  checkIn?: Date;
  checkOut?: Date;
  guests?: {
    adults: number;
    children: number;
  };
  selectedRoomId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  breakfast?: boolean;
  reservationId?: string;
  totalAmount?: number;
  paymentUrl?: string;
   availableRooms?: AvailableRoom[];
}
