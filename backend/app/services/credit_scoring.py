"""Mobile-money based credit scoring engine.

The engine turns a customer's mobile-money behaviour into a credit score on the
familiar 300-850 scale, together with a probability of default (PD), a risk band
and a recommended loan limit.

Design goals
------------
* **Explainable.** Every point of the score comes from a named factor with a
  weight, so a credit officer (or the customer) can see *why* a decision was
  made. This mirrors how micro-lenders like FairMoney combine alternative-data
  signals into a transparent scorecard.
* **Deterministic & testable.** No randomness; the same inputs always produce
  the same score. This keeps the model auditable and unit-testable.
* **Capacity aware.** The recommended limit is anchored to demonstrated
  affordability (net monthly cash-flow), not just the score, so we never lend
  more than a customer can plausibly repay.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models.mobile_money import MobileMoneyProfile

SCORE_MIN = 300
SCORE_MAX = 850


@dataclass
class ScoreFactor:
    """A single, explainable contribution to the credit score."""

    name: str
    detail: str
    points: int  # signed contribution in score points


@dataclass
class CreditAssessment:
    score: int
    risk_band: str
    probability_of_default: float
    recommended_limit: float
    net_monthly_cashflow: float
    factors: list[ScoreFactor] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "risk_band": self.risk_band,
            "probability_of_default": self.probability_of_default,
            "recommended_limit": self.recommended_limit,
            "net_monthly_cashflow": self.net_monthly_cashflow,
            "factors": [
                {"name": f.name, "detail": f.detail, "points": f.points} for f in self.factors
            ],
        }


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _band(score: int) -> str:
    if score >= 750:
        return "A"  # prime
    if score >= 680:
        return "B"  # near-prime
    if score >= 600:
        return "C"  # acceptable
    if score >= 520:
        return "D"  # sub-prime, small limits only
    return "E"      # decline


def assess(profile: MobileMoneyProfile) -> CreditAssessment:
    """Produce a full, explainable credit assessment from a mobile-money profile."""
    factors: list[ScoreFactor] = []

    # Start every applicant at the bottom of the acceptable range and build up.
    base = 500
    factors.append(ScoreFactor("base", "Starting score", base))

    # 1) Account tenure — longevity is one of the strongest repayment signals.
    if profile.account_age_months >= 36:
        pts = 70
    elif profile.account_age_months >= 24:
        pts = 55
    elif profile.account_age_months >= 12:
        pts = 35
    elif profile.account_age_months >= 6:
        pts = 15
    else:
        pts = -20
    factors.append(ScoreFactor("account_tenure", f"{profile.account_age_months} months on wallet", pts))

    # 2) Income proxy — average monthly inflow (top-ups + transfers received).
    inflow = profile.avg_monthly_inflow
    if inflow >= 8000:
        pts = 80
    elif inflow >= 4000:
        pts = 60
    elif inflow >= 2000:
        pts = 40
    elif inflow >= 800:
        pts = 20
    else:
        pts = -10
    factors.append(ScoreFactor("income_proxy", f"ZMW {inflow:,.0f} avg monthly inflow", pts))

    # 3) Liquidity buffer — average wallet balance retained.
    if profile.avg_wallet_balance >= 1500:
        pts = 45
    elif profile.avg_wallet_balance >= 500:
        pts = 30
    elif profile.avg_wallet_balance >= 150:
        pts = 15
    else:
        pts = -5
    factors.append(ScoreFactor("liquidity", f"ZMW {profile.avg_wallet_balance:,.0f} avg balance", pts))

    # 4) Engagement — transaction frequency.
    if profile.monthly_txn_count >= 40:
        pts = 40
    elif profile.monthly_txn_count >= 20:
        pts = 28
    elif profile.monthly_txn_count >= 8:
        pts = 15
    else:
        pts = 0
    factors.append(ScoreFactor("engagement", f"{profile.monthly_txn_count} txns/month", pts))

    # 5) Financial discipline — regular bill payments.
    if profile.bill_payments_per_month >= 3:
        pts = 35
    elif profile.bill_payments_per_month >= 1:
        pts = 20
    else:
        pts = 0
    factors.append(ScoreFactor("bill_discipline", f"{profile.bill_payments_per_month} bills/month", pts))

    # 6) Cash-out ratio — high pass-through behaviour is riskier.
    if profile.cashout_ratio >= 0.9:
        pts = -45
    elif profile.cashout_ratio >= 0.75:
        pts = -25
    elif profile.cashout_ratio >= 0.5:
        pts = -10
    else:
        pts = 15
    factors.append(ScoreFactor("cashout_ratio", f"{profile.cashout_ratio:.0%} of inflow cashed out", pts))

    # 7) Recurring airtime top-ups — small but consistent recurring behaviour.
    if profile.airtime_topups_per_month >= 4:
        pts = 15
    elif profile.airtime_topups_per_month >= 1:
        pts = 8
    else:
        pts = 0
    factors.append(ScoreFactor("airtime_regularity", f"{profile.airtime_topups_per_month} top-ups/month", pts))

    score = _clamp(sum(f.points for f in factors), SCORE_MIN, SCORE_MAX)

    # Map score to a probability of default. A simple, monotonic mapping keeps
    # the relationship intuitive: higher score -> lower PD.
    pd = round(_probability_of_default(score), 4)

    net_cashflow = round(profile.avg_monthly_inflow - profile.avg_monthly_outflow, 2)
    recommended = _recommended_limit(score, net_cashflow)

    return CreditAssessment(
        score=score,
        risk_band=_band(score),
        probability_of_default=pd,
        recommended_limit=recommended,
        net_monthly_cashflow=net_cashflow,
        factors=factors,
    )


def _probability_of_default(score: int) -> float:
    """Map a 300-850 score to a 0..1 PD using a smooth linear interpolation.

    850 -> ~2% PD, 300 -> ~60% PD. The band edges line up with the risk bands so
    the numbers stay intuitive for the risk team.
    """
    lo_pd, hi_pd = 0.02, 0.60
    frac = (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)
    return hi_pd - (hi_pd - lo_pd) * frac


def _recommended_limit(score: int, net_monthly_cashflow: float) -> float:
    """Anchor the limit to affordability, then scale by the risk band.

    We never recommend lending more than a multiple of demonstrated surplus
    cash-flow, and lower bands get smaller multiples. Sub-prime and decline
    bands are floored so we start customers small and let them build history.
    """
    surplus = max(net_monthly_cashflow, 0.0)
    band = _band(score)
    multiplier = {"A": 3.0, "B": 2.0, "C": 1.25, "D": 0.5, "E": 0.0}[band]
    limit = surplus * multiplier

    # Round down to the nearest 50 ZMW for clean disbursement amounts.
    limit = (int(limit) // 50) * 50
    # Hard product ceiling for a starter micro-loan product.
    return float(min(limit, 15000))
