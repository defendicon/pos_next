<template>
	<div class="flex flex-col h-full bg-gray-50">
		<!-- Item Groups Filter Tabs -->
		<div class="px-3 pt-3 pb-2 bg-white border-b border-gray-200">
			<div class="flex items-center space-x-2 overflow-x-auto pb-1">
				<button
					@click="itemStore.setSelectedItemGroup(null)"
					:class="[
						'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
						!selectedItemGroup
							? 'bg-blue-50 text-blue-600 border border-blue-200'
							: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
					]"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
					</svg>
					<span>All Items</span>
				</button>
				<button
					v-for="group in itemGroups"
					:key="group.item_group"
					@click="itemStore.setSelectedItemGroup(group.item_group)"
					:class="[
						'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
						selectedItemGroup === group.item_group
							? 'bg-blue-50 text-blue-600 border border-blue-200'
							: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
					]"
				>
					<span>{{ group.item_group }}</span>
				</button>
			</div>
		</div>

		<!-- Search Bar with Barcode Scanner and View Controls -->
		<div class="px-3 py-2 bg-white border-b border-gray-200">
			<div class="flex items-center space-x-2">
				<div class="flex-1 relative">
					<!-- Search Icon -->
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg
							class="h-4 w-4 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<!-- Search Input -->
					<input
						id="item-search"
						name="item-search"
						ref="searchInputRef"
						:value="searchTerm"
						@input="handleSearchInput"
						@keydown="handleKeyDown"
						type="text"
						:placeholder="scannerEnabled ? 'Scanner Ready - Scan barcode now' : 'Search by item code, name or scan barcode'"
						:class="[
							'w-full text-sm border rounded-md px-3 py-2 pl-10 pr-10 focus:outline-none transition-all',
							scannerEnabled
								? 'border-green-400 bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-transparent'
								: 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
						]"
						aria-label="Search items"
					/>
					<!-- Barcode Scan Icon -->
					<div class="absolute inset-y-0 right-0 pr-3 flex items-center">
						<button
							@click="toggleBarcodeScanner"
							:class="[
								'p-1 rounded transition-all',
								scannerEnabled
									? 'bg-green-100 hover:bg-green-200 text-green-700'
									: 'hover:bg-gray-100 text-gray-600'
							]"
							:title="scannerEnabled ? 'Barcode Scanner: ON (Click to disable)' : 'Barcode Scanner: OFF (Click to enable)'"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
							</svg>
						</button>
					</div>
				</div>
				<div class="flex items-center space-x-0.5 bg-gray-100 rounded-md p-0.5">
					<button
						@click="setViewMode('grid')"
						:class="[
							'p-1.5 rounded transition-all',
							viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
						]"
						title="Grid View"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
						</svg>
					</button>
					<button
						@click="setViewMode('list')"
						:class="[
							'p-1.5 rounded transition-all',
							viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
						]"
						title="List View"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="flex-1 flex items-center justify-center p-3">
			<div class="text-center py-8">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
				<p class="mt-3 text-xs text-gray-500">Loading items...</p>
			</div>
		</div>

		<!-- Empty State -->
		<div
			v-else-if="!filteredItems || filteredItems.length === 0"
			class="flex-1 flex items-center justify-center p-3"
		>
			<div class="text-center py-8">
				<svg
					class="mx-auto h-8 w-8 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
				<p v-if="searchTerm || selectedItemGroup" class="mt-2 text-xs font-medium text-gray-700">
					No results for <span v-if="searchTerm">"{{ searchTerm }}"</span><span v-if="searchTerm && selectedItemGroup"> in </span><span v-if="selectedItemGroup">{{ selectedItemGroup }}</span>
				</p>
				<p v-else class="mt-2 text-xs text-gray-500">No items available</p>
			</div>
		</div>

		<!-- Grid View -->
		<div v-else-if="viewMode === 'grid'" class="flex-1 flex flex-col overflow-hidden">
			<div class="flex-1 overflow-y-auto p-3">
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
					<div
						v-for="item in paginatedItems"
						:key="item.item_code"
						@click="handleItemClick(item)"
						class="relative bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
					>
						<!-- Item Image with Stock Badge -->
						<div class="relative aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
							<!-- Stock Badge -->
							<div
								:class="[
									'absolute top-1 right-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full',
									(item.actual_qty || item.stock_qty || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
								]"
							>
								{{ Math.floor(item.actual_qty || item.stock_qty || 0) }}
							</div>

							<img
								v-if="item.image"
								:src="item.image"
								:alt="item.item_name"
								loading="lazy"
								class="w-full h-full object-cover"
								@error="handleImageError"
							/>
							<svg
								v-else
								class="h-10 w-10 text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
						</div>

						<!-- Item Details -->
						<div>
							<h3 class="text-xs font-semibold text-gray-900 truncate mb-0.5 leading-tight">
								{{ item.item_name }}
							</h3>
                                                        <p class="text-[10px] text-gray-500">
                                                                {{ formatCurrency(item.rate || item.price_list_rate || 0) }}
                                                                <span class="text-gray-400">/ {{ item.uom || item.stock_uom || 'Nos' }}</span>
                                                        </p>
						</div>
					</div>
				</div>
			</div>

			<!-- Pagination Controls for Grid View -->
			<div v-if="totalPages > 1" class="px-3 py-2 bg-white border-t border-gray-200">
				<div class="flex items-center justify-between">
					<div class="text-xs text-gray-600">
						Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredItems.length) }} of {{ filteredItems.length }} items
					</div>
					<div class="flex items-center space-x-1">
						<button
							@click="previousPage"
							:disabled="currentPage === 1"
							:class="[
								'px-2 py-1 text-xs rounded border transition-all',
								currentPage === 1
									? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
							]"
						>
							Previous
						</button>
						<div class="flex items-center space-x-1">
							<button
								v-for="page in getPaginationRange()"
								:key="page"
								@click="goToPage(page)"
								:class="[
									'px-2.5 py-1 text-xs rounded border transition-all',
									currentPage === page
										? 'bg-blue-600 text-white border-blue-600'
										: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
								]"
							>
								{{ page }}
							</button>
						</div>
						<button
							@click="nextPage"
							:disabled="currentPage === totalPages"
							:class="[
								'px-2 py-1 text-xs rounded border transition-all',
								currentPage === totalPages
									? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
							]"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Table View -->
		<div v-else class="flex-1 flex flex-col overflow-hidden">
			<div class="flex-1 overflow-y-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50 sticky top-0 z-0">
						<tr>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">Image</th>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">Name</th>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">Code</th>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">Rate</th>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">Available QTY</th>
							<th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200">UOM</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						<tr
							v-for="item in paginatedItems"
							:key="item.item_code"
							@click="handleItemClick(item)"
							class="cursor-pointer hover:bg-blue-50 transition-colors"
						>
							<td class="px-3 py-2 whitespace-nowrap">
								<div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
									<img v-if="item.image" :src="item.image" :alt="item.item_name" loading="lazy" class="w-full h-full object-cover" @error="handleImageError" />
									<svg v-else class="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
							</td>
							<td class="px-3 py-2"><div class="text-sm font-medium text-gray-900">{{ item.item_name }}</div></td>
							<td class="px-3 py-2 whitespace-nowrap"><div class="text-sm text-gray-500">{{ item.item_code }}</div></td>
							<td class="px-3 py-2 whitespace-nowrap"><div class="text-sm font-semibold text-blue-600">{{ formatCurrency(item.rate || item.price_list_rate || 0) }}</div></td>
							<td class="px-3 py-2 whitespace-nowrap">
								<span :class="['text-sm font-medium', (item.actual_qty || item.stock_qty || 0) > 0 ? 'text-green-600' : 'text-red-600']">
									{{ Math.floor(item.actual_qty || item.stock_qty || 0) }}
								</span>
							</td>
                                                        <td class="px-3 py-2 whitespace-nowrap"><div class="text-sm text-gray-500">{{ item.uom || item.stock_uom || 'Nos' }}</div></td>
						</tr>
					</tbody>
				</table>
				<div v-if="paginatedItems.length === 0" class="text-center py-8 text-gray-500">No items found</div>
			</div>

			<!-- Pagination Controls for List View -->
			<div v-if="totalPages > 1" class="px-3 py-2 bg-white border-t border-gray-200">
				<div class="flex items-center justify-between">
					<div class="text-xs text-gray-600">
						Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredItems.length) }} of {{ filteredItems.length }} items
					</div>
					<div class="flex items-center space-x-1">
						<button
							@click="previousPage"
							:disabled="currentPage === 1"
							:class="[
								'px-2 py-1 text-xs rounded border transition-all',
								currentPage === 1
									? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
							]"
						>
							Previous
						</button>
						<div class="flex items-center space-x-1">
							<button
								v-for="page in getPaginationRange()"
								:key="page"
								@click="goToPage(page)"
								:class="[
									'px-2.5 py-1 text-xs rounded border transition-all',
									currentPage === page
										? 'bg-blue-600 text-white border-blue-600'
										: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
								]"
							>
								{{ page }}
							</button>
						</div>
						<button
							@click="nextPage"
							:disabled="currentPage === totalPages"
							:class="[
								'px-2 py-1 text-xs rounded border transition-all',
								currentPage === totalPages
									? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
									: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
							]"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import { toast } from "frappe-ui"
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency"
import { useItemSearchStore } from "@/stores/itemSearch"
import { storeToRefs } from "pinia"

const props = defineProps({
	posProfile: String,
	cartItems: {
		type: Array,
		default: () => [],
	},
	currency: {
		type: String,
		default: "USD",
	},
})

const emit = defineEmits(["item-selected"])

// Use Pinia store
const itemStore = useItemSearchStore()
const { filteredItems, searchTerm, selectedItemGroup, itemGroups, loading } =
	storeToRefs(itemStore)

// Local state
const viewMode = ref("grid")
const lastKeyTime = ref(0)
const barcodeBuffer = ref("")
const searchInputRef = ref(null)
const scannerEnabled = ref(false)
const itemThreshold = ref(50) // Threshold for auto-switching to list view
const userManuallySetView = ref(false) // Track if user manually changed view mode

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(20)

// Computed paginated items
const paginatedItems = computed(() => {
	if (!filteredItems.value) return []

	const start = (currentPage.value - 1) * itemsPerPage.value
	const end = start + itemsPerPage.value
	return filteredItems.value.slice(start, end)
})

const totalPages = computed(() => {
	if (!filteredItems.value) return 0
	return Math.ceil(filteredItems.value.length / itemsPerPage.value)
})

// Watch for cart items and pos profile changes
watch(
	() => props.cartItems,
	(newCartItems) => {
		itemStore.setCartItems(newCartItems)
	},
	{ immediate: true, deep: true },
)

watch(
	() => props.posProfile,
	(newProfile) => {
		if (newProfile) {
			itemStore.setPosProfile(newProfile)
		}
	},
	{ immediate: true },
)

// Reset to page 1 when filtered items change
watch(
	filteredItems,
	(newItems) => {
		if (!newItems) return

		const itemCount = newItems.length

		// Reset pagination when items change
		currentPage.value = 1

		// Only auto-switch if user hasn't manually set a preference
		// and we're in grid view with many items
		if (
			!userManuallySetView.value &&
			viewMode.value === "grid" &&
			itemCount > itemThreshold.value
		) {
			viewMode.value = "list"

			toast.create({
				title: "Switched to List View",
				text: `Displaying ${itemCount} items - automatically switched to list view for better performance`,
				icon: "list",
				iconClasses: "text-blue-600",
			})
		}
	},
	{ immediate: false },
)

onMounted(() => {
	if (props.posProfile) {
		itemStore.loadAllItems(props.posProfile)
		itemStore.loadItemGroups()
	}
})

// Handle keydown for barcode scanner detection
function handleKeyDown(event) {
	const currentTime = Date.now()
	const timeDiff = currentTime - lastKeyTime.value

	// If Enter is pressed, always trigger search
	if (event.key === "Enter") {
		event.preventDefault()
		handleBarcodeSearch()
		barcodeBuffer.value = ""
		return
	}

	// Barcode scanners typically input very fast (< 50ms between characters)
	// If time between keystrokes is very short, it's likely a barcode scanner
	if (timeDiff < 50 && event.key.length === 1) {
		barcodeBuffer.value += event.key
	} else {
		// Manual typing - reset buffer
		barcodeBuffer.value = event.key.length === 1 ? event.key : ""
	}

	lastKeyTime.value = currentTime
}

// Handle search input with instant reactivity
function handleSearchInput(event) {
	const value = event.target.value
	itemStore.setSearchTerm(value)
}

function handleItemClick(item) {
	emit("item-selected", item)
}

async function handleBarcodeSearch() {
	const barcode = searchTerm.value.trim()

	if (!barcode) {
		return
	}

	// If scanner is enabled, always try to add to cart automatically
	const shouldAutoAdd = scannerEnabled.value

	try {
		// First try exact barcode lookup via API
		const item = await itemStore.searchByBarcode(barcode)

		if (item) {
			// Item found by barcode - add to cart immediately
			emit("item-selected", item)
			itemStore.clearSearch()
			toast.create({
				title: "Item Added",
				text: `${item.item_name} added to cart`,
				icon: "check",
				iconClasses: "text-green-600",
			})
			return
		}
	} catch (error) {
		console.error("Barcode API error:", error)
	}

	// Fallback: If only one item matches in filtered results, auto-select it
	if (filteredItems.value.length === 1) {
		emit("item-selected", filteredItems.value[0])
		itemStore.clearSearch()
		toast.create({
			title: "Item Added",
			text: `${filteredItems.value[0].item_name} added to cart`,
			icon: "check",
			iconClasses: "text-green-600",
		})
	} else if (filteredItems.value.length === 0) {
		toast.create({
			title: "Item Not Found",
			text: `No item found with barcode: ${barcode}`,
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})

		// If scanner mode is enabled, clear search immediately for next scan
		if (shouldAutoAdd) {
			itemStore.clearSearch()
		}
	} else {
		if (shouldAutoAdd) {
			// In scanner mode, don't show manual selection - just notify
			toast.create({
				title: "Multiple Items Found",
				text: `${filteredItems.value.length} items match barcode. Please refine search.`,
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		} else {
			toast.create({
				title: "Multiple Items Found",
				text: `${filteredItems.value.length} items match. Please select one.`,
				icon: "alert-circle",
				iconClasses: "text-blue-600",
			})
		}
	}
}

function toggleBarcodeScanner() {
	scannerEnabled.value = !scannerEnabled.value

	// Focus on search input when enabling scanner
	if (scannerEnabled.value) {
		const input = searchInputRef.value || document.getElementById("item-search")
		if (input) {
			input.focus()
		}

		toast.create({
			title: "Barcode Scanner Enabled",
			text: "Scan barcode to automatically add items to cart",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} else {
		toast.create({
			title: "Barcode Scanner Disabled",
			text: "Scanner mode turned off",
			icon: "alert-circle",
			iconClasses: "text-gray-600",
		})
	}
}

function formatCurrency(amount) {
	return formatCurrencyUtil(parseFloat(amount || 0), props.currency)
}

// Expose methods for parent component
defineExpose({
	loadItems: () => itemStore.loadAllItems(props.posProfile),
	loadItemGroups: () => itemStore.loadItemGroups(),
})

function handleImageError(event) {
	event.target.style.display = "none"
}

// View mode functions
function setViewMode(mode) {
	viewMode.value = mode
	userManuallySetView.value = true
}

// Pagination functions
function goToPage(page) {
	if (page >= 1 && page <= totalPages.value) {
		currentPage.value = page
	}
}

function nextPage() {
	if (currentPage.value < totalPages.value) {
		currentPage.value++
	}
}

function previousPage() {
	if (currentPage.value > 1) {
		currentPage.value--
	}
}

function getPaginationRange() {
	const range = []
	const total = totalPages.value
	const current = currentPage.value
	const delta = 2 // Number of pages to show on each side of current page

	if (total <= 7) {
		// Show all pages if total is small
		for (let i = 1; i <= total; i++) {
			range.push(i)
		}
	} else {
		// Show smart range with ellipsis
		if (current <= 3) {
			for (let i = 1; i <= 5; i++) {
				range.push(i)
			}
		} else if (current >= total - 2) {
			for (let i = total - 4; i <= total; i++) {
				range.push(i)
			}
		} else {
			for (let i = current - delta; i <= current + delta; i++) {
				range.push(i)
			}
		}
	}

	return range
}
</script>
