/**
 * AVB Bandwidth Calculator - Modern UI Layer
 * Vanilla JavaScript replacement for jQuery-based middle.js
 *
 * Copyright (c) 2014-2026, J.D. Koftinoff Software, Ltd.
 * BSD 3-Clause License
 */

(function() {
    'use strict';

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
            // Default to inputs if no hash
            const targetId = hash ? hash.replace('#', '') : 'inputs';

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
        showPanel(location.hash || '#inputs');
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
     * Display output values in the form
     * @param {Object} outputs - Results from calculate_avb()
     */
    function setOutputValues(outputs) {
        for (const key of OUTPUT_ITEMS) {
            const element = document.getElementById('output_' + key);
            if (element && outputs[key] !== undefined) {
                element.value = outputs[key];
            }
        }

        // Display detailed JSON output
        const detailElement = document.getElementById('output_detail');
        if (detailElement) {
            detailElement.textContent = JSON.stringify(outputs, null, 2);
        }
    }

    /**
     * Process the form and calculate results
     */
    function processForm() {
        // Get input values
        const inputs = getInputValues();

        // Calculate (uses global calculate_avb from avbcalc.js)
        const outputs = calculate_avb(inputs);

        // Display outputs
        setOutputValues(outputs);

        // Navigate to answers panel
        history.pushState(null, '', '#answers');
        const panels = document.querySelectorAll('.panel');
        const tabs = document.querySelectorAll('.tab');

        panels.forEach(p => {
            p.classList.remove('active');
            p.setAttribute('aria-hidden', 'true');
        });
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });

        document.getElementById('answers').classList.add('active');
        document.getElementById('answers').setAttribute('aria-hidden', 'false');
        document.querySelector('.tab[href="#answers"]').classList.add('active');
        document.querySelector('.tab[href="#answers"]').setAttribute('aria-selected', 'true');
    }

    /**
     * Initialize the application
     */
    function init() {
        // Set up navigation
        initNavigation();

        // Set up sliders
        initSliders();

        // Set up calculate button
        const calculateBtn = document.getElementById('calculate');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', processForm);
        }

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
