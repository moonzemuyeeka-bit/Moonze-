import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, DueItem, Overview, Segment } from "../lib/api";
import { bandColor, kwacha, pct } from "../lib/format";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [due, setDue] = useState<DueItem[]>([]);
  const [dimension, setDimension] = useState("risk_band");
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);

  const load = () => {
    api.overview().then(setOverview).catch(() => {});
    api.segments(dimension).then(setSegments).catch(() => {});
    api.upcomingDue().then(setDue).catch(() => {});
  };

  useEffect(load, [dimension]);

  const runNudges = async () => {
    const res = await api.generateNudges();
    setNudgeMsg(`Generated ${res.created} repayment reminder(s).`);
    setTimeout(() => setNudgeMsg(null), 4000);
  };

  return (
    <>
      <h1 className="page-title">Portfolio Intelligence</h1>
      <p className="page-sub">
        Live loan-book health, segment performance and repayment risk — the signal your credit
        team runs on.
      </p>

      {overview && (
        <div className="grid cols-4">
          <Kpi label="Outstanding Book" value={kwacha(overview.outstanding)} />
          <Kpi label="On-time Payment Rate" value={pct(overview.payment_rate)} sub="of closed loans repaid in full" />
          <Kpi label="Portfolio at Risk" value={pct(overview.par_ratio)} sub={kwacha(overview.par_amount)} />
          <Kpi label="Default Rate" value={pct(overview.default_rate)} sub={`${overview.disbursed_count} disbursed`} />
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Performance by segment
            </h2>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value)}
              style={{ width: 160, marginBottom: 0 }}
            >
              <option value="risk_band">Risk band</option>
              <option value="mno">Mobile network</option>
              <option value="region">Region</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={segments} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26315c" />
              <XAxis dataKey="segment" stroke="#9aa6c9" fontSize={12} />
              <YAxis stroke="#9aa6c9" fontSize={12} domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} />
              <Tooltip
                formatter={(v: number) => pct(v)}
                contentStyle={{ background: "#161e3d", border: "1px solid #26315c", borderRadius: 12 }}
              />
              <Bar dataKey="payment_rate" name="Payment rate" radius={[6, 6, 0, 0]}>
                {segments.map((s, i) => (
                  <Cell key={i} fill={dimension === "risk_band" ? bandColor(s.segment) : "#6c5ce7"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Segment</th>
                <th>Loans</th>
                <th>Payment rate</th>
                <th>PAR</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <tr key={s.segment}>
                  <td>
                    <span className="badge blue">{s.segment}</span>
                  </td>
                  <td>{s.loan_count}</td>
                  <td>{pct(s.payment_rate)}</td>
                  <td>{pct(s.par_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Repayment radar
            </h2>
            <button className="btn small" onClick={runNudges}>
              Send reminders
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Customers due within 7 days or already overdue. Nudges go out automatically before the
            due date.
          </p>
          {nudgeMsg && <div className="alert ok">{nudgeMsg}</div>}
          {due.length === 0 && <p className="muted">No loans due in the reminder window.</p>}
          {due.map((d) => (
            <div className="nudge" key={d.loan_id}>
              <div className="meta">
                {d.customer_name} · {d.mobile_number}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{kwacha(d.outstanding)} outstanding</span>
                {d.overdue ? (
                  <span className="badge red">{Math.abs(d.days_to_due)}d overdue</span>
                ) : (
                  <span className="badge amber">due in {d.days_to_due}d</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
