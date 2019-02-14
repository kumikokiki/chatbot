(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function () {
  'use strict';
  var rec = require('./recorder.js');
  var recorder, audioRecorder, checkAudioSupport, audioSupported, playbackSource, UNSUPPORTED = 'Audio is not supported.';

  exports.audioControl = function (options) {
    options = options || {};
    this.checkAudioSupport = options.checkAudioSupport !== false;

    var startRecording = function (onSilence, visualizer, silenceDetectionConfig) {
      onSilence = onSilence || function () { /* no op */
        };
      visualizer = visualizer || function () { /* no op */
        };
      audioSupported = audioSupported !== false;
      if (!audioSupported) {
        throw new Error(UNSUPPORTED);
      }
      recorder = audioRecorder.createRecorder(silenceDetectionConfig);
      recorder.record(onSilence, visualizer);
    };

    var stopRecording = function () {
      audioSupported = audioSupported !== false;
      if (!audioSupported) {
        throw new Error(UNSUPPORTED);
      }
      recorder.stop();
    };

    var exportWAV = function (callback, sampleRate) {
      audioSupported = audioSupported !== false;
      if (!audioSupported) {
        throw new Error(UNSUPPORTED);
      }
      if (!(callback && typeof callback === 'function')) {
        throw new Error('You must pass a callback function to export.');
      }
      sampleRate = (typeof sampleRate !== 'undefined') ? sampleRate : 16000;
      recorder.exportWAV(callback, sampleRate);
      recorder.clear();
    };

    var playHtmlAudioElement = function (buffer, callback) {
      if (typeof buffer === 'undefined') {
        return;
      }
      var myBlob = new Blob([buffer]);
      var audio = document.createElement('audio');
      var objectUrl = window.URL.createObjectURL(myBlob);
      audio.src = objectUrl;
      audio.addEventListener('ended', function () {
        audio.currentTime = 0;
        if (typeof callback === 'function') {
          callback();
        }
      });
      audio.play();
    };

    var play = function (buffer, callback) {
      if (typeof buffer === 'undefined') {
        return;
      }
      var myBlob = new Blob([buffer]);
      var fileReader = new FileReader();
      fileReader.onload = function() {
        playbackSource = audioRecorder.audioContext().createBufferSource();
        audioRecorder.audioContext().decodeAudioData(this.result, function(buf) {
          playbackSource.buffer = buf;
          playbackSource.connect(audioRecorder.audioContext().destination);
          playbackSource.onended = function(event) {
            if (typeof callback === 'function') {
              callback();
            }
          };
          playbackSource.start(0);
        });
      };
      fileReader.readAsArrayBuffer(myBlob);
    };

    var stop = function() {
      if (typeof playbackSource === 'undefined') {
        return;
      }
      playbackSource.stop();
    };

    var clear = function () {
      recorder.clear();
    };

    var supportsAudio = function (callback) {
      callback = callback || function () { /* no op */
        };
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        audioRecorder = rec.audioRecorder();
        audioRecorder.requestDevice()
          .then(function (stream) {
            audioSupported = true;
            callback(audioSupported);
          })
          .catch(function (error) {
            audioSupported = false;
            callback(audioSupported);
          });
      } else {
        audioSupported = false;
        callback(audioSupported);
      }
    };

    if (this.checkAudioSupport) {
      supportsAudio();
    }

    return {
      startRecording: startRecording,
      stopRecording: stopRecording,
      exportWAV: exportWAV,
      play: play,
      stop: stop,
      clear: clear,
      playHtmlAudioElement: playHtmlAudioElement,
      supportsAudio: supportsAudio
    };
  };
})();

},{"./recorder.js":4}],2:[function(require,module,exports){
(function() {
  'use strict';
  var AudioControl = require('./control.js').audioControl;

  var DEFAULT_LATEST = '$LATEST';
  var DEFAULT_CONTENT_TYPE = 'audio/x-l16; sample-rate=16000';
  var DEFAULT_USER_ID = 'userId';
  var DEFAULT_ACCEPT_HEADER_VALUE = 'audio/mpeg';
  var MESSAGES = Object.freeze({
    PASSIVE: 'Talk to me',
    LISTENING: 'Listening',
    SENDING: 'Sending',
    SPEAKING: 'Speaking'
  });

  var lexruntime, audioControl = new AudioControl({ checkAudioSupport: false });

  exports.conversation = function(config, onStateChange, onSuccess, onError, onAudioData) {
    var currentState;

    // Apply default values.
    this.config = applyDefaults(config);
    this.lexConfig = this.config.lexConfig;
    this.messages = MESSAGES;
    onStateChange = onStateChange || function() { /* no op */ };
    this.onSuccess = onSuccess || function() { /* no op */ };
    this.onError = onError || function() { /* no op */ };
    this.onAudioData = onAudioData || function() { /* no op */ };

    // Validate input.
    if (!this.config.lexConfig.botName) {
      this.onError('A Bot name must be provided.');
      return;
    }
    if (!AWS.config.credentials) {
      this.onError('AWS Credentials must be provided.');
      return;
    }
    if (!AWS.config.region) {
      this.onError('A Region value must be provided.');
      return;
    }

    lexruntime = new AWS.LexRuntime();

    this.onSilence = function() {
      if (config.silenceDetection) {
        audioControl.stopRecording();
        currentState.advanceConversation();
      }
    };

    this.transition = function(conversation) {
      currentState = conversation;
      var state = currentState.state;
      onStateChange(state.message);

      if (state.message === state.messages.SENDING || state.message === state.messages.SPEAKING) {
        currentState.advanceConversation();
      }

      if (state.message === state.messages.SENDING && !this.config.silenceDetection) {
        audioControl.stopRecording();
      }
    };

    this.advanceConversation = function() {
      audioControl.supportsAudio(function(supported) {
        if (supported) {
          currentState.advanceConversation();
        } else {
          onError('Audio is not supported.');
        }
      });
    };

    this.updateConfig = function(newValue) {
      this.config = applyDefaults(newValue);
      this.lexConfig = this.config.lexConfig;
    };

    this.reset = function() {
      audioControl.clear();
      currentState = new Initial(currentState.state);
    };

    currentState = new Initial(this);

    return {
      advanceConversation: this.advanceConversation,
      updateConfig: this.updateConfig,
      reset: this.reset
    };
  };

  var Initial = function(state) {
    this.state = state;
    state.message = state.messages.PASSIVE;
    this.advanceConversation = function() {
      audioControl.startRecording(state.onSilence, state.onAudioData, state.config.silenceDetectionConfig);
      state.transition(new Listening(state));
    };
  };

  var Listening = function(state) {
    this.state = state;
    state.message = state.messages.LISTENING;
    this.advanceConversation = function() {
      audioControl.exportWAV(function(blob) {
        state.audioInput = blob;
        state.transition(new Sending(state));
      });
    };
  };

  var Sending = function(state) {
    this.state = state;
    state.message = state.messages.SENDING;
    this.advanceConversation = function() {
      state.lexConfig.inputStream = state.audioInput;
      lexruntime.postContent(state.lexConfig, function(err, data) {
        if (err) {
          state.onError(err);
          state.transition(new Initial(state));
        } else {
          state.audioOutput = data;
          state.transition(new Speaking(state));
          state.onSuccess(data);
        }
      });
    };
  };

  var Speaking = function(state) {
    this.state = state;
    state.message = state.messages.SPEAKING;
    this.advanceConversation = function() {
      if (state.audioOutput.contentType === 'audio/mpeg') {
        audioControl.play(state.audioOutput.audioStream, function() {
          if (state.audioOutput.dialogState === 'ReadyForFulfillment' ||
            state.audioOutput.dialogState === 'Fulfilled' ||
            state.audioOutput.dialogState === 'Failed' ||
            !state.config.silenceDetection) {
            state.transition(new Initial(state));
          } else {
            audioControl.startRecording(state.onSilence, state.onAudioData, state.config.silenceDetectionConfig);
            state.transition(new Listening(state));
          }
        });
      } else {
        state.transition(new Initial(state));
      }
    };
  };

  var applyDefaults = function(config) {
    config = config || {};
    config.silenceDetection = config.hasOwnProperty('silenceDetection') ? config.silenceDetection : true;

    var lexConfig = config.lexConfig || {};
    lexConfig.botAlias = lexConfig.hasOwnProperty('botAlias') ? lexConfig.botAlias : DEFAULT_LATEST;
    lexConfig.botName = lexConfig.hasOwnProperty('botName') ? lexConfig.botName : '';
    lexConfig.contentType = lexConfig.hasOwnProperty('contentType') ? lexConfig.contentType : DEFAULT_CONTENT_TYPE;
    lexConfig.userId = lexConfig.hasOwnProperty('userId') ? lexConfig.userId : DEFAULT_USER_ID;
    lexConfig.accept = lexConfig.hasOwnProperty('accept') ? lexConfig.accept : DEFAULT_ACCEPT_HEADER_VALUE;
    config.lexConfig = lexConfig;

    return config;
  };

})();

},{"./control.js":1}],3:[function(require,module,exports){
(function (global){
global.LexAudio = global.LexAudio || {};
global.LexAudio.audioControl = require('./control.js').audioControl;
global.LexAudio.conversation = require('./conversation.js').conversation;
module.exports = global.LexAudio;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./control.js":1,"./conversation.js":2}],4:[function(require,module,exports){
 (function () {
  'use strict';
  var work = require('webworkify');
  var worker = work(require('./worker.js'));
  var audio_context, audio_stream;

  var recorder = function (source, silenceDetectionConfig) {

    silenceDetectionConfig = silenceDetectionConfig || {};
    silenceDetectionConfig.time = silenceDetectionConfig.hasOwnProperty('time') ? silenceDetectionConfig.time : 1500;
    silenceDetectionConfig.amplitude = silenceDetectionConfig.hasOwnProperty('amplitude') ? silenceDetectionConfig.amplitude : 0.2;

    var recording = false,
      currCallback, start, silenceCallback, visualizationCallback;

    var node = source.context.createScriptProcessor(4096, 1, 1);

    worker.onmessage = function (message) {
      var blob = message.data;
      currCallback(blob);
    };

    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: source.context.sampleRate,
      }
    });

    var record = function (onSilence, visualizer) {
      silenceCallback = onSilence;
      visualizationCallback = visualizer;
      start = Date.now();
      recording = true;
    };

    var stop = function () {
      recording = false;
    };

    var clear = function () {
      stop();
      worker.postMessage({command: 'clear'});
    };

    var exportWAV = function (callback, sampleRate) {
      currCallback = callback;
      worker.postMessage({
        command: 'export',
        sampleRate: sampleRate
      });
    };

    var analyse = function () {
      analyser.fftSize = 2048;
      var bufferLength = analyser.fftSize;
      var dataArray = new Uint8Array(bufferLength);
      var amplitude = silenceDetectionConfig.amplitude;
      var time = silenceDetectionConfig.time;

      analyser.getByteTimeDomainData(dataArray);

      if (typeof visualizationCallback === 'function') {
        visualizationCallback(dataArray, bufferLength);
      }

      for (var i = 0; i < bufferLength; i++) {
        var curr_value_time = (dataArray[i] / 128) - 1.0;
        if (curr_value_time > amplitude || curr_value_time < (-1 * amplitude)) {
          start = Date.now();
        }
      }
      var newtime = Date.now();
      var elapsedTime = newtime - start;
      if (elapsedTime > time) {
        silenceCallback();
      }
    };

    node.onaudioprocess = function (audioProcessingEvent) {
      if (!recording) {
        return;
      }
      worker.postMessage({
        command: 'record',
        buffer: [
          audioProcessingEvent.inputBuffer.getChannelData(0),
        ]
      });
      analyse();
    };

    var analyser = source.context.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;

    source.connect(analyser);
    analyser.connect(node);
    node.connect(source.context.destination);

    return {
      record: record,
      stop: stop,
      clear: clear,
      exportWAV: exportWAV
    };
  };

  exports.audioRecorder = function () {
    var requestDevice = function () {

      if (typeof audio_context === 'undefined') {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audio_context = new AudioContext();
      }

      return navigator.mediaDevices.getUserMedia({audio: true}).then(function (stream) {
        audio_stream = stream;
      });
    };

    var createRecorder = function (silenceDetectionConfig) {
      return recorder(audio_context.createMediaStreamSource(audio_stream), silenceDetectionConfig);
    };

    var audioContext = function () {
      return audio_context;
    };

    return {
      requestDevice: requestDevice,
      createRecorder: createRecorder,
      audioContext: audioContext
    };

  };
})();

},{"./worker.js":5,"webworkify":6}],5:[function(require,module,exports){
module.exports = function (self) {
  'use strict';
  var recLength = 0,
    recBuffer = [],
    recordSampleRate;

  self.addEventListener('message', function (e) {
    switch (e.data.command) {
      case 'init':
        init(e.data.config);
        break;
      case 'record':
        record(e.data.buffer);
        break;
      case 'export':
        exportBuffer(e.data.sampleRate);
        break;
      case 'clear':
        clear();
        break;
    }
  });

  function init(config) {
    recordSampleRate = config.sampleRate;
  }

  function record(inputBuffer) {
    recBuffer.push(inputBuffer[0]);
    recLength += inputBuffer[0].length;
  }

  function exportBuffer(exportSampleRate) {
    var mergedBuffers = mergeBuffers(recBuffer, recLength);
    var downsampledBuffer = downsampleBuffer(mergedBuffers, exportSampleRate);
    var encodedWav = encodeWAV(downsampledBuffer);
    var audioBlob = new Blob([encodedWav], {type: 'application/octet-stream'});
    postMessage(audioBlob);
  }

  function clear() {
    recLength = 0;
    recBuffer = [];
  }

  function downsampleBuffer(buffer, exportSampleRate) {
    if (exportSampleRate === recordSampleRate) {
      return buffer;
    }
    var sampleRateRatio = recordSampleRate / exportSampleRate;
    var newLength = Math.round(buffer.length / sampleRateRatio);
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
      var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      var accum = 0,
        count = 0;
      for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function mergeBuffers(bufferArray, recLength) {
    var result = new Float32Array(recLength);
    var offset = 0;
    for (var i = 0; i < bufferArray.length; i++) {
      result.set(bufferArray[i], offset);
      offset += bufferArray[i].length;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset += 2) {
      var s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 32 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, recordSampleRate, true);
    view.setUint32(28, recordSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);

    return view;
  }
};

},{}],6:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn, options) {
    var wkey;
    var cacheKeys = Object.keys(cache);

    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp && exp.default === fn) {
            wkey = key;
            break;
        }
    }

    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            'function(require,module,exports){' + fn + '(self); }',
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);

    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        'function(require,module,exports){' +
            // try to call default if defined to also support babel esmodule exports
            'var f = require(' + stringify(wkey) + ');' +
            '(f.default ? f.default : f)(self);' +
        '}',
        scache
    ];

    var workerSources = {};
    resolveSources(skey);

    function resolveSources(key) {
        workerSources[key] = true;

        for (var depPath in sources[key][1]) {
            var depKey = sources[key][1][depPath];
            if (!workerSources[depKey]) {
                resolveSources(depKey);
            }
        }
    }

    var src = '(' + bundleFn + ')({'
        + Object.keys(workerSources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;

    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    var blob = new Blob([src], { type: 'text/javascript' });
    if (options && options.bare) { return blob; }
    var workerUrl = URL.createObjectURL(blob);
    var worker = new Worker(workerUrl);
    worker.objectURL = workerUrl;
    return worker;
};

},{}]},{},[3]);
