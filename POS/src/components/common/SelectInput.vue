<template>
	<div class="relative" ref="containerRef">
		<!-- Trigger Button -->
		<button
			type="button"
			@click="toggle"
			@keydown.enter.prevent="toggle"
			@keydown.space.prevent="toggle"
			@keydown.escape="close"
			@keydown.down.prevent="openAndFocusFirst"
			:disabled="disabled"
			class="w-full h-10 border border-gray-300 rounded-lg ps-3 pe-10 text-sm text-start bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center"
			:class="[selectClass, disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer']"
		>
			<span class="truncate">{{ selectedLabel || placeholder }}</span>
		</button>

		<!-- Chevron Icon -->
		<FeatherIcon
			name="chevron-down"
			class="absolute top-1/2 end-3 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none transition-transform"
			:class="{ 'rotate-180': isOpen }"
		/>

		<!-- Dropdown Options -->
		<Transition
			enter-active-class="transition ease-out duration-100"
			enter-from-class="opacity-0 scale-95"
			enter-to-class="opacity-100 scale-100"
			leave-active-class="transition ease-in duration-75"
			leave-from-class="opacity-100 scale-100"
			leave-to-class="opacity-0 scale-95"
		>
			<div
				v-if="isOpen"
				class="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
				role="listbox"
			>
				<div
					v-for="(option, index) in options"
					:key="option.value"
					@click="selectOption(option)"
					@keydown.enter.prevent="selectOption(option)"
					@keydown.escape="close"
					@keydown.down.prevent="focusNext(index)"
					@keydown.up.prevent="focusPrev(index)"
					:ref="el => optionRefs[index] = el"
					tabindex="0"
					role="option"
					:aria-selected="option.value === modelValue"
					class="px-3 py-2 text-sm cursor-pointer text-start transition-colors focus:outline-none"
					:class="option.value === modelValue
						? 'bg-blue-50 text-blue-700'
						: 'text-gray-700 hover:bg-gray-100 focus:bg-gray-100'"
				>
					{{ option.label }}
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { FeatherIcon } from "frappe-ui"
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from "vue"

defineOptions({
	inheritAttrs: false,
})

const props = defineProps({
	modelValue: {
		type: [String, Number],
		default: "",
	},
	options: {
		type: Array, // [{ value: '', label: '' }]
		default: () => [],
	},
	placeholder: {
		type: String,
		default: "",
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	selectClass: {
		type: String,
		default: "",
	},
})

const emit = defineEmits(["update:modelValue", "change"])

const isOpen = ref(false)
const containerRef = ref(null)
const optionRefs = ref([])

const selectedLabel = computed(() => {
	const selected = props.options.find((opt) => opt.value === props.modelValue)
	return selected?.label || ""
})

function toggle() {
	if (props.disabled) return
	isOpen.value = !isOpen.value
}

function close() {
	isOpen.value = false
}

function openAndFocusFirst() {
	if (!isOpen.value) {
		isOpen.value = true
		nextTick(() => {
			if (optionRefs.value[0]) {
				optionRefs.value[0].focus()
			}
		})
	}
}

function selectOption(option) {
	emit("update:modelValue", option.value)
	emit("change", option.value)
	close()
}

function focusNext(currentIndex) {
	const nextIndex = currentIndex + 1
	if (nextIndex < props.options.length && optionRefs.value[nextIndex]) {
		optionRefs.value[nextIndex].focus()
	}
}

function focusPrev(currentIndex) {
	const prevIndex = currentIndex - 1
	if (prevIndex >= 0 && optionRefs.value[prevIndex]) {
		optionRefs.value[prevIndex].focus()
	}
}

// Close on click outside
function handleClickOutside(event) {
	if (containerRef.value && !containerRef.value.contains(event.target)) {
		close()
	}
}

onMounted(() => {
	document.addEventListener("click", handleClickOutside)
})

onBeforeUnmount(() => {
	document.removeEventListener("click", handleClickOutside)
})
</script>
