<template>
	<Dialog
		v-model="show"
		:options="{ title: 'Available Offers', size: 'lg' }"
	>
		<template #body-content>
			<div class="space-y-4">
				<!-- Loading State -->
				<div v-if="loading" class="py-8 text-center">
					<div class="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto"></div>
					<p class="mt-3 text-sm text-gray-500">Loading offers...</p>
				</div>

				<!-- Empty State -->
				<div v-else-if="eligibleOffers.length === 0" class="py-12 text-center">
					<div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100">
						<svg class="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
						</svg>
					</div>
					<h3 class="mt-4 text-sm font-medium text-gray-900">No offers available</h3>
					<p class="mt-2 text-xs text-gray-500">
						Add items to your cart to see eligible offers
					</p>
				</div>

				<!-- Offers List -->
				<div v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
					<div
						v-for="offer in eligibleOffers"
						:key="offer.name"
						@click="checkOfferEligibility(offer) ? selectOffer(offer) : null"
						:class="[
							'relative rounded-xl p-4 transition-all duration-200 border-2',
							checkOfferEligibility(offer) ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
							appliedOffer?.code === offer.name
								? 'bg-green-50 border-green-500 shadow-md'
								: checkOfferEligibility(offer)
									? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-400 hover:shadow-lg'
									: 'bg-gray-50 border-gray-300'
						]"
					>
						<!-- Applied Badge -->
						<div
							v-if="appliedOffer?.code === offer.name"
							class="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center space-x-1"
						>
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
							</svg>
							<span>APPLIED</span>
						</div>

						<!-- Offer Header -->
						<div class="flex items-start justify-between mb-3">
							<div class="flex-1 pr-4">
								<h4 class="text-base font-bold text-gray-900">
									{{ offer.title || offer.name }}
								</h4>
								<p v-if="offer.description" class="text-xs text-gray-600 mt-1">
									{{ offer.description }}
								</p>
							</div>
							<div class="flex-shrink-0">
								<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
								</svg>
							</div>
						</div>

						<!-- Discount Display -->
						<div class="flex items-center space-x-3 mb-3">
							<div class="bg-green-600 text-white px-4 py-2 rounded-lg">
								<div class="text-lg font-bold">
									<span v-if="offer.discount_percentage">{{ offer.discount_percentage }}% OFF</span>
									<span v-else-if="offer.discount_amount">{{ formatCurrency(offer.discount_amount) }} OFF</span>
									<span v-else>Special Offer</span>
								</div>
							</div>
							<div v-if="offer.offer === 'Give Product'" class="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
								+ Free Item
							</div>
						</div>

						<!-- Offer Details -->
						<div class="grid grid-cols-2 gap-3 mb-3">
							<!-- Min Amount -->
							<div v-if="offer.min_amt" class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
								</svg>
								<div>
									<p class="text-[10px] text-gray-500">Min Purchase</p>
									<p class="text-xs font-semibold text-gray-900">{{ formatCurrency(offer.min_amt) }}</p>
								</div>
							</div>

							<!-- Min Quantity -->
							<div v-if="offer.min_qty" class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
								</svg>
								<div>
									<p class="text-[10px] text-gray-500">Min Quantity</p>
									<p class="text-xs font-semibold text-gray-900">{{ offer.min_qty }} items</p>
								</div>
							</div>

							<!-- Valid Until -->
							<div v-if="offer.valid_upto" class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
								</svg>
								<div>
									<p class="text-[10px] text-gray-500">Valid Until</p>
									<p class="text-xs font-semibold text-gray-900">{{ formatDate(offer.valid_upto) }}</p>
								</div>
							</div>

							<!-- Offer Type -->
							<div class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
								</svg>
								<div>
									<p class="text-[10px] text-gray-500">Type</p>
									<p class="text-xs font-semibold text-gray-900">{{ offer.offer || 'Discount' }}</p>
								</div>
							</div>
						</div>

						<!-- Progress Bar for Min Amount -->
						<div v-if="offer.min_amt && subtotal < offer.min_amt" class="mt-3">
							<div class="flex items-center justify-between text-xs mb-1">
								<span class="text-gray-600">Subtotal (before tax)</span>
								<span class="text-gray-900 font-semibold">
									{{ formatCurrency(subtotal) }} / {{ formatCurrency(offer.min_amt) }}
								</span>
							</div>
							<div class="w-full bg-gray-200 rounded-full h-2">
								<div
									class="bg-green-600 h-2 rounded-full transition-all"
									:style="{ width: `${Math.min((subtotal / offer.min_amt) * 100, 100)}%` }"
								></div>
							</div>
							<p class="text-xs text-orange-600 mt-1 font-medium">
								Add {{ formatCurrency(offer.min_amt - subtotal) }} more to unlock
							</p>
						</div>

						<!-- Apply Button -->
						<button
							v-if="checkOfferEligibility(offer)"
							@click.stop="selectOffer(offer)"
							:class="[
								'mt-3 w-full py-2 px-4 rounded-lg font-semibold text-sm transition-all',
								appliedOffer?.code === offer.name
									? 'bg-red-600 hover:bg-red-700 text-white'
									: 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
							]"
						>
							{{ appliedOffer?.code === offer.name ? 'Remove Offer' : 'Apply Offer' }}
						</button>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div class="flex justify-end w-full">
				<Button variant="subtle" @click="show = false">
					Close
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Dialog, Button, createResource, toast } from 'frappe-ui'
import { formatCurrency as formatCurrencyUtil } from '@/utils/currency'

const props = defineProps({
	modelValue: Boolean,
	subtotal: {
		type: Number,
		required: true,
		note: 'Cart subtotal BEFORE tax - used for discount calculations'
	},
	items: Array,
	posProfile: String,
	customer: String,
	company: String,
	currency: {
		type: String,
		default: 'USD'
	},
	appliedOffer: {
		type: Object,
		default: null
	}
})

const emit = defineEmits(['update:modelValue', 'offer-applied', 'offer-removed'])

const show = ref(props.modelValue)
const allOffers = ref([])
const appliedOffer = computed(() => props.appliedOffer)
const loading = ref(false)

// Resource to load offers
const offersResource = createResource({
	url: 'pos_next.api.offers.get_offers',
	makeParams() {
		return {
			pos_profile: props.posProfile
		}
	},
	auto: false,
	onSuccess(data) {
		allOffers.value = data?.message || data || []
		loading.value = false
	},
	onError(error) {
		console.error('Error loading offers:', error)
		loading.value = false
		toast.create({
			title: 'Error',
			text: 'Failed to load offers',
			icon: 'x',
			iconClasses: 'text-red-600'
		})
	}
})

// Computed eligible offers
const eligibleOffers = computed(() => {
        if (!allOffers.value) return []

        return allOffers.value
                .filter(offer => !offer.coupon_based)
                .sort((a, b) => {
                        // Sort by eligibility first (eligible offers on top)
                        const aEligible = checkOfferEligibility(a)
                        const bEligible = checkOfferEligibility(b)
                        if (aEligible !== bEligible) return bEligible ? 1 : -1

                        // Prioritize auto offers when both share the same eligibility state
                        if (a.auto !== b.auto) {
                                return b.auto ? 1 : -1
                        }

                        // Then sort by discount value (higher discounts first)
                        const aValue = a.discount_percentage || a.discount_amount || 0
                        const bValue = b.discount_percentage || b.discount_amount || 0
                        return bValue - aValue
                })
})

watch(() => props.modelValue, (val) => {
	show.value = val
	if (val) {
		loadOffers()
	}
})

watch(show, (val) => {
	emit('update:modelValue', val)
})

function checkOfferEligibility(offer) {
	// Check minimum amount (on subtotal before tax)
	if (offer.min_amt && props.subtotal < offer.min_amt) {
		return false
	}
	// Check maximum amount (on subtotal before tax)
	if (offer.max_amt && props.subtotal > offer.max_amt) {
		return false
	}
	// Check minimum quantity
	if (offer.min_qty) {
		const totalQty = props.items.reduce((sum, item) => sum + item.quantity, 0)
		if (totalQty < offer.min_qty) {
			return false
		}
	}
	return true
}

async function loadOffers() {
	if (!props.posProfile) return
	loading.value = true
	try {
		await offersResource.reload()
	} catch (error) {
		console.error('Error loading offers:', error)
		loading.value = false
	}
}

function selectOffer(offer) {
	// Toggle offer - if already applied, remove it
	if (appliedOffer.value?.code === offer.name) {
		emit('offer-removed')
		toast.create({
			title: 'Offer Removed',
			text: 'Offer has been removed from your cart',
			icon: 'info',
			iconClasses: 'text-blue-600'
		})
		return
	}

	// Check eligibility before applying
	if (!checkOfferEligibility(offer)) {
		toast.create({
			title: 'Not Eligible',
			text: 'Your cart does not meet the requirements for this offer',
			icon: 'alert-circle',
			iconClasses: 'text-orange-600'
		})
		return
	}

	// Calculate discount on subtotal (before tax)
	const discountData = {
		percentage: offer.discount_percentage || 0,
		amount: offer.discount_amount || 0
	}

	let discountAmount = 0
	if (discountData.percentage > 0) {
		discountAmount = (props.subtotal * discountData.percentage) / 100
	} else if (discountData.amount > 0) {
		discountAmount = discountData.amount
	}

	// Clamp discount to subtotal to prevent negative totals
	discountAmount = Math.min(discountAmount, props.subtotal)

	const offerData = {
		name: offer.title || offer.name,
		code: offer.name,
		percentage: discountData.percentage,
		amount: discountAmount,
		type: offer.discount_type,
		offer: offer
	}

	emit('offer-applied', offerData)

	toast.create({
		title: 'Offer Applied!',
		text: `${offer.title || offer.name} applied successfully`,
		icon: 'check',
		iconClasses: 'text-green-600'
	})
}

function formatCurrency(amount) {
	return formatCurrencyUtil(parseFloat(amount || 0), props.currency)
}

function formatDate(dateStr) {
	if (!dateStr) return ''
	const date = new Date(dateStr)
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
