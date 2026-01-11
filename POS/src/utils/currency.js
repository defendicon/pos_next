/**
 * Currency formatting utility for POS Next
 * Provides consistent currency formatting across the application
 */

/**
 * Get currency symbol for a specific currency code
 * @param {string} currency - The currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbolOnly(currency) {
	// Manual mapping for currencies that don't have good symbols in en-US
	const symbolMap = {
		EGP: "E£",
		SAR: "\u00EA",
		AED: "د.إ",
		INR: "₹",
		EUR: "€",
		GBP: "£",
		JPY: "¥",
		CNY: "¥",
		USD: "$",
	}

	// Return mapped symbol or try to get from Intl
	if (symbolMap[currency]) {
		return symbolMap[currency]
	}

	// Fallback to Intl with narrowSymbol
	try {
		const parts = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency,
			currencyDisplay: "narrowSymbol",
		}).formatToParts(0)
		const symbolPart = parts.find((part) => part.type === "currency")
		return symbolPart ? symbolPart.value : currency
	} catch {
		return currency
	}
}

/**
 * Format currency with proper locale and currency code
 * @param {number} value - The numeric value to format
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR', 'EGP')
 * @param {string} locale - The locale for formatting (default: 'en-US' for English numbers)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = "USD", locale = "en-US") {
	if (typeof value !== "number" || isNaN(value)) {
		return ""
	}

	const absValue = Math.abs(value)
	const symbol = getCurrencySymbolOnly(currency)

	// Format number with English locale
	const numberFormatted = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(absValue)

	// Combine symbol with formatted number (with space)
	const formatted = `${symbol} ${numberFormatted}`

	// Return with negative sign if needed
	return value < 0 ? `-${formatted}` : formatted
}

/**
 * Get currency symbol for a given currency code
 * @param {string} currency - The currency code (e.g., 'USD', 'EUR')
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currency = "USD") {
	return getCurrencySymbolOnly(currency)
}

/**
 * Format currency without symbol (numbers only)
 * @param {number} value - The numeric value to format
 * @param {string} locale - The locale for formatting
 * @returns {string} Formatted number string
 */
export function formatCurrencyNumber(value, locale = "en-US") {
	if (typeof value !== "number" || isNaN(value)) {
		return "0.00"
	}

	return new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value)
}

/**
 * Get CSS class for currency values based on positive/negative
 * @param {number} value - The numeric value
 * @returns {string} CSS class string
 */
export function getCurrencyClass(value) {
	return value < 0 ? "text-red-600" : "text-gray-900"
}

/**
 * Round a number to 2 decimal places
 * Prevents floating point precision issues (e.g., 10.000000000000002)
 * @param {number} value - The numeric value to round
 * @returns {number} Rounded value
 */
export function round2(value) {
	if (typeof value !== "number" || isNaN(value)) {
		return 0
	}
	return Math.round(value * 100) / 100
}
