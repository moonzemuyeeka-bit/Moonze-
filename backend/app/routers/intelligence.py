"""Intelligence layer endpoints: portfolio KPIs, segments and nudges."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import intelligence, loan_service

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    """Portfolio-wide KPIs (outstanding book, payment rate, PAR, default rate)."""
    loan_service.refresh_overdue(db)
    return intelligence.portfolio_overview(db)


@router.get("/segments")
def segments(
    dimension: str = Query("risk_band", pattern="^(risk_band|mno|region)$"),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Loan performance broken down by customer segment."""
    loan_service.refresh_overdue(db)
    try:
        return intelligence.segment_performance(db, dimension)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/upcoming-due")
def upcoming_due(
    lead_days: int | None = Query(None, ge=0, le=90),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Loans within the reminder window (default 7 days) or already overdue."""
    loan_service.refresh_overdue(db)
    return intelligence.upcoming_due(db, lead_days=lead_days)


@router.post("/nudges/generate")
def generate_nudges(
    lead_days: int | None = Query(None, ge=0, le=90),
    db: Session = Depends(get_db),
) -> dict:
    """Generate repayment reminder nudges for loans nearing their due date."""
    loan_service.refresh_overdue(db)
    nudges = intelligence.generate_nudges(db, lead_days=lead_days)
    return {
        "created": len(nudges),
        "nudges": [
            {
                "id": n.id,
                "loan_id": n.loan_id,
                "customer_id": n.customer_id,
                "channel": n.channel.value,
                "days_to_due": n.days_to_due,
                "message": n.message,
            }
            for n in nudges
        ],
    }
