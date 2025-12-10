import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def verify_admin_access(usr, pwd):
    """
    Verifies credentials and checks if user has 'System User' role or is Administrator.
    Does not create a session.
    """
    try:
        login_manager = frappe.auth.LoginManager()
        login_manager.authenticate(user=usr, pwd=pwd)
        user = login_manager.user

        if user == "Administrator":
             return {"allowed": True}

        roles = frappe.get_roles(user)
        if "System Manager" in roles or "System User" in roles:
            return {"allowed": True}

        return {
            "allowed": False,
            "message": _("User does not have System User or System Manager role.")
        }

    except frappe.AuthenticationError:
        return {
            "allowed": False,
            "message": _("Invalid username or password.")
        }
    except Exception as e:
        frappe.log_error("POS Auth Verification Error")
        return {
            "allowed": False,
            "message": _("An error occurred during verification.")
        }
