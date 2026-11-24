export type ShareCheckStatus =
  | "exposed"
  | "review"
  | "removed"
  | "kept"
  | "reduced"
  | "ok";

export type ShareCheckTone = "risk" | "warn" | "ok";

export type ShareCheckIcon =
  | "location"
  | "camera"
  | "calendar"
  | "file"
  | "eye"
  | "clock"
  | "hash"
  | "user";

export interface ShareCheckItem {
  label: string;
  before: string;
  after: string;
  status: ShareCheckStatus;
  icon?: ShareCheckIcon;
  note?: string;
}

/** Pills always carry text, so colour is never the only signal. */
export const shareStatusLabels: Record<ShareCheckStatus, string> = {
  exposed: "Exposed",
  review: "Review",
  removed: "Removed",
  kept: "Kept",
  reduced: "Reduced",
  ok: "OK",
};

/** --risk only for exposed, --warn for review, --ok for everything done. */
export const shareStatusTone: Record<ShareCheckStatus, ShareCheckTone> = {
  exposed: "risk",
  review: "warn",
  removed: "ok",
  kept: "ok",
  reduced: "ok",
  ok: "ok",
};
