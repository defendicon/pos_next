<template>
	<Dialog
		v-model="show"
		:options="{ title: __('Verification Required'), size: 'sm' }"
	>
		<template #body-content>
			<div class="py-4 space-y-4">
				<p class="text-sm text-gray-600">
					{{ __('Please enter your credentials to access Settings.') }}
				</p>
				<p class="text-xs text-gray-500">
					{{ __('Only Administrator or System User can access.') }}
				</p>

				<div class="space-y-4">
					<div>
						<label class="block text-xs font-medium text-gray-700 mb-1">{{ __('Email / Username') }}</label>
						<input
							type="text"
							v-model="username"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
							:placeholder="__('Enter your email or username')"
							@keyup.enter="focusPassword"
						/>
					</div>

					<div>
						<label class="block text-xs font-medium text-gray-700 mb-1">{{ __('Password') }}</label>
						<input
							ref="passwordInput"
							type="password"
							v-model="password"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
							:placeholder="__('Enter your password')"
							@keyup.enter="handleVerify"
						/>
					</div>

					<div v-if="error" class="text-xs text-red-600 font-medium flex items-center gap-1">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						{{ error }}
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div class="flex gap-2 w-full">
				<Button
					variant="subtle"
					class="flex-1"
					@click="show = false"
				>
					{{ __('Cancel') }}
				</Button>
				<Button
					variant="solid"
					theme="blue"
					class="flex-1"
					:loading="verifying"
					@click="handleVerify"
				>
					{{ __('Verify') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Dialog, Button } from 'frappe-ui'
import { call } from '@/utils/apiWrapper'
import { __ } from '@/utils/translation'

const props = defineProps({
	modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'success'])

const show = computed({
	get: () => props.modelValue,
	set: (val) => emit('update:modelValue', val)
})

const username = ref('')
const password = ref('')
const verifying = ref(false)
const error = ref('')
const passwordInput = ref(null)

watch(show, (val) => {
	if (val) {
		// Reset state on open
		username.value = ''
		password.value = ''
		error.value = ''
		verifying.value = false
	}
})

function focusPassword() {
	if (passwordInput.value) {
		passwordInput.value.focus()
	}
}

async function handleVerify() {
	if (!username.value || !password.value) {
		error.value = __('Please enter both username and password')
		return
	}

	verifying.value = true
	error.value = ''

	try {
		const result = await call('pos_next.api.auth.verify_admin_access', {
			usr: username.value,
			pwd: password.value
		})

		if (result && result.allowed) {
			emit('success')
			show.value = false
		} else {
			error.value = result.message || __('Invalid credentials or insufficient permissions')
		}
	} catch (err) {
		console.error(err)
		error.value = err.message || __('Verification failed')
	} finally {
		verifying.value = false
	}
}
</script>
