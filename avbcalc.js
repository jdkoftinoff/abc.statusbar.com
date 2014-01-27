
/*
  AVB Bandwidth Calculator, Version 2014-01-25

  Copyright (c) 2014, J.D. Koftinoff Software, Ltd. <jeffk@jdkoftinoff.com>
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

   3. Neither the name of J.D. Koftinoff Software, Ltd. nor the names of its
      contributors may be used to endorse or promote products derived from
      this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.
*/


/*
inputs:
        "network_speed_in_bps", "avb_bw", "stream_format", "sample_rate",
        "bits_per_sample", "channel_count", "async", "aes_gcm"

outputs:

        "status", "octets_per_frame", "micros_per_frame",
        "max_stream_count_per_net_link", "leftover_bw_in_bps",
        "total_channels_per_net_link", "octet_times"

*/

var am824_syt_interval_from_sample_rate = {
    "32000" : 8,
    "44100" : 8,
    "48000" : 8,
    "88200" : 16,
    "96000" : 16,
    "176400" : 32,
    "192000" : 32
};

var am824nb_async_samples_per_frame_from_sample_rate = {
    "32000" : 5,
    "44100" : 7,
    "48000" : 7,
    "88200" : 13,
    "96000" : 13,
    "176400" : 25,
    "192000" : 25
};

var am824nb_sync_samples_per_frame_from_sample_rate = {
    "32000" : 4,
    "44100" : 6,
    "48000" : 6,
    "88200" : 12,
    "96000" : 12,
    "176400" : 24,
    "192000" : 24
};

var am824b_samples_per_frame_from_sample_rate = {
    "32000" : 4,
    "44100" : 8,
    "48000" : 8,
    "88200" : 16,
    "96000" : 16,
    "176400" : 32,
    "192000" : 32
};


function calculate_avb( inputs ) {

    var r={};

    r.ethernet_frame = {};

    // Default to good status
    r.status = "Bad Format";

    // all components of the frame
    r.ethernet_frame.interframe_gap = 12;
    r.ethernet_frame.preambles_and_sfd = 8;
    r.ethernet_frame.ethernet_header = 14;
    r.ethernet_frame.vlan_tag = 4;
    r.ethernet_frame.avtpdu_header = 24;
    r.ethernet_frame.cip_header = 0;
    r.ethernet_frame.aaf_header = 0;
    r.ethernet_frame.ethernet_fcs = 4;
    r.ethernet_frame.padding = 0;

    // Determine samples_per_frame, syt_interval, octets_per_sample, frames_per_observation_interval,
    // and observation_intervals_per_second values based on stream format and other options
    if( inputs.stream_format == "AM824nb" ) {
        r.status = "success";
        // AM824 non blocking mode may be asynchronous or synchronous
        if( inputs.async==1 ) {
           r.samples_per_frame = am824nb_async_samples_per_frame_from_sample_rate[ inputs.sample_rate ];
        } else {
           r.samples_per_frame = am824nb_sync_samples_per_frame_from_sample_rate[ inputs.sample_rate ];
        }

        // AM824 always has a cip_header of 8 octets
        r.ethernet_frame.cip_header = 8;

        // SYT_INTERVAL is fixed based on sample rate
        r.syt_interval = am824_syt_interval_from_sample_rate[ inputs.sample_rate ];

        // IEEE 1722 AM824 always uses 4 octets per sample
        r.octets_per_sample = 4;

        // IEEE 1722 AM824 always uses 1 frame per observation interval
        r.frames_per_observation_interval = 1;

        // Class A is 8000 observation intervals per second
        r.observation_intervals_per_second = 8000;

    } else if ( inputs.stream_format == "AM824b" ) {
        r.status = "success";

        // AM824 always has a cip_header of 8 octets
        r.ethernet_frame.cip_header = 8;

        // Blocking mode has a fixed number of samples per frame when it does send a frame
        r.samples_per_frame = am824b_samples_per_frame_from_sample_rate[ inputs.sample_rate ];

        // SYT_INTERVAL is fixed based on sample rate
        r.syt_interval = am824_syt_interval_from_sample_rate[ inputs.sample_rate ];

        // IEEE 1722 AM824 always uses 4 octets per sample
        r.octets_per_sample = 4;

        // IEEE 1722 AM824 always uses 1 frame per observation interval
        r.frames_per_observation_interval = 1;

        // Class A is 8000 observation intervals per second
        r.observation_intervals_per_second = 8000;

    } else if ( inputs.stream_format == "AAF" ) {
        r.status = "success";

        // No CIP header for AAF
        r.ethernet_frame.cip_header = 0;

        // AAF header is fully contained in 1722 header
        r.ethernet_frame.aaf_header = 0;


        // Class A is 8000 observation intervals per second
        r.observation_intervals_per_second = 8000;

        // AAF allows 16,24, and 32 bit bits per sample
        r.octets_per_sample = inputs.bits_per_sample / 8;

        // The number of samples per observation interval for a sample rate is the same as am824nb
        r.samples_per_observation_interval = am824nb_sync_samples_per_frame_from_sample_rate[ inputs.sample_rate ];

        // samples per frame can be parameterized
        if( inputs.samples_per_frame > 0 ) {
            r.samples_per_frame = inputs.samples_per_frame;
        } else {
            r.samples_per_frame = r.samples_per_observation_interval;
        }

        // From the samples per frame, calculate how many frames per observation interval are needed to be sent
        r.frames_per_observation_interval = Math.ceil( r.samples_per_observation_interval / r.samples_per_frame );
    }

    // Calculate the audio payload octets
    r.ethernet_frame.audio_payload = r.octets_per_sample * r.samples_per_frame * inputs.channel_count;

    // Calculate the total octets for the frame
    r.octets_per_frame = 0;
    for( var i in r.ethernet_frame ) {
        if( r.ethernet_frame[i] ) {
            r.octets_per_frame += r.ethernet_frame[i];
        }
    }

    // Calculate the total payload length
    r.ethernet_payload_length =
        r.ethernet_frame.avtpdu_header
        +r.ethernet_frame.cip_header
        +r.ethernet_frame.aaf_header
        +r.ethernet_frame.audio_payload;

    // Is the stream encrypted?
    if( inputs.aes_gcm==1 ) {
        // If the stream is encrypted with AES_GCM then the payload needs to be
        // a multiple of 16 bytes and then the AES_GCM header/footer overhead added
        r.ethernet_frame.aes_gcm_padding = 0;
        var aes_gcm_block_size=16;
        var remainder = r.ethernet_payload_length % aes_gcm_block_size;
        if( remainder>0 ) {
            r.ethernet_frame.aes_gcm_padding = aes_gcm_block_size-remainder;
        }
        // Add the additional headers/footers for AESGCM
        r.ethernet_frame.aes_gcm_subtype_data = 4;
        r.ethernet_frame.aes_gcm_key_id = 8
        r.ethernet_frame.aes_gcm_aes_seed = 8;
        r.ethernet_frame.aes_gcm_auth = 8;

        r.aes_gcm_overhead = r.ethernet_frame.aes_gcm_subtype_data
            + r.ethernet_frame.aes_gcm_key_id
            + r.ethernet_frame.aes_gcm_aes_seed
            + r.ethernet_frame.aes_gcm_auth
            + r.ethernet_frame.aes_gcm_padding;

        r.ethernet_payload_length += r.aes_gcm_overhead;
        r.octets_per_frame += r.aes_gcm_overhead;
    }

    r.octets_per_frame=r.octets_per_frame+1; // SRP adds 1 octet per frame

    // if it is smaller than 46 then we need to pad it to 46 for minimum
    // ethernet frame size of 68 bytes for bandwidth reservation requirements
    // as while the smallest frame can be 64, it must also be able to have
    // an additional tag
    if( r.ethernet_payload_length<46 ) {
        r.ethernet_frame.padding = 46 - r.ethernet_payload_length;
        r.octets_per_frame += r.ethernet_frame.padding;
        r.ethernet_payload_length += r.ethernet_frame.padding;
    }

    // If the payload length > 1500 then this is an error
    if( r.ethernet_payload_length > 1500 ) {
        r.status = "Err: Payload > 1500";
    }

    // microseconds per octet for this network speed
    r.micros_per_octet = 8.0 / inputs.network_speed_in_bps * 1.0e6;

    // microseconds per ethernet frame
    r.micros_per_frame=r.octets_per_frame * r.micros_per_octet;

    // microseconds taken by the frames for this stream per observation interval
    r.micros_spent_per_observation_interval = r.micros_per_frame * r.frames_per_observation_interval;

    if( inputs.avb_bw<10 || inputs.avb_bw>95 ) {
        r.status = "Invalid AVB Bandwidth";
    }

    // available time per observation interval
    r.available_time_per_observation_interval_in_micros = 1000000 * (inputs.avb_bw*0.01) / r.observation_intervals_per_second;

    // if the payload time of the packets is too large for the available time then this is an error
    if( r.micros_spent_per_observation_interval > r.available_time_per_observation_interval_in_micros ) {
        r.status = "Err: Time > " + inputs.avb_bw + "%";
    }

    // Add up all the octet times for all bandwidth reserved for a second to calc the bandwidth per stream
    r.bw_per_stream_in_bps = (8*r.octets_per_frame*r.frames_per_observation_interval*r.observation_intervals_per_second);

    // How many streams can we fit on this link?
    r.max_stream_count_per_net_link = Math.floor( inputs.network_speed_in_bps * inputs.avb_bw*0.01 / r.bw_per_stream_in_bps);

    // And how much BW in bps do those streams use?
    r.total_bw_used_in_bps = (r.bw_per_stream_in_bps * r.max_stream_count_per_net_link );

    // What bandwidth is left over?
    r.leftover_bw_in_bps = inputs.network_speed_in_bps - r.total_bw_used_in_bps;

    // embed the inputs in the result for reference
    r.inputs = inputs;

    // How many channels in total?
    if( inputs.channel_count < 1 ) {
        r.status = "Invalid channel count";
    } else {}
        r.total_channels_per_net_link = r.max_stream_count_per_net_link * inputs.channel_count;
    }
    return r;
}


