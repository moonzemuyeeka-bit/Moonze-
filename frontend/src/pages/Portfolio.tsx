import { useEffect, useState } from "react";
import { api, Loan } from "../lib/api";
import { kwacha, statusBadge } from "../lib/format";

export default function Portfolio() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.allLoans().then(setLoans).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const act = async (fn: () => Promise<unknown>, id: number) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1 className="page-title">Loan Book</h1>
      <p className="page-sub">Disburse approved loans and collect repayments via the pay-way.</p>
      {error && <div className="alert error">{error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Principal</th>
              <th>Total due</th>
              <th>Outstanding</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{kwacha(l.principal)}</td>
                <td>{kwacha(l.total_due)}</td>
                <td>{kwacha(l.outstanding)}</td>
                <td>
                  {l.credit_score ?? "—"} {l.risk_band && <span className="badge gray">{l.risk_band}</span>}
                </td>
                <td>
                  <span className={`badge ${statusBadge(l.status)}`}>{l.status}</span>
                </td>
                <td>
                  {l.status === "approved" && (
                    <button
                      className="btn small"
                      disabled={busy === l.id}
                      onClick={() => act(() => api.disburse(l.id), l.id)}
                    >
                      Disburse
                    </button>
                  )}
                  {(l.status === "disbursed" || l.status === "overdue") && (
                    <button
                      className="btn small good"
                      disabled={busy === l.id}
                      onClick={() => act(() => api.repay(l.id, l.outstanding), l.id)}
                    >
                      Collect {kwacha(l.outstanding)}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No loans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
