/**
 * Web Worker that loads Pyodide and executes Python code.
 *
 * This runs in a separate thread so the main UI stays responsive
 * and infinite loops can be terminated via worker.terminate().
 *
 * Placed in public/ so it's served as-is (classic worker using importScripts).
 * Vite does not process files in public/.
 */

let pyodide = null;
let ready = false;

// Load Pyodide from CDN on worker start
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

async function init() {
  try {
    pyodide = await loadPyodide();
    ready = true;
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'init-error', error: err.message || String(err) });
  }
}

self.onmessage = async function (e) {
  const msg = e.data;

  if (msg.type === 'run') {
    if (!ready || !pyodide) {
      self.postMessage({
        type: 'result',
        status: 'error',
        stdout: '',
        stderr: 'Python environment is not ready yet. Please wait.',
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    // Capture Python print() output and error output
    pyodide.setStdout({
      batched: function (text) {
        stdout += text + '\n';
      },
    });
    pyodide.setStderr({
      batched: function (text) {
        stderr += text + '\n';
      },
    });

    const startTime = performance.now();
    try {
      const result = pyodide.runPython(msg.code);
      const execTime = Math.round(performance.now() - startTime);

      let returnValue;
      if (result !== undefined && result !== null) {
        // Pyodide returns Python objects wrapped in JS proxies
        // For basic types, convert to string representation
        try {
          if (typeof result.toJs === 'function') {
            const jsResult = result.toJs();
            returnValue = JSON.stringify(jsResult);
          } else {
            returnValue = String(result);
          }
        } catch {
          returnValue = String(result);
        }
      }

      self.postMessage({
        type: 'result',
        status: 'success',
        stdout: stdout,
        stderr: stderr,
        returnValue: returnValue,
        executionTime: execTime,
      });
    } catch (err) {
      const execTime = Math.round(performance.now() - startTime);
      self.postMessage({
        type: 'result',
        status: 'error',
        stdout: stdout,
        stderr: stderr,
        // Pyodide wraps Python exceptions; the message is usually clear enough
        error: err.message || String(err),
        executionTime: execTime,
      });
    }
  }
};

init();
