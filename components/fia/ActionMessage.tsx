import type { FiaActionState } from "@/lib/fia/types";

type ActionMessageProps = {
  state: FiaActionState;
};

export default function ActionMessage({ state }: ActionMessageProps) {
  if (!state.message) return <span />;

  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-sm text-red-300"
          : "text-sm text-blue-300"
      }
    >
      {state.message}
    </p>
  );
}
