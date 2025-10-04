import { ref, computed } from "vue"
import { createResource } from "frappe-ui"

export function useInvoice() {
	// State
	const invoiceItems = ref([])
	const customer = ref(null)
	const payments = ref([])
	const posProfile = ref(null)
	const additionalDiscount = ref(0)
	const couponCode = ref(null)

	// Resources
	const updateInvoiceResource = createResource({
		url: "pos_next.api.invoices.update_invoice",
		makeParams(params) {
			return { data: JSON.stringify(params.data) }
		},
		auto: false,
	})

	const submitInvoiceResource = createResource({
		url: "pos_next.api.invoices.submit_invoice",
		makeParams(params) {
			return {
				invoice: JSON.stringify(params.invoice),
				data: JSON.stringify(params.data || {}),
			}
		},
		auto: false,
	})

	const validateCartItemsResource = createResource({
		url: "pos_next.api.invoices.validate_cart_items",
		makeParams({ items, pos_profile }) {
			return {
				items: JSON.stringify(items),
				pos_profile: pos_profile,
			}
		},
		auto: false,
	})

	const applyOffersResource = createResource({
		url: "pos_next.api.invoices.apply_offers",
		makeParams({ invoice_data }) {
			return { invoice_data: JSON.stringify(invoice_data) }
		},
		auto: false,
	})

	const getItemDetailsResource = createResource({
		url: "pos_next.api.items.get_item_details",
		auto: false,
	})

	// Computed
	const subtotal = computed(() => {
		return invoiceItems.value.reduce((sum, item) => {
			return sum + item.quantity * item.rate
		}, 0)
	})

	const totalTax = computed(() => {
		return invoiceItems.value.reduce((sum, item) => {
			return sum + (item.tax_amount || 0)
		}, 0)
	})

	const totalDiscount = computed(() => {
		const itemDiscount = invoiceItems.value.reduce((sum, item) => {
			return sum + (item.discount_amount || 0)
		}, 0)
		return itemDiscount + (additionalDiscount.value || 0)
	})

	const grandTotal = computed(() => {
		return subtotal.value + totalTax.value - totalDiscount.value
	})

	const totalPaid = computed(() => {
		return payments.value.reduce((sum, p) => sum + (p.amount || 0), 0)
	})

	const remainingAmount = computed(() => {
		return grandTotal.value - totalPaid.value
	})

	const canSubmit = computed(() => {
		return (
			invoiceItems.value.length > 0 &&
			remainingAmount.value <= 0.01 // Allow small rounding differences
		)
	})

	// Actions
	function addItem(item, quantity = 1) {
		const existingItem = invoiceItems.value.find(
			(i) => i.item_code === item.item_code
		)

		if (existingItem) {
			existingItem.quantity += quantity
			recalculateItem(existingItem)
		} else {
			invoiceItems.value.unshift({
				item_code: item.item_code,
				item_name: item.item_name,
				rate: item.rate || item.price_list_rate || 0,
				price_list_rate: item.price_list_rate || 0,
				quantity: quantity,
				discount_amount: 0,
				discount_percentage: 0,
				tax_amount: 0,
				amount: quantity * (item.rate || item.price_list_rate || 0),
				stock_qty: item.stock_qty || 0,
				image: item.image,
				uom: item.uom || item.stock_uom,
				stock_uom: item.stock_uom,
				conversion_factor: item.conversion_factor || 1,
				warehouse: item.warehouse,
				actual_batch_qty: item.actual_batch_qty || 0,
				has_batch_no: item.has_batch_no || 0,
				has_serial_no: item.has_serial_no || 0,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
			})
		}
	}

	function removeItem(itemCode) {
		invoiceItems.value = invoiceItems.value.filter(
			(i) => i.item_code !== itemCode
		)
	}

	function updateItemQuantity(itemCode, quantity) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.quantity = parseFloat(quantity) || 1
			recalculateItem(item)
		}
	}

	function updateItemRate(itemCode, rate) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.rate = parseFloat(rate) || 0
			recalculateItem(item)
		}
	}

	function updateItemDiscount(itemCode, discountPercentage) {
		const item = invoiceItems.value.find((i) => i.item_code === itemCode)
		if (item) {
			item.discount_percentage = parseFloat(discountPercentage) || 0
			const discountAmount =
				(item.rate * item.quantity * item.discount_percentage) / 100
			item.discount_amount = discountAmount
			recalculateItem(item)
		}
	}

	function recalculateItem(item) {
		// Recalculate amount
		item.amount = item.quantity * item.rate

		// Recalculate discount if percentage is set
		if (item.discount_percentage > 0) {
			item.discount_amount = (item.amount * item.discount_percentage) / 100
		}

		// Calculate tax (simplified - in production, use tax template logic)
		const netAmount = item.amount - (item.discount_amount || 0)
		// This is a simplified tax calculation - should be enhanced with proper tax template logic
		item.tax_amount = 0 // Will be calculated by backend
	}

	function addPayment(payment) {
		payments.value.push({
			mode_of_payment: payment.mode_of_payment,
			amount: parseFloat(payment.amount) || 0,
			type: payment.type,
		})
	}

	function removePayment(index) {
		payments.value.splice(index, 1)
	}

	function updatePayment(index, amount) {
		if (payments.value[index]) {
			payments.value[index].amount = parseFloat(amount) || 0
		}
	}

	async function validateStock() {
		/**
		 * Validate stock availability before submission
		 * Returns array of errors if stock is insufficient
		 */
		const items = invoiceItems.value.map((item) => ({
			item_code: item.item_code,
			qty: item.quantity,
			warehouse: item.warehouse,
			conversion_factor: item.conversion_factor || 1,
			stock_qty: item.quantity * (item.conversion_factor || 1),
			is_stock_item: item.is_stock_item !== false, // default to true
		}))

		try {
			const result = await validateCartItemsResource.submit({
				items: items,
				pos_profile: posProfile.value,
			})
			return result || []
		} catch (error) {
			console.error("Stock validation error:", error)
			return []
		}
	}

	async function saveDraft() {
		/**
		 * Save invoice as draft (Step 1 - POSAwesome style)
		 * This creates the invoice with docstatus=0
		 */
		const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value.map((item) => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
				conversion_factor: item.conversion_factor || 1,
				discount_percentage: item.discount_percentage || 0,
				discount_amount: item.discount_amount || 0,
			})),
			payments: payments.value.map((p) => ({
				mode_of_payment: p.mode_of_payment,
				amount: p.amount,
				type: p.type,
			})),
			discount_amount: additionalDiscount.value || 0,
			coupon_code: couponCode.value,
			is_pos: 1,
			update_stock: 1,
		}

		const result = await updateInvoiceResource.submit({ data: invoiceData })
		return result?.data || result
	}

	async function submitInvoice() {
		/**
		 * Two-step submission process (POSAwesome style):
		 * 1. Create/update draft invoice
		 * 2. Validate stock and submit
		 */
		try {
			// Step 1: Create invoice draft
			const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value,
			items: invoiceItems.value.map((item) => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				batch_no: item.batch_no,
				serial_no: item.serial_no,
				conversion_factor: item.conversion_factor || 1,
				discount_percentage: item.discount_percentage || 0,
				discount_amount: item.discount_amount || 0,
			})),
			payments: payments.value.map((p) => ({
				mode_of_payment: p.mode_of_payment,
				amount: p.amount,
				type: p.type,
			})),
			discount_amount: additionalDiscount.value || 0,
			coupon_code: couponCode.value,
			is_pos: 1,
			update_stock: 1, // Critical: Ensures stock is updated
		}

		const draftInvoice = await updateInvoiceResource.submit({ data: invoiceData })

		let invoiceDoc = draftInvoice
		if (draftInvoice && typeof draftInvoice === 'object' && 'data' in draftInvoice) {
			invoiceDoc = draftInvoice.data
		}

		if (!invoiceDoc || !invoiceDoc.name) {
			throw new Error("Failed to create draft invoice - no invoice name returned")
		}

		const submitData = {
			change_amount: remainingAmount.value < 0 ? Math.abs(remainingAmount.value) : 0,
		}

		const result = await submitInvoiceResource.submit({
			invoice: invoiceDoc,
			data: submitData,
		})

		resetInvoice()
		return result
	} catch (error) {
		throw new Error(`Failed to submit invoice: ${error.message}`)
		}
	}

	function resetInvoice() {
		invoiceItems.value = []
		customer.value = null
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null
	}

	function clearCart() {
		invoiceItems.value = []
		payments.value = []
		additionalDiscount.value = 0
		couponCode.value = null
	}

	return {
		// State
		invoiceItems,
		customer,
		payments,
		posProfile,
		additionalDiscount,
		couponCode,

		// Computed
		subtotal,
		totalTax,
		totalDiscount,
		grandTotal,
		totalPaid,
		remainingAmount,
		canSubmit,

		// Actions
		addItem,
		removeItem,
		updateItemQuantity,
		updateItemRate,
		updateItemDiscount,
		addPayment,
		removePayment,
		updatePayment,
		validateStock,
		saveDraft,
		submitInvoice,
		resetInvoice,
		clearCart,

		// Resources
		updateInvoiceResource,
		submitInvoiceResource,
		validateCartItemsResource,
		applyOffersResource,
		getItemDetailsResource,
	}
}
