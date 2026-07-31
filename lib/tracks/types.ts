export type TrackActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialTrackActionState: TrackActionState = { status: "idle", message: "" };
