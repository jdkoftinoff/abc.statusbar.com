/**
 * AVB Bandwidth Calculator - Modern UI Layer
 * Vanilla JavaScript replacement for jQuery-based middle.js
 *
 * Copyright (c) 2014-2026, J.D. Koftinoff Software, Ltd.
 * BSD 3-Clause License
 */

(function() {
    'use strict';

    // Chart.js instance reference
    let channelPlotChart = null;

    // Input parameter names (must match avbcalc.js expectations)
    const INPUT_ITEMS = [
        'network_speed_in_bps', 'avb_bw', 'stream_format', 'sample_rate',
        'bits_per_sample', 'channel_count', 'aes_siv', 'samples_per_frame',
        'observation_interval_freq'
    ];

    // Output parameter names
    const OUTPUT_ITEMS = [
        'status', 'octets_per_frame', 'micros_per_frame',
        'bw_per_stream_in_bps', 'max_stream_count_per_net_link',
        'total_bw_used_in_bps', 'leftover_bw_in_bps',
        'total_channels_per_net_link', 'ethernet_payload_length',
        'channels_per_stream', 'efficiency'
    ];

    /**
     * Initialize tab navigation
     */
    function initNavigation() {
        const tabs = document.querySelectorAll('.tab');
        const panels = document.querySelectorAll('.panel');

        function showPanel(hash) {
            // Default to calculator if no hash
            const targetId = hash ? hash.replace('#', '') : 'calculator';

            // Hide all panels
            panels.forEach(panel => {
                panel.classList.remove('active');
                panel.setAttribute('aria-hidden', 'true');
            });

            // Deactivate all tabs
            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });

            // Show target panel
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
                targetPanel.setAttribute('aria-hidden', 'false');
            }

            // Activate corresponding tab
            const activeTab = document.querySelector(`.tab[href="#${targetId}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.setAttribute('aria-selected', 'true');
            }

            // Update plot when switching to plot panel
            if (targetId === 'plot') {
                requestAnimationFrame(() => {
                    updatePlot();
                });
            }
        }

        // Handle tab clicks
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const hash = tab.getAttribute('href');
                history.pushState(null, '', hash);
                showPanel(hash);
            });
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            showPanel(location.hash);
        });

        // Show initial panel
        showPanel(location.hash || '#calculator');
    }

    /**
     * Sync a range slider with a number input
     */
    function syncSliderAndNumber(sliderId, numberId) {
        const slider = document.getElementById(sliderId);
        const numberInput = document.getElementById(numberId);

        if (!slider || !numberInput) return;

        // Sync number input when slider changes
        slider.addEventListener('input', () => {
            numberInput.value = slider.value;
            calculateLive();
        });

        // Sync slider when number input changes
        numberInput.addEventListener('input', () => {
            // Clamp value to min/max
            let val = parseInt(numberInput.value, 10);
            const min = parseInt(slider.min, 10);
            const max = parseInt(slider.max, 10);

            if (!isNaN(val)) {
                if (val < min) val = min;
                if (val > max) val = max;
                slider.value = val;
                calculateLive();
            }
        });

        // On blur, enforce valid value in number input
        numberInput.addEventListener('blur', () => {
            let val = parseInt(numberInput.value, 10);
            const min = parseInt(slider.min, 10);
            const max = parseInt(slider.max, 10);

            if (isNaN(val) || val < min) {
                val = min;
            } else if (val > max) {
                val = max;
            }
            numberInput.value = val;
            slider.value = val;
            calculateLive();
        });
    }

    /**
     * Initialize range sliders with synced number inputs
     */
    function initSliders() {
        syncSliderAndNumber('input_avb_bw', 'input_avb_bw_number');
        syncSliderAndNumber('input_channel_count', 'input_channel_count_number');
    }

    /**
     * Initialize live calculation on all inputs
     */
    function initLiveCalculation() {
        const form = document.getElementById('inputForm');
        if (!form) return;

        // Add change listeners to all form elements
        const inputs = form.querySelectorAll('select, input[type="checkbox"]');
        inputs.forEach(input => {
            input.addEventListener('change', calculateLive);
        });

        // For range inputs, also listen to 'input' for live updates while dragging
        const rangeInputs = form.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            input.addEventListener('input', calculateLive);
        });

        // Calculate on page load
        calculateLive();
    }

    /**
     * Extract input values from the form
     * @returns {Object} Input values for calculate_avb()
     */
    function getInputValues() {
        const inputs = {};

        for (const key of INPUT_ITEMS) {
            const widget = document.getElementById('input_' + key);
            if (!widget) continue;

            let val;

            if (widget.type === 'checkbox') {
                val = widget.checked ? 1 : 0;
            } else {
                val = widget.value;
            }

            // Convert numeric values to numbers (except "default" strings)
            if (key === 'network_speed_in_bps' || key === 'avb_bw' ||
                key === 'bits_per_sample' || key === 'channel_count' ||
                key === 'aes_siv' || key === 'samples_per_frame' ||
                key === 'observation_interval_freq') {
                if (val !== 'default' && val !== 'Default') {
                    val = Number(val);
                }
            } else if (key === 'sample_rate') {
                val = Number(val);
            }

            inputs[key] = val;
        }

        // Map observation_interval_freq to observation_intervals_per_second
        // (the avbcalc.js expects this name)
        inputs.observation_intervals_per_second = inputs.observation_interval_freq;

        return inputs;
    }

    /**
     * Format a number with appropriate units
     */
    function formatNumber(value, decimals = 2) {
        if (typeof value !== 'number' || isNaN(value)) return value;

        if (Math.abs(value) >= 1e9) {
            return (value / 1e9).toFixed(decimals) + ' G';
        } else if (Math.abs(value) >= 1e6) {
            return (value / 1e6).toFixed(decimals) + ' M';
        } else if (Math.abs(value) >= 1e3) {
            return (value / 1e3).toFixed(decimals) + ' k';
        }
        return value.toFixed ? value.toFixed(decimals) : value;
    }

    /**
     * Format bandwidth in bps with units
     */
    function formatBps(value) {
        if (typeof value !== 'number' || isNaN(value)) return value;

        if (value >= 1e9) {
            return (value / 1e9).toFixed(2) + ' Gbps';
        } else if (value >= 1e6) {
            return (value / 1e6).toFixed(2) + ' Mbps';
        } else if (value >= 1e3) {
            return (value / 1e3).toFixed(2) + ' kbps';
        }
        return value.toFixed(0) + ' bps';
    }

    /**
     * Generate formatted details HTML
     */
    function generateFormattedDetails(outputs) {
        const statusClass = outputs.status === 'success' ? 'success' : 'error';

        // Get input descriptions
        const streamFormatNames = {
            'AM824nb': 'AM824 Non-Blocking Sync',
            'AM824nb-async': 'AM824 Non-Blocking Async',
            'AM824b': 'AM824 Blocking',
            'AAF': 'AVTP Audio Format (AAF)'
        };

        const inputs = outputs.inputs || {};
        const streamFormatName = streamFormatNames[inputs.stream_format] || inputs.stream_format;

        let html = '';

        // Status Section
        html += `
        <div class="details-section">
            <h3>Calculation Status</h3>
            <div class="details-row">
                <span class="details-label">Result</span>
                <span class="details-value ${statusClass}">${outputs.status}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Efficiency (audio payload / total bandwidth)</span>
                <span class="details-value">${outputs.efficiency}%</span>
            </div>
        </div>`;

        // Input Summary
        html += `
        <div class="details-section">
            <h3>Input Parameters</h3>
            <div class="details-row">
                <span class="details-label">Network Speed</span>
                <span class="details-value">${formatBps(inputs.network_speed_in_bps)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">AVB Bandwidth Allocation</span>
                <span class="details-value">${inputs.avb_bw}%</span>
            </div>
            <div class="details-row">
                <span class="details-label">Stream Format</span>
                <span class="details-value">${streamFormatName}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Sample Rate</span>
                <span class="details-value">${(inputs.sample_rate / 1000).toFixed(1)} kHz</span>
            </div>
            <div class="details-row">
                <span class="details-label">Bits Per Sample</span>
                <span class="details-value">${inputs.bits_per_sample} bits</span>
            </div>
            <div class="details-row">
                <span class="details-label">Channels Per Stream</span>
                <span class="details-value">${inputs.channel_count}</span>
            </div>
            <div class="details-row">
                <span class="details-label">AES-SIV Encryption</span>
                <span class="details-value">${inputs.aes_siv ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Observation Interval</span>
                <span class="details-value">${(1000000 / inputs.observation_intervals_per_second).toFixed(1)} µs</span>
            </div>
        </div>`;

        // Stream Capacity
        html += `
        <div class="details-section">
            <h3>Network Capacity</h3>
            <div class="details-row">
                <span class="details-label">Maximum Streams Per Network Link</span>
                <span class="details-value">${outputs.max_stream_count_per_net_link}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Total Audio Channels Per Link</span>
                <span class="details-value">${outputs.total_channels_per_net_link}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Channels Per Stream</span>
                <span class="details-value">${outputs.channels_per_stream}</span>
            </div>
        </div>`;

        // Bandwidth Usage
        html += `
        <div class="details-section">
            <h3>Bandwidth Utilization</h3>
            <div class="details-row">
                <span class="details-label">Available AVB Bandwidth</span>
                <span class="details-value">${formatBps(inputs.network_speed_in_bps * inputs.avb_bw / 100)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Bandwidth Per Stream</span>
                <span class="details-value">${formatBps(outputs.bw_per_stream_in_bps)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Total Bandwidth Used (all streams)</span>
                <span class="details-value">${formatBps(outputs.total_bw_used_in_bps)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Leftover AVB Bandwidth</span>
                <span class="details-value">${formatBps(outputs.leftover_bw_in_bps)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Raw Audio Bitrate Per Stream</span>
                <span class="details-value">${formatBps(outputs.audio_bps)}</span>
            </div>
        </div>`;

        // Frame Details
        html += `
        <div class="details-section">
            <h3>Ethernet Frame Details</h3>
            <div class="details-row">
                <span class="details-label">Samples Per Frame</span>
                <span class="details-value">${outputs.samples_per_frame}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Bytes Per Sample</span>
                <span class="details-value">${outputs.octets_per_sample} bytes</span>
            </div>
            <div class="details-row">
                <span class="details-label">Frame Payload Length</span>
                <span class="details-value">${outputs.ethernet_payload_length} bytes</span>
            </div>
            <div class="details-row">
                <span class="details-label">Total Frame Size (including all overhead)</span>
                <span class="details-value">${outputs.octets_per_frame} bytes</span>
            </div>
            <div class="details-row">
                <span class="details-label">Frame Transmission Time</span>
                <span class="details-value">${outputs.micros_per_frame?.toFixed(3)} µs</span>
            </div>
            <div class="details-row">
                <span class="details-label">Frames Per Second</span>
                <span class="details-value">${formatNumber(outputs.frames_per_second, 0)}</span>
            </div>
        </div>`;

        // Frame Breakdown
        if (outputs.ethernet_frame) {
            const frame = outputs.ethernet_frame;
            html += `
        <div class="details-section">
            <h3>Frame Structure Breakdown</h3>
            <table class="frame-breakdown">
                <tr><td>Interframe Gap</td><td>${frame.interframe_gap} bytes</td></tr>
                <tr><td>Preamble + Start Frame Delimiter</td><td>${frame.preambles_and_sfd} bytes</td></tr>
                <tr><td>Ethernet Header</td><td>${frame.ethernet_header} bytes</td></tr>
                <tr><td>VLAN Tag</td><td>${frame.vlan_tag} bytes</td></tr>
                <tr><td>AVTPDU Header</td><td>${frame.avtpdu_header} bytes</td></tr>
                ${frame.cip_header ? `<tr><td>CIP Header (AM824)</td><td>${frame.cip_header} bytes</td></tr>` : ''}
                ${frame.aaf_header ? `<tr><td>AAF Header</td><td>${frame.aaf_header} bytes</td></tr>` : ''}
                <tr><td>Audio Payload</td><td>${frame.audio_payload} bytes</td></tr>
                ${frame.padding ? `<tr><td>Padding (minimum frame size)</td><td>${frame.padding} bytes</td></tr>` : ''}
                ${frame.aes_siv_padding ? `<tr><td>AES-SIV Padding</td><td>${frame.aes_siv_padding} bytes</td></tr>` : ''}
                ${frame.aes_siv_subtype_data ? `<tr><td>AES-SIV Subtype Data</td><td>${frame.aes_siv_subtype_data} bytes</td></tr>` : ''}
                ${frame.aes_siv_key_id ? `<tr><td>AES-SIV Key ID</td><td>${frame.aes_siv_key_id} bytes</td></tr>` : ''}
                ${frame.aes_siv_iv ? `<tr><td>AES-SIV Initialization Vector</td><td>${frame.aes_siv_iv} bytes</td></tr>` : ''}
                <tr><td>Ethernet Frame Check Sequence</td><td>${frame.ethernet_fcs} bytes</td></tr>
            </table>
        </div>`;
        }

        // Timing Details
        html += `
        <div class="details-section">
            <h3>Timing Parameters</h3>
            <div class="details-row">
                <span class="details-label">Observation Intervals Per Second</span>
                <span class="details-value">${formatNumber(outputs.observation_intervals_per_second, 0)}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Frames Per Observation Interval</span>
                <span class="details-value">${outputs.frames_per_observation_interval}</span>
            </div>
            <div class="details-row">
                <span class="details-label">Time Per Observation Interval</span>
                <span class="details-value">${(1000000 / outputs.observation_intervals_per_second).toFixed(1)} µs</span>
            </div>
            <div class="details-row">
                <span class="details-label">Time Spent Transmitting Per Interval</span>
                <span class="details-value">${outputs.micros_spent_per_observation_interval?.toFixed(3)} µs</span>
            </div>
            <div class="details-row">
                <span class="details-label">Available Time Per Interval (at ${inputs.avb_bw}%)</span>
                <span class="details-value">${outputs.available_time_per_observation_interval_in_micros?.toFixed(3)} µs</span>
            </div>
            ${outputs.syt_interval ? `
            <div class="details-row">
                <span class="details-label">SYT Interval (AM824)</span>
                <span class="details-value">${outputs.syt_interval} samples</span>
            </div>` : ''}
        </div>`;

        return html;
    }

    /**
     * Format output value based on field type
     */
    function formatOutputValue(key, value, outputs) {
        if (value === undefined || value === null) return '';

        // Total BW Used - show bps and percentage of link
        if (key === 'total_bw_used_in_bps' && outputs && outputs.inputs) {
            const networkSpeed = outputs.inputs.network_speed_in_bps;
            const percent = networkSpeed ? ((value / networkSpeed) * 100).toFixed(1) : 0;
            return formatBps(value) + ' (' + percent + '%)';
        }

        // Other bandwidth fields - format as Gbps/Mbps/kbps
        if (key === 'leftover_bw_in_bps' ||
            key === 'bw_per_stream_in_bps') {
            return formatBps(value);
        }

        // Microseconds - format with 3 decimal places
        if (key === 'micros_per_frame') {
            return value.toFixed(3) + ' µs';
        }

        // Efficiency - add percent sign
        if (key === 'efficiency') {
            return value + '%';
        }

        // Octets/bytes - add unit
        if (key === 'octets_per_frame' || key === 'ethernet_payload_length') {
            return value + ' bytes';
        }

        return value;
    }

    /**
     * Generate plot data by iterating channels_per_stream until invalid
     * @param {Object} baseInputs - Current input values
     * @returns {Object} {labels: number[], data: number[], currentIndex: number, maxChannels: number}
     */
    function generatePlotData(baseInputs) {
        const labels = [];
        const data = [];
        const currentChannelCount = baseInputs.channel_count;
        let currentIndex = -1;
        const maxChannelsToTest = 512;  // Upper bound to prevent infinite loop

        for (let channels = 1; channels <= maxChannelsToTest; channels++) {
            // Create modified inputs with this channel count
            const inputs = { ...baseInputs, channel_count: channels };

            // Calculate for this configuration
            const outputs = calculate_avb(inputs);

            // Stop when we hit an invalid configuration
            if (outputs.status !== 'success') {
                break;
            }

            labels.push(channels);
            data.push(outputs.total_channels_per_net_link);

            if (channels === currentChannelCount) {
                currentIndex = labels.length - 1;
            }
        }

        return { labels, data, currentIndex };
    }

    /**
     * Get theme-aware colors from CSS custom properties
     */
    function getThemeColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            text: style.getPropertyValue('--pico-color').trim() || '#333',
            primary: style.getPropertyValue('--pico-primary').trim() || '#1095c1',
            muted: style.getPropertyValue('--pico-muted-color').trim() || '#666',
            grid: style.getPropertyValue('--pico-muted-border-color').trim() || '#ddd',
            background: style.getPropertyValue('--pico-card-background-color').trim() || '#fff'
        };
    }

    /**
     * Check if the Plot panel is currently active
     */
    function isPlotPanelActive() {
        const plotPanel = document.getElementById('plot');
        return plotPanel && plotPanel.classList.contains('active');
    }

    /**
     * Initialize or update the channel plot chart
     */
    function updatePlot() {
        const canvas = document.getElementById('channelPlot');
        if (!canvas) return;

        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet');
            return;
        }

        // Get current inputs and generate plot data
        const inputs = getInputValues();
        const plotData = generatePlotData(inputs);
        const colors = getThemeColors();

        // Find optimal point (maximum total channels)
        const maxChannels = Math.max(...plotData.data);
        const optimalIndex = plotData.data.indexOf(maxChannels);

        // Create point background colors (highlight current selection and optimal)
        const pointBackgroundColors = plotData.labels.map((label, index) => {
            if (index === plotData.currentIndex) {
                return colors.primary;  // Current selection
            }
            if (index === optimalIndex && optimalIndex !== plotData.currentIndex) {
                return '#28a745';  // Optimal (green)
            }
            return 'transparent';
        });

        const pointRadii = plotData.labels.map((label, index) => {
            if (index === plotData.currentIndex || index === optimalIndex) {
                return 6;
            }
            return 0;
        });

        const chartConfig = {
            type: 'line',
            data: {
                labels: plotData.labels,
                datasets: [{
                    label: 'Total Channels Per Link',
                    data: plotData.data,
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointBorderColor: pointBackgroundColors,
                    pointRadius: pointRadii,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => `${items[0].label} channels/stream`,
                            label: (item) => {
                                let label = `Total: ${item.raw} channels`;
                                if (item.dataIndex === optimalIndex) {
                                    label += ' (optimal)';
                                }
                                if (item.dataIndex === plotData.currentIndex) {
                                    label += ' (current)';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Channels Per Stream',
                            color: colors.text
                        },
                        ticks: {
                            color: colors.muted
                        },
                        grid: {
                            color: colors.grid
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Channels Per Link',
                            color: colors.text
                        },
                        ticks: {
                            color: colors.muted
                        },
                        grid: {
                            color: colors.grid
                        },
                        beginAtZero: true
                    }
                }
            }
        };

        // Update existing chart or create new one
        if (channelPlotChart) {
            channelPlotChart.data = chartConfig.data;
            channelPlotChart.options = chartConfig.options;
            channelPlotChart.update('none');  // Skip animation for live updates
        } else {
            channelPlotChart = new Chart(canvas, chartConfig);
        }

        // Update plot description with current settings
        const maxValidChannels = plotData.labels.length > 0 ? plotData.labels[plotData.labels.length - 1] : 0;
        updatePlotDescription(inputs, maxValidChannels);
    }

    /**
     * Update the plot description with specific settings
     */
    function updatePlotDescription(inputs, maxValidChannels) {
        const descElement = document.getElementById('plot-description');
        if (!descElement) return;

        // Format network speed
        const speed = inputs.network_speed_in_bps;
        let speedStr;
        if (speed >= 1e9) {
            speedStr = (speed / 1e9) + ' Gbps';
        } else if (speed >= 1e6) {
            speedStr = (speed / 1e6) + ' Mbps';
        } else {
            speedStr = (speed / 1e3) + ' kbps';
        }

        // Format stream format name
        const formatNames = {
            'AM824nb': 'AM824 non-blocking',
            'AM824nb-async': 'AM824 non-blocking async',
            'AM824b': 'AM824 blocking',
            'AAF': 'AAF'
        };
        const formatStr = formatNames[inputs.stream_format] || inputs.stream_format;

        // Format sample rate
        const sampleRateStr = (inputs.sample_rate / 1000) + ' kHz';

        // Build description
        let description = `This chart shows the total audio channels achievable on a ${speedStr} link ` +
            `with ${inputs.avb_bw}% AVB bandwidth allocation, using ${formatStr} format ` +
            `at ${sampleRateStr} sample rate with ${inputs.bits_per_sample}-bit samples`;

        if (inputs.aes_siv) {
            description += ' and AES-SIV encryption enabled';
        }

        description += `. Valid configurations allow 1 to ${maxValidChannels} channels per stream. The optimal value maximizes total channels.`;

        descElement.textContent = description;
    }

    /**
     * Display output values in the form
     * @param {Object} outputs - Results from calculate_avb()
     */
    function setOutputValues(outputs) {
        for (const key of OUTPUT_ITEMS) {
            const element = document.getElementById('output_' + key);
            if (element && outputs[key] !== undefined) {
                const formattedValue = formatOutputValue(key, outputs[key], outputs);
                // Use textContent for spans, value for inputs
                if (element.tagName === 'SPAN') {
                    element.textContent = formattedValue;
                } else {
                    element.value = formattedValue;
                }
            }
        }

        // Style status based on success/error
        const statusElement = document.getElementById('output_status');
        if (statusElement) {
            statusElement.classList.remove('success', 'error');
            if (outputs.status === 'success') {
                statusElement.classList.add('success');
            } else if (outputs.status) {
                statusElement.classList.add('error');
            }
        }

        // Display formatted details
        const formattedElement = document.getElementById('output_detail_formatted');
        if (formattedElement) {
            formattedElement.innerHTML = generateFormattedDetails(outputs);
        }

        // Display raw JSON output
        const detailElement = document.getElementById('output_detail');
        if (detailElement) {
            detailElement.textContent = JSON.stringify(outputs, null, 2);
        }
    }

    /**
     * Perform live calculation and update results
     */
    function calculateLive() {
        // Get input values
        const inputs = getInputValues();

        // Calculate (uses global calculate_avb from avbcalc.js)
        const outputs = calculate_avb(inputs);

        // Display outputs
        setOutputValues(outputs);

        // Update plot if visible
        if (isPlotPanelActive()) {
            updatePlot();
        }
    }

    /**
     * Initialize the application
     */
    function init() {
        // Set up navigation
        initNavigation();

        // Set up sliders
        initSliders();

        // Set up live calculation
        initLiveCalculation();

        // Register service worker for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
