// Test Case: User Reported Issue
// 10 Mbps, 75%, AAF, 48kHz, 24-bit, Default AAF samples, 3 channels, default obs interval

console.log("\n=== TEST: User Reported Issue (10 Mbps AAF with 3 channels) ===\n");

var inputs = {
    network_speed_in_bps: 10e6,  // 10 Mbps
    avb_bw: 75,
    stream_format: "AAF",
    sample_rate: "48000",
    bits_per_sample: 24,
    channel_count: 3,  // User selected 3 channels
    aes_siv: 0,
    observation_intervals_per_second: 8000,  // Default
    samples_per_frame: "default"  // User selected Default
};

console.log("INPUT VALUES:");
console.log("  network_speed_in_bps: " + inputs.network_speed_in_bps + " (type: " + typeof inputs.network_speed_in_bps + ")");
console.log("  channel_count: " + inputs.channel_count + " (type: " + typeof inputs.channel_count + ")");
console.log("  samples_per_frame: " + inputs.samples_per_frame + " (type: " + typeof inputs.samples_per_frame + ")");

var result = calculate_avb(inputs);

console.log("\nRESULT:");
console.log("  status: " + result.status);
console.log("  max_stream_count_per_net_link: " + result.max_stream_count_per_net_link);
console.log("  total_channels_per_net_link: " + result.total_channels_per_net_link);
console.log("  bw_per_stream_in_bps: " + result.bw_per_stream_in_bps);
console.log("  total_bw_used_in_bps: " + result.total_bw_used_in_bps);
console.log("  leftover_bw_in_bps: " + result.leftover_bw_in_bps);

console.log("\nEXPECTED VS ACTUAL:");
var available_bw = 10e6 * 0.75;
console.log("  Available AVB BW: " + available_bw + " bps (10 Mbps × 75%)");
console.log("  Total channels should be: " + result.max_stream_count_per_net_link + " streams × 3 channels = " + (result.max_stream_count_per_net_link * 3));
console.log("  Actual total_channels: " + result.total_channels_per_net_link);
if( result.total_channels_per_net_link !== result.max_stream_count_per_net_link * 3 ) {
    console.log("  ❌ MISMATCH!");
}

console.log("  Leftover should be: " + available_bw + " - " + result.total_bw_used_in_bps + " = " + (available_bw - result.total_bw_used_in_bps));
console.log("  Actual leftover: " + result.leftover_bw_in_bps);
if( Math.abs((available_bw - result.total_bw_used_in_bps) - result.leftover_bw_in_bps) > 1 ) {
    console.log("  ❌ MISMATCH!");
}

console.log("\nDEBUG INFO:");
console.log("  samples_per_frame: " + result.samples_per_frame);
console.log("  octets_per_sample: " + result.octets_per_sample);
console.log("  octets_per_frame: " + result.octets_per_frame);
console.log("  frames_per_second: " + result.frames_per_second);
console.log("  efficiency: " + result.efficiency + "%");

// Test with numeric channel_count (what it should be)
console.log("\n=== Testing with STRING channel_count (what might be passed from form) ===\n");
var inputs_string = {
    network_speed_in_bps: "10000000",  // String!
    avb_bw: "75",  // String!
    stream_format: "AAF",
    sample_rate: "48000",
    bits_per_sample: "24",  // String!
    channel_count: "3",  // String instead of number!
    aes_siv: "0",
    observation_intervals_per_second: "8000",
    samples_per_frame: "default"
};

console.log("CHECKING TYPE ISSUES:");
console.log("  channel_count as string '3' > 0: " + ("3" > 0));
console.log("  network_speed as string: " + ("10000000" * "75" * 0.01) + " (might lose precision)");

// Try calculation with strings
try {
    var result_string = calculate_avb(inputs_string);
    console.log("\nWith STRING values:");
    console.log("  max_stream_count: " + result_string.max_stream_count_per_net_link);
    console.log("  total_channels: " + result_string.total_channels_per_net_link);
    console.log("  leftover_bw: " + result_string.leftover_bw_in_bps);
} catch(e) {
    console.log("ERROR with string values: " + e.message);
}
