import { onBeforeUnmount, ref } from "vue"

export function useLongPress(callback, { delay = 2000, preventClick = true } = {}) {
	const timeout = ref(null)
	const isLongPress = ref(false)

	function start(e) {
		// Only left click or touch
		if (e.type === 'mousedown' && e.button !== 0) return

		isLongPress.value = false
		timeout.value = setTimeout(() => {
			isLongPress.value = true
			callback(e)
		}, delay)
	}

	function cancel() {
		if (timeout.value) {
			clearTimeout(timeout.value)
			timeout.value = null
		}
	}

	function click(e) {
		if (preventClick && isLongPress.value) {
			e.stopImmediatePropagation()
			e.preventDefault()
		}
	}

	return {
		mousedown: start,
		touchstart: start,
		mouseup: cancel,
		mouseleave: cancel,
		touchend: cancel,
		touchcancel: cancel,
		click
	}
}
