# COMP4431-MIDI-Project

List of features added from lab01:

- UI:
  - Record, Start, Stop buttons
  - BPM Slider
  - Dropdown box to select which track to record to
  - Checkbox for which tracks to play in playback
- Functionalities:
  - All added UI elements work correctly at this time.
  - Recording and playback features also work correctly when playing with major and minor chords.
  - Recording automatically times out according to calculated max recording time ((60/BPM) \* 16)
    - This does raise a concern about what happens to notes that were 'on' when max recording time is reached

Features to add (for now):

- Metronome
- Save correct instrument information during recording
- Play back correct instrument as in recording
- Change instrument of recorded tracks after recording.
- Change tempo of recording
- **Timeline visualization**
- UI element cleanup (All these are very rudimentary atm, and are purely for function testing.)
  - Start recording, play, stop buttons
  - BPM
  - Select track to record
  - Clear track
