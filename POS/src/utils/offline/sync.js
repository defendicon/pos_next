import { call } from "@/utils/apiWrapper"
import { db } from "./db"
import { offlineState } from "./offlineState"
import { generateOfflineId } from "./uuid"

// Re-export for backwards compatibility
export { generateOfflineId }

// ============================================================================
// CONSTANTS
// ============================================================================

const SYNC_CONFIG = {
	MAX_RETRY_COUNT: 3,
	CLEANUP_AGE_DAYS: 7,
	PING_TIMEOUT_MS: 3000,
}

// Duplicate error patterns to detect already-synced invoices
const DUPLICATE_ERROR_PATTERNS = [
	"DUPLICATE_OFFLINE_INVOICE",
	"already been synced",
]

// ============================================================================
// SERVER CONNECTIVITY
// ============================================================================

/**
 * Ping server to check connectivity
 * @returns {Promise<boolean>} Whether server is reachable
 */
export const pingServer = async () => {
	if (typeof window === "undefined") return true

	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.PING_TIMEOUT_MS)

		const response = await fetch("/api/method/pos_next.api.ping", {
			method: "GET",
			signal: controller.signal,
		})

		clearTimeout(timeoutId)
		const isOnline = response.ok
		// Update centralized state (handles window sync automatically)
		offlineState.setServerOnline(isOnline)
		return isOnline
	} catch (error) {
		// Server unreachable
		offlineState.setServerOnline(false)
		return false
	}
}

/**
 * Check if currently offline
 * @returns {boolean}
 */
export const isOffline = () => {
	if (typeof window === "undefined") return false
	return offlineState.isOffline
}

// ============================================================================
// OFFLINE INVOICE QUEUE OPERATIONS
// ============================================================================

/**
 * Save invoice to offline queue with unique offline_id for deduplication
 * @param {Object} invoiceData - Invoice data to save
 * @returns {Promise<{success: boolean, id: number, offline_id: string}>}
 */
export const saveOfflineInvoice = async (invoiceData) => {
	if (!invoiceData.items?.length) {
		throw new Error("Cannot save empty invoice")
	}

	// Clean data (remove reactive properties) and add offline_id
	const cleanData = JSON.parse(JSON.stringify(invoiceData))
	const offlineId = generateOfflineId()
	cleanData.offline_id = offlineId

	const id = await db.invoice_queue.add({
		offline_id: offlineId,
		data: cleanData,
		timestamp: Date.now(),
		synced: false,
		retry_count: 0,
	})

	await updateLocalStock(cleanData.items)

	console.log(`Invoice saved to offline queue with offline_id: ${offlineId}`)
	return { success: true, id, offline_id: offlineId }
}

/**
 * Get all pending (unsynced) offline invoices
 * @returns {Promise<Array>}
 */
export const getOfflineInvoices = async () => {
	try {
		return await db.invoice_queue.filter((inv) => !inv.synced).toArray()
	} catch (error) {
		console.error("Error getting offline invoices:", error)
		return []
	}
}

/**
 * Get count of pending offline invoices
 * @returns {Promise<number>}
 */
export const getOfflineInvoiceCount = async () => {
	try {
		return await db.invoice_queue.filter((inv) => !inv.synced).count()
	} catch (error) {
		console.error("Error getting offline invoice count:", error)
		return 0
	}
}

/**
 * Delete an offline invoice by ID
 * @param {number} id - Invoice queue ID
 * @returns {Promise<boolean>}
 */
export const deleteOfflineInvoice = async (id) => {
	try {
		await db.invoice_queue.delete(id)
		return true
	} catch (error) {
		console.error("Error deleting offline invoice:", error)
		return false
	}
}

// ============================================================================
// DEDUPLICATION CHECK
// ============================================================================

/**
 * Check if an offline_id has already been synced to the server.
 * @param {string} offlineId - The offline_id to check
 * @returns {Promise<{synced: boolean, sales_invoice?: string}>}
 */
export const checkOfflineIdSynced = async (offlineId) => {
	if (!offlineId) return { synced: false }

	try {
		const response = await call(
			"pos_next.api.invoices.check_offline_invoice_synced",
			{ offline_id: offlineId },
		)
		return response || { synced: false }
	} catch (error) {
		// If check fails, assume not synced - server will still deduplicate
		console.warn(`Failed to check sync status for ${offlineId}:`, error)
		return { synced: false }
	}
}

/**
 * Check if an error message indicates a duplicate invoice
 * @param {Error|string} error - Error to check
 * @returns {{isDuplicate: boolean, invoiceName: string|null}}
 */
const checkDuplicateError = (error) => {
	const errorMessage = error?.message || error?.exc || String(error)
	const isDuplicate = DUPLICATE_ERROR_PATTERNS.some((pattern) =>
		errorMessage.includes(pattern),
	)

	if (!isDuplicate) return { isDuplicate: false, invoiceName: null }

	const match = errorMessage.match(/Sales Invoice: (\S+)/)
	return { isDuplicate: true, invoiceName: match?.[1] || null }
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Mark an invoice as synced in the local database
 * @param {number} id - Invoice queue ID
 * @param {string} serverInvoice - Server invoice name
 */
const markInvoiceSynced = async (id, serverInvoice) => {
	await db.invoice_queue.update(id, {
		synced: true,
		server_invoice: serverInvoice,
	})
}

/**
 * Increment retry count and optionally mark as failed
 * @param {Object} invoice - Invoice record
 * @param {string} errorMessage - Error message
 */
const handleSyncFailure = async (invoice, errorMessage) => {
	const newRetryCount = (invoice.retry_count || 0) + 1
	const updates = { retry_count: newRetryCount }

	if (newRetryCount >= SYNC_CONFIG.MAX_RETRY_COUNT) {
		updates.sync_failed = true
		updates.error = errorMessage
	}

	await db.invoice_queue.update(invoice.id, updates)
}

/**
 * Transform invoice data for server submission
 * @param {Object} invoiceData - Raw invoice data
 * @param {string} offlineId - Offline ID
 * @returns {Object} Transformed invoice data
 */
const prepareInvoiceForSubmission = (invoiceData, offlineId) => {
	const prepared = { ...invoiceData }

	// Map 'quantity' to 'qty' for ERPNext compatibility
	if (prepared.items?.length) {
		prepared.items = prepared.items.map((item) => ({
			...item,
			qty: item.quantity || item.qty || 1,
		}))
	}

	if (offlineId) {
		prepared.offline_id = offlineId
	}

	return prepared
}

/**
 * Sync a single invoice to the server
 * @param {Object} invoice - Invoice queue record
 * @returns {Promise<{status: 'success'|'skipped'|'failed', error?: Error}>}
 */
const syncSingleInvoice = async (invoice) => {
	const offlineId = invoice.offline_id || invoice.data?.offline_id

	// Pre-sync deduplication check
	if (offlineId) {
		const syncStatus = await checkOfflineIdSynced(offlineId)
		if (syncStatus.synced) {
			await markInvoiceSynced(invoice.id, syncStatus.sales_invoice)
			console.log(
				`Invoice ${invoice.id} (${offlineId}) already synced as ${syncStatus.sales_invoice}`,
			)
			return { status: "skipped" }
		}
	}

	// Prepare and submit
	const invoiceData = prepareInvoiceForSubmission(invoice.data, offlineId)

	const response = await call("pos_next.api.invoices.submit_invoice", {
		data: JSON.stringify({ invoice: invoiceData, data: {} }),
	})

	if (response.message || response.name) {
		const serverName = response.name || response.message
		await markInvoiceSynced(invoice.id, serverName)
		console.log(`Invoice ${invoice.id} (${offlineId}) synced as ${serverName}`)
		return { status: "success" }
	}

	throw new Error("Invalid server response")
}

/**
 * Sync all pending offline invoices to server
 * @returns {Promise<{success: number, failed: number, skipped: number, errors: Array}>}
 */
export const syncOfflineInvoices = async () => {
	if (isOffline()) {
		console.log("Cannot sync while offline")
		return { success: 0, failed: 0, skipped: 0, errors: [] }
	}

	const pendingInvoices = await getOfflineInvoices()
	if (!pendingInvoices.length) {
		return { success: 0, failed: 0, skipped: 0, errors: [] }
	}

	const result = { success: 0, failed: 0, skipped: 0, errors: [] }

	for (const invoice of pendingInvoices) {
		try {
			const syncResult = await syncSingleInvoice(invoice)

			if (syncResult.status === "success") {
				result.success++
			} else if (syncResult.status === "skipped") {
				result.skipped++
			}
		} catch (error) {
			console.error(`Error syncing invoice ${invoice.id}:`, error)

			// Check for duplicate error
			const { isDuplicate, invoiceName } = checkDuplicateError(error)
			if (isDuplicate) {
				await markInvoiceSynced(invoice.id, invoiceName)
				console.log(`Invoice ${invoice.id} duplicate detected, marking synced`)
				result.skipped++
				continue
			}

			// Handle genuine failure
			result.errors.push({
				invoiceId: invoice.id,
				offlineId: invoice.offline_id,
				customer: invoice.data?.customer || "Walk-in Customer",
				error,
			})

			await handleSyncFailure(invoice, error.message)
			result.failed++
		}
	}

	// Cleanup old synced invoices
	await cleanupSyncedInvoices()

	return result
}

/**
 * Clean up synced invoices older than configured days
 */
const cleanupSyncedInvoices = async () => {
	const cutoff = Date.now() - SYNC_CONFIG.CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000
	await db.invoice_queue
		.filter((inv) => inv.synced && inv.timestamp < cutoff)
		.delete()
}

// ============================================================================
// LOCAL STOCK OPERATIONS
// ============================================================================

/**
 * Update local stock after invoice
 * @param {Array} items - Invoice items
 */
export const updateLocalStock = async (items) => {
	if (!items?.length) return

	try {
		for (const item of items) {
			if (!item.item_code || !item.warehouse) continue

			const currentStock = await db.stock.get({
				item_code: item.item_code,
				warehouse: item.warehouse,
			})

			const qty = item.quantity || item.qty || 0
			const newQty = (currentStock?.qty || 0) - qty

			await db.stock.put({
				item_code: item.item_code,
				warehouse: item.warehouse,
				qty: newQty,
				updated_at: Date.now(),
			})
		}
	} catch (error) {
		console.error("Error updating local stock:", error)
	}
}

/**
 * Get local stock for an item
 * @param {string} itemCode - Item code
 * @param {string} warehouse - Warehouse
 * @returns {Promise<number>}
 */
export const getLocalStock = async (itemCode, warehouse) => {
	try {
		const stock = await db.stock.get({ item_code: itemCode, warehouse })
		return stock?.qty || 0
	} catch (error) {
		console.error("Error getting local stock:", error)
		return 0
	}
}

// ============================================================================
// OFFLINE PAYMENT OPERATIONS
// ============================================================================

/**
 * Save payment to offline queue
 * @param {Object} paymentData - Payment data
 * @returns {Promise<boolean>}
 */
export const saveOfflinePayment = async (paymentData) => {
	const cleanData = JSON.parse(JSON.stringify(paymentData))

	await db.payment_queue.add({
		data: cleanData,
		timestamp: Date.now(),
		synced: false,
		retry_count: 0,
	})

	console.log("Payment saved to offline queue")
	return true
}

// ============================================================================
// AUTO-SYNC ON RECONNECT
// ============================================================================

if (typeof window !== "undefined") {
	offlineState.subscribe(async (state) => {
		// Only sync when transitioning from offline to online (not manual)
		if (!state.isOffline && state.source !== "manual") {
			console.log("Back online, syncing pending invoices...")
			const result = await syncOfflineInvoices()

			window.dispatchEvent(
				new CustomEvent("offlineInvoicesSynced", { detail: result }),
			)

			if (result.success > 0) {
				console.log(`Successfully synced ${result.success} invoices`)
				if (result.skipped > 0) {
					console.log(`Skipped ${result.skipped} already-synced invoices`)
				}
				window.frappe?.msgprint?.({
					title: __("Sync Complete"),
					message: __("Successfully synced {0} offline invoices", [result.success]),
					indicator: "green",
				})
			}
		}
	})
}
