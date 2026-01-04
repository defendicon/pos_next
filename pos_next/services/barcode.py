"""
Barcode resolver service for POS Next.

This module provides an optional integration with the barcode_resolver app.
When barcode_resolver is installed, it enables advanced barcode parsing
for weighted and priced barcodes. When not installed, it gracefully
returns None.

Usage:
    from pos_next.services import resolve_barcode, is_barcode_resolver_available

    # Check if feature is available
    if is_barcode_resolver_available():
        result = resolve_barcode("2001234001234")
        if result:
            print(result["item_barcode"], result["qty"])

    # Or simply call resolve_barcode (returns None if app not installed)
    result = resolve_barcode("2001234001234")
"""

from __future__ import annotations

from functools import lru_cache
from typing import TypedDict

import frappe


class BarcodeResult(TypedDict, total=False):
    """Type definition for barcode resolution result."""

    item_barcode: str  # The barcode from Item Barcodes table
    integer_value: str  # Integer part of the encoded value
    decimal_value: str  # Decimal part of the encoded value
    barcode_type: str  # "Weighted" or "Priced"
    uom: str | None  # UOM from Item Barcodes table
    qty: float | None  # Quantity (only for weighted barcodes)


class ResolvedItemData(TypedDict, total=False):
    """Type definition for resolved item data to be applied to cart."""

    resolved_qty: float | None
    resolved_uom: str | None
    resolved_barcode_type: str | None


@lru_cache(maxsize=1)
def is_barcode_resolver_available() -> bool:
    """
    Check if the barcode_resolver app is installed.

    Returns:
        bool: True if barcode_resolver is available, False otherwise.

    Note:
        Result is cached for performance. Server restart clears the cache.
    """
    return "barcode_resolver" in frappe.get_installed_apps()


def resolve_barcode(barcode: str) -> BarcodeResult | None:
    """
    Resolve a barcode using the barcode_resolver app if available.

    This function attempts to parse special barcode formats (weighted/priced)
    using configurable rules from the barcode_resolver app.

    Args:
        barcode: The barcode string to resolve.

    Returns:
        BarcodeResult dict if the barcode matches a rule, None otherwise.
        Also returns None if barcode_resolver app is not installed.

    Example:
        >>> result = resolve_barcode("2001234001500")
        >>> if result:
        ...     print(f"Item: {result['item_barcode']}, Qty: {result['qty']}")
    """
    if not is_barcode_resolver_available():
        return None

    try:
        from barcode_resolver.barcode_resolver.doctype.barcode_rule.utils import (
            resolve_barcode as _resolve_barcode,
        )

        return _resolve_barcode(barcode)
    except ImportError:
        # App might have been uninstalled, clear cache and return None
        is_barcode_resolver_available.cache_clear()
        return None
    except Exception:
        # Log unexpected errors but don't break POS functionality
        frappe.log_error(
            title="Barcode Resolver Error",
            message=f"Error resolving barcode: {barcode}",
        )
        return None


def compute_resolved_item_data(
    resolved_barcode: BarcodeResult | None,
    item_rate: float = 0,
) -> ResolvedItemData | None:
    """
    Compute qty and uom from resolved barcode data.

    For weighted barcodes: uses qty directly from the barcode.
    For priced barcodes: computes qty = encoded_price / item_rate.

    Args:
        resolved_barcode: The result from resolve_barcode().
        item_rate: The item's unit price (required for priced barcodes).

    Returns:
        ResolvedItemData with resolved_qty, resolved_uom, and resolved_barcode_type,
        or None if no valid resolution.

    Example:
        >>> resolved = resolve_barcode("2001234001500")
        >>> if resolved:
        ...     item_data = compute_resolved_item_data(resolved, item_rate=10.0)
        ...     print(f"Qty: {item_data['resolved_qty']}, UOM: {item_data['resolved_uom']}")
    """
    if not resolved_barcode:
        return None

    from barcode_resolver.barcode_resolver.doctype.barcode_rule.utils import BarcodeTypes

    barcode_type = resolved_barcode.get("barcode_type")
    barcode_uom = resolved_barcode.get("uom")

    if barcode_type == BarcodeTypes.WEIGHTED.value:
        return {
            "resolved_qty": resolved_barcode.get("qty"),
            "resolved_uom": barcode_uom,
            "resolved_barcode_type": barcode_type,
        }
    elif barcode_type == BarcodeTypes.PRICED.value:
        integer_value = resolved_barcode.get("integer_value", "0")
        decimal_value = resolved_barcode.get("decimal_value", "0")
        encoded_price = float(f"{integer_value}.{decimal_value}")

        resolved_qty = None
        if item_rate and item_rate > 0:
            resolved_qty = encoded_price / item_rate

        return {
            "resolved_qty": resolved_qty,
            "resolved_uom": barcode_uom,
            "resolved_barcode_type": barcode_type,
        }

    return None
