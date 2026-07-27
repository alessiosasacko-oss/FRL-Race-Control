type TableShellProps = {
  children: React.ReactNode;
  className?: string;
  label?: string;
};

export default function TableShell({
  children,
  className = "",
  label,
}: TableShellProps) {
  return (
    <div
      className={`data-table-shell overflow-x-auto ${className}`}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
