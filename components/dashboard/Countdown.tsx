"use client";

import { useEffect, useState } from "react";

function remaining(target: string): string {
  const difference = Math.max(
    0,
    new Date(target).getTime() - Date.now(),
  );
  if (difference === 0) return "Startet jetzt";

  const totalMinutes = Math.floor(difference / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}T ${hours}Std ${minutes}Min`;
}

export default function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState(() => remaining(target));

  useEffect(() => {
    const update = () => setLabel(remaining(target));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [target]);

  return (
    <span
      suppressHydrationWarning
      className="font-mono text-[inherit] font-black tracking-tight text-cyan-200"
    >
      {label}
    </span>
  );
}
