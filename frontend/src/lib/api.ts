// Thin typed wrapper around the Zatu backend REST API.
// All calls go through the Vite dev proxy at /api.

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export interface Customer {
  id: number;
  full_name: string;
  mobile_number: string;
  nrc_number: string;
  tpin: string | null;
  region: string | null;
  mno: string | null;
  kyc_status: string;
  face_match_score: number | null;
  created_at: string;
}

export interface ScoreFactor {
  name: string;
  detail: string;
  points: number;
}

export interface Credit {
  score: number;
  risk_band: string;
  probability_of_default: number;
  recommended_limit: number;
  net_monthly_cashflow: number;
  factors: ScoreFactor[];
}

export interface RiskSignal {
  code: string;
  message: string;
  severity: string;
}

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
  max_amount: number;
  existing_exposure: number;
  credit: Credit | null;
  risk: { blocked: boolean; score: number; signals: RiskSignal[] } | null;
}

export interface Loan {
  id: number;
  customer_id: number;
  principal: number;
  interest_rate: number;
  term_days: number;
  status: string;
  credit_score: number | null;
  risk_band: string | null;
  total_due: number;
  amount_repaid: number;
  outstanding: number;
  created_at: string;
  disbursed_at: string | null;
  due_date: string | null;
}

export interface Overview {
  loan_count: number;
  disbursed_count: number;
  principal_disbursed: number;
  outstanding: number;
  par_amount: number;
  par_ratio: number;
  payment_rate: number;
  default_rate: number;
}

export interface Segment extends Overview {
  segment: string;
}

export interface DueItem {
  loan_id: number;
  customer_id: number;
  customer_name: string;
  mobile_number: string;
  outstanding: number;
  due_date: string;
  days_to_due: number;
  overdue: boolean;
}

export interface MobileMoney {
  account_age_months: number;
  avg_monthly_inflow: number;
  avg_monthly_outflow: number;
  monthly_txn_count: number;
  avg_wallet_balance: number;
  cashout_ratio: number;
  bill_payments_per_month: number;
  airtime_topups_per_month: number;
  days_since_sim_swap: number;
}

export const api = {
  listCustomers: () => request<Customer[]>("/customers"),
  getCustomer: (id: number) => request<Customer>(`/customers/${id}`),
  createCustomer: (data: Record<string, unknown>) =>
    request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
  submitKyc: (id: number, data: Record<string, unknown>) =>
    request<Customer>(`/customers/${id}/kyc`, { method: "POST", body: JSON.stringify(data) }),
  setMobileMoney: (id: number, data: MobileMoney) =>
    request<Customer>(`/customers/${id}/mobile-money`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  eligibility: (id: number) => request<Eligibility>(`/customers/${id}/eligibility`),
  applyLoan: (id: number, amount: number, term_days?: number) =>
    request<Loan>(`/customers/${id}/loans`, {
      method: "POST",
      body: JSON.stringify({ amount, term_days }),
    }),
  customerLoans: (id: number) => request<Loan[]>(`/customers/${id}/loans`),
  allLoans: () => request<Loan[]>("/loans"),
  disburse: (loanId: number) => request<Loan>(`/loans/${loanId}/disburse`, { method: "POST" }),
  repay: (loanId: number, amount: number) =>
    request<Loan>(`/loans/${loanId}/repay`, { method: "POST", body: JSON.stringify({ amount }) }),
  overview: () => request<Overview>("/intelligence/overview"),
  segments: (dimension: string) => request<Segment[]>(`/intelligence/segments?dimension=${dimension}`),
  upcomingDue: () => request<DueItem[]>("/intelligence/upcoming-due"),
  generateNudges: () =>
    request<{ created: number; nudges: { message: string; days_to_due: number }[] }>(
      "/intelligence/nudges/generate",
      { method: "POST" }
    ),
};
