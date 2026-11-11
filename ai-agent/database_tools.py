import logging
from datetime import date
from typing import Any, Dict, List, Optional, Union
from supabase_client import get_supabase_client

logger = logging.getLogger("vynzora-db-tools")

ALLOWED_TABLES = [
    "contacts",
    "crm_leads",
    "crm_activities",
    "notifications"
]

DATE_COLUMNS = {
    "contacts": "created_at",
    "crm_leads": "created_at",
    "crm_activities": "activity_date",
    "notifications": "created_at"
}


def read_database(table: str, limit: int = 10) -> Union[List[Dict[str, Any]], str]:
    """
    Reads records from allowed Supabase tables: contacts, crm_leads, crm_activities, notifications.
    """
    if table not in ALLOWED_TABLES:
        return f"Table '{table}' is not allowed. Allowed tables: {', '.join(ALLOWED_TABLES)}"

    try:
        supabase = get_supabase_client()
        date_column = DATE_COLUMNS[table]
        response = (
            supabase
            .table(table)
            .select("*")
            .order(date_column, desc=True)
            .limit(limit)
            .execute()
        )
        return response.data
    except Exception as e:
        logger.error(f"Database error in read_database: {e}")
        return f"Database error: {str(e)}"


def search_customer(name: str) -> Union[List[Dict[str, Any]], str]:
    """
    Search for customer contacts in the database matching a given name.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("contacts")
            .select("*")
            .ilike("full_name", f"%{name}%")
            .limit(10)
            .execute()
        )
        return response.data
    except Exception as e:
        logger.error(f"Error in search_customer: {e}")
        return str(e)


def get_customer_complete_details(name: str) -> Union[Dict[str, Any], str]:
    """
    Retrieve comprehensive customer profile including contact info, CRM lead status, and activity logs.
    """
    try:
        contacts = search_customer(name)

        if not contacts:
            return "Customer not found"

        if isinstance(contacts, list) and len(contacts) > 1:
            return {
                "message": "Multiple customers found",
                "customers": contacts
            }

        contact = contacts[0]
        contact_id = contact["id"]
        supabase = get_supabase_client()

        # Find CRM lead
        leads_res = (
            supabase
            .table("crm_leads")
            .select("*")
            .eq("contact_id", contact_id)
            .execute()
        )
        leads = leads_res.data or []

        # Retrieve activities
        activities = []
        for lead in leads:
            lead_id = lead["id"]
            act_res = (
                supabase
                .table("crm_activities")
                .select("*")
                .eq("lead_id", lead_id)
                .execute()
            )
            activities.extend(act_res.data or [])

        return {
            "contact_details": contact,
            "lead_details": leads,
            "activities": activities
        }
    except Exception as e:
        logger.error(f"Error in get_customer_complete_details: {e}")
        return f"Error retrieving customer complete details: {str(e)}"


def create_customer(
    full_name: str,
    email: str,
    phone_number: str,
    company_name: str,
    service_required: str,
    message: str
) -> Union[List[Dict[str, Any]], str]:
    """
    Insert a new customer into the contacts table in Supabase.
    """
    try:
        supabase = get_supabase_client()
        data = {
            "full_name": full_name,
            "email": email,
            "phone_number": phone_number,
            "company_name": company_name,
            "service_required": service_required,
            "message": message
        }
        response = supabase.table("contacts").insert(data).execute()
        logger.info(f"{full_name} successfully added to contacts!")
        return response.data
    except Exception as e:
        logger.error(f"Error in create_customer: {e}")
        return f"Error creating customer: {str(e)}"


def update_lead(customer_name: str, status: str, notes: str) -> Union[List[Dict[str, Any]], str]:
    """
    Update an existing customer's CRM lead status (e.g. New, Contacted, Interested, Converted, Lost) and notes.
    """
    try:
        supabase = get_supabase_client()
        customer = (
            supabase
            .table("contacts")
            .select("id, full_name")
            .ilike("full_name", f"%{customer_name}%")
            .execute()
        )

        if not customer.data:
            return "Customer not found!"

        if len(customer.data) > 1:
            return "Multiple customers found. Please identify the correct customer with full name."

        contact_id = customer.data[0]["id"]

        lead = (
            supabase
            .table("crm_leads")
            .select("*")
            .eq("contact_id", contact_id)
            .execute()
        )

        if not lead.data:
            return "No lead found for this customer!"

        if len(lead.data) > 1:
            return "Multiple leads found. Please identify the correct lead."

        lead_id = lead.data[0]["id"]

        response = (
            supabase
            .table("crm_leads")
            .update({
                "lead_status": status,
                "notes": notes
            })
            .eq("id", lead_id)
            .execute()
        )
        logger.info(f"{customer_name}'s lead updated to {status} successfully!")
        return response.data
    except Exception as e:
        logger.error(f"Error in update_lead: {e}")
        return f"Error updating lead: {str(e)}"


def delete_lead(customer_name: str) -> str:
    """
    Delete a CRM lead associated with a customer name (preserves the contact).
    """
    try:
        supabase = get_supabase_client()
        customer = (
            supabase
            .table("contacts")
            .select("id, full_name")
            .ilike("full_name", f"%{customer_name}%")
            .execute()
        )

        if not customer.data:
            return "Customer not found!"

        if len(customer.data) > 1:
            return "Multiple customers found. Please identify the correct customer."

        contact_id = customer.data[0]["id"]

        lead = (
            supabase
            .table("crm_leads")
            .select("id")
            .eq("contact_id", contact_id)
            .execute()
        )

        if not lead.data:
            return "No lead found for this customer!"

        if len(lead.data) > 1:
            return "Multiple leads found. Please identify the correct lead."

        lead_id = lead.data[0]["id"]

        supabase.table("crm_leads").delete().eq("id", lead_id).execute()
        logger.info(f"{customer_name}'s lead deleted successfully!")
        return f"{customer_name}'s CRM lead deleted successfully!"
    except Exception as e:
        logger.error(f"Error in delete_lead: {e}")
        return f"Error deleting lead: {str(e)}"


def get_total_enquiries() -> Dict[str, Any]:
    """
    Retrieve the total count of customer enquiries from the contacts table.
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("contacts").select("id").execute()
        total = len(response.data) if response.data else 0
        return {"total_enquiries": total}
    except Exception as e:
        logger.error(f"Error in get_total_enquiries: {e}")
        return {"error": str(e), "total_enquiries": 0}


def get_total_leads() -> Dict[str, Any]:
    """
    Retrieve the total count of active CRM leads from the crm_leads table.
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("crm_leads").select("id").execute()
        total = len(response.data) if response.data else 0
        return {"total_leads": total}
    except Exception as e:
        logger.error(f"Error in get_total_leads: {e}")
        return {"error": str(e), "total_leads": 0}


def get_leads_by_status() -> Dict[str, Any]:
    """
    Retrieve breakdown and distribution count of CRM leads grouped by status (New, Contacted, Interested, Converted, Lost).
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("crm_leads").select("lead_status").execute()
        status_count = {}
        for row in (response.data or []):
            st = row.get("lead_status") or "Unknown"
            status_count[st] = status_count.get(st, 0) + 1
        return {"leads_by_status": status_count}
    except Exception as e:
        logger.error(f"Error in get_leads_by_status: {e}")
        return {"error": str(e), "leads_by_status": {}}


def get_latest_enquiries() -> Dict[str, Any]:
    """
    Retrieve the latest 5 customer contact enquiries from Supabase.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("contacts")
            .select("*")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        return {"latest_enquiries": response.data or []}
    except Exception as e:
        logger.error(f"Error in get_latest_enquiries: {e}")
        return {"error": str(e), "latest_enquiries": []}


def get_crm_analytics() -> Dict[str, Any]:
    """
    Retrieve complete executive CRM performance summary including total enquiries, total leads, and status breakdown.
    """
    total_enquiries = get_total_enquiries()
    total_leads = get_total_leads()
    lead_status = get_leads_by_status()

    return {
        "total_enquiries": total_enquiries.get("total_enquiries", 0),
        "total_leads": total_leads.get("total_leads", 0),
        "lead_status_distribution": lead_status.get("leads_by_status", {})
    }


def get_unread_notifications() -> Dict[str, Any]:
    """
    Retrieve all unread alerts and notifications from the notifications table.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("is_read", False)
            .order("created_at", desc=True)
            .execute()
        )
        data = response.data or []
        return {
            "unread_count": len(data),
            "notifications": data
        }
    except Exception as e:
        logger.error(f"Error in get_unread_notifications: {e}")
        return {"error": str(e), "unread_count": 0, "notifications": []}


def get_today_notifications() -> Dict[str, Any]:
    """
    Retrieve all notifications scheduled for today's date.
    """
    try:
        today = date.today().isoformat()
        supabase = get_supabase_client()
        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("scheduled_date", today)
            .execute()
        )
        data = response.data or []
        return {
            "today_count": len(data),
            "date": today,
            "notifications": data
        }
    except Exception as e:
        logger.error(f"Error in get_today_notifications: {e}")
        return {"error": str(e), "today_count": 0, "notifications": []}


def get_high_priority_notifications() -> Dict[str, Any]:
    """
    Retrieve all high-priority or urgent notifications requiring administrative attention.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("notifications")
            .select("*")
            .in_("priority", ["High", "Urgent"])
            .execute()
        )
        data = response.data or []
        return {
            "high_priority_count": len(data),
            "notifications": data
        }
    except Exception as e:
        logger.error(f"Error in get_high_priority_notifications: {e}")
        return {"error": str(e), "high_priority_count": 0, "notifications": []}


def get_scheduled_notifications() -> Dict[str, Any]:
    """
    Retrieve all upcoming scheduled notifications.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("notifications")
            .select("*")
            .eq("status", "Scheduled")
            .execute()
        )
        data = response.data or []
        return {
            "scheduled_count": len(data),
            "notifications": data
        }
    except Exception as e:
        logger.error(f"Error in get_scheduled_notifications: {e}")
        return {"error": str(e), "scheduled_count": 0, "notifications": []}


def mark_notification_as_read(title: str) -> Union[Dict[str, Any], str]:
    """
    Mark a notification as read by matching its title.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase
            .table("notifications")
            .select("*")
            .ilike("title", f"%{title}%")
            .execute()
        )

        if not response.data:
            return "Notification not found!"

        if len(response.data) > 1:
            return "Multiple notifications found. Please specify the title."

        notification_id = response.data[0]["id"]
        result = (
            supabase
            .table("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .execute()
        )
        return result.data[0] if result.data else "Notification marked as read."
    except Exception as e:
        logger.error(f"Error in mark_notification_as_read: {e}")
        return f"Error: {str(e)}"

