import { countryCodeToFlagEmoji, countryOptions } from "@/lib/countries";

type CountrySelectProps = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
  required?: boolean;
};

export default function CountrySelect({
  name = "countryCode",
  defaultValue,
  className = "form-control mt-2",
  required = true,
}: CountrySelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue?.trim().toUpperCase() ?? ""}
      required={required}
      className={className}
    >
      {!required ? <option value="">Land nicht angegeben</option> : null}
      {countryOptions.map((country) => (
        <option key={country.code} value={country.code}>
          {countryCodeToFlagEmoji(country.code)} {country.name} – {country.code}
        </option>
      ))}
    </select>
  );
}
