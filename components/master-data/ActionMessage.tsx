import type { MasterDataActionState } from "@/lib/master-data/types";

export default function ActionMessage({
  state,
}: {
  state: MasterDataActionState;
}) {
  if (!state.message) return null;

  return (
    <div
      aria-live="polite"
      className={
        state.status === "error"
          ? "text-sm text-red-300"
          : "text-sm text-green-300"
      }
    >
      <p>{state.message}</p>
      {state.fieldErrors ? (
        <ul className="mt-1 list-inside list-disc">
          {Object.values(state.fieldErrors)
            .flat()
            .map((message) => (
              <li key={message}>{message}</li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
