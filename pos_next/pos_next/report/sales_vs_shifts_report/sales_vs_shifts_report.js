// Copyright (c) 2026, BrainWise and contributors
// For license information, please see license.txt

frappe.query_reports["Sales vs Shifts Report"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_days(frappe.datetime.get_today(), -30)
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today()
		},
		{
			fieldname: "pos_profile",
			label: __("POS Profile"),
			fieldtype: "Link",
			options: "POS Profile"
		},
		{
			fieldname: "cashier",
			label: __("Cashier"),
			fieldtype: "Link",
			options: "User"
		},
		{
			fieldname: "sales_person",
			label: __("Sales Person"),
			fieldtype: "Link",
			options: "Sales Person"
		},
		{
			fieldname: "shift",
			label: __("Shift"),
			fieldtype: "Link",
			options: "POS Closing Shift"
		},
		{
			fieldname: "chart_type",
			label: __("Chart View"),
			fieldtype: "Select",
			options: "Shift Performance\nCashier Comparison\nHourly Breakdown\nPayment Methods\nDaily Trend",
			default: "Shift Performance",
			on_change: function() {
				frappe.query_report.refresh();
			}
		}
	],

	formatter: function(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (!data) return value;

		// Rating colors
		if (column.fieldname === "rating" && data.rating) {
			const colors = {
				"Excellent": "#28a745",
				"Good": "#17a2b8",
				"Average": "#ffc107",
				"Needs Improvement": "#dc3545"
			};
			const color = colors[data.rating] || "#6c757d";
			value = `<span style="color: ${color}; font-weight: 600;">${value}</span>`;
		}

		// Efficiency colors
		if (column.fieldname === "efficiency" && data.efficiency !== undefined) {
			let color = "#dc3545";
			if (data.efficiency >= 90) color = "#28a745";
			else if (data.efficiency >= 75) color = "#17a2b8";
			else if (data.efficiency >= 60) color = "#ffc107";
			value = `<span style="color: ${color}; font-weight: 600;">${value}</span>`;
		}

		// Returns in red
		if (column.fieldname === "returns" && data.returns > 0) {
			value = `<span style="color: #dc3545;">${value}</span>`;
		}

		// Return rate warning
		if (column.fieldname === "return_rate" && data.return_rate > 10) {
			value = `<span style="color: #dc3545; font-weight: 500;">${value}</span>`;
		}

		// Peak hour highlight
		if (column.fieldname === "peak_hour" && data.peak_hour) {
			value = `<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 4px;">${value}</span>`;
		}

		// Sales person highlight
		if (column.fieldname === "sales_person" && data.sales_person) {
			value = `<span style="background: #fff3e0; padding: 2px 8px; border-radius: 4px;">${value}</span>`;
		}

		return value;
	},

	after_datatable_render: function() {
		const chart_type = frappe.query_report.get_filter_value("chart_type");
		if (chart_type && chart_type !== "Shift Performance") {
			this.render_custom_chart(chart_type);
		}
	},

	render_custom_chart: function(chart_type) {
		const filters = frappe.query_report.get_filter_values();
		const method_base = "pos_next.pos_next.report.sales_vs_shifts_report.sales_vs_shifts_report";
		const result = frappe.query_report.data || [];

		if (chart_type === "Cashier Comparison") {
			// Aggregate by cashier
			const cashierData = {};
			result.forEach(d => {
				const cashier = d.cashier || "Unknown";
				if (!cashierData[cashier]) {
					cashierData[cashier] = { sales: 0, invoices: 0, shifts: 0, efficiency: 0 };
				}
				cashierData[cashier].sales += d.net_sales || 0;
				cashierData[cashier].invoices += d.invoices || 0;
				cashierData[cashier].shifts += 1;
				cashierData[cashier].efficiency += d.efficiency || 0;
			});

			// Sort by sales descending
			const sorted = Object.entries(cashierData)
				.map(([name, data]) => ({
					name: name.split(' ')[0], // First name only
					sales: data.sales,
					invoices: data.invoices,
					avgEfficiency: data.shifts > 0 ? Math.round(data.efficiency / data.shifts) : 0
				}))
				.sort((a, b) => b.sales - a.sales)
				.slice(0, 10);

			frappe.query_report.render_chart({
				data: {
					labels: sorted.map(d => d.name),
					datasets: [
						{ name: __("Net Sales"), values: sorted.map(d => d.sales), chartType: "bar" },
						{ name: __("Avg Efficiency %"), values: sorted.map(d => d.avgEfficiency), chartType: "line" }
					]
				},
				type: "axis-mixed",
				colors: ["#28a745", "#5e64ff"],
				height: 300,
				barOptions: { spaceRatio: 0.4 }
			});
		}

		else if (chart_type === "Hourly Breakdown") {
			frappe.call({
				method: `${method_base}.get_hourly_breakdown`,
				args: { filters },
				callback: (r) => {
					if (!r.message || !r.message.length) return;

					const labels = [];
					const sales = [];
					const invoices = [];

					// Only show hours with data, or business hours (6 AM - 11 PM)
					for (let i = 6; i <= 23; i++) {
						// Simple hour format: 6, 7, 8... 12, 13... 23
						const hourLabel = i <= 12 ? `${i}${i < 12 ? 'am' : 'pm'}` : `${i - 12}pm`;
						labels.push(hourLabel);
						const hourData = r.message.find(d => d.hour === i);
						sales.push(hourData ? hourData.total_sales : 0);
						invoices.push(hourData ? hourData.invoice_count : 0);
					}

					frappe.query_report.render_chart({
						data: {
							labels,
							datasets: [
								{ name: __("Sales"), values: sales, chartType: "bar" },
								{ name: __("Invoices"), values: invoices, chartType: "line" }
							]
						},
						type: "axis-mixed",
						colors: ["#28a745", "#5e64ff"],
						height: 320,
						barOptions: { spaceRatio: 0.5 },
						axisOptions: {
							xAxisMode: "tick",
							xIsSeries: false
						}
					});
				}
			});
		}

		else if (chart_type === "Payment Methods") {
			frappe.call({
				method: `${method_base}.get_payment_method_breakdown`,
				args: { filters },
				callback: (r) => {
					if (!r.message || !r.message.length) return;

					const total = r.message.reduce((sum, d) => sum + d.total_amount, 0);
					const sorted = r.message.sort((a, b) => b.total_amount - a.total_amount);

					// Short labels for pie chart - just percentage
					const labels = sorted.map(d => {
						const pct = Math.round(d.total_amount / total * 100);
						// Truncate long payment method names
						const name = d.mode_of_payment.length > 10
							? d.mode_of_payment.substring(0, 10) + '..'
							: d.mode_of_payment;
						return `${name} ${pct}%`;
					});

					frappe.query_report.render_chart({
						data: {
							labels: labels,
							datasets: [{ name: __("Amount"), values: sorted.map(d => d.total_amount) }]
						},
						type: "pie",
						colors: ["#28a745", "#5e64ff", "#ffc107", "#17a2b8", "#dc3545", "#6f42c1", "#fd7e14", "#20c997"],
						height: 360
					});
				}
			});
		}

		else if (chart_type === "Daily Trend") {
			frappe.call({
				method: `${method_base}.get_daily_trend`,
				args: { filters },
				callback: (r) => {
					if (!r.message || !r.message.length) return;

					// Calculate moving average (3-day)
					const sales = r.message.map(d => d.total_sales);
					const movingAvg = sales.map((val, i, arr) => {
						if (i < 2) return val;
						return Math.round((arr[i-2] + arr[i-1] + val) / 3);
					});

					frappe.query_report.render_chart({
						data: {
							labels: r.message.map(d => {
								const date = new Date(d.date);
								return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
							}),
							datasets: [
								{ name: __("Daily Sales"), values: sales, chartType: "bar" },
								{ name: __("3-Day Avg"), values: movingAvg, chartType: "line" }
							]
						},
						type: "axis-mixed",
						colors: ["#28a745", "#dc3545"],
						height: 300,
						lineOptions: { dotSize: 3 },
						barOptions: { spaceRatio: 0.4 }
					});
				}
			});
		}
	},

	get_chart_data: function(columns, result) {
		const chart_type = frappe.query_report.get_filter_value("chart_type");

		// Custom charts are rendered via after_datatable_render
		if (chart_type && chart_type !== "Shift Performance") {
			return null;
		}

		if (!result || !result.length) {
			return null;
		}

		// Sort by date and take recent 15
		const sorted = [...result]
			.filter(d => d.shift_date)
			.sort((a, b) => new Date(a.shift_date) - new Date(b.shift_date))
			.slice(-15);

		if (!sorted.length) {
			return null;
		}

		// Build informative labels: Date + Cashier initial
		const labels = sorted.map(d => {
			const date = new Date(d.shift_date);
			const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
			const cashierInitial = d.cashier ? d.cashier.charAt(0).toUpperCase() : '';
			return cashierInitial ? `${dateStr} (${cashierInitial})` : dateStr;
		});

		return {
			data: {
				labels,
				datasets: [
					{
						name: __("Net Sales"),
						values: sorted.map(d => d.net_sales || 0),
						chartType: "bar"
					},
					{
						name: __("Efficiency %"),
						values: sorted.map(d => d.efficiency || 0),
						chartType: "line"
					}
				]
			},
			type: "axis-mixed",
			colors: ["#28a745", "#5e64ff"],
			height: 300,
			barOptions: {
				spaceRatio: 0.4
			},
			lineOptions: {
				dotSize: 4
			}
		};
	}
};
