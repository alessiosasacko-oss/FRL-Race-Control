type BadgeProps = {
  color?: "blue" | "green" | "red" | "yellow" | "gray";
  children: React.ReactNode;
};

const colors = {
  blue: "bg-blue-500/20 text-blue-400",
  green: "bg-green-500/20 text-green-400",
  red: "bg-red-500/20 text-red-400",
  yellow: "bg-yellow-500/20 text-yellow-400",
  gray: "bg-slate-700 text-slate-300",
};

export default function Badge({
  color = "gray",
  children,
}: BadgeProps) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}