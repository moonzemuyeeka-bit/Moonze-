"""Tests for the mobile-money credit scoring engine."""

from __future__ import annotations

from app.models.mobile_money import MobileMoneyProfile
from app.services import credit_scoring


def _profile(**kw) -> MobileMoneyProfile:
    base = dict(
        account_age_months=0,
        avg_monthly_inflow=0,
        avg_monthly_outflow=0,
        monthly_txn_count=0,
        avg_wallet_balance=0,
        cashout_ratio=0.0,
        bill_payments_per_month=0,
        airtime_topups_per_month=0,
        days_since_sim_swap=9999,
    )
    base.update(kw)
    return MobileMoneyProfile(**base)


def test_strong_profile_scores_high_and_prime_band():
    p = _profile(
        account_age_months=48, avg_monthly_inflow=9000, avg_monthly_outflow=5000,
        monthly_txn_count=55, avg_wallet_balance=2200, cashout_ratio=0.3,
        bill_payments_per_month=4, airtime_topups_per_month=5,
    )
    a = credit_scoring.assess(p)
    assert a.score >= 750
    assert a.risk_band == "A"
    assert a.probability_of_default < 0.10
    assert a.recommended_limit > 0


def test_weak_profile_scores_low():
    p = _profile(
        account_age_months=1, avg_monthly_inflow=400, avg_monthly_outflow=390,
        monthly_txn_count=3, avg_wallet_balance=20, cashout_ratio=0.97,
    )
    a = credit_scoring.assess(p)
    assert a.score < 520
    assert a.risk_band == "E"
    assert a.recommended_limit == 0.0


def test_score_is_deterministic():
    p = _profile(account_age_months=24, avg_monthly_inflow=4000, monthly_txn_count=25)
    assert credit_scoring.assess(p).score == credit_scoring.assess(p).score


def test_higher_score_means_lower_pd():
    weak = credit_scoring.assess(_profile(account_age_months=2, avg_monthly_inflow=500))
    strong = credit_scoring.assess(
        _profile(account_age_months=48, avg_monthly_inflow=9000, avg_wallet_balance=2000)
    )
    assert strong.probability_of_default < weak.probability_of_default


def test_score_bounds_respected():
    p = _profile(
        account_age_months=999, avg_monthly_inflow=999999, avg_wallet_balance=999999,
        monthly_txn_count=999, bill_payments_per_month=99, airtime_topups_per_month=99,
    )
    a = credit_scoring.assess(p)
    assert credit_scoring.SCORE_MIN <= a.score <= credit_scoring.SCORE_MAX


def test_limit_is_capped_by_affordability():
    # Huge score potential but tiny net cash-flow -> limit anchored to surplus.
    p = _profile(
        account_age_months=48, avg_monthly_inflow=9000, avg_monthly_outflow=8900,
        monthly_txn_count=55, avg_wallet_balance=2200, cashout_ratio=0.3,
        bill_payments_per_month=4, airtime_topups_per_month=5,
    )
    a = credit_scoring.assess(p)
    assert a.net_monthly_cashflow == 100.0
    assert a.recommended_limit <= 3 * 100  # A-band multiplier * surplus
