'use strict';

/*global window, document */
/*jslint bitwise: true */

/* Main code entry point */

var chime = (function() {

    var audioContext, frequencyLookup, HAMMING_CODES, NOTE_REGEX, BIT_RISE, BIT_FALL, LOW_BIT_SUSTAIN, HIGH_BIT_SUSTAIN, START_STOP_BIT_SUSTAIN, CARRIER_FREQUENCY, NUMBER_OF_START_AND_STOP_BITS, NOTE_RISE_DURATION, NOTE_FALL_DURATION, NOTE_LONG_FALL_DURATION;

    /* Constants */

    CARRIER_FREQUENCY = 18000;

    BIT_RISE = 0.0005;
    BIT_FALL = 0.0005;

    LOW_BIT_SUSTAIN = 0.004;
    HIGH_BIT_SUSTAIN = 0.009;
    START_STOP_BIT_SUSTAIN = 0.0065;

    NUMBER_OF_START_AND_STOP_BITS = 8;

    NOTE_RISE_DURATION = 0.030;
    NOTE_FALL_DURATION = 0.030;
    NOTE_LONG_FALL_DURATION = 0.090;

    NOTE_REGEX = /^(C|C#|Db|D|D#|Eb|E|F|F#|Gb|G|G#|Ab|A|A#|Bb|B)([0-9]):([1-9])$/i;

    HAMMING_CODES = [
        [0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 0, 0, 0, 0],
        [1, 0, 0, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 0, 0],
        [0, 1, 0, 1, 0, 1, 0],
        [1, 0, 1, 1, 0, 1, 0],
        [1, 1, 0, 0, 1, 1, 0],
        [0, 0, 1, 0, 1, 1, 0],
        [1, 1, 0, 1, 0, 0, 1],
        [0, 0, 1, 1, 0, 0, 1],
        [0, 1, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 1, 1],
        [0, 1, 1, 0, 0, 1, 1],
        [0, 0, 0, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1]
    ];

    /* Functions to calculate CRC code */

    function crc_update(crc_in, incr) {

        var xor, out, CRC_POLY = 0x1021;

        xor = (crc_in >> 15) & 65535;
        out = (crc_in << 1) & 65535;

        if (incr > 0) {
            out += 1;
        }

        if (xor > 0) {
            out ^= CRC_POLY;
        }

        return out;

    }

    function crc16(bytes) {

        var i, j, low, high, crc = 0;

        for (i = 0; i < bytes.length; i += 1) {
            for (j = 7; j >= 0; j -= 1) {
                crc = crc_update(crc, bytes[i] & (1 << j));
            }
        }

        for (i = 0; i < 16; i += 1) {
            crc = crc_update(crc, 0);
        }

        low = crc & 255;
        high = (crc >> 8) & 255;

        return [low, high];

    }
    
    /* Function to encode bytes */

    function encode(bytes) {

        var i, j, low, high, bitSequence = [];

        for (i = 0; i < bytes.length; i += 1) {

            low = bytes[i] & 0x0F;

            high = (bytes[i] & 0xFF) >> 4;

            for (j = 0; j < 7; j += 1) {

                bitSequence.push(HAMMING_CODES[low][j]);

                bitSequence.push(HAMMING_CODES[high][j]);

            }

        }

        return bitSequence;

    }

    /* Functions to parse and generate notes */

    function generateFrequencyLookup() {

        var i, j, note, NOTE_PREFIXES, NOTE_DISTANCES, NUMBER_OF_OCTAVES, frequencyLookup = {};

        NUMBER_OF_OCTAVES = 10;

        NOTE_PREFIXES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

        NOTE_DISTANCES = [-9, -8, -8, -7, -6, -6, -5, -4, -3, -3, -2, -1, -1, 0, 1, 1, 2];

        for (i = 0; i < NUMBER_OF_OCTAVES; i += 1) {
            for (j = 0; j < NOTE_PREFIXES.length; j += 1) {
                note = NOTE_PREFIXES[j] + i;
                frequencyLookup[note.toLowerCase()] = Math.round(440 * Math.pow(2, i - 4 + NOTE_DISTANCES[j] / 12));
            }
        }

        return frequencyLookup;

    }

    function parseFrequencies(notes) {

        var i, result, frequencies = [];

        for (i = 0; i < notes.length; i += 1) {
            result = notes[i].match(NOTE_REGEX);
            if (result) frequencies.push(frequencyLookup[result[1].toLowerCase() + result[2]]);
        }

        if (frequencies.length > 0) return frequencies;

        return [256];

    }

    function parseDurations(notes) {

        var i, result, durations = [];

        for (i = 0; i < notes.length; i += 1) {
            result = notes[i].match(NOTE_REGEX);
            if (result) durations.push(parseInt(result[3], 10));
        }

        if (durations.length > 0) return durations;

        return [1];

    }

    /* Functions to generate waveforms */

    function createWaveformComponent(waveform, state, frequency, phase, rampUp, sustain, rampDown) {

        var k, x, y, theta, volume, samplesInRampUp, samplesInSustain, samplesInRampDown;

        samplesInRampUp = rampUp * audioContext.sampleRate;

        samplesInSustain = sustain * audioContext.sampleRate;

        samplesInRampDown = rampDown * audioContext.sampleRate;

        theta = 2 * Math.PI * frequency / audioContext.sampleRate;

        for (k = 0; k < samplesInRampUp + samplesInSustain + samplesInRampDown; k += 1) {

            if (k < samplesInRampUp) {

                state.amplitudePhase = Math.min(Math.PI / 2, state.amplitudePhase + Math.PI / 2 / samplesInRampUp);

            }

            if (k >= samplesInRampUp + samplesInSustain) {

                state.amplitudePhase = Math.max(0, state.amplitudePhase - Math.PI / 2 / samplesInRampDown);

            }

            volume = Math.pow(Math.sin(state.amplitudePhase), 2);

            waveform.push(volume * phase * state.x);

            x = state.x * Math.cos(theta) - state.y * Math.sin(theta);
            y = state.x * Math.sin(theta) + state.y * Math.cos(theta);

            state.x = x;
            state.y = y;

        }

    }

    function createWaveform(bytes, notes) {

        var i, bytes, phase, duration, state, bitSequence, duration, durations, sumOfDurations, frequencies, waveform, waveform1, waveform2;

        waveform = [];

        waveform1 = [];

        waveform2 = [];

        /* Generate bit sequence */

        bytes = bytes.concat(crc16(bytes));

        bitSequence = encode(bytes);

        /* Display output */

        console.log("AUDIOMOTH CHIME: " + bytes.length + " bytes");

        console.log("AUDIOMOTH CHIME: " + bitSequence.length + " bits");

        /* Counters used during sound wave creation */

        state = {
            amplitudePhase: 0,
            x: 1,
            y: 0
        };

        phase = 1;

        /* Initial start bits */

        for (i = 0; i < NUMBER_OF_START_AND_STOP_BITS; i += 1) {

            createWaveformComponent(waveform1, state, CARRIER_FREQUENCY, phase, BIT_RISE, START_STOP_BIT_SUSTAIN, BIT_FALL);

            phase *= -1;

        }

        /* Data bits */

        for (i = 0; i < bitSequence.length; i += 1) {

            duration = bitSequence[i] === 1 ? HIGH_BIT_SUSTAIN : LOW_BIT_SUSTAIN;

            createWaveformComponent(waveform1, state, CARRIER_FREQUENCY, phase, BIT_RISE, duration, BIT_FALL);

            phase *= -1;

        }

        /* Stop bits */

        for (i = 0; i < NUMBER_OF_START_AND_STOP_BITS; i += 1) {
        
            createWaveformComponent(waveform1, state, CARRIER_FREQUENCY, phase, BIT_RISE, START_STOP_BIT_SUSTAIN, BIT_FALL);

            phase *= -1;

        }

        /* Counters used during sound wave creation */

        state = {
            amplitudePhase: 0,
            x: 1,
            y: 0
        };

        /* Parse notes */

        durations = parseDurations(notes);

        frequencies = parseFrequencies(notes);

        sumOfDurations = 0;

        for (i = 0; i < durations.length; i += 1) sumOfDurations += durations[i];

        duration = waveform1.length / audioContext.sampleRate - durations.length * (NOTE_RISE_DURATION + NOTE_FALL_DURATION) + NOTE_FALL_DURATION - NOTE_LONG_FALL_DURATION;

        duration /= sumOfDurations;

        for (i = 0; i < durations.length - 1; i += 1) {

            createWaveformComponent(waveform2, state, frequencies[i], 1, NOTE_RISE_DURATION, duration * durations[i], NOTE_FALL_DURATION);

        }

        createWaveformComponent(waveform2, state, frequencies[durations.length - 1], 1, NOTE_RISE_DURATION, duration * durations[durations.length - 1], NOTE_LONG_FALL_DURATION);

        /* Sum the waveforms */

        for (i = 0; i < Math.min(waveform1.length, waveform2.length); i += 1) {

            waveform.push(waveform1[i] / 4 + waveform2[i] / 2);
        
        }

        return waveform;

    }

    /* Code entry point */

    frequencyLookup = generateFrequencyLookup();

    return function(bytes, notes, callback) {

        var i, source, buffer, channel, waveform;
    
        function onended() {
    
            console.log("AUDIOMOTH CHIME: Done");

            callback();
    
        }
    
        function perform() {
    
            console.log("AUDIOMOTH CHIME: Start");

            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

            if (audioContext.state === 'suspended') audioContext.resume();

            waveform = createWaveform(bytes, notes);

            buffer = audioContext.createBuffer(1, waveform.length, audioContext.sampleRate);

            channel = buffer.getChannelData(0);
        
            for (i = 0; i < waveform.length; i += 1) {
    
                channel[i] = waveform[i];
    
            }
    
            source = audioContext.createBufferSource();
    
            source.buffer = buffer;
    
            source.onended = onended;
    
            source.connect(audioContext.destination);
    
            source.start();  

        }

        /* Play the sound */

        setTimeout(perform, 200);

    };

})();