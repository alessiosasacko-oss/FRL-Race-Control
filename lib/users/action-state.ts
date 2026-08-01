export type UserAdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  changes?: string[];
};

export const initialUserAdminActionState: UserAdminActionState = {
  status: "idle",
  message: "",
};
