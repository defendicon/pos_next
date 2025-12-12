import frappe
import os

no_cache = 1

def get_context(context):
    try:
        # Path to the built service worker file in the public assets folder
        sw_path = frappe.get_app_path("pos_next", "public", "pos", "sw.js")

        if os.path.exists(sw_path):
            with open(sw_path, "r") as f:
                content = f.read()

            frappe.response["type"] = "text"
            frappe.response["filename"] = "sw.js"
            frappe.response["file_content"] = content
            frappe.response["headers"] = {
                "Content-Type": "application/javascript",
                "Service-Worker-Allowed": "/",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        else:
            frappe.response["status_code"] = 404
            frappe.response["type"] = "text"
            frappe.response["file_content"] = "Service Worker not found"

    except Exception as e:
        frappe.log_error(f"Error serving Service Worker: {str(e)}")
        frappe.response["status_code"] = 500
        frappe.response["file_content"] = str(e)
