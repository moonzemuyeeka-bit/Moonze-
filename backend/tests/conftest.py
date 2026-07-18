"""Shared pytest fixtures.

Each test runs against its own throwaway SQLite database so tests are fully
isolated and order-independent.
"""

from __future__ import annotations

import os
import tempfile

import pytest

# Point the app at a temp DB *before* app modules import the engine.
_TMP_DB = os.path.join(tempfile.mkdtemp(prefix="moonze-test-"), "test.db")
os.environ["MOONZE_DATABASE_URL"] = f"sqlite:///{_TMP_DB}"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services import payments  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_db():
    """Recreate all tables and reset the mock payment ledger for each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    payments._provider = None  # force a clean mock provider per test
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def _override():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
