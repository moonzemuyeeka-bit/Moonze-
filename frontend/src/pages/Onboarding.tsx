import { useState } from "react";
import { api, Customer, Eligibility } from "../lib/api";
import { bandColor, kwacha, pct, severityBadge } from "../lib/format";

type Step = 0 | 1 | 2 | 3;

const STEPS = ["Identity", "KYC & Face ID", "Mobile Money", "Decision"];

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState(false);

  const [identity, setIdentity] = useState({
    full_name: "",
    mobile_number: "",
    nrc_number: "",
    region: "Lusaka",
    mno: "Airtel",
    device_fingerprint: "device-" + Math.random().toString(36).slice(2, 8),
  });

  const [kyc, setKyc] = useState({
    tpin: "",
    id_front_captured: true,
    id_back_captured: true,
    selfie_captured: true,
    face_match_score: 0.95,
  });

  const [mm, setMm] = useState({
    account_age_months: 24,
    avg_monthly_inflow: 5000,
    avg_monthly_outflow: 3500,
    monthly_txn_count: 30,
    avg_wallet_balance: 900,
    cashout_ratio: 0.5,
    bill_payments_per_month: 2,
    airtime_topups_per_month: 3,
    days_since_sim_swap: 400,
  });

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitIdentity = () =>
    wrap(async () => {
      const c = await api.createCustomer(identity);
      setCustomer(c);
      setStep(1);
    });

  const submitKyc = () =>
    wrap(async () => {
      if (!customer) return;
      const c = await api.submitKyc(customer.id, kyc);
      setCustomer(c);
      setStep(2);
    });

  const submitMm = () =>
    wrap(async () => {
      if (!customer) return;
      await api.setMobileMoney(customer.id, mm);
      const elig = await api.eligibility(customer.id);
      setEligibility(elig);
      setStep(3);
    });

  const reset = () => {
    setStep(0);
    setCustomer(null);
    setEligibility(null);
    setError(null);
    setIdentity({ ...identity, full_name: "", mobile_number: "", nrc_number: "" });
  };

  return (
    <>
      <h1 className="page-title">Onboard &amp; Score a Customer</h1>
      <p className="page-sub">
        KYC with NRC, T-PIN and Face ID, then an instant mobile-money credit decision.
      </p>

      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            {i + 1}. {s}
          </div>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {step === 0 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <label>Full name</label>
          <input
            value={identity.full_name}
            onChange={(e) => setIdentity({ ...identity, full_name: e.target.value })}
            placeholder="e.g. Mercy Mumba"
          />
          <div className="row">
            <div>
              <label>Mobile number</label>
              <input
                value={identity.mobile_number}
                onChange={(e) => setIdentity({ ...identity, mobile_number: e.target.value })}
                placeholder="260970000000"
              />
            </div>
            <div>
              <label>Mobile network</label>
              <select value={identity.mno} onChange={(e) => setIdentity({ ...identity, mno: e.target.value })}>
                <option>Airtel</option>
                <option>MTN</option>
                <option>Zamtel</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div>
              <label>NRC number</label>
              <input
                value={identity.nrc_number}
                onChange={(e) => setIdentity({ ...identity, nrc_number: e.target.value })}
                placeholder="123456/78/1"
              />
            </div>
            <div>
              <label>Region</label>
              <select value={identity.region} onChange={(e) => setIdentity({ ...identity, region: e.target.value })}>
                <option>Lusaka</option>
                <option>Copperbelt</option>
                <option>Southern</option>
                <option>Eastern</option>
                <option>Northern</option>
              </select>
            </div>
          </div>
          <button className="btn" disabled={busy || !identity.full_name || !identity.mobile_number || !identity.nrc_number} onClick={submitIdentity}>
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <label>ZRA T-PIN</label>
          <input value={kyc.tpin} onChange={(e) => setKyc({ ...kyc, tpin: e.target.value })} placeholder="10-digit Taxpayer PIN" />
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            {[
              ["id_front_captured", "NRC front"],
              ["id_back_captured", "NRC back"],
              ["selfie_captured", "Selfie / liveness"],
            ].map(([key, lbl]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", margin: 0 }}
                  checked={(kyc as any)[key]}
                  onChange={(e) => setKyc({ ...kyc, [key]: e.target.checked })}
                />
                {lbl} captured
              </label>
            ))}
          </div>
          <label>Face-ID match score: {pct(kyc.face_match_score)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={kyc.face_match_score}
            onChange={(e) => setKyc({ ...kyc, face_match_score: Number(e.target.value) })}
          />
          <p className="muted" style={{ fontSize: 13 }}>
            A match below 75% is auto-rejected pending manual review — the first line of defence
            against identity fraud.
          </p>
          <button className="btn" disabled={busy || !kyc.tpin} onClick={submitKyc}>
            Verify identity
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ maxWidth: 720 }}>
          <p className="muted" style={{ marginTop: 0 }}>
            These signals are read from the customer's mobile-money statement and drive the credit
            score.
          </p>
          <div className="grid cols-3">
            {(
              [
                ["account_age_months", "Wallet age (months)"],
                ["avg_monthly_inflow", "Avg monthly inflow (ZMW)"],
                ["avg_monthly_outflow", "Avg monthly outflow (ZMW)"],
                ["monthly_txn_count", "Transactions / month"],
                ["avg_wallet_balance", "Avg wallet balance (ZMW)"],
                ["bill_payments_per_month", "Bill payments / month"],
                ["airtime_topups_per_month", "Airtime top-ups / month"],
                ["days_since_sim_swap", "Days since SIM swap"],
              ] as [keyof typeof mm, string][]
            ).map(([key, lbl]) => (
              <div key={key}>
                <label>{lbl}</label>
                <input
                  type="number"
                  value={mm[key]}
                  onChange={(e) => setMm({ ...mm, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <div>
              <label>Cash-out ratio: {pct(mm.cashout_ratio)}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={mm.cashout_ratio}
                onChange={(e) => setMm({ ...mm, cashout_ratio: Number(e.target.value) })}
              />
            </div>
          </div>
          <button className="btn" disabled={busy} onClick={submitMm}>
            Run credit decision
          </button>
        </div>
      )}

      {step === 3 && eligibility && (
        <Decision eligibility={eligibility} customerId={customer!.id} onReset={reset} />
      )}
    </>
  );
}

function Decision({
  eligibility,
  customerId,
  onReset,
}: {
  eligibility: Eligibility;
  customerId: number;
  onReset: () => void;
}) {
  const { credit, risk } = eligibility;
  const [amount, setAmount] = useState(Math.min(eligibility.max_amount, 500));
  const [msg, setMsg] = useState<string | null>(null);

  const apply = async () => {
    try {
      const loan = await api.applyLoan(customerId, amount);
      setMsg(
        loan.status === "approved"
          ? `Loan #${loan.id} approved for ${kwacha(loan.principal)} — total due ${kwacha(loan.total_due)}.`
          : `Application #${loan.id} was ${loan.status}.`
      );
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Credit decision
        </h2>
        <div className={`alert ${eligibility.eligible ? "ok" : "error"}`}>
          {eligibility.eligible
            ? `Eligible — offer up to ${kwacha(eligibility.max_amount)}`
            : "Not eligible"}
        </div>
        <ul style={{ margin: "0 0 16px", paddingLeft: 18 }} className="muted">
          {eligibility.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        {credit && (
          <div className="score-ring">
            <div
              className="gauge"
              style={{
                background: `conic-gradient(${bandColor(credit.risk_band)} ${
                  ((credit.score - 300) / 550) * 360
                }deg, #0e1530 0deg)`,
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: "50%",
                  background: "#141c3a",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {credit.score}
              </div>
            </div>
            <div>
              <div>
                <span className="pill-band" style={{ background: bandColor(credit.risk_band), color: "#0b1020" }}>
                  {credit.risk_band}
                </span>{" "}
                <span className="muted">risk band</span>
              </div>
              <p style={{ margin: "10px 0 2px" }}>PD: {pct(credit.probability_of_default)}</p>
              <p className="muted" style={{ margin: 0 }}>
                Net cash-flow {kwacha(credit.net_monthly_cashflow)}/mo
              </p>
            </div>
          </div>
        )}

        {credit && (
          <>
            <h3 className="section-title">Why this score</h3>
            <ul className="factors" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {credit.factors.map((f) => (
                <li key={f.name}>
                  <span>
                    <strong>{f.name}</strong>
                    <br />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {f.detail}
                    </span>
                  </span>
                  <span className={`pts ${f.points >= 0 ? "pos" : "neg"}`}>
                    {f.points >= 0 ? "+" : ""}
                    {f.points}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Risk &amp; fraud checks
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Risk score: <strong>{risk?.score ?? 0}/100</strong>{" "}
            {risk?.blocked && <span className="badge red">BLOCKED</span>}
          </p>
          {risk && risk.signals.length === 0 && <p className="muted">All checks passed cleanly.</p>}
          {risk?.signals.map((s) => (
            <div key={s.code} style={{ marginBottom: 10 }}>
              <span className={`badge ${severityBadge(s.severity)}`}>{s.severity}</span>{" "}
              <strong>{s.code}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {s.message}
              </div>
            </div>
          ))}
        </div>

        {eligibility.eligible && (
          <div className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Create loan
            </h2>
            <label>Amount (max {kwacha(eligibility.max_amount)})</label>
            <input
              type="number"
              value={amount}
              max={eligibility.max_amount}
              min={50}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <button className="btn good" onClick={apply} disabled={amount < 50 || amount > eligibility.max_amount}>
              Approve loan
            </button>
            {msg && <div className="alert ok" style={{ marginTop: 14 }}>{msg}</div>}
          </div>
        )}

        <button className="btn ghost" style={{ marginTop: 18 }} onClick={onReset}>
          Onboard another customer
        </button>
      </div>
    </div>
  );
}
