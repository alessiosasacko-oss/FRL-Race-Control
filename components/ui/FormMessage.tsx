type FormMessageProps = {
  state: {
    status: "idle" | "success" | "error";
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export default function FormMessage({ state }: FormMessageProps) {
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
        <ul className="mt-2 list-inside list-disc">
          {Object.values(state.fieldErrors)
            .flat()
            .map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
