/** A baby is either on the way or here, and that drives most of the app. */
export type BabyStatus = "expecting" | "born";

export type BabySex = "girl" | "boy" | "surprise";

export type Baby = {
  id: string;
  /** Often unknown while expecting, so the app never insists on it. */
  name?: string;
  /** The friends this baby belongs to - usually what you search by. */
  parents: string[];
  status: BabyStatus;
  /** ISO yyyy-mm-dd. Set while expecting, kept afterwards as a keepsake. */
  dueDate?: string;
  /** ISO yyyy-mm-dd. */
  birthDate?: string;
  /** HH:mm. Optional, but sharpens the star sign on a cusp day. */
  birthTime?: string;
  sex?: BabySex;
  /** Data URL, downscaled before it is stored. */
  photo?: string;
  notes?: string;
  giftSent?: boolean;
  /** ISO timestamp, bumped on every write so a future server can merge. */
  updatedAt: string;
  /** Soft delete: set instead of dropping the record, for the same reason. */
  deletedAt?: string;
};

export type NewBaby = Omit<Baby, "id" | "updatedAt" | "deletedAt">;
