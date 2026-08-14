"""End-to-end API tests via the FastAPI TestClient."""

from __future__ import annotations


def _register(client, **overrides):
    payload = {
        "full_name": "API Tester",
        "mobile_number": "260970001234",
        "nrc_number": "123456/78/1",
        "tpin": "1000001234",
        "region": "Lusaka",
        "mno": "Airtel",
    }
    payload.update(overrides)
    return client.post("/customers", json=payload)


def _good_mm():
    return {
        "account_age_months": 36,
        "avg_monthly_inflow": 6000,
        "avg_monthly_outflow": 4000,
        "monthly_txn_count": 40,
        "avg_wallet_balance": 1500,
        "cashout_ratio": 0.4,
        "bill_payments_per_month": 3,
        "airtime_topups_per_month": 4,
        "days_since_sim_swap": 500,
    }


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_full_onboarding_and_loan_flow(client):
    # Register
    r = _register(client)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert r.json()["kyc_status"] == "pending"

    # KYC
    r = client.post(f"/customers/{cid}/kyc", json={"tpin": "1000001234", "face_match_score": 0.95})
    assert r.status_code == 200
    assert r.json()["kyc_status"] == "verified"

    # Mobile money
    r = client.put(f"/customers/{cid}/mobile-money", json=_good_mm())
    assert r.status_code == 200

    # Eligibility
    r = client.get(f"/customers/{cid}/eligibility")
    assert r.status_code == 200
    body = r.json()
    assert body["eligible"] is True
    assert body["max_amount"] >= 50
    assert body["credit"]["score"] > 0

    # Apply
    amount = min(body["max_amount"], 500)
    r = client.post(f"/customers/{cid}/loans", json={"amount": amount})
    assert r.status_code == 201
    loan = r.json()
    assert loan["status"] == "approved"
    loan_id = loan["id"]

    # Disburse
    r = client.post(f"/loans/{loan_id}/disburse")
    assert r.status_code == 200
    assert r.json()["status"] == "disbursed"

    # Repay in full
    total_due = r.json()["total_due"]
    r = client.post(f"/loans/{loan_id}/repay", json={"amount": total_due})
    assert r.status_code == 200
    assert r.json()["status"] == "repaid"


def test_duplicate_mobile_rejected(client):
    assert _register(client).status_code == 201
    r = _register(client)
    assert r.status_code == 409


def test_incomplete_kyc_blocks_eligibility(client):
    r = _register(client, mobile_number="260970005555", nrc_number="555/55/5")
    cid = r.json()["id"]
    client.put(f"/customers/{cid}/mobile-money", json=_good_mm())
    # No KYC submitted -> blocked
    r = client.get(f"/customers/{cid}/eligibility")
    assert r.json()["eligible"] is False


def test_intelligence_endpoints(client):
    # Build a customer and a loan so KPIs are non-trivial.
    r = _register(client, mobile_number="260970009999", nrc_number="999/99/9")
    cid = r.json()["id"]
    client.post(f"/customers/{cid}/kyc", json={"face_match_score": 0.95})
    client.put(f"/customers/{cid}/mobile-money", json=_good_mm())
    amount = min(client.get(f"/customers/{cid}/eligibility").json()["max_amount"], 500)
    loan_id = client.post(f"/customers/{cid}/loans", json={"amount": amount}).json()["id"]
    client.post(f"/loans/{loan_id}/disburse")

    assert client.get("/intelligence/overview").json()["disbursed_count"] == 1
    assert isinstance(client.get("/intelligence/segments?dimension=mno").json(), list)
    assert isinstance(client.get("/intelligence/upcoming-due").json(), list)
    assert client.post("/intelligence/nudges/generate").status_code == 200
