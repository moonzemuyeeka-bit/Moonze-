"""Loan eligibility, application, disbursement and repayment endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.models.loan import Loan
from app.schemas.schemas import LoanApply, LoanOut, RepaymentIn
from app.services import loan_service

router = APIRouter(tags=["loans"])


def _get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return customer


@router.get("/customers/{customer_id}/eligibility")
def eligibility(customer_id: int, db: Session = Depends(get_db)) -> dict:
    """Return an explainable eligibility decision with the score & risk report."""
    customer = _get_customer(db, customer_id)
    return loan_service.check_eligibility(db, customer).as_dict()


@router.post("/customers/{customer_id}/loans", response_model=LoanOut, status_code=201)
def apply(customer_id: int, payload: LoanApply, db: Session = Depends(get_db)) -> Loan:
    """Apply for a loan; it is auto-decisioned against policy."""
    customer = _get_customer(db, customer_id)
    return loan_service.apply_for_loan(db, customer, payload.amount, payload.term_days)


@router.get("/customers/{customer_id}/loans", response_model=list[LoanOut])
def customer_loans(customer_id: int, db: Session = Depends(get_db)) -> list[Loan]:
    _get_customer(db, customer_id)
    return list(
        db.scalars(select(Loan).where(Loan.customer_id == customer_id).order_by(Loan.id)).all()
    )


@router.get("/loans", response_model=list[LoanOut])
def all_loans(db: Session = Depends(get_db)) -> list[Loan]:
    return list(db.scalars(select(Loan).order_by(Loan.id)).all())


@router.get("/loans/{loan_id}", response_model=LoanOut)
def get_loan(loan_id: int, db: Session = Depends(get_db)) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")
    return loan


@router.post("/loans/{loan_id}/disburse", response_model=LoanOut)
def disburse(loan_id: int, db: Session = Depends(get_db)) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")
    try:
        return loan_service.disburse_loan(db, loan)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/loans/{loan_id}/repay", response_model=LoanOut)
def repay(loan_id: int, payload: RepaymentIn, db: Session = Depends(get_db)) -> Loan:
    loan = db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found.")
    try:
        loan_service.record_repayment(db, loan, payload.amount)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.refresh(loan)
    return loan
