<template>
	<Teleport to="body">
		<Transition :name="isRTL ? 'toast-slide-rtl' : 'toast-slide-ltr'">
			<div
				v-if="showToast && toastNotification"
				class="fixed top-4 end-4 z-[9999] max-w-md"
			>
				<div
					:class="[
						'rounded-lg shadow-xl p-4 flex items-start gap-3',
						toastNotification.type === 'success' ? 'bg-green-50 border-s-4 border-green-500' : '',
						toastNotification.type === 'error' ? 'bg-red-50 border-s-4 border-red-500' : '',
						toastNotification.type === 'warning' ? 'bg-orange-50 border-s-4 border-orange-500' : ''
					]"
				>
					<div class="flex-shrink-0">
						<FeatherIcon
							:name="toastNotification.type === 'success' ? 'check-circle' : toastNotification.type === 'error' ? 'x-circle' : 'alert-circle'"
							:class="[
								'w-5 h-5',
								toastNotification.type === 'success' ? 'text-green-600' : '',
								toastNotification.type === 'error' ? 'text-red-600' : '',
								toastNotification.type === 'warning' ? 'text-orange-600' : ''
							]"
						/>
					</div>
					<div class="flex-1 min-w-0">
						<p
							:class="[
								'text-sm font-semibold',
								toastNotification.type === 'success' ? 'text-green-900' : '',
								toastNotification.type === 'error' ? 'text-red-900' : '',
								toastNotification.type === 'warning' ? 'text-orange-900' : ''
							]"
						>
							{{ toastNotification.title }}
						</p>
						<p
							:class="[
								'text-sm mt-1',
								toastNotification.type === 'success' ? 'text-green-700' : '',
								toastNotification.type === 'error' ? 'text-red-700' : '',
								toastNotification.type === 'warning' ? 'text-orange-700' : ''
							]"
						>
							{{ toastNotification.message }}
						</p>
					</div>
					<button
						@click="hideToast"
						class="flex-shrink-0"
					>
						<FeatherIcon
							name="x"
							:class="[
								'w-4 h-4',
								toastNotification.type === 'success' ? 'text-green-600 hover:text-green-900' : '',
								toastNotification.type === 'error' ? 'text-red-600 hover:text-red-900' : '',
								toastNotification.type === 'warning' ? 'text-orange-600 hover:text-orange-900' : ''
							]"
						/>
					</button>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { useToast } from "@/composables/useToast"
import { useLocale } from "@/composables/useLocale"
import { FeatherIcon } from "frappe-ui"

const { toastNotification, showToast, hideToast } = useToast()
const { isRTL } = useLocale()
</script>

<style scoped>
/* Common transition timing */
.toast-slide-ltr-enter-active,
.toast-slide-ltr-leave-active,
.toast-slide-rtl-enter-active,
.toast-slide-rtl-leave-active {
	transition: all 0.3s ease;
}

/* LTR: slide from right (end side) */
.toast-slide-ltr-enter-from,
.toast-slide-ltr-leave-to {
	opacity: 0;
	transform: translateX(100%);
}

/* RTL: slide from left (end side in RTL) */
.toast-slide-rtl-enter-from,
.toast-slide-rtl-leave-to {
	opacity: 0;
	transform: translateX(-100%);
}
</style>
