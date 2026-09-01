/** A baby is either on the way or here, and that drives most of the app. */
export type BabyStatus = "expecting" | "born";

export type BabySex = "girl" | "boy" | "surprise";

/** One picture in a baby's album, dated so the album reads as a timeline. */
export type Photo = {
  id: string;
  /** Data URL, squared and shrunk before it ever reaches storage. */
  data: string;
  /** ISO yyyy-mm-dd: when it was taken, not when it was added. */
  date: string;
  caption?: string;
};

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
  /** Grams at birth. Metric on disk, shown both ways, since people say both. */
  birthWeightGrams?: number;
  /** Centimetres at birth, to one decimal place. */
  birthLengthCm?: number;
  /** Their picture: the one on the tile. Data URL, downscaled before storing. */
  photo?: string;
  /** The album, which is a different thing from their picture. Oldest first. */
  photos?: Photo[];
  notes?: string;
  giftSent?: boolean;
  /** ISO timestamp, bumped on every write so a future server can merge. */
  updatedAt: string;
  /** Soft delete: set instead of dropping the record, for the same reason. */
  deletedAt?: string;
};

export type NewBaby = Omit<Baby, "id" | "updatedAt" | "deletedAt">;
