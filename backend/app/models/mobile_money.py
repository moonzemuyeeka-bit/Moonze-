"""Mobile-money behavioural profile.

These features are the raw signals used by the credit-scoring engine. In a real
deployment they would be derived from a mobile-money statement pulled (with the
customer's consent) from the MNO or an aggregator. Here we store the aggregated
features directly so the scoring logic stays testable and deterministic.
"""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MobileMoneyProfile(Base):
    __tablename__ = "mobile_money_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), unique=True, index=True)

    # How long the wallet has been active. Older accounts are lower risk.
    account_age_months: Mapped[int] = mapped_column(Integer, default=0)

    # Cash coming in (salary, top-ups, transfers received) per month, in ZMW.
    avg_monthly_inflow: Mapped[float] = mapped_column(Float, default=0.0)
    # Cash going out per month, in ZMW.
    avg_monthly_outflow: Mapped[float] = mapped_column(Float, default=0.0)

    # Number of transactions per month -> proxy for engagement / activity.
    monthly_txn_count: Mapped[int] = mapped_column(Integer, default=0)

    # Typical wallet balance held, in ZMW -> proxy for liquidity buffer.
    avg_wallet_balance: Mapped[float] = mapped_column(Float, default=0.0)

    # Share of inflow immediately cashed out (0..1). High ratios suggest the
    # wallet is a pass-through and the customer keeps little buffer.
    cashout_ratio: Mapped[float] = mapped_column(Float, default=0.0)

    # Regular bill / utility payments per month -> stability signal.
    bill_payments_per_month: Mapped[int] = mapped_column(Integer, default=0)

    # Airtime top-ups per month -> a small but consistent recurring behaviour.
    airtime_topups_per_month: Mapped[int] = mapped_column(Integer, default=0)

    # Recent SIM swap is a strong fraud signal (account-takeover risk).
    days_since_sim_swap: Mapped[int] = mapped_column(Integer, default=9999)

    customer = relationship("Customer", back_populates="mobile_money")
