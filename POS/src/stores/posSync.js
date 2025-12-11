/**
 * POS Sync Store
 *
 * Manages offline synchronization state and operations for the POS system.
 * Handles invoice caching, sync operations, and offline state management.
 *
 * Key Design Decision:
 * This store subscribes directly to offlineState instead of using the useOffline()
 * composable. This is intentional because Pinia stores are singletons that persist
 * across component remounts (e.g., when changing language). Using Vue lifecycle
 * hooks (onMounted/onUnmounted) from composables would cause the subscription to
 * break when components remount.
 *
 * @module stores/posSync
 */

import { useToast } from "@/composables/useToast"
import {
	cacheCustomersFromServer,
	cacheItemsFromServer,
	cachePaymentMethodsFromServer,
	syncOfflineInvoices,
} from "@/utils/offline"
import { logger } from "@/utils/logger"
import { offlineState } from "@/utils/offline/offlineState"
import { offlineWorker } from "@/utils/offline/workerClient"
import { defineStore } from "pinia"
import { computed, ref } from "vue"

const log = logger.create('POSSync')

export const usePOSSyncStore = defineStore("posSync", () => {
	// =========================================================================
	// STATE
	// =========================================================================

	/** Current offline status - synced with offlineState singleton */
	const isOffline = ref(offlineState.isOffline)

	/** Number of invoices pending sync */
	const pendingInvoicesCount = ref(0)

	/** Whether a sync operation is in progress */
	const isSyncing = ref(false)

	/** Current connection quality metrics */
	const connectionQuality = ref(offlineState.getConnectionQuality())

	/** List of pending invoices for display */
	const pendingInvoicesList = ref([])

	/** Track previous offline state for detecting online/offline transitions */
	let wasOffline = offlineState.isOffline

	// =========================================================================
	// TOAST NOTIFICATIONS
	// =========================================================================

	const { showSuccess, showError, showWarning } = useToast()

	// =========================================================================
	// OFFLINE STATE SUBSCRIPTION
	// =========================================================================

	/**
	 * Subscribe to offlineState changes at the store level.
	 * This subscription persists for the app's lifetime since Pinia stores are singletons.
	 */
	offlineState.subscribe(async (state) => {
		const nowOffline = state.isOffline

		// Update reactive state
		isOffline.value = nowOffline
		connectionQuality.value = state.quality || offlineState.getConnectionQuality()

		// Auto-sync when transitioning from offline to online
		if (wasOffline && !nowOffline) {
			log.info('Transition to online detected, auto-syncing pending invoices')
			try {
				await syncPending()
			} catch (error) {
				log.error('Auto-sync failed on reconnection', error)
			}
		}

		wasOffline = nowOffline
	})

	// =========================================================================
	// COMPUTED
	// =========================================================================

	/** Whether there are any pending invoices to sync */
	const hasPendingInvoices = computed(() => pendingInvoicesCount.value > 0)

	// =========================================================================
	// INTERNAL HELPERS
	// =========================================================================

	/**
	 * Update the pending invoices count from the worker
	 */
	async function updatePendingCount() {
		try {
			pendingInvoicesCount.value = await offlineWorker.getOfflineInvoiceCount()
		} catch (error) {
			log.error('Failed to get pending invoice count', error)
		}
	}

	/**
	 * Sync pending invoices to the server
	 * @throws {Error} If called while offline
	 */
	async function syncPending() {
		if (isOffline.value) {
			throw new Error("Cannot sync while offline")
		}

		isSyncing.value = true
		try {
			const result = await syncOfflineInvoices()
			await updatePendingCount()
			return result
		} catch (error) {
			log.error('Failed to sync invoices', error)
			throw error
		} finally {
			isSyncing.value = false
		}
	}

	/**
	 * Get all pending invoices from the worker
	 */
	async function getPending() {
		return await offlineWorker.getOfflineInvoices()
	}

	/**
	 * Delete a pending invoice by ID
	 * @param {string} id - Invoice ID to delete
	 */
	async function deletePending(id) {
		await offlineWorker.deleteOfflineInvoice(id)
		await updatePendingCount()
	}

	/**
	 * Cache items and customers for offline use
	 * @param {Array} items - Items to cache
	 * @param {Array} customers - Customers to cache
	 */
	async function cacheData(items, customers) {
		try {
			if (items?.length > 0) {
				await offlineWorker.cacheItems(items)
			}
			if (customers?.length > 0) {
				await offlineWorker.cacheCustomers(customers)
			}
			return true
		} catch (error) {
			log.error('Failed to cache data', error)
			return false
		}
	}

	// =========================================================================
	// PUBLIC ACTIONS
	// =========================================================================

	/**
	 * Save an invoice offline for later sync
	 * @param {Object} invoiceData - Invoice data to save
	 */
	async function saveInvoiceOffline(invoiceData) {
		try {
			await offlineWorker.saveOfflineInvoice(invoiceData)
			await updatePendingCount()
			log.info('Invoice saved offline successfully')
			return true
		} catch (error) {
			log.error('Failed to save invoice offline', error)
			throw error
		}
	}

	/**
	 * Load the list of pending invoices for display
	 */
	async function loadPendingInvoices() {
		try {
			pendingInvoicesList.value = await getPending()
		} catch (error) {
			log.error('Failed to load pending invoices', error)
			pendingInvoicesList.value = []
		}
	}

	/**
	 * Delete an offline invoice by ID with user feedback
	 * @param {string} invoiceId - Invoice ID to delete
	 */
	async function deleteOfflineInvoice(invoiceId) {
		try {
			await deletePending(invoiceId)
			await loadPendingInvoices()
			showSuccess(__("Offline invoice deleted successfully"))
		} catch (error) {
			log.error('Failed to delete offline invoice', error)
			showError(error.message || __("Failed to delete offline invoice"))
			throw error
		}
	}

	/**
	 * Sync all pending invoices with user feedback
	 * @returns {Object} Sync result with success/failed counts
	 */
	async function syncAllPending() {
		if (isOffline.value) {
			showWarning(__("Cannot sync while offline"))
			return { success: 0, failed: 0, errors: [] }
		}

		try {
			const result = await syncPending()

			if (result.success > 0) {
				showSuccess(__('{0} invoice(s) synced successfully', [result.success]))
				await loadPendingInvoices()
			}

			return result
		} catch (error) {
			log.error('Sync all pending failed', error)
			throw error
		}
	}

	/**
	 * Preload data for offline use (payment methods, customers, items)
	 * @param {Object} currentProfile - Current POS profile
	 */
	async function preloadDataForOffline(currentProfile) {
		if (!currentProfile || isOffline.value) {
			return
		}

		try {
			const cacheReady = await checkCacheReady()
			const stats = await getCacheStats()
			const needsRefresh = !stats.lastSync || Date.now() - stats.lastSync > 24 * 60 * 60 * 1000

			// Always load payment methods for reliable offline support
			log.info('Loading payment methods for offline use')
			try {
				const paymentMethodsData = await cachePaymentMethodsFromServer(currentProfile.name)

				if (paymentMethodsData.payment_methods?.length > 0) {
					const methodsWithProfile = paymentMethodsData.payment_methods.map((method) => ({
						...method,
						pos_profile: currentProfile.name,
					}))
					await offlineWorker.cachePaymentMethods(methodsWithProfile)
					log.success(`Cached ${methodsWithProfile.length} payment methods`)
				}
			} catch (error) {
				log.error('Failed to load payment methods', error)
				// Continue with other data loading
			}

			// Load items and customers if cache needs refresh
			if (!cacheReady || needsRefresh) {
				// 1. Sync Items
				showSuccess(__("Syncing items for offline use..."))
				try {
					// cacheItemsFromServer now handles fetching and caching iteratively (Robust Sync)
					// We pass { force: true } if cache is expired (needsRefresh) to ensure we get updates
					// even if item counts happen to match.
					await cacheItemsFromServer(currentProfile.name, { force: true })
					log.success('Items sync completed successfully')
				} catch (error) {
					log.error('Items sync failed:', error)
					showWarning(__("Failed to sync some items"))
				}

				// 2. Sync Customers
				showSuccess(__("Loading customers for offline use..."))
				const customersData = await cacheCustomersFromServer(currentProfile.name)
				await cacheData([], customersData.customers || [])

				showSuccess(__("Data is ready for offline use"))
			}
		} catch (error) {
			log.error('Failed to preload offline data', error)
			showWarning(__("Some data may not be available offline"))
		}
	}

	/**
	 * Explicitly sync master data (items and customers) from server.
	 * Forces a full sync check even if cache appears fresh.
	 *
	 * @param {Object} currentProfile - Current POS profile
	 */
	async function syncMasterData(currentProfile) {
		if (!currentProfile || isOffline.value) {
			showWarning(__("Cannot sync while offline"))
			return
		}

		try {
			showSuccess(__("Syncing master data..."))
			log.info('Starting manual master data sync')

			// 1. Sync Items (Robust Sync with force=true)
			try {
				await cacheItemsFromServer(currentProfile.name, { force: true })
				log.success('Manual item sync completed')
			} catch (error) {
				log.error('Manual item sync failed:', error)
				showWarning(__("Failed to sync items"))
			}

			// 2. Sync Customers
			// Note: Customer sync logic is simpler (fetch all), so we just call it
			try {
				const customersData = await cacheCustomersFromServer(currentProfile.name)
				await cacheData([], customersData.customers || [])
				log.success('Manual customer sync completed')
			} catch (error) {
				log.error('Manual customer sync failed:', error)
				showWarning(__("Failed to sync customers"))
			}

			// 3. Payment Methods
			try {
				const paymentMethodsData = await cachePaymentMethodsFromServer(currentProfile.name)
				if (paymentMethodsData.payment_methods?.length > 0) {
					const methodsWithProfile = paymentMethodsData.payment_methods.map((method) => ({
						...method,
						pos_profile: currentProfile.name,
					}))
					await offlineWorker.cachePaymentMethods(methodsWithProfile)
				}
			} catch (error) {
				log.error('Manual payment methods sync failed:', error)
			}

			showSuccess(__("Master data synced successfully"))
		} catch (error) {
			log.error('Master data sync failed:', error)
			showError(__("Master data sync failed"))
		}
	}

	/**
	 * Check if offline cache is available and warn user if not
	 * @returns {boolean} Whether cache is ready
	 */
	async function checkOfflineCacheAvailability() {
		const cacheReady = await checkCacheReady()
		if (!cacheReady && isOffline.value) {
			showWarning(__("POS is offline without cached data. Please connect to sync."))
		}
		return cacheReady
	}

	/**
	 * Check if the offline cache is ready
	 */
	async function checkCacheReady() {
		return await offlineWorker.isCacheReady()
	}

	/**
	 * Get cache statistics
	 */
	async function getCacheStats() {
		return await offlineWorker.getCacheStats()
	}

	// =========================================================================
	// INITIALIZATION
	// =========================================================================

	// Initialize pending count on store creation
	updatePendingCount()

	// =========================================================================
	// EXPORTS
	// =========================================================================

	return {
		// State
		isOffline,
		pendingInvoicesCount,
		isSyncing,
		pendingInvoicesList,

		// Computed
		hasPendingInvoices,

		// Actions
		saveInvoiceOffline,
		loadPendingInvoices,
		deleteOfflineInvoice,
		syncAllPending,
		preloadDataForOffline,
		checkOfflineCacheAvailability,
		checkCacheReady,
		getCacheStats,
		syncMasterData,
	}
})
