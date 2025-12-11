import { call } from "@/utils/apiWrapper"
import { db, getSetting, setSetting } from "./db"
import { offlineState } from "./offlineState"
import { offlineWorker } from "@/utils/offline/workerClient"

// Cache structure definition - modify this when cache structure changes
const CACHE_STRUCTURE = {
	// Define what gets cached
	items: ["item_code", "item_name", "item_group", "barcodes", "price", "stock"],
	customers: ["name", "customer_name", "mobile_no", "email_id"],
	item_prices: ["price_list", "item_code", "price"],
	local_stock: ["item_code", "warehouse", "actual_qty"],
	payment_methods: [
		"mode_of_payment",
		"pos_profile",
		"default",
		"allow_in_returns",
		"type",
	],
}

// Generate cache version from structure hash
function getCacheStructureHash(structure) {
	const structureString = JSON.stringify(structure)
	let hash = 0
	for (let i = 0; i < structureString.length; i++) {
		const char = structureString.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash)
}

// Auto-increment cache version based on structure changes
function getCacheVersion() {
	const structureHash = getCacheStructureHash(CACHE_STRUCTURE)
	const storedHash = localStorage.getItem("pos_next_cache_structure_hash")
	const storedVersion = Number.parseInt(
		localStorage.getItem("pos_next_cache_version") || "1",
	)

	if (storedHash !== structureHash.toString()) {
		const newVersion = storedVersion + 1
		console.log(
			`Cache structure changed. Upgrading from v${storedVersion} to v${newVersion}`,
		)
		localStorage.setItem(
			"pos_next_cache_structure_hash",
			structureHash.toString(),
		)
		localStorage.setItem("pos_next_cache_version", newVersion.toString())
		return newVersion
	}

	return storedVersion
}

export const CACHE_VERSION = getCacheVersion()

// In-memory cache for fast access
export const memory = {
	// Offline queues
	offline_invoices: [],
	offline_customers: [],
	offline_payments: [],

	// Cached data
	items: [],
	customers: [],
	item_prices: {},
	local_stock: {},
	payment_methods: [],

	// Metadata
	items_last_sync: null,
	customers_last_sync: null,
	payment_methods_last_sync: null,
	cache_ready: false,
	stock_cache_ready: false,
	manual_offline: false,

	// Cache version
	cache_version: CACHE_VERSION,
}

// Initialize memory cache from IndexedDB
export const initMemoryCache = async () => {
	try {
		console.log("Initializing memory cache...")

		// Load cache version
		const storedVersion = await getSetting("cache_version", CACHE_VERSION)
		if (storedVersion !== CACHE_VERSION) {
			console.log("Cache version mismatch, clearing cache...")
			await clearAllCache()
			await setSetting("cache_version", CACHE_VERSION)
			memory.cache_version = CACHE_VERSION
		}

		// Load items last sync timestamp
		memory.items_last_sync = await getSetting("items_last_sync", null)
		memory.customers_last_sync = await getSetting("customers_last_sync", null)
		memory.cache_ready = await getSetting("cache_ready", false)
		memory.stock_cache_ready = await getSetting("stock_cache_ready", false)
		memory.manual_offline = await getSetting("manual_offline", false)

		// Sync manual_offline to centralized state manager
		if (memory.manual_offline) {
			offlineState.setManualOffline(true, { silent: true })
		}

		// Load items count (don't load all items into memory, too heavy)
		const itemsCount = await db.items.count()
		const customersCount = await db.customers.count()

		console.log(
			`Cache initialized: ${itemsCount} items, ${customersCount} customers`,
		)
		console.log(
			`Cache ready: ${memory.cache_ready}, Stock ready: ${memory.stock_cache_ready}`,
		)

		return true
	} catch (error) {
		console.error("Failed to initialize memory cache:", error)
		return false
	}
}

// Check if cache is ready for offline use
export const isCacheReady = () => {
	return memory.cache_ready
}

// Check if stock cache is ready
export const isStockCacheReady = () => {
	return memory.stock_cache_ready
}

// Get manual offline state (uses centralized offlineState)
export const isManualOffline = () => {
	return offlineState.manualOffline
}

// Set manual offline state (uses centralized offlineState)
export const setManualOffline = async (state) => {
	offlineState.setManualOffline(!!state)
	// Also persist to settings for worker initialization
	await setSetting("manual_offline", !!state)
	memory.manual_offline = !!state
}

// Toggle manual offline (uses centralized offlineState)
export const toggleManualOffline = async () => {
	const newState = offlineState.toggleManualOffline()
	await setSetting("manual_offline", newState)
	memory.manual_offline = newState
	return newState
}

// Load items from server (returns data for worker to cache)
export const cacheItemsFromServer = async (posProfile, options = {}) => {
	try {
		console.log("Starting robust item sync...", options)

		// Use the robust sync logic
		await syncAllItems(posProfile, options)

		return { success: true }
	} catch (error) {
		console.error("Error in item sync:", error)
		throw error
	}
}

/**
 * Robust item sync mechanism that ensures all items are fetched from server
 * by comparing server count with local count and retrying if necessary.
 *
 * @param {string} posProfile - POS Profile name
 * @param {object} options - Sync options
 * @param {boolean} options.force - Force full sync even if counts match
 */
async function syncAllItems(posProfile, options = {}) {
	const BATCH_SIZE = 1000
	const MAX_RETRIES = 5
	const MAX_BATCH_RETRIES = 3
	let retryCount = 0

	try {
		// 1. Get total item count from server
		// Pass item_group if needed, but for now we sync everything for the profile
		const serverCount = await call("pos_next.api.items.get_item_count", {
			pos_profile: posProfile
		})

		console.log(`Server has ${serverCount} items`)

		// 2. Determine if sync is needed
		const localCount = await db.items.count()

		// If force sync is requested, or if we have missing items, proceed.
		// Also proceed if counts match but we specifically want to update (implicit in "Sync Master Data").
		// However, for "Auto Sync", we might want to be efficient.
		// But since the requirement is "sync again until ... same", we should check count.
		// To support UPDATES (where count is same but data changed), we should probably
		// check a timestamp or hash, but lacking that, we can assume manual sync (force=true) implies full fetch.
		// If called automatically, we rely on count mismatch or empty cache.

		if (localCount >= serverCount && !options.force && localCount > 0) {
			console.log(`Sync skipped: Local count (${localCount}) >= Server count (${serverCount}) and not forced.`)
			return
		}

		// 3. Fetch items in batches
		const totalBatches = Math.ceil(serverCount / BATCH_SIZE) || 1

		// If forcing, maybe clear cache first?
		// "offlineWorker.cacheItems" uses "bulkPut" which upserts.
		// Clearing is safer for deleted items but slower.
		// Let's stick to upsert for robustness.

		// Retry loop for the whole process if final verification fails
		while (true) {

			for (let i = 0; i < totalBatches; i++) {
				const start = i * BATCH_SIZE

				let batchSuccess = false
				let batchRetries = 0

				// Retry loop for individual batch
				while (!batchSuccess && batchRetries < MAX_BATCH_RETRIES) {
					try {
						console.log(`Fetching batch ${i+1}/${totalBatches} (Start: ${start})...`)

						const response = await call("pos_next.api.items.get_items", {
							pos_profile: posProfile,
							start: start,
							limit: BATCH_SIZE
						})

						const items = response.message || []

						if (items.length > 0) {
							const processedItems = items.map((item) => ({
								...item,
								barcodes: item.item_barcode
									? Array.isArray(item.item_barcode)
										? item.item_barcode.map((b) => b.barcode).filter(Boolean)
										: [item.item_barcode]
									: [],
							}))

							await offlineWorker.cacheItems(processedItems)
						}
						batchSuccess = true
					} catch (err) {
						console.error(`Error fetching batch ${start}, retry ${batchRetries}:`, err)
						batchRetries++
						await new Promise(r => setTimeout(r, 1000 * batchRetries))
					}
				}

				if (!batchSuccess) {
					console.error(`Failed to fetch batch starting at ${start} after ${MAX_BATCH_RETRIES} retries.`)
					// If a batch fails, the final count check will likely fail and trigger outer retry.
				}
			}

			// Verification
			const finalLocalCount = await db.items.count()
			if (finalLocalCount >= serverCount) {
				console.log(`Sync complete! Local: ${finalLocalCount}, Server: ${serverCount}`)
				break
			}

			if (retryCount >= MAX_RETRIES) {
				console.warn(`Max outer retries reached. Local: ${finalLocalCount}, Server: ${serverCount}`)
				break
			}

			console.log(`Sync mismatch. Local: ${finalLocalCount}, Server: ${serverCount}. Retrying missing items...`)
			retryCount++
			await new Promise(r => setTimeout(r, 2000))
		}

	} catch (error) {
		console.error("Sync failed:", error)
		throw error
	}
}

// Load customers from server (returns data for worker to cache)
export const cacheCustomersFromServer = async (posProfile) => {
	try {
		console.log("Fetching customers from server...")

		const response = await call("pos_next.api.customers.get_customers", {
                        pos_profile: posProfile,
                        start: 0,
                        limit: 0, // Get all customers
                })

		if (response.message && Array.isArray(response.message)) {
			const customers = response.message

			console.log(`Fetched ${customers.length} customers from server`)
			return { customers }
		}

		return { customers: [] }
	} catch (error) {
		console.error("Error fetching customers from server:", error)
		throw error
	}
}

// Search items in cache
export const searchCachedItems = async (searchTerm = "", limit = 50) => {
	try {
		if (!searchTerm) {
			return await db.items.limit(limit).toArray()
		}

		const term = searchTerm.toLowerCase()

		// Search by item code, name, or barcode
		const results = await db.items
			.where("item_code")
			.startsWithIgnoreCase(term)
			.or("item_name")
			.startsWithIgnoreCase(term)
			.or("barcodes")
			.equals(term)
			.limit(limit)
			.toArray()

		return results
	} catch (error) {
		console.error("Error searching cached items:", error)
		return []
	}
}

// Search customers in cache
export const searchCachedCustomers = async (searchTerm = "", limit = 50) => {
	try {
		if (!searchTerm) {
			return await db.customers.limit(limit).toArray()
		}

		const term = searchTerm.toLowerCase()

		// Search by name, mobile, or email
		const results = await db.customers
			.where("customer_name")
			.startsWithIgnoreCase(term)
			.or("mobile_no")
			.startsWithIgnoreCase(term)
			.or("email_id")
			.startsWithIgnoreCase(term)
			.limit(limit)
			.toArray()

		return results
	} catch (error) {
		console.error("Error searching cached customers:", error)
		return []
	}
}

// Get item from cache by code
export const getCachedItem = async (itemCode) => {
	try {
		return await db.items.get(itemCode)
	} catch (error) {
		console.error("Error getting cached item:", error)
		return null
	}
}

// Get customer from cache by name
export const getCachedCustomer = async (customerName) => {
	try {
		return await db.customers.get(customerName)
	} catch (error) {
		console.error("Error getting cached customer:", error)
		return null
	}
}

// Check if cache needs refresh (older than 24 hours)
export const needsCacheRefresh = () => {
	if (!memory.items_last_sync) return true

	const ONE_DAY = 24 * 60 * 60 * 1000
	const now = Date.now()
	return now - memory.items_last_sync > ONE_DAY
}

// Clear all cached data
export const clearAllCache = async () => {
	try {
		console.log("Clearing all cache...")

		// Clear IndexedDB tables
		await db.items.clear()
		await db.customers.clear()
		await db.item_prices.clear()
		await db.stock.clear()

		// Reset memory
		memory.items = []
		memory.customers = []
		memory.item_prices = {}
		memory.local_stock = {}
		memory.items_last_sync = null
		memory.customers_last_sync = null
		memory.cache_ready = false
		memory.stock_cache_ready = false

		// Update settings
		await setSetting("items_last_sync", null)
		await setSetting("customers_last_sync", null)
		await setSetting("cache_ready", false)
		await setSetting("stock_cache_ready", false)

		console.log("Cache cleared successfully")
		return true
	} catch (error) {
		console.error("Error clearing cache:", error)
		return false
	}
}

// Get cache stats
export const getCacheStats = async () => {
	try {
		const itemsCount = await db.items.count()
		const customersCount = await db.customers.count()
		const queuedInvoices = await db.invoice_queue
			.filter((inv) => inv.synced === false)
			.count()

		return {
			items: itemsCount,
			customers: customersCount,
			queuedInvoices,
			cacheReady: memory.cache_ready,
			stockReady: memory.stock_cache_ready,
			lastSync: memory.items_last_sync
				? new Date(memory.items_last_sync).toLocaleString()
				: "Never",
		}
	} catch (error) {
		console.error("Error getting cache stats:", error)
		return {
			items: 0,
			customers: 0,
			queuedInvoices: 0,
			cacheReady: false,
			stockReady: false,
			lastSync: "Error",
		}
	}
}

/**
 * Cache payment methods from server
 * @param {string} posProfile - POS Profile name
 * @returns {Promise<object>} - Result with payment methods array
 */
export async function cachePaymentMethodsFromServer(posProfile) {
	try {
		const result = await call("pos_next.api.pos_profile.get_payment_methods", {
			pos_profile: posProfile,
		})
		const paymentMethods = result?.message || result || []

		// Add pos_profile to each method for indexing
		const methodsWithProfile = paymentMethods.map((method) => ({
			...method,
			pos_profile: posProfile,
		}))

		// Store in IndexedDB
		await db.payment_methods.bulkPut(methodsWithProfile)

		// Update last sync timestamp
		const timestamp = Date.now()
		await setSetting("payment_methods_last_sync", timestamp)
		memory.payment_methods_last_sync = timestamp

		console.log(
			`Cached ${paymentMethods.length} payment methods for ${posProfile}`,
		)

		return { payment_methods: paymentMethods }
	} catch (error) {
		console.error("Error caching payment methods:", error)
		throw error
	}
}

/**
 * Get cached payment methods for a POS Profile
 * @param {string} posProfile - POS Profile name
 * @returns {Promise<Array>} - Array of payment methods
 */
export async function getCachedPaymentMethods(posProfile) {
	try {
		const methods = await db.payment_methods
			.where("pos_profile")
			.equals(posProfile)
			.toArray()

		return methods
	} catch (error) {
		console.error("Error getting cached payment methods:", error)
		return []
	}
}

// Initialize cache on import
initMemoryCache()
