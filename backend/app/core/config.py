"""Application configuration.

Values can be overridden through environment variables (prefixed ``MOONZE_``)
or a local ``.env`` file. Keeping configuration centralised makes it easy to
point the same code at different environments (dev, staging, prod).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MOONZE_", env_file=".env", extra="ignore")

    app_name: str = "Moonze Loan Platform"
    database_url: str = "sqlite:///./moonze.db"

    # Credit policy knobs. These are deliberately conservative defaults that a
    # risk team would tune against real portfolio performance.
    min_credit_score: int = 520
    max_debt_to_income: float = 0.45
    base_interest_rate: float = 0.18  # monthly flat rate used for the demo
    default_term_days: int = 30

    # Risk / fraud thresholds.
    max_applications_per_day: int = 3
    reminder_lead_days: int = 7  # nudge customers this many days before due date

    # Payment gateway. The demo ships with a mock provider so the whole flow is
    # runnable end-to-end without external credentials.
    payment_provider: str = "mock"

    model_config = SettingsConfigDict(env_prefix="MOONZE_", extra="ignore")


settings = Settings()
