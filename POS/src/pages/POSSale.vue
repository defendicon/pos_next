<template>
	<div class="h-screen flex flex-col bg-gray-50">
		<!-- Loading State -->
		<div
			v-if="isLoading"
			class="flex-1 flex items-center justify-center bg-gray-50"
		>
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"
				></div>
				<p class="mt-4 text-sm text-gray-500">Loading...</p>
			</div>
		</div>

		<!-- Main App -->
		<template v-else>
			<!-- Header -->
		<div class="bg-white border-b border-gray-200 shadow-sm">
			<div class="px-6 py-3">
				<div class="flex justify-between items-center">
					<!-- Left Side: Logo/Brand -->
					<div class="flex items-center space-x-4">
						<div class="flex items-center space-x-3">
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
								<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
								</svg>
							</div>
							<div>
								<h1 class="text-base font-bold text-gray-900">POS Next</h1>
								<p v-if="currentProfile" class="text-xs text-gray-500">{{ currentProfile.name }}</p>
							</div>
						</div>

						<!-- Time and Shift Duration -->
						<div class="flex items-center space-x-4 ml-6">
							<!-- Current Time -->
							<div class="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
								<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
								</svg>
								<span class="text-sm font-semibold text-gray-900">{{ currentTime }}</span>
							</div>

							<!-- Shift Duration -->
							<div v-if="hasOpenShift && currentShift" class="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
								<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
								</svg>
								<div class="text-xs">
									<span class="text-gray-600">Shift Open:</span>
									<span class="font-semibold text-gray-900 ml-1">{{ shiftDuration }}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Right Side: Controls -->
					<div class="flex items-center space-x-1">
						<!-- WiFi/Offline Status -->
						<button
							@click="handleSyncClick"
							:class="[
								'p-2 hover:bg-gray-50 rounded-lg transition-colors relative group',
								isSyncing ? 'animate-pulse' : ''
							]"
							:title="isOffline ? `Offline (${pendingInvoicesCount} pending)` : 'Online - Click to sync'"
						>
							<svg
								v-if="!isOffline"
								class="w-5 h-5 text-green-600"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
							</svg>
							<svg
								v-else
								class="w-5 h-5 text-orange-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/>
							</svg>
							<span
								v-if="pendingInvoicesCount > 0"
								class="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
							>
								{{ pendingInvoicesCount }}
							</span>
						</button>

						<!-- Printer -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Print">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
							</svg>
						</button>

						<!-- Refresh -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Refresh">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
							</svg>
						</button>

						<!-- Scanner -->
						<button class="p-2 hover:bg-gray-50 rounded-lg transition-colors group" title="Scan Barcode">
							<svg class="w-5 h-5 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
							</svg>
						</button>

						<div class="w-px h-6 bg-gray-200 mx-2"></div>

						<!-- Actions Dropdown -->
						<div class="relative">
							<button
								@click="showActionsMenu = !showActionsMenu"
								class="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
							>
								<svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
								</svg>
								<span class="text-sm font-medium text-gray-700">Actions</span>
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
								</svg>
							</button>

							<!-- Dropdown Menu -->
							<div
								v-if="showActionsMenu"
								@click.stop
								class="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50"
							>
								<button
									v-if="hasOpenShift"
									@click="showOpenShiftDialog = true; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span>View Shift</span>
								</button>
								<button
									@click="showDraftDialog = true; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 flex items-center space-x-3 transition-colors relative"
								>
									<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
									</svg>
									<span>Draft Invoices</span>
									<span v-if="draftsCount > 0" class="ml-auto text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">
										{{ draftsCount }}
									</span>
								</button>
								<button
									@click="showHistoryDialog = true; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
									</svg>
									<span>Invoice History</span>
								</button>
								<button
									@click="showReturnDialog = true; showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
									</svg>
									<span>Return Invoice</span>
								</button>
								<hr class="my-2 border-gray-100">
								<button
									@click="handleCloseShift(); showActionsMenu = false"
									class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span>Close Shift</span>
								</button>
								<hr class="my-2 border-gray-100">
								<button
									@click="handleLogout"
									class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-colors"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
									</svg>
									<span>Logout</span>
								</button>
							</div>
						</div>

						<div class="w-px h-6 bg-gray-200 mx-2"></div>

						<!-- User Profile -->
						<div class="flex items-center space-x-3 px-2">
							<div class="text-right">
								<p class="text-sm font-semibold text-gray-900">{{ getCurrentUser() }}</p>
							</div>
							<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
								<span class="text-sm font-bold text-white">{{ getUserInitials() }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Content: Two Column Layout -->
		<div
			v-if="hasOpenShift"
			ref="containerRef"
			class="flex-1 flex overflow-hidden relative"
		>
			<!-- Left: Items Selector -->
			<div
				:style="{ width: leftPanelWidth + 'px' }"
				class="flex flex-col bg-white overflow-hidden flex-shrink-0"
				style="will-change: width; contain: layout;"
			>
				<ItemsSelector
					ref="itemsSelectorRef"
					:pos-profile="currentProfile?.name"
					:cart-items="invoiceItems"
					:currency="currentProfile?.currency || 'USD'"
					@item-selected="handleItemSelected"
				/>
			</div>

			<!-- Draggable Divider -->
			<div
				ref="dividerRef"
				role="separator"
				aria-orientation="vertical"
				@pointerdown="startResize"
				@pointermove="handleResize"
				@pointerup="stopResize"
				@pointercancel="stopResize"
				class="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize relative flex-shrink-0 transition-all duration-100"
				:class="{
					'bg-blue-500': isResizing,
					'pointer-events-none opacity-0': isAnyDialogOpen,
					'z-[1]': !isAnyDialogOpen
				}"
			>
				<!-- Expanded hit area for easier grabbing -->
				<div
					class="absolute inset-y-0 -left-2 -right-2"
					style="cursor: col-resize;"
				></div>
				<!-- Visual handle -->
				<div
					class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-gray-400 rounded-full"
					:class="{ 'bg-blue-600': isResizing, 'bg-blue-500': !isResizing }"
					style="transition: background-color 0.1s ease; opacity: 0.8;"
				></div>
			</div>

			<!-- Right: Invoice Cart -->
			<div
				class="flex-1 flex flex-col bg-gray-50 overflow-hidden"
				style="min-width: 300px; contain: layout;"
			>
				<InvoiceCart
					:items="invoiceItems"
					:customer="customer"
					:subtotal="subtotal"
					:tax-amount="totalTax"
					:discount-amount="totalDiscount"
					:grand-total="grandTotal"
					:pos-profile="currentProfile?.name"
					:currency="currentProfile?.currency || 'USD'"
					:applied-offer="autoAppliedOffer"
					@update-quantity="updateItemQuantity"
					@remove-item="removeItem"
					@select-customer="handleCustomerSelected"
					@create-customer="handleCreateCustomer"
					@proceed-to-payment="handleProceedToPayment"
					@clear-cart="handleClearCart"
					@save-draft="handleSaveDraft"
					@apply-coupon="showCouponDialog = true"
					@show-offers="showOffersDialog = true"
					@remove-offer="handleOfferRemoved"
				/>
			</div>
		</div>

		<!-- No Shift Placeholder -->
		<div v-else class="flex-1 flex items-center justify-center bg-gray-50">
			<div class="text-center">
				<div
					class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-blue-100"
				>
					<svg
						class="h-12 w-12 text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-medium text-gray-900">
					Welcome to POS Next
				</h3>
				<p class="mt-2 text-sm text-gray-500">
					Please open a shift to start making sales
				</p>
				<Button
					variant="solid"
					theme="blue"
					@click="showOpenShiftDialog = true"
					class="mt-6"
				>
					Open Shift
				</Button>
			</div>
		</div>

		<!-- Payment Dialog -->
		<PaymentDialog
			v-model="showPaymentDialog"
			:grand-total="grandTotal"
			:pos-profile="currentProfile?.name"
			:currency="currentProfile?.currency || 'USD'"
			@payment-completed="handlePaymentCompleted"
		/>

		<!-- Customer Selection Dialog -->
		<CustomerDialog
			v-model="showCustomerDialog"
			:pos-profile="currentProfile?.name"
			@customer-selected="handleCustomerSelected"
		/>

		<!-- Shift Opening Dialog -->
		<ShiftOpeningDialog
			v-model="showOpenShiftDialog"
			@shift-opened="handleShiftOpened"
		/>

		<!-- Shift Closing Dialog -->
		<ShiftClosingDialog
			v-model="showCloseShiftDialog"
			:opening-shift="currentShift?.name"
			@shift-closed="handleShiftClosed"
		/>

		<!-- Draft Invoices Dialog -->
		<DraftInvoicesDialog
			v-model="showDraftDialog"
			:currency="currentProfile?.currency || 'USD'"
			@load-draft="handleLoadDraft"
			@drafts-updated="updateDraftsCount"
		/>

		<!-- Return Invoice Dialog -->
		<ReturnInvoiceDialog
			v-model="showReturnDialog"
			:pos-profile="currentProfile?.name"
			@return-created="handleReturnCreated"
		/>

		<!-- Coupon Dialog -->
		<CouponDialog
			v-model="showCouponDialog"
			:subtotal="subtotal"
			:items="invoiceItems"
			:pos-profile="currentProfile?.name"
			:customer="customer?.name || customer"
			:company="currentProfile?.company"
			:currency="currentProfile?.currency || 'USD'"
			:applied-coupon="appliedCoupon"
			@discount-applied="handleDiscountApplied"
			@discount-removed="handleDiscountRemoved"
		/>

		<!-- Offers Dialog -->
		<OffersDialog
			v-model="showOffersDialog"
			:subtotal="subtotal"
			:items="invoiceItems"
			:pos-profile="currentProfile?.name"
			:customer="customer?.name || customer"
			:company="currentProfile?.company"
			:currency="currentProfile?.currency || 'USD'"
			:applied-offer="autoAppliedOffer"
			@offer-applied="handleOfferApplied"
			@offer-removed="handleOfferRemoved"
		/>

		<!-- Batch/Serial Dialog -->
		<BatchSerialDialog
			v-model="showBatchSerialDialog"
			:item="pendingItem"
			:quantity="pendingItemQty"
			:warehouse="currentProfile?.warehouse"
			@batch-serial-selected="handleBatchSerialSelected"
		/>

		<!-- Invoice History Dialog -->
		<InvoiceHistoryDialog
			v-model="showHistoryDialog"
			:pos-profile="currentProfile?.name"
			@create-return="handleCreateReturnFromHistory"
		/>

		<!-- Create Customer Dialog -->
		<CreateCustomerDialog
			v-model="showCreateCustomerDialog"
			:pos-profile="currentProfile?.name"
			:initial-name="initialCustomerName"
			@customer-created="handleCustomerCreated"
		/>

		<!-- Clear Cart Confirmation Dialog -->
		<Dialog
			v-model="showClearCartDialog"
			:options="{ title: 'Clear Cart?', size: 'xs' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-600">
						Remove all {{ invoiceItems.length }} items from cart?
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2 w-full">
					<Button class="flex-1" variant="subtle" @click="showClearCartDialog = false">
						Cancel
					</Button>
					<Button class="flex-1" variant="solid" theme="red" @click="confirmClearCart">
						Clear All
					</Button>
				</div>
			</template>
		</Dialog>

		<!-- Logout Confirmation Dialog -->
		<Dialog
			v-model="showLogoutDialog"
			:options="{ title: 'Logout', size: 'xs' }"
		>
			<template #body-content>
				<div class="py-3">
					<p class="text-sm text-gray-600">
						Are you sure you want to logout?
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2 w-full">
					<Button class="flex-1" variant="subtle" @click="showLogoutDialog = false">
						Cancel
					</Button>
					<Button class="flex-1" variant="solid" theme="red" @click="confirmLogout">
						Logout
					</Button>
				</div>
			</template>
		</Dialog>

		<!-- Success Dialog -->
		<Dialog
			v-model="showSuccessDialog"
			:options="{ title: 'Invoice Created Successfully', size: 'md' }"
		>
			<template #body-content>
				<div class="text-center py-6">
					<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-medium text-gray-900">
						Invoice {{ lastInvoiceName }} created successfully!
					</h3>
					<p class="mt-2 text-sm text-gray-500">
						Total: {{ formatCurrency(lastInvoiceTotal) }}
					</p>
				</div>
			</template>
			<template #actions>
				<div class="flex space-x-2">
					<Button variant="subtle" @click="showSuccessDialog = false">
						Close
					</Button>
					<Button variant="solid" theme="blue" @click="handlePrintInvoice">
						Print Invoice
					</Button>
				</div>
			</template>
		</Dialog>
		</template>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue"
import { useRouter } from "vue-router"
import { useInvoice } from "@/composables/useInvoice"
import { useShift } from "@/composables/useShift"
import { useOffline } from "@/composables/useOffline"
import { useDialog, useDialogState } from "@/composables/useDialogState"
import { Button, Dialog, toast } from "frappe-ui"
import { session } from "@/data/session"
import ItemsSelector from "@/components/sale/ItemsSelector.vue"
import InvoiceCart from "@/components/sale/InvoiceCart.vue"
import PaymentDialog from "@/components/sale/PaymentDialog.vue"
import CustomerDialog from "@/components/sale/CustomerDialog.vue"
import ShiftOpeningDialog from "@/components/ShiftOpeningDialog.vue"
import ShiftClosingDialog from "@/components/ShiftClosingDialog.vue"
import DraftInvoicesDialog from "@/components/sale/DraftInvoicesDialog.vue"
import ReturnInvoiceDialog from "@/components/sale/ReturnInvoiceDialog.vue"
import CouponDialog from "@/components/sale/CouponDialog.vue"
import OffersDialog from "@/components/sale/OffersDialog.vue"
import BatchSerialDialog from "@/components/sale/BatchSerialDialog.vue"
import InvoiceHistoryDialog from "@/components/sale/InvoiceHistoryDialog.vue"
import CreateCustomerDialog from "@/components/sale/CreateCustomerDialog.vue"
import { printInvoiceByName } from "@/utils/printInvoice"
import { saveDraft, getDraftsCount, deleteDraft } from "@/utils/draftManager"
import { offlineWorker } from "@/utils/offline/workerClient"
import { cacheItemsFromServer, cacheCustomersFromServer } from "@/utils/offline"

const LEFT_PANEL_MIN = 320
const RIGHT_PANEL_MIN = 360

const router = useRouter()
const { currentProfile, currentShift, hasOpenShift, checkOpeningShift } = useShift()

const {
	isOffline,
	pendingInvoicesCount,
	isSyncing,
	saveInvoiceOffline,
	syncPending,
	cacheData,
	searchItems: searchCachedItems,
	getCacheStats,
} = useOffline()

const {
	invoiceItems,
	customer,
	subtotal,
	totalTax,
	totalDiscount,
	grandTotal,
	posProfile,
	payments,
	addItem,
	removeItem,
	updateItemQuantity,
	submitInvoice,
	clearCart,
	loadTaxRules,
	calculateDiscountAmount,
	applyDiscount,
	removeDiscount,
	applyOffersResource,
} = useInvoice()

// Use dialog composable for automatic global tracking
const { isOpen: showPaymentDialog } = useDialog('payment')
const { isOpen: showCustomerDialog } = useDialog('customer')
const { isOpen: showSuccessDialog } = useDialog('success')
const { isOpen: showOpenShiftDialog } = useDialog('openShift')
const { isOpen: showCloseShiftDialog } = useDialog('closeShift')
const { isOpen: showDraftDialog } = useDialog('draft')
const { isOpen: showReturnDialog } = useDialog('return')
const { isOpen: showCouponDialog } = useDialog('coupon')
const { isOpen: showOffersDialog } = useDialog('offers')
const { isOpen: showBatchSerialDialog } = useDialog('batchSerial')
const { isOpen: showHistoryDialog } = useDialog('history')
const { isOpen: showCreateCustomerDialog } = useDialog('createCustomer')
const { isOpen: showClearCartDialog } = useDialog('clearCart')
const { isOpen: showLogoutDialog } = useDialog('logout')

// Other refs
const itemsSelectorRef = ref(null)
const showActionsMenu = ref(false)
const initialCustomerName = ref("")
const pendingItem = ref(null)
const pendingItemQty = ref(1)
const lastInvoiceName = ref("")
const lastInvoiceTotal = ref(0)
const isLoading = ref(true)
const currentTime = ref("")
const shiftDuration = ref("")
const draftsCount = ref(0)
const containerRef = ref(null)
const dividerRef = ref(null)
const leftPanelWidth = ref(800) // Start with 800px width
const isResizing = ref(false)
const autoAppliedOffer = ref(null)
const appliedCoupon = ref(null)
const pendingPaymentAfterCustomer = ref(false)

// Get global dialog state for divider behavior
const { isAnyDialogOpen } = useDialogState()

// Update shift duration every second
function updateShiftDuration() {
	if (!hasOpenShift.value || !currentShift.value?.period_start_date) {
		shiftDuration.value = ""
		return
	}

	const startTime = new Date(currentShift.value.period_start_date)
	const now = new Date()
	const diff = now - startTime

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
	const seconds = Math.floor((diff % (1000 * 60)) / 1000)

	shiftDuration.value = `${hours}h ${minutes}m ${seconds}s`
}

onMounted(async () => {
	window.addEventListener('resize', updateLayoutBounds)
	try {
		// Update time and shift duration every second
		setInterval(() => {
			const now = new Date()
			currentTime.value = now.toLocaleTimeString('en-US', { hour12: false })
			updateShiftDuration()
		}, 1000)

		// Initial update
		const now = new Date()
		currentTime.value = now.toLocaleTimeString('en-US', { hour12: false })
		updateShiftDuration()

		// Check for existing open shift
		await checkOpeningShift.fetch()

		// If no shift is open, show the shift opening dialog
		if (!hasOpenShift.value) {
			showOpenShiftDialog.value = true
		} else {
			// Set POS profile from current shift
			if (currentProfile.value) {
				posProfile.value = currentProfile.value.name

				// Load tax rules for this POS Profile
				await loadTaxRules(currentProfile.value.name)

				// Pre-load data for offline use if online and needed
				if (!isOffline.value) {
					// Check cache status via worker
					const cacheReady = await offlineWorker.isCacheReady()
					const stats = await offlineWorker.getCacheStats()
					const needsRefresh = !stats.lastSync || (Date.now() - stats.lastSync) > (24 * 60 * 60 * 1000)

					if (!cacheReady || needsRefresh) {
						toast.create({
							title: "Syncing Data",
							text: "Loading items and customers for offline use...",
							icon: "download",
							iconClasses: "text-blue-600",
						})

						try {
							// Fetch from server (main thread - uses window.frappe.call)
							const [itemsData, customersData] = await Promise.all([
								cacheItemsFromServer(currentProfile.value.name),
								cacheCustomersFromServer(currentProfile.value.name)
							])

							// Cache via worker (background thread)
							await Promise.all([
								offlineWorker.cacheItems(itemsData.items || []),
								offlineWorker.cacheCustomers(customersData.customers || [])
							])

							toast.create({
								title: "Sync Complete",
								text: "Data is ready for offline use",
								icon: "check",
								iconClasses: "text-green-600",
							})
						} catch (error) {
							console.error('Error pre-loading data:', error)
							toast.create({
								title: "Sync Warning",
								text: "Some data may not be available offline",
								icon: "alert-circle",
								iconClasses: "text-orange-600",
							})
						}
					}
				} else {
					// Check if cache is available when offline
					const cacheReady = await offlineWorker.isCacheReady()
					if (!cacheReady) {
						// Show warning if offline and no cache
						toast.create({
							title: "Limited Functionality",
							text: "POS is offline without cached data. Please connect to sync.",
							icon: "alert-circle",
							iconClasses: "text-orange-600",
						})
					}
				}
			}
		}

		// Add click outside listener
		document.addEventListener('click', handleClickOutside)

		requestAnimationFrame(updateLayoutBounds)

		// Update drafts count
		await updateDraftsCount()
	} catch (error) {
		console.error("Error checking shift:", error)
	} finally {
		isLoading.value = false
	}
})

watch(hasOpenShift, value => {
	if (value && typeof window !== 'undefined') {
		requestAnimationFrame(updateLayoutBounds)
	}
})

// Watch cart changes to auto-apply eligible offers with debouncing
let autoApplyTimeout = null
watch([invoiceItems, subtotal], async (newVal, oldVal) => {
	// Clear any pending auto-apply
	if (autoApplyTimeout) {
		clearTimeout(autoApplyTimeout)
	}

	// Only auto-apply if:
	// 1. Cart is not empty
	// 2. POS profile is set
	// 3. No offer is currently applied (to avoid overwriting manual selections)
	if (invoiceItems.value.length > 0 && posProfile.value && !autoAppliedOffer.value) {
		// Debounce for 500ms to avoid excessive API calls
		autoApplyTimeout = setTimeout(async () => {
			await autoApplyOffers()
		}, 500)
	} else if (invoiceItems.value.length === 0) {
		// Clear auto-applied offers when cart is emptied
		autoAppliedOffer.value = null
	}
}, { deep: true })

// Watch for items changes and re-apply offer if one is already applied
watch(invoiceItems, () => {
	if (autoAppliedOffer.value && invoiceItems.value.length > 0) {
		// Re-apply the current offer to new items
		applyDiscount(autoAppliedOffer.value)
	}
}, { deep: true })

onUnmounted(() => {
	// Clean up timeout
	if (autoApplyTimeout) {
		clearTimeout(autoApplyTimeout)
	}

	// Clean up event listeners
	document.removeEventListener('click', handleClickOutside)
	window.removeEventListener('resize', updateLayoutBounds)
	stopResize()
})

async function handleShiftOpened() {
	showOpenShiftDialog.value = false
	// Set POS profile after shift is opened
	if (currentProfile.value) {
		posProfile.value = currentProfile.value.name
		// Load tax rules for this POS Profile
		await loadTaxRules(currentProfile.value.name)
	}
	// Update shift duration immediately
	updateShiftDuration()
	toast.create({
		title: "Shift Opened",
		text: "You can now start making sales",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleShiftClosed() {
	showCloseShiftDialog.value = false
	toast.create({
		title: "Shift Closed",
		text: "Shift closed successfully",
		icon: "check",
		iconClasses: "text-green-600",
	})
	// Show shift opening dialog again
	setTimeout(() => {
		showOpenShiftDialog.value = true
	}, 500)
}

function handleItemSelected(item) {
	// Check if item requires batch/serial selection
	if (item.has_batch_no || item.has_serial_no) {
		pendingItem.value = item
		pendingItemQty.value = 1
		showBatchSerialDialog.value = true
	} else {
		addItem(item)
		toast.create({
			title: "Item Added",
			text: `${item.item_name} added to cart`,
			icon: "check",
			iconClasses: "text-green-600",
		})
	}
}

function handleCustomerSelected(selectedCustomer) {
	if (selectedCustomer) {
		customer.value = selectedCustomer
		showCustomerDialog.value = false
		toast.create({
			title: "Customer Selected",
			text: `${selectedCustomer.customer_name} selected`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		// If there was a pending payment, continue to payment dialog
		if (pendingPaymentAfterCustomer.value) {
			pendingPaymentAfterCustomer.value = false
			showPaymentDialog.value = true
		}
	} else {
		// Clear customer
		customer.value = null
	}
}

function handleCreateCustomer(searchValue) {
	initialCustomerName.value = searchValue || ""
	showCreateCustomerDialog.value = true
}

function handleProceedToPayment() {
	if (invoiceItems.value.length === 0) {
		toast.create({
			title: "Empty Cart",
			text: "Please add items to cart before proceeding to payment",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	// Check if customer is selected
	const customerValue = customer.value?.name || customer.value
	if (!customerValue && !currentProfile.value?.customer) {
		toast.create({
			title: "Customer Required",
			text: "Please select a customer before proceeding",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		showCustomerDialog.value = true
		// Set flag to continue to payment after customer selection
		pendingPaymentAfterCustomer.value = true
		return
	}

	showPaymentDialog.value = true
}

async function handlePaymentCompleted(paymentData) {
	try {
		// Validate customer
		const customerValue = customer.value?.name || customer.value
		if (!customerValue && !currentProfile.value?.customer) {
			toast.create({
				title: "Customer Required",
				text: "Please select a customer before proceeding",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
			showPaymentDialog.value = false
			showCustomerDialog.value = true
			return
		}

		payments.value = []
		if (paymentData.payments && Array.isArray(paymentData.payments)) {
			paymentData.payments.forEach(p => {
				payments.value.push({
					mode_of_payment: p.mode_of_payment,
					amount: p.amount,
					type: p.type
				})
			})
		}

		if (isOffline.value) {
			await saveInvoiceOffline({
				pos_profile: posProfile.value,
				customer: customerValue || currentProfile.value?.customer,
				items: invoiceItems.value,
				payments: payments.value,
			})

			lastInvoiceName.value = `OFFLINE-${Date.now()}`
			lastInvoiceTotal.value = grandTotal.value
			showPaymentDialog.value = false

			clearCart()
			customer.value = null
			showSuccessDialog.value = true

			toast.create({
				title: "Saved Offline",
				text: "Invoice saved and will sync when online",
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		} else {
			const result = await submitInvoice()

			if (result) {
				lastInvoiceName.value = result.name || result.message?.name || "Unknown"
				lastInvoiceTotal.value = result.grand_total || result.total || 0
				showPaymentDialog.value = false
				clearCart()
				customer.value = null
				autoAppliedOffer.value = null

				if (itemsSelectorRef.value) {
					itemsSelectorRef.value.loadItems()
				}

				// Check if auto-print is enabled
				const autoPrint = currentProfile.value?.print_receipt_on_order_complete
				if (autoPrint) {
					try {
						await printInvoiceByName(lastInvoiceName.value)
						toast.create({
							title: "Success",
							text: `Invoice ${lastInvoiceName.value} created and sent to printer`,
							icon: "check",
							iconClasses: "text-green-600",
						})
					} catch (error) {
						console.error("Auto-print error:", error)
						toast.create({
							title: "Invoice Created",
							text: `Invoice ${lastInvoiceName.value} created but print failed`,
							icon: "alert-circle",
							iconClasses: "text-orange-600",
						})
					}
				} else {
					showSuccessDialog.value = true
					toast.create({
						title: "Success",
						text: `Invoice ${lastInvoiceName.value} created successfully`,
						icon: "check",
						iconClasses: "text-green-600",
					})
				}
			}
		}
	} catch (error) {
		console.error("Error submitting invoice:", error)
		showPaymentDialog.value = false

		const errorMessage = error.messages ? error.messages[0] : (error.message || "Failed to create invoice")

		toast.create({
			title: "Error Creating Invoice",
			text: errorMessage,
			icon: "alert-circle",
			iconClasses: "text-red-600",
			timeout: 5000,
		})
	}
}

function handleClearCart() {
	if (invoiceItems.value.length === 0) return
	showClearCartDialog.value = true
}

function confirmClearCart() {
	clearCart()
	customer.value = null
	autoAppliedOffer.value = null
	showClearCartDialog.value = false
	toast.create({
		title: "Cart Cleared",
		text: "All items removed from cart",
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleCloseShift() {
	showCloseShiftDialog.value = true
}

async function handlePrintInvoice() {
	try {
		await printInvoiceByName(lastInvoiceName.value)
		showSuccessDialog.value = false
	} catch (error) {
		console.error("Error printing invoice:", error)
		toast.create({
			title: "Print Error",
			text: "Failed to print invoice. Please try again.",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}

function getCurrentUser() {
	if (typeof window !== 'undefined' && window.frappe?.session) {
		return window.frappe.session.user_fullname || window.frappe.session.user || "User"
	}
	return "User"
}

function getUserInitials() {
	const name = getCurrentUser()
	const parts = name.split(" ")
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase()
	}
	return name.substring(0, 2).toUpperCase()
}

function handleLogout() {
	showActionsMenu.value = false
	showLogoutDialog.value = true
}

function confirmLogout() {
	showLogoutDialog.value = false
	session.logout.submit()
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
	if (showActionsMenu.value && !event.target.closest('.relative')) {
		showActionsMenu.value = false
	}
}

async function handleSaveDraft() {
	if (invoiceItems.value.length === 0) {
		toast.create({
			title: "Empty Cart",
			text: "Cannot save an empty cart as draft",
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	try {
		const draftData = {
			pos_profile: posProfile.value,
			customer: customer.value,
			items: invoiceItems.value,
		}

		await saveDraft(draftData)

		// Clear cart after saving
		clearCart()
		customer.value = null

		// Update drafts count
		await updateDraftsCount()

		toast.create({
			title: "Draft Saved",
			text: "Invoice saved as draft successfully",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error("Error saving draft:", error)
		toast.create({
			title: "Error",
			text: "Failed to save draft",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function handleLoadDraft(draft) {
	try {
		// Load items into cart
		invoiceItems.value = draft.items || []

		// Load customer
		customer.value = draft.customer

		// Delete the draft after loading (to prevent duplicates)
		await deleteDraft(draft.draft_id)

		// Update drafts count
		await updateDraftsCount()

		// Close dialog
		showDraftDialog.value = false

		toast.create({
			title: "Draft Loaded",
			text: "Draft invoice loaded successfully",
			icon: "check",
			iconClasses: "text-green-600",
		})
	} catch (error) {
		console.error("Error loading draft:", error)
		toast.create({
			title: "Error",
			text: "Failed to load draft",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

async function updateDraftsCount() {
	try {
		draftsCount.value = await getDraftsCount()
	} catch (error) {
		console.error("Error getting drafts count:", error)
	}
}

function handleReturnCreated(returnInvoice) {
	toast.create({
		title: "Return Created",
		text: `Return invoice ${returnInvoice.name} created successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleDiscountApplied(discount) {
	// Use the composable's applyDiscount function
	applyDiscount(discount)
	appliedCoupon.value = discount
	showCouponDialog.value = false

	toast.create({
		title: "Coupon Applied",
		text: `${discount.name} applied successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleDiscountRemoved() {
	// Use the composable's removeDiscount function
	removeDiscount()
	autoAppliedOffer.value = null
	appliedCoupon.value = null

	toast.create({
		title: "Discount Removed",
		text: "Discount has been removed from cart",
		icon: "check",
		iconClasses: "text-blue-600",
	})
}

function handleOfferApplied(offer) {
	// Use the composable's applyDiscount function
	applyDiscount(offer)
	autoAppliedOffer.value = offer
	showOffersDialog.value = false

	toast.create({
		title: "Offer Applied",
		text: `${offer.name} applied successfully`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

function handleOfferRemoved() {
	// Use the composable's removeDiscount function
	removeDiscount()
	autoAppliedOffer.value = null

	toast.create({
		title: "Offer Removed",
		text: "Offer has been removed from cart",
		icon: "check",
		iconClasses: "text-blue-600",
	})
}

async function autoApplyOffers() {
	// Automatically apply eligible offers from the backend
	try {
		// Clear auto-applied flag if cart is empty
		if (invoiceItems.value.length === 0) {
			autoAppliedOffer.value = null
			return
		}

		const invoiceData = {
			doctype: "Sales Invoice",
			pos_profile: posProfile.value,
			customer: customer.value?.name || customer.value || currentProfile.value?.customer,
			items: invoiceItems.value.map(item => ({
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.quantity,
				rate: item.rate,
				uom: item.uom,
				warehouse: item.warehouse,
				conversion_factor: item.conversion_factor || 1,
			})),
		}

		const result = await applyOffersResource.submit({ invoice_data: invoiceData })

                if (result && result.items) {
                        const previouslyApplied = !!autoAppliedOffer.value
                        let hasDiscounts = false
                        const serverItemsMap = new Map()

                        result.items.forEach(serverItem => {
                                if (serverItem?.item_code) {
                                        serverItemsMap.set(serverItem.item_code, serverItem)
                                }
                        })

                        invoiceItems.value.forEach(cartItem => {
                                const serverItem = serverItemsMap.get(cartItem.item_code)
                                const discountPercentage = parseFloat(serverItem?.discount_percentage) || 0
                                const discountAmount = parseFloat(serverItem?.discount_amount) || 0

                                cartItem.discount_percentage = discountPercentage
                                cartItem.discount_amount = discountAmount

                                if (discountPercentage > 0 || discountAmount > 0) {
                                        hasDiscounts = true
                                }

                                updateItemQuantity(cartItem.item_code, cartItem.quantity)
                        })

                        if (hasDiscounts) {
                                autoAppliedOffer.value = { name: "Auto Offer", applied: true }

                                if (!previouslyApplied) {
                                        toast.create({
                                                title: "Offers Applied",
                                                text: "Eligible offers have been applied to your cart",
                                                icon: "check",
                                                iconClasses: "text-green-600",
                                        })
                                }
                        } else {
                                autoAppliedOffer.value = null

                                if (previouslyApplied) {
                                        toast.create({
                                                title: "Offers Removed",
                                                text: "Offers no longer apply to the current cart items",
                                                icon: "info",
                                                iconClasses: "text-blue-600",
                                        })
                                }
                        }
                }
	} catch (error) {
		// Silently fail - don't interrupt the user experience
		console.error("Error auto-applying offers:", error)
	}
}

function handleBatchSerialSelected(batchSerial) {
	if (pendingItem.value) {
		// Add item with batch/serial info
		const itemToAdd = {
			...pendingItem.value,
			quantity: pendingItemQty.value,
			...batchSerial
		}
		addItem(itemToAdd)

		toast.create({
			title: "Item Added",
			text: `${pendingItem.value.item_name} added to cart`,
			icon: "check",
			iconClasses: "text-green-600",
		})

		pendingItem.value = null
		pendingItemQty.value = 1
	}
}

function handleCreateReturnFromHistory(invoice) {
	// Open return dialog with pre-filled invoice
	showReturnDialog.value = true
	toast.create({
		title: "Create Return",
		text: `Creating return for invoice ${invoice.name}`,
		icon: "alert-circle",
		iconClasses: "text-orange-600",
	})
}

function handleCustomerCreated(newCustomer) {
	customer.value = newCustomer
	showCreateCustomerDialog.value = false
	toast.create({
		title: "Customer Created",
		text: `${newCustomer.customer_name} created and selected`,
		icon: "check",
		iconClasses: "text-green-600",
	})
}

async function handleSyncClick() {
	if (isOffline.value) {
		toast.create({
			title: "Offline Mode",
			text: `${pendingInvoicesCount.value} invoice(s) pending sync`,
			icon: "alert-circle",
			iconClasses: "text-orange-600",
		})
		return
	}

	if (pendingInvoicesCount.value === 0) {
		toast.create({
			title: "All Synced",
			text: "No pending invoices to sync",
			icon: "check",
			iconClasses: "text-green-600",
		})
		return
	}

	try {
		const result = await syncPending()

		if (result.success > 0) {
			toast.create({
				title: "Sync Complete",
				text: `${result.success} invoice(s) synced successfully`,
				icon: "check",
				iconClasses: "text-green-600",
			})
		}

		if (result.failed > 0) {
			toast.create({
				title: "Partial Sync",
				text: `${result.failed} invoice(s) failed to sync`,
				icon: "alert-circle",
				iconClasses: "text-orange-600",
			})
		}
	} catch (error) {
		console.error('Sync error:', error)
		toast.create({
			title: "Sync Failed",
			text: error.message || "Failed to sync invoices",
			icon: "alert-circle",
			iconClasses: "text-red-600",
		})
	}
}

// Resizable layout helpers
let resizeState = null
let bodyStyleSnapshot = null

function clampLeftPanelWidth(width, containerWidth) {
	const safeContainerWidth = Number.isFinite(containerWidth) && containerWidth > 0
		? containerWidth
		: LEFT_PANEL_MIN + RIGHT_PANEL_MIN
	const maxWidth = Math.max(LEFT_PANEL_MIN, safeContainerWidth - RIGHT_PANEL_MIN)
	const clampedWidth = Math.min(Math.max(width, LEFT_PANEL_MIN), maxWidth)
	return Number.isFinite(clampedWidth) ? clampedWidth : LEFT_PANEL_MIN
}

function updateLayoutBounds() {
	if (!containerRef.value) return
	const containerWidth = containerRef.value.offsetWidth
	leftPanelWidth.value = clampLeftPanelWidth(leftPanelWidth.value, containerWidth)
}

function startResize(event) {
	if (!containerRef.value || !dividerRef.value) return
	if (event.isPrimary === false) return
	if (event.button !== undefined && event.button !== 0 && event.pointerType !== 'touch') return

	updateLayoutBounds()

	resizeState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startWidth: leftPanelWidth.value,
		containerWidth: containerRef.value?.offsetWidth ?? LEFT_PANEL_MIN + RIGHT_PANEL_MIN
	}

	isResizing.value = true
	bodyStyleSnapshot = {
		cursor: document.body.style.cursor,
		userSelect: document.body.style.userSelect
	}

	dividerRef.value.setPointerCapture?.(event.pointerId)
	document.body.style.cursor = 'col-resize'
	document.body.style.userSelect = 'none'
	event.preventDefault()
}

function handleResize(event) {
	if (!isResizing.value || !resizeState || (event.pointerId ?? resizeState.pointerId) !== resizeState.pointerId) {
		return
	}

	event.preventDefault()

	const containerWidth = containerRef.value?.offsetWidth ?? resizeState.containerWidth
	resizeState.containerWidth = containerWidth

	const deltaX = event.clientX - resizeState.startX
	const rawWidth = resizeState.startWidth + deltaX

	leftPanelWidth.value = clampLeftPanelWidth(rawWidth, containerWidth)
}

function stopResize(event) {
	if (!isResizing.value || !resizeState) {
		return
	}

	if (event?.pointerId !== undefined && event.pointerId !== resizeState.pointerId) {
		return
	}

	if (event?.preventDefault) {
		event.preventDefault()
	}

	if (dividerRef.value?.hasPointerCapture?.(resizeState.pointerId)) {
		dividerRef.value.releasePointerCapture(resizeState.pointerId)
	}

	isResizing.value = false
	resizeState = null
	restoreBodyStyles()
	updateLayoutBounds()
}

function restoreBodyStyles() {
	if (!bodyStyleSnapshot) {
		return
	}

	document.body.style.cursor = bodyStyleSnapshot.cursor || ''
	document.body.style.userSelect = bodyStyleSnapshot.userSelect || ''
	bodyStyleSnapshot = null
}
</script>
