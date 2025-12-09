# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, nowdate, today, cint, get_datetime


@frappe.whitelist()
def get_customer_balance(customer, company=None):
    """
    Get customer balance info including:
    - Outstanding amount (sales invoices)
    - Credit balance (return invoices/CNs)
    - Advance payments (unallocated payment entries)
    """
    if not company:
        company = frappe.defaults.get_user_default("Company")

    return {
        "outstanding_amount": _get_customer_outstanding(customer, company),
        "credit_balance": _get_customer_credits(customer, company),
        "advance_balance": _get_customer_advances(customer, company)
    }

def _get_customer_outstanding(customer, company):
    return frappe.db.get_value(
        "Customer",
        customer,
        "total_unpaid"
    ) or 0.0

def _get_customer_credits(customer, company):
    # Sum of outstanding amounts from Credit Notes (negative outstanding)
    credit_notes = frappe.get_all(
        "Sales Invoice",
        filters={
            "customer": customer,
            "company": company,
            "docstatus": 1,
            "outstanding_amount": ["<", 0],
            "is_return": 1
        },
        fields=["SUM(outstanding_amount) as amount"]
    )

    # Negative outstanding means credit to customer, so we flip sign
    return abs(flt(credit_notes[0].amount)) if credit_notes and credit_notes[0].amount else 0.0

def _get_customer_advances(customer, company):
    # Sum of unallocated payment entries
    advances = frappe.get_all(
        "Payment Entry",
        filters={
            "party_type": "Customer",
            "party": customer,
            "company": company,
            "docstatus": 1,
            "payment_type": "Receive",
            "unallocated_amount": [">", 0]
        },
        fields=["SUM(unallocated_amount) as amount"]
    )
    return flt(advances[0].amount) if advances and advances[0].amount else 0.0


@frappe.whitelist()
def check_credit_sale_enabled(pos_profile):
    """Check if credit sales are allowed for this POS Profile"""
    pos_settings = frappe.db.get_value(
        "POS Settings",
        {"pos_profile": pos_profile, "allow_credit_sale": 1},
        "name"
    )
    return bool(pos_settings)


@frappe.whitelist()
def get_available_credit(customer, company, pos_profile=None):
    """
    Get available credit details to be used for payment.
    Returns a list of credit sources (Return Invoices and Unallocated Advances).
    """
    credits = []

    # 1. Get Credit Notes (Negative Outstanding)
    negative_invoices = _get_negative_invoices(customer, company)
    for inv in negative_invoices:
        credits.append({
            "name": inv.name,
            "doctype": "Sales Invoice",
            "amount": abs(flt(inv.outstanding_amount)),
            "posting_date": inv.posting_date,
            "reference_name": inv.name
        })

    # 2. Get Unallocated Advances
    unallocated_advances = _get_unallocated_advances(customer, company)
    for adv in unallocated_advances:
        credits.append({
            "name": adv.name,
            "doctype": "Payment Entry",
            "amount": flt(adv.unallocated_amount),
            "posting_date": adv.posting_date,
            "reference_name": adv.name
        })

    return credits

def _get_negative_invoices(customer, company):
    return frappe.get_all(
        "Sales Invoice",
        filters={
            "customer": customer,
            "company": company,
            "docstatus": 1,
            "outstanding_amount": ["<", 0],
            "is_return": 1
        },
        fields=["name", "outstanding_amount", "posting_date", "grand_total"]
    )

def _get_unallocated_advances(customer, company):
    return frappe.get_all(
        "Payment Entry",
        filters={
            "party_type": "Customer",
            "party": customer,
            "company": company,
            "docstatus": 1,
            "payment_type": "Receive",
            "unallocated_amount": [">", 0]
        },
        fields=["name", "unallocated_amount", "posting_date", "paid_amount"]
    )


@frappe.whitelist()
def redeem_customer_credit(invoice_name, credit_data):
    """
    Redeem available credit against a sales invoice.

    Args:
        invoice_name: Name of the Sales Invoice to pay
        credit_data: List of dicts or JSON string of credits to use.
            Format: [{"doctype": "Sales Invoice", "name": "INV-RET-001", "amount": 50}, ...]
            OR older format dict: {"sales_invoices": [...], "payment_entries": [...]}
    """
    import json
    if isinstance(credit_data, str):
        credit_data = json.loads(credit_data)

    invoice_doc = frappe.get_doc("Sales Invoice", invoice_name)
    created_docs = []

    sales_invoices = []
    payment_entries = []

    # Normalize input format (Handle both list and dict for backward compat)
    if isinstance(credit_data, dict):
        sales_invoices = credit_data.get("sales_invoices", [])
        payment_entries = credit_data.get("payment_entries", [])
    elif isinstance(credit_data, list):
        for credit in credit_data:
            if credit.get("doctype") == "Sales Invoice":
                sales_invoices.append(credit)
            elif credit.get("doctype") == "Payment Entry":
                payment_entries.append(credit)

    # 1. Apply Credit Notes (Return Invoices) -> Create Journal Entry
    for credit_inv in sales_invoices:
        je = _create_credit_allocation_journal_entry(
            invoice_doc,
            credit_inv["name"],
            credit_inv["amount"]
        )
        created_docs.append(je)

    # 2. Apply Advances (Payment Entries) -> Reconcile Payment Entry
    for advance in payment_entries:
        pe = _reconcile_payment_entry(
            invoice_doc,
            advance["name"],
            advance["amount"]
        )
        created_docs.append(pe)

    return created_docs


def _create_credit_allocation_journal_entry(invoice_doc, original_invoice_name, amount):
    """
    Create Journal Entry to allocate credit from one invoice to another.
    """
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Credit Note"
    je.company = invoice_doc.company
    je.posting_date = nowdate()

    # Debit the Customer (reduce credit balance) - Linked to Return Invoice
    je.append("accounts", {
        "account": invoice_doc.debit_to,
        "party_type": "Customer",
        "party": invoice_doc.customer,
        "debit_in_account_currency": amount,
        "reference_type": "Sales Invoice",
        "reference_name": original_invoice_name,
        "cost_center": invoice_doc.cost_center or frappe.get_cached_value('Company', invoice_doc.company, 'cost_center')
    })

    # Credit the Customer (reduce debit balance) - Linked to New Invoice
    je.append("accounts", {
        "account": invoice_doc.debit_to,
        "party_type": "Customer",
        "party": invoice_doc.customer,
        "credit_in_account_currency": amount,
        "reference_type": "Sales Invoice",
        "reference_name": invoice_doc.name,
        "cost_center": invoice_doc.cost_center or frappe.get_cached_value('Company', invoice_doc.company, 'cost_center')
    })

    je.save()
    je.submit()
    return je.name


def _reconcile_payment_entry(invoice_doc, payment_entry_name, amount):
    """
    Allocate payment entry amount to the invoice
    """
    pe = frappe.get_doc("Payment Entry", payment_entry_name)

    # Append invoice to references
    pe.append("references", {
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_doc.name,
        "total_amount": invoice_doc.grand_total,
        "outstanding_amount": invoice_doc.outstanding_amount,
        "allocated_amount": amount
    })

    pe.save()
    pe.submit()
    return pe.name


@frappe.whitelist()
def get_credit_sale_summary(pos_profile):
    """Get summary of credit sales for a POS Profile"""
    filters = {
        "outstanding_amount": [">", 0],
        "docstatus": 1,
        "is_pos": 1
    }

    if pos_profile:
        filters["pos_profile"] = pos_profile

    summary = frappe.get_all(
        "Sales Invoice",
        filters=filters,
        fields=["count(name) as count", "sum(outstanding_amount) as total"]
    )

    return {
        "total_outstanding": summary[0].total if summary else 0.0,
        "invoice_count": summary[0].count if summary else 0
    }


@frappe.whitelist()
def get_credit_invoices(pos_profile, limit=100):
    """
    Get list of outstanding credit invoices for this POS Profile's customers.
    """
    # Refactored from raw SQL to ORM
    filters = {
        "outstanding_amount": [">", 0],
        "docstatus": 1,
        "is_pos": 1
    }

    if pos_profile:
        filters["pos_profile"] = pos_profile

    invoices = frappe.get_all(
        "Sales Invoice",
        filters=filters,
        fields=["name", "customer", "posting_date", "grand_total", "outstanding_amount", "due_date"],
        order_by="posting_date desc",
        limit=limit
    )

    return invoices
