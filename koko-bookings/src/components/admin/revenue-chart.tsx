import { formatKwacha } from "@/lib/money";
import { formatDateShort } from "@/lib/time";

/**
 * Fourteen-day value bar chart. Hand-drawn with divs so it stays light, scales
 * on a phone, and exposes the same numbers to screen readers via a table.
 */
export function RevenueChart({
  data,
}: {
  data: { date: string; ngwee: number }[];
}) {
  const max = Math.max(1, ...data.map((point) => point.ngwee));

  return (
    <figure className="space-y-3">
      <div className="flex h-40 items-end gap-1.5" aria-hidden>
        {data.map((point) => {
          const height = Math.round((point.ngwee / max) * 100);
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-lg bg-linear-to-t from-blush-300 to-blush-500 transition-all"
                  style={{ height: `${Math.max(height, point.ngwee > 0 ? 4 : 1)}%` }}
                  title={`${point.date}: ${formatKwacha(point.ngwee)}`}
                />
              </div>
              <span className="w-full truncate text-center text-[0.6rem] text-ink-muted">
                {point.date.slice(-2)}
              </span>
            </div>
          );
        })}
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>Value collected per day over the last {data.length} days</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date}>
                <th scope="row">{formatDateShort(point.date)}</th>
                <td>{formatKwacha(point.ngwee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
