# -*- coding: utf-8 -*-
# Copyright (c) 2024, POS Next and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
from frappe import _, as_json
from frappe.utils import flt, nowdate
from erpnext.stock.doctype.batch.batch import get_batch_qty
from erpnext.stock.get_item_details import get_item_details as erpnext_get_item_details


def get_stock_availability(item_code, warehouse):
	"""Return total available quantity for an item in the given warehouse."""
	if not warehouse:
		return 0.0

	warehouses = [warehouse]
	if frappe.db.get_value("Warehouse", warehouse, "is_group"):
		# Include all child warehouses when a group warehouse is set
		warehouses = frappe.db.get_descendants("Warehouse", warehouse) or []

	rows = frappe.get_all(
		"Bin",
		fields=["sum(actual_qty) as actual_qty"],
		filters={"item_code": item_code, "warehouse": ["in", warehouses]},
	)

	return flt(rows[0].actual_qty) if rows else 0.0


def get_item_detail(item, doc=None, warehouse=None, price_list=None, company=None):
	"""Get item detail with batch/serial data and pricing"""
	item = json.loads(item) if isinstance(item, str) else item
	today = nowdate()
	item_code = item.get("item_code")
	batch_no_data = []
	serial_no_data = []

	if warehouse and item.get("has_batch_no"):
		batch_list = get_batch_qty(warehouse=warehouse, item_code=item_code)
		if batch_list:
			for batch in batch_list:
				if batch.qty > 0 and batch.batch_no:
					batch_doc = frappe.get_cached_doc("Batch", batch.batch_no)
					if (
						str(batch_doc.expiry_date) > str(today) or batch_doc.expiry_date in ["", None]
					) and batch_doc.disabled == 0:
						batch_no_data.append(
							{
								"batch_no": batch.batch_no,
								"batch_qty": batch.qty,
								"expiry_date": batch_doc.expiry_date,
								"manufacturing_date": batch_doc.manufacturing_date,
							}
						)

	if warehouse and item.get("has_serial_no"):
		serial_no_data = frappe.get_all(
			"Serial No",
			filters={
				"item_code": item_code,
				"status": "Active",
				"warehouse": warehouse,
			},
			fields=["name as serial_no"],
		)

	item["selling_price_list"] = price_list

	# Handle multi-currency
	if company:
		company_currency = frappe.db.get_value("Company", company, "default_currency")
		price_list_currency = company_currency
		if price_list:
			price_list_currency = (
				frappe.db.get_value("Price List", price_list, "currency") or company_currency
			)

		exchange_rate = 1
		if price_list_currency != company_currency:
			from erpnext.setup.utils import get_exchange_rate
			try:
				exchange_rate = get_exchange_rate(price_list_currency, company_currency, today)
			except Exception:
				frappe.log_error(
					f"Missing exchange rate from {price_list_currency} to {company_currency}",
					"POS Next",
				)

		item["price_list_currency"] = price_list_currency
		item["plc_conversion_rate"] = exchange_rate
		item["conversion_rate"] = exchange_rate

		if doc:
			doc.price_list_currency = price_list_currency
			doc.plc_conversion_rate = exchange_rate
			doc.conversion_rate = exchange_rate

	# Add company to the item args
	if company:
		item["company"] = company

	# Create a proper doc structure with company
	if not doc and company:
		doc = frappe._dict({"doctype": "Sales Invoice", "company": company})

	max_discount = frappe.get_value("Item", item_code, "max_discount")

	# Prepare args dict for get_item_details - only include necessary fields
	args = frappe._dict({
		"doctype": "Sales Invoice",
		"item_code": item.get("item_code"),
		"company": item.get("company"),
		"qty": item.get("qty", 1),
		"selling_price_list": item.get("selling_price_list"),
		"price_list_currency": item.get("price_list_currency"),
		"plc_conversion_rate": item.get("plc_conversion_rate"),
		"conversion_rate": item.get("conversion_rate"),
	})

	res = erpnext_get_item_details(args, doc)

	if item.get("is_stock_item") and warehouse:
		res["actual_qty"] = get_stock_availability(item_code, warehouse)

	res["max_discount"] = max_discount
	res["batch_no_data"] = batch_no_data
	res["serial_no_data"] = serial_no_data

	# Add UOMs data
	uoms = frappe.get_all(
		"UOM Conversion Detail",
		filters={"parent": item_code},
		fields=["uom", "conversion_factor"],
	)

	# Add stock UOM if not already in uoms list
	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
	if stock_uom:
		stock_uom_exists = False
		for uom_data in uoms:
			if uom_data.get("uom") == stock_uom:
				stock_uom_exists = True
				break

		if not stock_uom_exists:
			uoms.append({"uom": stock_uom, "conversion_factor": 1.0})

	res["item_uoms"] = uoms

	return res


@frappe.whitelist()
def search_by_barcode(barcode, pos_profile):
	"""Search item by barcode"""
	try:
		# Parse pos_profile if it's a JSON string
		if isinstance(pos_profile, str):
			try:
				pos_profile = json.loads(pos_profile)
			except (json.JSONDecodeError, ValueError):
				pass  # It's already a plain string

		# Ensure pos_profile is a string (handle dict or string input)
		if isinstance(pos_profile, dict):
			pos_profile = pos_profile.get("name") or pos_profile.get("pos_profile")

		if not pos_profile:
			frappe.throw(_("POS Profile is required"))

		# Search for item by barcode
		item_code = frappe.db.get_value("Item Barcode", {"barcode": barcode}, "parent")

		if not item_code:
			# Try searching in item code field directly
			item_code = frappe.db.get_value("Item", {"name": barcode})

		if not item_code:
			frappe.throw(_("Item with barcode {0} not found").format(barcode))

		# Get POS Profile details
		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)

		# Validate POS Profile has required fields
		if not pos_profile_doc.warehouse:
			frappe.throw(_("Warehouse not set in POS Profile {0}").format(pos_profile))
		if not pos_profile_doc.selling_price_list:
			frappe.throw(_("Selling Price List not set in POS Profile {0}").format(pos_profile))
		if not pos_profile_doc.company:
			frappe.throw(_("Company not set in POS Profile {0}").format(pos_profile))

		# Get item doc
		item_doc = frappe.get_cached_doc("Item", item_code)

		# Check if item is allowed for sales
		if not item_doc.is_sales_item:
			frappe.throw(_("Item {0} is not allowed for sales").format(item_code))

		# Prepare item dict for get_item_detail
		item = {
			"item_code": item_code,
			"has_batch_no": item_doc.has_batch_no or 0,
			"has_serial_no": item_doc.has_serial_no or 0,
			"is_stock_item": item_doc.is_stock_item or 0,
			"pos_profile": pos_profile
		}

		# Get item details
		item_details = get_item_detail(
			item=json.dumps(item),
			warehouse=pos_profile_doc.warehouse,
			price_list=pos_profile_doc.selling_price_list,
			company=pos_profile_doc.company
		)

		return item_details
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Search by Barcode Error")
		frappe.throw(_("Error searching by barcode: {0}").format(str(e)))


@frappe.whitelist()
def get_item_stock(item_code, warehouse):
	"""Get real-time stock for item"""
	try:
		from frappe.utils import flt

		# Get actual stock quantity
		stock_qty = frappe.db.get_value(
			"Bin",
			{"item_code": item_code, "warehouse": warehouse},
			"actual_qty"
		) or 0

		# Get reserved quantity
		reserved_qty = frappe.db.get_value(
			"Bin",
			{"item_code": item_code, "warehouse": warehouse},
			"reserved_qty"
		) or 0

		available_qty = flt(stock_qty) - flt(reserved_qty)

		return {
			"item_code": item_code,
			"warehouse": warehouse,
			"stock_qty": flt(stock_qty),
			"reserved_qty": flt(reserved_qty),
			"available_qty": available_qty
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Stock Error")
		frappe.throw(_("Error fetching item stock: {0}").format(str(e)))


@frappe.whitelist()
def get_batch_serial_details(item_code, warehouse):
	"""Get batch/serial number details"""
	try:
		# Check if item has batch
		has_batch_no = frappe.db.get_value("Item", item_code, "has_batch_no")
		# Check if item has serial
		has_serial_no = frappe.db.get_value("Item", item_code, "has_serial_no")

		result = {
			"item_code": item_code,
			"has_batch_no": has_batch_no,
			"has_serial_no": has_serial_no,
			"batches": [],
			"serial_nos": []
		}

		if has_batch_no:
			# Get available batches
			batches = frappe.db.sql(
				"""
				SELECT batch_no, batch_qty as qty, expiry_date
				FROM `tabBatch`
				WHERE item = %s AND batch_qty > 0
				ORDER BY expiry_date ASC, creation ASC
				""",
				item_code,
				as_dict=1
			)
			result["batches"] = batches

		if has_serial_no:
			# Get available serial numbers
			serial_nos = frappe.db.sql(
				"""
				SELECT name as serial_no, warehouse
				FROM `tabSerial No`
				WHERE item_code = %s AND warehouse = %s AND status = 'Active'
				ORDER BY creation ASC
				""",
				(item_code, warehouse),
				as_dict=1
			)
			result["serial_nos"] = serial_nos

		return result
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Batch/Serial Details Error")
		frappe.throw(_("Error fetching batch/serial details: {0}").format(str(e)))


@frappe.whitelist()
def get_items(pos_profile, search_term=None, item_group=None, start=0, limit=20):
	"""Get items for POS with stock, price, and tax details"""
	try:
		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)

		filters = {
			"disabled": 0,
			"has_variants": 0,
			"is_sales_item": 1  # Only show items with "Allow Sales" enabled
		}

		# Add item group filter if provided
		if item_group:
			filters["item_group"] = item_group

		# Build search conditions
		or_filters = []
		if search_term:
			or_filters = [
				["item_code", "like", f"%{search_term}%"],
				["item_name", "like", f"%{search_term}%"],
				["description", "like", f"%{search_term}%"]
			]

		# Get items
		items = frappe.get_list(
			"Item",
			filters=filters,
			or_filters=or_filters if or_filters else None,
			fields=[
				"name as item_code",
				"item_name",
				"description",
				"stock_uom",
				"image",
				"is_stock_item",
				"has_batch_no",
				"has_serial_no",
				"item_group"
			],
			start=start,
			page_length=limit,
			order_by="item_name asc"
		)

		# Get all barcodes for these items in a single query (performance optimization)
		item_codes = [item["item_code"] for item in items]
		barcode_map = {}
		if item_codes:
			barcodes = frappe.db.sql(
				"""
				SELECT parent, barcode
				FROM `tabItem Barcode`
				WHERE parent IN %s
				GROUP BY parent
				""",
				[item_codes],
				as_dict=1
			)
			barcode_map = {b["parent"]: b["barcode"] for b in barcodes}

		# Enrich items with price, stock, and barcode data
		for item in items:
			# Get price
			price = frappe.db.get_value(
				"Item Price",
				{
					"item_code": item["item_code"],
					"price_list": pos_profile_doc.selling_price_list
				},
				["price_list_rate", "uom"],
				as_dict=1,
			)

			if price:
				item["rate"] = price.get("price_list_rate") or 0
				item["price_list_rate"] = price.get("price_list_rate") or 0
				item["uom"] = price.get("uom") or item.get("stock_uom")
			else:
				item["rate"] = 0
				item["price_list_rate"] = 0
				item["uom"] = item.get("stock_uom")

			# Get stock if warehouse specified
			if pos_profile_doc.warehouse and item.get("is_stock_item"):
				stock = frappe.db.get_value(
					"Bin",
					{
						"item_code": item["item_code"],
						"warehouse": pos_profile_doc.warehouse
					},
					"actual_qty"
				)
				item["actual_qty"] = stock or 0
			else:
				item["actual_qty"] = 0

			# Add barcode from map
			item["barcode"] = barcode_map.get(item["item_code"], "")

		return items
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Items Error")
		frappe.throw(_("Error fetching items: {0}").format(str(e)))


@frappe.whitelist()
def get_item_details(item_code, pos_profile, customer=None, qty=1):
	"""Get detailed item info including price, tax, stock"""
	try:
		# Parse pos_profile if it's a JSON string
		if isinstance(pos_profile, str):
			try:
				pos_profile = json.loads(pos_profile)
			except (json.JSONDecodeError, ValueError):
				pass  # It's already a plain string

		# Ensure pos_profile is a string (handle dict or string input)
		if isinstance(pos_profile, dict):
			pos_profile = pos_profile.get("name") or pos_profile.get("pos_profile")

		if not pos_profile:
			frappe.throw(_("POS Profile is required"))

		pos_profile_doc = frappe.get_cached_doc("POS Profile", pos_profile)
		item_doc = frappe.get_cached_doc("Item", item_code)

		# Check if item is allowed for sales
		if not item_doc.is_sales_item:
			frappe.throw(_("Item {0} is not allowed for sales").format(item_code))

		# Prepare item dict
		item = {
			"item_code": item_code,
			"has_batch_no": item_doc.has_batch_no,
			"has_serial_no": item_doc.has_serial_no,
			"is_stock_item": item_doc.is_stock_item,
			"pos_profile": pos_profile,
			"qty": qty
		}

		return get_item_detail(
			item=json.dumps(item),
			warehouse=pos_profile_doc.warehouse,
			price_list=pos_profile_doc.selling_price_list,
			company=pos_profile_doc.company
		)
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Details Error")
		frappe.throw(_("Error fetching item details: {0}").format(str(e)))


@frappe.whitelist()
def get_item_groups(pos_profile):
	"""Get item groups for filtering"""
	try:
		# Get item groups from POS Profile's item groups table
		item_groups = frappe.db.sql(
			"""
			SELECT DISTINCT ig.item_group
			FROM `tabPOS Item Group` ig
			WHERE ig.parent = %s
			ORDER BY ig.item_group
			""",
			pos_profile,
			as_dict=1
		)

		# If no item groups defined in POS Profile, get all item groups
		if not item_groups:
			item_groups = frappe.get_list(
				"Item Group",
				filters={"is_group": 0},
				fields=["name as item_group"],
				order_by="name",
				limit_page_length=50
			)

		return item_groups
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Item Groups Error")
		frappe.throw(_("Error fetching item groups: {0}").format(str(e)))
