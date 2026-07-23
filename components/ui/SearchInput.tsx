import { ReactNode } from "react";

type Props = {
  title: string;
  value: string | number;
  icon: ReactNode;
};

export default function StatCard({
  title,
  value,
  icon,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#151B24] p-5">

      <div className="flex justify-between items-center">

        <div>
          <p className="text-slate-400 text-sm">
            {title}
          </p>

          <h2 className="text-3xl font-bold mt-1">
            {value}
          </h2>
        </div>

        <div className="rounded-xl bg-blue-600 p-3">
          {icon}
        </div>

      </div>

    </div>
  );
}