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

// We limit recording time to 4 bars in 4/4 time signature to whatever BPM the user chooses.
let total_recording_time = 0;

// Holds track currently being recorded to.
let recording_track = Recording_Track.ONE;

// Holds information on recorded MIDI events for each track
const tracks_events = [
    { events: [], recording_BPM: 0 },
    { events: [], recording_BPM: 0 },
    { events: [], recording_BPM: 0 }
];

// Recording timeout id
let recording_timeout;

// Map the key with the key number
let key_mapping = {
    // White keys of the first octave
    "z": 0, "x": 2, "c": 4, "v": 5, "b": 7, "n": 9, "m": 11,
    // Black keys of the first octave
    "s": 1, "d": 3, "g": 6, "h": 8, "j": 10,
    // White keys of the second octave
    "w": 12, "e": 14, "r": 16, "t": 17, "y": 19, "u": 21, "i": 23,
    // Black keys of the second octave
    "3": 13, "4": 15, "6": 18, "7": 20, "8": 22
}

// Signal the key is down
let key_down_status = new Array(23).fill(false);

function recordNoteOn(time_offset, pitch, amplitude, trackIndex) {
    let playmode;
    if (trackIndex === 0) {
        playmode = $(":radio[name=playmode_track_1]:checked").val();
    } else if (trackIndex === 1) {
        playmode = $(":radio[name=playmode_track_2]:checked").val();
    } else if (trackIndex === 2) {
        playmode = $(":radio[name=playmode_track_3]:checked").val();
    }
    MIDI.noteOn(trackIndex + 1, pitch, amplitude, time_offset);
    if (playmode === "major") {
        MIDI.noteOn(trackIndex + 1, pitch + 4, amplitude, time_offset);
        MIDI.noteOn(trackIndex + 1, pitch + 7, amplitude, time_offset);
    } else if (playmode === "minor") {
        MIDI.noteOn(trackIndex + 1, pitch + 3, amplitude, time_offset);
        MIDI.noteOn(trackIndex + 1, pitch + 7, amplitude, time_offset);
    }
}

function recordNoteOff(time_offset, pitch, trackIndex) {
    let playmode;
    if (trackIndex === 0) {
        playmode = $(":radio[name=playmode_track_1]:checked").val();
    } else if (trackIndex === 1) {
        playmode = $(":radio[name=playmode_track_2]:checked").val();
    } else if (trackIndex === 2) {
        playmode = $(":radio[name=playmode_track_3]:checked").val();
    }
    MIDI.noteOff(trackIndex + 1, pitch, time_offset);
    if (playmode === "major") {
        MIDI.noteOff(trackIndex + 1, pitch + 4, time_offset);
        MIDI.noteOff(trackIndex + 1, pitch + 7, time_offset);
    } else if (playmode === "minor") {
        MIDI.noteOff(trackIndex + 1, pitch + 3, time_offset);
        MIDI.noteOff(trackIndex + 1, pitch + 7, time_offset);
    }
}

function handleNoteOn(key_number) {
    let lowest_pitch = parseInt($("#pitch").val());
    let pitch = lowest_pitch + key_number;
    let amplitude = parseInt($("#amplitude").val());
    let time_offset = (performance.now() - recording_start_time) / 1000; // in seconds
    if (is_recording) {
        tracks_events[recording_track].events.push({
            time_offset,
            type: 'on',
            pitch,
            amplitude
        });
    }
    MIDI.noteOn(0, pitch, amplitude);
    let playmode = $(":radio[name=playmode]:checked").val();
    if (playmode === "major") {
        MIDI.noteOn(0, pitch + 4, amplitude);
        MIDI.noteOn(0, pitch + 7, amplitude);
    } else if (playmode === "minor") {
        MIDI.noteOn(0, pitch + 3, amplitude);
        MIDI.noteOn(0, pitch + 7, amplitude);
    }
}

function handleNoteOff(key_number) {
    let lowest_pitch = parseInt($("#pitch").val());
    let pitch = lowest_pitch + key_number;
    let time_offset = (performance.now() - recording_start_time) / 1000; // in seconds
    if (is_recording) {
        tracks_events[recording_track].events.push({
            time_offset,
            type: 'off',
            pitch,
            amplitude
        });
    }
    MIDI.noteOff(0, pitch);
    let playmode = $(":radio[name=playmode]:checked").val();
    if (playmode === "major") {
        MIDI.noteOff(0, pitch + 4);
        MIDI.noteOff(0, pitch + 7);
    } else if (playmode === "minor") {
        MIDI.noteOff(0, pitch + 3);
        MIDI.noteOff(0, pitch + 7);
    }
}

function handlePianoMouseDown(evt) {
    let key_number = $(evt.target).attr("id").substring(4);
    key_number = parseInt(key_number);
    handleNoteOn(key_number);
    $("#key-" + key_number).focus();
    last_mouse_key_number = key_number;
}

function handlePianoMouseUp(evt) {
    if (last_mouse_key_number < 0) return;
    handleNoteOff(last_mouse_key_number);
    $("#key-" + last_mouse_key_number).blur();
    last_mouse_key_number = -1;
}

function handlePageKeyDown(evt) {
    if (!(evt.key in key_mapping)) return;
    let key_number = key_mapping[evt.key];
    if (key_down_status[key_number]) return;
    handleNoteOn(key_number);
    $("#key-" + key_number).focus();
    key_down_status[key_number] = true;
}

function handlePageKeyUp(evt) {
    if (!(evt.key in key_mapping)) return;
    let key_number = key_mapping[evt.key];
    handleNoteOff(key_number);
    $("#key-" + key_number).blur();
    key_down_status[key_number] = false;
}

function play_recording() {
    const context = MIDI.getContext();
    context.resume().then(() => {
        let checkedValues = $("input[id='play-track-check']:checked").map(function() {
            return $(this).val();
        }).get();
        for (let track = 0; track < checkedValues.length; ++track) {
            checkedValues[track] = parseInt(checkedValues[track]);
        }
        const playing_BPM = parseInt($("#bpm_play").val());
        checkedValues.forEach(trackIndex => {
            const recording_BPM = tracks_events[trackIndex].recording_BPM;
            const scale = recording_BPM / playing_BPM;
            tracks_events[trackIndex].events.forEach(event => {
                const delay = event.time_offset * scale;
                if (event.type === 'on') {
                    recordNoteOn(delay, event.pitch, event.amplitude, trackIndex);
                } else {
                    recordNoteOff(delay, event.pitch, trackIndex);
                }
            });
        });
    });
}

function stop_recording() {
    is_recording = false;
    $("#record").prop("disabled", false);
    $("#stop, #play").prop("disabled", false);
    clearTimeout(recording_timeout);
}

$(document).ready(function() {
    MIDI.loadPlugin({
        soundfontUrl: "./midi-js/soundfont/",
        instruments: [
            "trumpet",
            "acoustic_grand_piano",
            "overdriven_guitar",
            "violin",
            "flute",
            "banjo",
            "clarinet",
            "voice_oohs",
            "choir_aahs",
            "orchestral_harp"
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
            for(var i = 0; i < 4;i++){
                MIDI.setVolume(i, 127);     //
                MIDI.programChange(i, 56);
            }

            // Set up the event handlers for all the buttons
            $(".white-key").on("mousedown", handlePianoMouseDown);
            $(".black-key").on("mousedown", handlePianoMouseDown);
            $(".white-key").on("mouseup", handlePianoMouseUp);
            $(".black-key").on("mouseup", handlePianoMouseUp);

            // Set up key events
            $(document).keydown(handlePageKeyDown);
            $(document).keyup(handlePageKeyUp);

            // Set up recording logic
            $("#record").click(() => {
                is_recording = true;
                recording_track = parseInt($("#track-select").val());
                tracks_events[recording_track].events.length = 0;
                recording_start_time = performance.now();
                BPM = parseInt($("#bpm").val());
                tracks_events[recording_track].recording_BPM = BPM;
                total_recording_time = (60 / BPM) * 16;
                recording_timeout = setTimeout(() => {
                    stop_recording();
                }, total_recording_time * 1000);
                $("#record").prop("disabled", true);
                $("#stop, #play").prop("disabled", false);
            });

            $("#stop").click(stop_recording);
            $("#play").click(play_recording);

            // Instrument change handlers
            $("#instrument").on("change", function() {
                let new_instrument = parseInt($("#instrument").val());
                MIDI.programChange(0, new_instrument);
            });

            $("#instrument_track_1").on("change", function() {
                let new_instrument = parseInt($("#instrument_track_1").val());
                MIDI.programChange(1, new_instrument);
            });

            $("#instrument_track_2").on("change", function() {
                let new_instrument = parseInt($("#instrument_track_2").val());
                MIDI.programChange(2, new_instrument);
            });

            $("#instrument_track_3").on("change", function() {
                let new_instrument = parseInt($("#instrument_track_3").val());
                MIDI.programChange(3, new_instrument);
            });
        }
    });
});