export type DesignActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
  warnings?: string[];
};

export const initialDesignActionState: DesignActionState = {
  status: "idle",
  message: "",
};
