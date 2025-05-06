// Enum to indicate the track being recorded to currently.
const Recording_Track = {
    ONE: 0,
    TWO: 1,
    THREE: 2
}
// The last played key number
let last_mouse_key_number = -1;
// Global variables for keeping track of recording state
let is_recording = false;
// User's chosen/inputted BPM value for recording and metronome.
let BPM = 0;
let recording_start_time;
/**  We limit recording time to 4 bars in 4/4 time signature to whatever BPM the user chooses.
 * Calculate the total recording time with (60 / BPM) * 4 * 4
 * - (60 / BPM) where 60 is seconds in a minute. This should give the time in seconds for one beat.
 * - Multiply by 4 for 4 beats in a bar
 * - Multiply by 4 again for 4 bars.
 */
let total_recording_time = 0; 
// Holds track currently being recorded to.
let recording_track = Recording_Track.ONE;
/** Holds information on midi recorded midi events
 * Limited to a total of three tracks.
 * Access example: tracks_events[Recording_Track.One]
 * Each track should store: { time_offset, type, instrument, pitch, amplitude }
 * Use 'time_offset' to reconstruct events for playback.
 * 'type' is either 'on' or 'off', which indicates a noteOn or noteOff event.
 */
const tracks_events = [[],[],[]];
// Recording timeout id
let recording_timeout;

// Map the key with the key number
let key_mapping = {
    // White keys of the first octave
    "z":  0, "x":  2, "c":  4, "v":  5, "b":  7, "n":  9, "m": 11,
    // Black keys of the first octave
    "s":  1, "d":  3, "g":  6, "h":  8, "j": 10,
    // White keys of the second octave
    "w": 12, "e": 14, "r": 16, "t": 17, "y": 19, "u": 21, "i": 23,
    // Black keys of the second octave
    "3": 13, "4": 15, "6": 18, "7": 20, "8": 22
}

// Signal the key is down
let key_down_status = new Array(23);

function handleNoteOn(key_number) {
    // Find the pitch
    let lowest_pitch = parseInt($("#pitch").val());
    let pitch = lowest_pitch + key_number;
    console.log("lowest pitch: %i, played pitch: %i", lowest_pitch,pitch);
    /*
     * You need to use the slider to get the lowest pitch number above
     * rather than the hardcoded value
     */

    // Extract the amplitude value from the slider
    let amplitude = parseInt($("#amplitude").val());

    // Time offset to be stored in track data if we are recording
    let time_offset = performance.now() - recording_start_time
    // Need to keep track of the instrument being played for recording and playback.
    let instrument = parseInt($("#instrument").val());
    // When recording, push noteOn event data to the appropriate track.
    if (is_recording) {
        tracks_events[recording_track].push({
            time_offset,
            type: 'on',
            instrument,
            pitch,
            amplitude
        })
    }
    // Use the two numbers to start a MIDI note
    MIDI.noteOn(0, pitch, amplitude);


    /*
     * You need to handle the chord mode here
     */
    let playmode = $(":radio[name=playmode]:checked").val()
    if(playmode==="major") {
        console.log("Playing major chord...");
        MIDI.noteOn(0, pitch+4, amplitude)
        MIDI.noteOn(0, pitch+7, amplitude)
        // Also push chord notes to track_events if recording.
        if (is_recording) {
            tracks_events[recording_track].push({
                time_offset,
                type: 'on',
                instrument,
                pitch: pitch+4,
                amplitude
            })
            tracks_events[recording_track].push({
                time_offset,
                type: 'on',
                instrument,
                pitch: pitch+7,
                amplitude
            })
        }
    } else if(playmode === "minor") {
        console.log("Playing minor chord...");
        MIDI.noteOn(0, pitch+3, amplitude)
        MIDI.noteOn(0, pitch+7, amplitude)
        if (is_recording) {
            tracks_events[recording_track].push({
                time_offset,
                type: 'on',
                instrument,
                pitch: pitch+3,
                amplitude
            })
            tracks_events[recording_track].push({
                time_offset,
                type: 'on',
                instrument,
                pitch: pitch+7,
                amplitude
            })
        }
    } else  {
        console.log("Playing single note...");
    }

}

/**
 * Note: Concerned about what happens if the recording automatically ends at 
 * total_recording_time, as no noteOff event will be pushed to the events.
 * Might be necessary to, at the end of any playback, to noteOff on all possible
 * pitches to ensure no lingering sound.
 */
function handleNoteOff(key_number) {
    // Find the pitch
    let lowest_pitch = parseInt($("#pitch").val());
    let pitch = lowest_pitch + key_number;
    /*
     * You need to use the slider to get the lowest pitch number above
     * rather than the hardcoded value
     */

    // Time offset to be stored in track data if we are recording
    let time_offset = performance.now() - recording_start_time
    // Need to keep track of the instrument being played for recording and playback.
    let instrument = parseInt($("#instrument").val());
    // When recording, push noteOff event data to the appropriate track.
    if (is_recording) {
        tracks_events[recording_track].push({
            time_offset,
            type: 'off',
            instrument,
            pitch,
            amplitude
        })
    }

    // Send the note off message for the pitch
    MIDI.noteOff(0, pitch); 


    /*
     * You need to handle the chord mode here
     */
    let playmode = $(":radio[name=playmode]:checked").val()
    if(playmode==="major") {
        MIDI.noteOff(0, pitch+4);
        MIDI.noteOff(0, pitch+7);
        if (is_recording) {
            tracks_events[recording_track].push({
                time_offset,
                type: 'off',
                instrument,
                pitch: pitch+4,
                amplitude
            })
            tracks_events[recording_track].push({
                time_offset,
                type: 'off',
                instrument,
                pitch: pitch+7,
                amplitude
            })
        }
    } else if(playmode === "minor") {
        MIDI.noteOff(0, pitch+3);
        MIDI.noteOff(0, pitch+7);
        if (is_recording) {
            tracks_events[recording_track].push({
                time_offset,
                type: 'off',
                instrument,
                pitch: pitch+3,
                amplitude
            })
            tracks_events[recording_track].push({
                time_offset,
                type: 'off',
                instrument,
                pitch: pitch+7,
                amplitude
            })
        }
    } else  {
        return;
    }

}

function handlePianoMouseDown(evt) {
    // Determine which piano key has been clicked on
    // evt.target tells us which item triggered this function
    // The piano key number is extracted from the key id (0-23)
    let key_number = $(evt.target).attr("id").substring(4);
    key_number = parseInt(key_number);

    // Start the note
    handleNoteOn(key_number);

    // Select the key
    $("#key-" + key_number).focus();

    // Show a simple message in the console
    console.log("Piano mouse down event for key " + key_number + "!");

    // Remember the key number
    last_mouse_key_number = key_number;
}

function handlePianoMouseUp(evt) {
    // last_key_number is used because evt.target does not necessarily
    // equal to the key that has been clicked on 
    if (last_mouse_key_number < 0) return;
    
    // Stop the note
    handleNoteOff(last_mouse_key_number);

    // De-select the key
    $("#key-" + last_mouse_key_number).blur();

    // Show a simple message in the console
    console.log("Piano mouse up event for key " + last_mouse_key_number + "!");

    // Reset the key number
    last_mouse_key_number = -1;
}

function handlePageKeyDown(evt) {
    // Exit the function if the key is not a piano key
    // evt.key tells us the key that has been pressed
    if (!(evt.key in key_mapping)) return;
    
    // Find the key number of the key that has been pressed
    let key_number = key_mapping[evt.key];
    if (key_down_status[key_number]) return;

    // Start the note
    handleNoteOn(key_number);

    // Select the key
    $("#key-" + key_number).focus();

    // Show a simple message in the console
    console.log("Page key down event for key " + key_number + "!");

    // Remember the key is down
    key_down_status[key_number] = true;
}

function handlePageKeyUp(evt) {
    // Exit the function if the key is not a piano key
    // evt.key tells us the key that has been released
    if (!(evt.key in key_mapping)) return;
    
    // Find the key number of the key that has been released
    let key_number = key_mapping[evt.key];

    // Stop the note
    handleNoteOff(key_number);

    // De-select the key
    $("#key-" + key_number).blur();

    // Show a simple message in the console
    console.log("Page key up event for key " + key_number + "!");

    // Reset the key status
    key_down_status[key_number] = false;
}
// playback
function play_recording() {
    const context = MIDI.getContext();
    // this context.resume() must run once before playback logic.
    // Otherwise, the noteOff() calls don't seem to work.
    context.resume().then(() => {
    // identify tracks to play.
        let checkedValues = $("input[id='play-track-check']:checked").map(function() {
            return $(this).val();
        }).get();
        // checkedValues is an array of checked values, e.g. ["0", "2"]
        // console.log(checkedValues); // debug
        for (let track = 0; track < checkedValues.length; ++track) {
            checkedValues[track] = parseInt(checkedValues[track]);
        }
        // Now checkedValues is an array of checked values in int e.g. [0, 2].
        // console.log(checkedValues); // debug
        // Now play all tracks at once.
        checkedValues.forEach(trackIndex => {
            // For each event in the track...
            tracks_events[trackIndex].forEach(event => {

                // NOTE: need to implement instrument change feature.
                
                // const new_instrument = event.instrument;
                // console.log("Changing instrument to %i...", new_instrument);
                // MIDI.programChange(0,new_instrument);
                const delay = event.time_offset / 1000; // Convert ms to seconds
                //debug
                // console.log(typeof performance, performance);
                // console.log(typeof performance.now, performance.now);
                // console.log(performance.now());
                // console.log("event.time_offset : %i", event.time_offset);
                // console.log("delay : %i", delay); //debug
                if (event.type === 'on') {
                    MIDI.noteOn(0, event.pitch, event.amplitude, delay);
                    // console.log("noteOn", event.pitch, "at", delay); // debug
                } else {
                    MIDI.noteOff(0, event.pitch, delay);
                    // console.log("noteOff", event.pitch, "at", delay); // debug
                }
            });
        });
    });
}
function stop_recording() {
    is_recording = false;
    $("#record").prop("disabled", false);
    $("#stop, #play").prop("disabled", false);
    console.log(tracks_events)
    clearTimeout(recording_timeout); // Cancel auto-stop timer
}


/*
 * You need to write an event handling function for the instrument
 */
$("#instrument").on("change", function() {
    let new_instrument = parseInt($("#instrument").val());
    console.log("Changing instrument to %i...", new_instrument);
    MIDI.programChange(0,new_instrument);
})

$(document).ready(function() {
    MIDI.loadPlugin({
        soundfontUrl: "./midi-js/soundfont/",
        instruments: [
            "trumpet"
            /*
             * You can preload the instruments here if you add the instrument
             * name in the list here
             */
        ],
        onprogress: function(state, progress) {
            console.log(state, progress);
        },
        onsuccess: function() {
            // Resuming the AudioContext when there is user interaction
            $("body").click(function() {
                if (MIDI.getContext().state != "running") {
                    MIDI.getContext().resume().then(function() {
                        console.log("Audio Context is resumed!");
                    });
                }
            });

            // Hide the loading text and show the container
            $(".loading").hide();
            $(".container").show();

            // At this point the MIDI system is ready
            MIDI.setVolume(0, 127);     // Set the volume level
            MIDI.programChange(0, 56);  // Use the General MIDI 'trumpet' number

            // Set up the event handlers for all the buttons
            $(".white-key").on("mousedown", handlePianoMouseDown);
            $(".black-key").on("mousedown", handlePianoMouseDown);
            $(".white-key").on("mouseup", handlePianoMouseUp);
            $(".black-key").on("mouseup", handlePianoMouseUp);

            // Set up key events
            $(document).keydown(handlePageKeyDown);
            $(document).keyup(handlePageKeyUp);

            // Set up recording logic.
            $("#record").click(() => {
                is_recording = true;
                recording_track = parseInt($("#track-select").val());
                tracks_events[recording_track].length = 0;
                // note performance.now() returns time in milliseconds.
                recording_start_time = performance.now();
                BPM = parseInt($("#bpm").val());
                // total_recording_time is in seconds right now.
                // Note that setTimeout receives in ms.
                total_recording_time = (60 / BPM) * 16;

                //debug
                console.log("is_recording: %b", is_recording);
                console.log("BPM: %i", BPM);
                console.log("total_recording_time: %i", total_recording_time);
                // 
                recording_timeout = setTimeout(() => {
                    stop_recording();
                    console.log("Recording stopped automatically after", total_recording_time, "seconds");
                }, total_recording_time * 1000); // Convert seconds to milliseconds
            
                $("#record").prop("disabled", true);
                $("#stop, #play").prop("disabled", false);
            });
            
            $("#stop").click(stop_recording);
            
            $("#play").click(play_recording);
              


            /*
             * You need to set up the event for the instrument 
             */
        }
    });
});
