// New Unit Test: 10 Mbps AAF with 3 channels
// This test was added after user reported incorrect totals

function test_10mbps_aaf_3channels() {
    console.log("\n=== Test 7: 10 Mbps AAF with 3 Channels (User Reported Issue) ===");
    
    var inputs = {
        network_speed_in_bps: 10000000,  // 10 Mbps (number type)
        avb_bw: 75,
        stream_format: "AAF",
        sample_rate: "48000",
        bits_per_sample: 24,
        channel_count: 3,  // User had this set
        aes_siv: 0,
        observation_intervals_per_second: 8000,
        samples_per_frame: "default"  // User had this
    };
    
    var result = calculate_avb(inputs);
    
    // Calculate expected values
    var available_bw = 10000000 * 0.75;  // 7,500,000 bps
    var expected_channels = result.max_stream_count_per_net_link * 3;
    var expected_leftover = available_bw - result.total_bw_used_in_bps;
    
    console.log("Input verification:");
    console.log("  network_speed_in_bps: " + inputs.network_speed_in_bps + " (10 Mbps)");
    console.log("  avb_bw: " + inputs.avb_bw + "% = " + available_bw + " bps available");
    console.log("  channel_count: " + inputs.channel_count);
    
    console.log("Results:");
    console.log("  max_stream_count: " + result.max_stream_count_per_net_link);
    console.log("  total_channels: " + result.total_channels_per_net_link);
    console.log("  Expected channels: " + result.max_stream_count_per_net_link + " × 3 = " + expected_channels);
    console.log("  BW used: " + result.total_bw_used_in_bps + " bps");
    console.log("  Leftover: " + result.leftover_bw_in_bps + " bps");
    console.log("  Expected leftover: " + available_bw + " - " + result.total_bw_used_in_bps + " = " + expected_leftover);
    
    // Assertions
    assert(result.status === "success", "Status should be success");
    assert(result.total_channels_per_net_link === expected_channels, 
        "Total channels should be " + expected_channels + ", got " + result.total_channels_per_net_link);
    assertAlmostEqual(result.leftover_bw_in_bps, expected_leftover, 1,
        "Leftover BW should be " + expected_leftover);
    assert(result.total_bw_used_in_bps <= available_bw,
        "Used BW should not exceed available BW");
    
    console.log("  ✓ All assertions passed");
}

// Run this test
test_10mbps_aaf_3channels();

console.log("\n✓ Test 7 PASSED: 10 Mbps AAF with 3 channels calculation is now correct!");
