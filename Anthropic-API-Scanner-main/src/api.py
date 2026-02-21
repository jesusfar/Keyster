"""
REST API for querying scanned API keys
"""

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

from manager import DatabaseManager

app = FastAPI(
    title="Anthropic API Scanner API",
    description="API for querying scanned Anthropic API keys",
    version="1.0.0"
)

DB_FILE = os.getenv("DB_FILE", "anthropic_github.db")


class APIKeyResponse(BaseModel):
    api_key: str
    status: str
    last_checked: str


class APIKeyStatus(BaseModel):
    api_key: str
    status: str


@app.get("/")
async def root():
    return {"message": "Anthropic API Scanner API", "version": "1.0.0"}


@app.get("/keys", response_model=list[APIKeyResponse])
async def get_all_keys(status_filter: Optional[str] = None):
    """
    Get all API keys, optionally filtered by status
    """
    with DatabaseManager(DB_FILE) as mgr:
        if status_filter:
            mgr.cur.execute(
                "SELECT apiKey, status, lastChecked FROM APIKeys WHERE status=?",
                (status_filter,)
            )
        else:
            mgr.cur.execute("SELECT apiKey, status, lastChecked FROM APIKeys")
        
        results = mgr.cur.fetchall()
        return [
            APIKeyResponse(
                api_key=row[0],
                status=row[1],
                last_checked=row[2]
            )
            for row in results
        ]


@app.get("/keys/available", response_model=list[APIKeyResponse])
async def get_available_keys():
    """
    Get all available (working) API keys
    """
    with DatabaseManager(DB_FILE) as mgr:
        mgr.cur.execute(
            "SELECT apiKey, status, lastChecked FROM APIKeys WHERE status='yes'"
        )
        results = mgr.cur.fetchall()
        return [
            APIKeyResponse(
                api_key=row[0],
                status=row[1],
                last_checked=row[2]
            )
            for row in results
        ]


@app.get("/keys/{api_key}", response_model=APIKeyResponse)
async def get_key(api_key: str):
    """
    Get details for a specific API key
    """
    with DatabaseManager(DB_FILE) as mgr:
        mgr.cur.execute(
            "SELECT apiKey, status, lastChecked FROM APIKeys WHERE apiKey=?",
            (api_key,)
        )
        result = mgr.cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="API key not found")
        
        return APIKeyResponse(
            api_key=result[0],
            status=result[1],
            last_checked=result[2]
        )


@app.post("/keys/{api_key}/check")
async def check_key_status(api_key: str):
    """
    Re-check the status of a specific API key
    """
    from utils import check_key
    
    result = check_key(api_key)
    
    with DatabaseManager(DB_FILE) as mgr:
        mgr.delete(api_key)
        mgr.insert(api_key, result)
    
    return {"api_key": api_key, "status": result}


@app.get("/stats")
async def get_stats():
    """
    Get statistics about scanned keys
    """
    with DatabaseManager(DB_FILE) as mgr:
        mgr.cur.execute("SELECT status, COUNT(*) FROM APIKeys GROUP BY status")
        status_counts = dict(mgr.cur.fetchall())
        
        mgr.cur.execute("SELECT COUNT(*) FROM APIKeys")
        total = mgr.cur.fetchone()[0]
        
        mgr.cur.execute("SELECT COUNT(*) FROM URLs")
        urls_scanned = mgr.cur.fetchone()[0]
    
    return {
        "total_keys": total,
        "urls_scanned": urls_scanned,
        "status_breakdown": status_counts
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
