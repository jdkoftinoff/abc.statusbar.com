/*
 * Unit Tests for AVB Bandwidth Calculator
 * Run these tests to verify math calculations
 */

// Test framework utilities
function assert(condition, message) {
    if (!condition) {
        console.error("❌ FAILED: " + message);
        return false;
    } else {
        console.log("✓ PASSED: " + message);
        return true;
    }
}

function assertAlmostEqual(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) <= tolerance) {
        console.log("✓ PASSED: " + message + " (expected: " + expected + ", got: " + actual + ")");
        return true;
    } else {
        console.error("❌ FAILED: " + message + " (expected: " + expected + ", got: " + actual + ")");
        return false;
    }
}

function describe(testName, testFunc) {
    console.log("\n=== " + testName + " ===");
    testFunc();
}

// Test 1: AM824 Non-Blocking with default observation intervals
describe("Test 1: AM824 Non-Blocking Async (Default Obs Interval)", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb-async",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0  // not used for AM824
    };
    
    var result = calculate_avb(inputs);
    
    assert(result.status === "success", "Status should be 'success', got: " + result.status);
    assert(result.observation_intervals_per_second === 8000, 
        "Observation intervals should be 8000, got: " + result.observation_intervals_per_second);
    assert(result.samples_per_frame === 7, 
        "Samples per frame should be 7 for 48kHz async, got: " + result.samples_per_frame);
    assertAlmostEqual(result.frames_per_second, 48000/7, 1, 
        "Frames per second calculation (48000/7)");
    assert(result.max_stream_count_per_net_link > 0, 
        "Max stream count should be positive, got: " + result.max_stream_count_per_net_link);
    console.log("   Octets per frame: " + result.octets_per_frame);
    console.log("   Max streams: " + result.max_stream_count_per_net_link);
    console.log("   Total BW used: " + result.total_bw_used_in_bps + " bps");
    console.log("   Efficiency: " + result.efficiency + "%");
});

// Test 2: AM824 Blocking with default observation intervals  
describe("Test 2: AM824 Blocking (Default Obs Interval)", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824b",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result = calculate_avb(inputs);
    
    assert(result.status === "success", "Status should be 'success'");
    assert(result.observation_intervals_per_second === 8000, 
        "Observation intervals should be 8000");
    assert(result.samples_per_frame === 8, 
        "Samples per frame should be 8 for 48kHz blocking, got: " + result.samples_per_frame);
    console.log("   Octets per frame: " + result.octets_per_frame);
    console.log("   Max streams: " + result.max_stream_count_per_net_link);
});

// Test 3: AAF with default parameters
describe("Test 3: AAF with Default Sample Rate and Default Samples Per Frame", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AAF",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: "default"  // should use default
    };
    
    var result = calculate_avb(inputs);
    
    assert(result.status === "success", "Status should be 'success'");
    assert(result.octets_per_sample === 3, 
        "Octets per sample should be 3 for 24-bit (24/8), got: " + result.octets_per_sample);
    assert(result.samples_per_frame > 0, 
        "Samples per frame should be positive, got: " + result.samples_per_frame);
    console.log("   Octets per sample: " + result.octets_per_sample);
    console.log("   Samples per frame: " + result.samples_per_frame);
    console.log("   Frames per observation interval: " + result.frames_per_observation_interval);
    console.log("   Max streams: " + result.max_stream_count_per_net_link);
});

// Test 4: AAF with custom samples per frame
describe("Test 4: AAF with Custom Samples Per Frame (64)", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AAF",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 64
    };
    
    var result = calculate_avb(inputs);
    
    assert(result.status === "success", "Status should be 'success'");
    assert(result.samples_per_frame === 64, 
        "Samples per frame should be 64, got: " + result.samples_per_frame);
    console.log("   Samples per frame: " + result.samples_per_frame);
    console.log("   Frames per observation interval: " + result.frames_per_observation_interval);
    console.log("   Max streams: " + result.max_stream_count_per_net_link);
});

// Test 5: Verify observation interval affect on calculations
describe("Test 5: Observation Interval Effect on Bandwidth", function() {
    var inputs1 = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var inputs2 = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 4000,  // Half the interval frequency
        samples_per_frame: 0
    };
    
    var result1 = calculate_avb(inputs1);
    var result2 = calculate_avb(inputs2);
    
    assert(result1.observation_intervals_per_second === 8000, "Result1 obs interval should be 8000");
    assert(result2.observation_intervals_per_second === 4000, "Result2 obs interval should be 4000");
    
    // With half the observation intervals, frames_per_second should be half
    var ratio1 = result1.frames_per_second;
    var ratio2 = result2.frames_per_second;
    console.log("   8000 OI/s: frames_per_second = " + ratio1);
    console.log("   4000 OI/s: frames_per_second = " + ratio2);
    console.log("   Ratio: " + (ratio1/ratio2));
    
    assertAlmostEqual(ratio1/ratio2, 2, 0.01, "With half obs intervals, frames per second should double");
});

// Test 6: Bandwidth calculation consistency check
describe("Test 6: Bandwidth Calculation Consistency", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb-async",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result = calculate_avb(inputs);
    
    // Manual check: bw_per_stream = 8 * octets_per_frame * frames_per_second
    var expected_bw = 8 * result.octets_per_frame * result.frames_per_second;
    assertAlmostEqual(result.bw_per_stream_in_bps, expected_bw, 1,
        "BW per stream calculation");
    
    // Manual check: total_bw_used = bw_per_stream * max_stream_count
    var expected_total = result.bw_per_stream_in_bps * result.max_stream_count_per_net_link;
    assertAlmostEqual(result.total_bw_used_in_bps, expected_total, 1,
        "Total BW used calculation");
    
    // Manual check: available_bw = network_bw * avb_bw%
    var available_bw = inputs.network_speed_in_bps * inputs.avb_bw * 0.01;
    assert(result.total_bw_used_in_bps <= available_bw,
        "Total BW should not exceed available BW (" + result.total_bw_used_in_bps + " <= " + available_bw + ")");
});

// Test 7: Efficiency calculation check
describe("Test 7: Efficiency Calculation", function() {
    var inputs = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 2,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result = calculate_avb(inputs);
    
    // Efficiency should be: audio_bps / nominal_bw_per_stream * 100
    var audio_bps = inputs.channel_count * result.octets_per_sample * inputs.sample_rate * 8;
    var expected_efficiency = 100 * 100 * audio_bps / result.nominal_bw_per_stream_in_bps;
    expected_efficiency = Math.round(expected_efficiency) / 100.0;
    
    assertAlmostEqual(result.efficiency, expected_efficiency, 0.1,
        "Efficiency calculation (should be " + expected_efficiency + "%)");
    
    assert(result.efficiency > 0 && result.efficiency <= 100,
        "Efficiency should be between 0 and 100%, got: " + result.efficiency + "%");
    
    console.log("   Audio payload BPS: " + audio_bps);
    console.log("   Nominal BW per stream: " + result.nominal_bw_per_stream_in_bps);
    console.log("   Efficiency: " + result.efficiency + "%");
});

// Test 8: High sample rate check
describe("Test 8: High Sample Rate (192 kHz)", function() {
    var inputs = {
        network_speed_in_bps: 10e9,  // 10 Gbps to handle higher data rate
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "192000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result = calculate_avb(inputs);
    
    assert(result.status === "success", "Status should be success");
    assert(result.samples_per_frame === 24, 
        "Samples per frame should be 24 for 192kHz, got: " + result.samples_per_frame);
    console.log("   Samples per frame: " + result.samples_per_frame);
    console.log("   Max streams on 10 Gbps: " + result.max_stream_count_per_net_link);
});

// Test 9: AES-SIV Encryption adds overhead
describe("Test 9: AES-SIV Encryption Overhead", function() {
    var inputs_plain = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var inputs_encrypted = {
        network_speed_in_bps: 1e9,
        avb_bw: 75,
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 1,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result_plain = calculate_avb(inputs_plain);
    var result_encrypted = calculate_avb(inputs_encrypted);
    
    assert(result_encrypted.octets_per_frame > result_plain.octets_per_frame,
        "Encrypted should have more octets per frame due to AES-SIV overhead");
    assert(result_encrypted.bw_per_stream_in_bps > result_plain.bw_per_stream_in_bps,
        "Encrypted should have higher BW per stream");
    assert(result_encrypted.max_stream_count_per_net_link <= result_plain.max_stream_count_per_net_link,
        "Encrypted should support fewer streams due to higher overhead");
    
    console.log("   Plain: " + result_plain.octets_per_frame + " octets/frame, " + result_plain.max_stream_count_per_net_link + " max streams");
    console.log("   Encrypted: " + result_encrypted.octets_per_frame + " octets/frame, " + result_encrypted.max_stream_count_per_net_link + " max streams");
});

// Test 10: Edge case - minimum and maximum AVB bandwidth allocation
describe("Test 10: AVB Bandwidth Edge Cases", function() {
    var inputs_min = {
        network_speed_in_bps: 1e9,
        avb_bw: 5,  // Minimum
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var inputs_max = {
        network_speed_in_bps: 1e9,
        avb_bw: 95,  // Maximum
        stream_format: "AM824nb",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 1,
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: 0
    };
    
    var result_min = calculate_avb(inputs_min);
    var result_max = calculate_avb(inputs_max);
    
    assert(result_min.status === "success", "Min AVB bandwidth should succeed");
    assert(result_max.status === "success", "Max AVB bandwidth should succeed");
    assert(result_max.max_stream_count_per_net_link > result_min.max_stream_count_per_net_link,
        "95% BW allocation should support more streams than 5%");
    
    console.log("   5% AVB: " + result_min.max_stream_count_per_net_link + " streams");
    console.log("   95% AVB: " + result_max.max_stream_count_per_net_link + " streams");
});

console.log("\n" + "=".repeat(50));
console.log("TESTS COMPLETE");
console.log("=".repeat(50));
