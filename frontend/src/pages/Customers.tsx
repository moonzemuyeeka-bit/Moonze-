import { useEffect, useState } from "react";
import { api, Customer } from "../lib/api";
import { statusBadge } from "../lib/format";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    api.listCustomers().then(setCustomers).catch(() => {});
  }, []);

  return (
    <>
      <h1 className="page-title">Customers</h1>
      <p className="page-sub">Everyone onboarded into the lending pipeline.</p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>NRC</th>
              <th>Network</th>
              <th>Region</th>
              <th>KYC</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.full_name}</td>
                <td>{c.mobile_number}</td>
                <td>{c.nrc_number}</td>
                <td>
                  <span className="badge blue">{c.mno ?? "—"}</span>
                </td>
                <td>{c.region ?? "—"}</td>
                <td>
                  <span className={`badge ${statusBadge(c.kyc_status)}`}>{c.kyc_status}</span>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No customers yet. Head to Onboard &amp; Score to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
