#!/usr/bin/env python3
"""
Sender.net MCP Server
Exposes Sender.net Email Marketing, Subscribers, Campaigns, Groups, Segments, and Transactional APIs.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("sender")

API_BASE = "https://api.sender.net/v2"

def get_api_token() -> str:
    """Retrieve Sender API token from environment or .env files."""
    token = os.environ.get("SENDER_API_TOKEN")
    if token:
        return token.strip()

    project_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..", ".env"))
    env_paths = [
        project_env,
        "/Users/cassio/GitHubPessoal/kob-site/.env",
    ]
    for p in env_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("SENDER_API_TOKEN="):
                        val = line.split("=", 1)[1].strip()
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        if val:
                            return val
    raise ValueError("SENDER_API_TOKEN not found in environment or .env files.")

def sender_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make an authenticated request to Sender.net API."""
    token = get_api_token()
    url = f"{API_BASE}/{endpoint.lstrip('/')}"
    
    if params:
        query_string = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        if query_string:
            url += f"?{query_string}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Sender-MCP-Client/1.0"
    }

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else {"status": "success", "code": response.status}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_msg)
            return {"error": True, "status_code": e.code, "message": err_json.get("message", err_msg), "details": err_json}
        except Exception:
            return {"error": True, "status_code": e.code, "message": err_msg}
    except Exception as e:
        return {"error": True, "message": str(e)}

# ==============================================================================
# 1. ACCOUNT & DOMAINS
# ==============================================================================

@mcp.tool()
def get_account_details() -> Dict[str, Any]:
    """Get details of the authenticated Sender.net account."""
    # List domains or subscribers as account test
    res = sender_request("/subscribers", params={"limit": 1})
    if "meta" in res:
        return {
            "status": "active",
            "total_subscribers": res["meta"].get("total", 0),
            "info": "Connected successfully to Sender.net API"
        }
    return res

@mcp.tool()
def list_domains() -> Dict[str, Any]:
    """List sending domains and their verification status."""
    return sender_request("/sending-domains")

# ==============================================================================
# 2. SUBSCRIBERS & GROUPS
# ==============================================================================

@mcp.tool()
def list_subscribers(page: int = 1, limit: int = 25, group_id: Optional[str] = None) -> Dict[str, Any]:
    """List subscribers with optional group filtering and pagination."""
    params = {"page": page, "limit": limit}
    if group_id:
        params["group_id"] = group_id
    return sender_request("/subscribers", params=params)

@mcp.tool()
def get_subscriber(subscriber_id_or_email: str) -> Dict[str, Any]:
    """Get subscriber data by ID or email."""
    return sender_request(f"/subscribers/{subscriber_id_or_email}")

@mcp.tool()
def create_subscriber(
    email: str,
    firstname: Optional[str] = None,
    lastname: Optional[str] = None,
    phone: Optional[str] = None,
    groups: Optional[List[str]] = None,
    fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a new subscriber or update an existing one in Sender.net."""
    payload: Dict[str, Any] = {"email": email}
    if firstname:
        payload["firstname"] = firstname
    if lastname:
        payload["lastname"] = lastname
    if phone:
        payload["phone"] = phone
    if groups:
        payload["groups"] = groups
    if fields:
        payload["fields"] = fields
    return sender_request("/subscribers", method="POST", data=payload)

@mcp.tool()
def delete_subscriber(subscriber_id_or_email: str) -> Dict[str, Any]:
    """Delete a subscriber by ID or email."""
    return sender_request(f"/subscribers/{subscriber_id_or_email}", method="DELETE")

@mcp.tool()
def list_groups(page: int = 1, limit: int = 50) -> Dict[str, Any]:
    """List all subscriber groups (tags/lists) in Sender.net."""
    return sender_request("/tags", params={"page": page, "limit": limit})

@mcp.tool()
def create_group(title: str) -> Dict[str, Any]:
    """Create a new subscriber group (tag)."""
    return sender_request("/tags", method="POST", data={"title": title})

@mcp.tool()
def add_subscribers_to_group(group_id: str, subscriber_ids: List[str]) -> Dict[str, Any]:
    """Add subscribers to a specific group/tag."""
    return sender_request(f"/tags/{group_id}/subscribers", method="POST", data={"subscribers": subscriber_ids})

# ==============================================================================
# 3. EMAIL CAMPAIGNS
# ==============================================================================

@mcp.tool()
def list_campaigns(page: int = 1, limit: int = 20) -> Dict[str, Any]:
    """List email campaigns from Sender.net."""
    return sender_request("/campaigns", params={"page": page, "limit": limit})

@mcp.tool()
def get_campaign(campaign_id: str) -> Dict[str, Any]:
    """Get details of a specific email campaign."""
    return sender_request(f"/campaigns/{campaign_id}")

@mcp.tool()
def get_campaign_statistics(campaign_id: str) -> Dict[str, Any]:
    """Get delivery and open statistics for a campaign."""
    return sender_request(f"/campaigns/{campaign_id}/statistics")

@mcp.tool()
def create_email_campaign(
    title: str,
    subject: str,
    from_name: str,
    from_email: str,
    html_content: str,
    group_ids: Optional[List[str]] = None,
    send_to_all: bool = False
) -> Dict[str, Any]:
    """
    Create a new draft email campaign in Sender.net.
    HTML content must contain {{unsubscribe_link}}.
    """
    payload = {
        "title": title,
        "subject": subject,
        "from": {
            "name": from_name,
            "email": from_email
        },
        "content": {
            "type": "html",
            "html": html_content
        }
    }
    if group_ids:
        payload["groups"] = group_ids
    if send_to_all:
        payload["send_to_all"] = True

    return sender_request("/campaigns", method="POST", data=payload)

@mcp.tool()
def update_campaign_content(campaign_id: str, html_content: str) -> Dict[str, Any]:
    """Update the HTML body content of a draft campaign."""
    payload = {
        "content": {
            "type": "html",
            "html": html_content
        }
    }
    return sender_request(f"/campaigns/{campaign_id}", method="PATCH", data=payload)

@mcp.tool()
def send_campaign(campaign_id: str) -> Dict[str, Any]:
    """Trigger the sending of an existing campaign."""
    return sender_request(f"/campaigns/{campaign_id}/send", method="POST")

# ==============================================================================
# 4. TRANSACTIONAL EMAILS
# ==============================================================================

@mcp.tool()
def list_transactional_campaigns() -> Dict[str, Any]:
    """List all transactional campaigns."""
    return sender_request("/transactional-campaigns")

@mcp.tool()
def send_transactional_email(
    to_email: str,
    subject: str,
    html: str,
    from_name: Optional[str] = "Kriativos On Board",
    from_email: Optional[str] = "noreply@kriativosonboard.com.br",
    to_name: Optional[str] = None
) -> Dict[str, Any]:
    """Send a one-off transactional email directly through Sender.net."""
    recipient: Dict[str, Any] = {"email": to_email}
    if to_name:
        recipient["name"] = to_name

    payload = {
        "from": {
            "name": from_name,
            "email": from_email
        },
        "to": [recipient],
        "subject": subject,
        "html": html
    }
    return sender_request("/transactional/send", method="POST", data=payload)

# ==============================================================================
# 5. MAIN RUNNER
# ==============================================================================

if __name__ == "__main__":
    mcp.run()
