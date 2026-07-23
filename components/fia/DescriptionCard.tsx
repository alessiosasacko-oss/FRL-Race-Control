type Props = {
  ticket: any;
};

export default function DescriptionCard({ ticket }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6">
      <h2 className="mb-5 text-xl font-bold text-white">
        Vorfallsbeschreibung
      </h2>

      <p className="leading-8 text-slate-300">
        {ticket.description}
      </p>
    </div>
  );
}