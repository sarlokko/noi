/**
 * Usa TensorFlow.js CPU (puro JavaScript) al posto di tfjs-node (modulo nativo).
 * Va caricato PRIMA di @vladmandic/face-api.
 */

const Module = require("module");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "@tensorflow/tfjs-node") {
    return require.resolve("@tensorflow/tfjs");
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const tf = require("@tensorflow/tfjs");
require("@tensorflow/tfjs-backend-cpu");

let ready = null;

function ensureBackend() {
  if (!ready) {
    ready = (async () => {
      await tf.setBackend("cpu");
      await tf.ready();
    })();
  }
  return ready;
}

module.exports = { tf, ensureBackend };
