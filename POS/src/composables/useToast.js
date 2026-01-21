import { ref } from "vue"

// Global toast state
const toastNotification = ref(null)
const showToast = ref(false)

export function useToast() {
	function showToastNotification(title, message, type = "success") {
		toastNotification.value = { title, message, type }
		showToast.value = true

		// Auto-hide after 4 seconds
		setTimeout(() => {
			showToast.value = false
			setTimeout(() => {
				toastNotification.value = null
			}, 300) // Wait for fade animation
		}, 4000)
	}

	function showSuccess(message) {
		showToastNotification(__("Success"), message, "success")
	}

	function showError(message) {
		showToastNotification(__("Error"), message, "error")
	}

	function showWarning(message) {
		showToastNotification(__("Validation Error"), message, "warning")
	}

	function hideToast() {
		showToast.value = false
		setTimeout(() => {
			toastNotification.value = null
		}, 300)
	}

	return {
		toastNotification,
		showToast,
		showSuccess,
		showError,
		showWarning,
		hideToast,
	}
}
