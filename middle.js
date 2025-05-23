/*
  AVB Bandwidth Calculator, Version 2014-05-23

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


function process_abc_form(item) {
    // The list of input parameters
    var input_items = [
        "network_speed_in_bps", "avb_bw", "stream_format", "sample_rate",
        "bits_per_sample", "channel_count", "aes_siv", "samples_per_frame",
        "observation_interval_freq" ];

    // The list of output parameters
    var output_items = [
        "status", "octets_per_frame", "micros_per_frame",
        "bw_per_stream_in_bps",
        "max_stream_count_per_net_link", "total_bw_used_in_bps",
        "leftover_bw_in_bps",
        "total_channels_per_net_link",
        "ethernet_payload_length",
        "channels_per_stream",
        "efficiency"
    ];

    // Extract the inputs from the form into one object
    var inputs = {};
    for( var i in input_items ) {
        var key=input_items[i];
        var widget = $("#input_"+key);
        var val;
        if( widget.attr("type") == "checkbox" ) {
            if( widget.is(":checked") ) {
                val=1;
            } else {
                val=0;
            }
        } else {
            val=widget.val();
        }

        inputs[key] = val;
    }

    // Calculate
    outputs = calculate_avb( inputs );

    // Store the outputs of the calculation into the form
    for( var i in output_items ) {
        var key=output_items[i];
        if( key ) {
            var item = $("#output_" + key );
            if( item && outputs[key] ) {
                item.val( outputs[key] );
            }
        }
    }

    $("#output_detail").text(JSON.stringify(outputs,undefined,2));
    window.location="#page_answers";

}

