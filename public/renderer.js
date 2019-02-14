(function() {
  'use strict';
  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext('2d');
  var listening = true;

  window.Waveform = function() {

    var clearCanvas = function() {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      listening = false;
    };

    var prepCanvas = function() {
      listening = true;
    };

    var visualizeAudioBuffer = function(dataArray, bufferLength) {
      var WIDTH = canvas.width;
      var HEIGHT = canvas.height;
      var animationId;
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      function draw() {
        if (!listening) {
          return;
        }

        canvasCtx.fillStyle = 'rgb(249,250,252)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.lineWidth = 1;
        canvasCtx.strokeStyle = 'rgb(0,125,188)';
        canvasCtx.beginPath();

        var sliceWidth = WIDTH * 1.0 / bufferLength;
        var x = 0;

        for (var i = 0; i < bufferLength; i++) {
          var v = dataArray[i] / 128.0;
          var y = v * HEIGHT / 2;
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      }

      if (typeof animationId === 'undefined') {
        animationId = requestAnimationFrame(draw);
      }
    };
    return {
      clearCanvas: clearCanvas,
      prepCanvas: prepCanvas,
      visualizeAudioBuffer: visualizeAudioBuffer
    };
  };
})();
