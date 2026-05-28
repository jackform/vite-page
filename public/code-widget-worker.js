/**
 * Web Worker with Pyodide + webtkinter widget support.
 *
 * Same Pyodide execution as code-worker.js, plus:
 * 1. A webtkinter Python module that provides tkinter-like widgets
 * 2. Widget commands are collected during execution and sent to main thread
 * 3. User widget events (clicks) are forwarded back to Python callbacks
 *
 * Placed in public/ so it's served as-is (classic worker using importScripts).
 */

let pyodide = null;
let ready = false;

// Load Pyodide from CDN on worker start
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

/**
 * The webtkinter Python module, embedded as a string.
 * Written to Pyodide's virtual filesystem at init time so user code can
 * `import webtkinter` and use Button, Label, Entry, etc.
 */
const WEBTKINTER_CODE = `
# webtkinter — tkinter-style widgets rendered as HTML in the output panel.
#
# Widgets queue creation commands during execution. After the Python code
# finishes, the worker sends these commands to the main thread which renders
# the actual DOM elements.

import js

_widget_commands = []
_widget_next_id = 1
_event_handlers = {}

def _next_id():
    global _widget_next_id
    i = _widget_next_id
    _widget_next_id += 1
    return i

def _get_widget_commands():
    global _widget_commands
    cmds = _widget_commands[:]
    _widget_commands = []
    return cmds

def _handle_event(widget_id, event_type):
    handler = _event_handlers.get(widget_id)
    if handler:
        handler()

class Widget:
    def __init__(self, widget_type, **props):
        self._id = _next_id()
        self._type = widget_type
        self._props = props
        self._layout = {}

    def pack(self, side='top', fill=None, padx=0, pady=0):
        self._layout = {'side': side, 'fill': fill, 'padx': padx, 'pady': pady}
        _widget_commands.append({
            'cmd': 'create',
            'id': self._id,
            'type': self._type,
            'props': self._props,
            'layout': self._layout,
        })
        return self

    def destroy(self):
        _widget_commands.append({'cmd': 'destroy', 'id': self._id})


class Button(Widget):
    def __init__(self, text="Button", command=None):
        super().__init__('button', text=text)
        if command:
            _event_handlers[self._id] = command


class Label(Widget):
    def __init__(self, text=""):
        super().__init__('label', text=str(text))


class Entry(Widget):
    def __init__(self, placeholder=""):
        super().__init__('entry', placeholder=placeholder)

    @property
    def value(self):
        # The main thread stores the current value on the element
        # and sends it back when queried.
        # For simplicity, we use js to access the DOM directly.
        return js.document.getElementById('widget-' + str(self._id)).value if js.document else ''


class Text(Widget):
    def __init__(self, text=""):
        super().__init__('text', text=str(text))
`;

async function init() {
  try {
    pyodide = await loadPyodide();

    // Write webtkinter.py to Pyodide's virtual filesystem so
    // `import webtkinter` works in user code.
    pyodide.FS.writeFile('webtkinter.py', WEBTKINTER_CODE);

    // Preload science packages for convenience
    self.postMessage({ type: 'progress', stage: 'packages' });
    await pyodide.loadPackage(['numpy', 'pandas', 'scikit-learn', 'scipy']);

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
      // Prepend the webtkinter import so user code can use the widgets
      const fullCode = 'import webtkinter\n' + msg.code;

      // Collect widget commands after execution
      const wrappedCode =
        fullCode +
        '\n_widgets = webtkinter._get_widget_commands()\n';

      await pyodide.runPythonAsync(wrappedCode);

      // Retrieve the collected widget commands
      // Use dict_converter to convert Python dicts → plain JS objects
      // (default Map is not structured-cloneable for postMessage)
      const widgets = pyodide.globals.get('_widgets').toJs({ dict_converter: Object.fromEntries });
      pyodide.globals.delete('_widgets');

      const execTime = Math.round(performance.now() - startTime);

      self.postMessage({
        type: 'result',
        status: 'success',
        stdout: stdout,
        stderr: stderr,
        executionTime: execTime,
        widgets: widgets,
      });
    } catch (err) {
      const execTime = Math.round(performance.now() - startTime);
      self.postMessage({
        type: 'result',
        status: 'error',
        stdout: stdout,
        stderr: stderr,
        error: err.message || String(err),
        executionTime: execTime,
      });
    }
  }

  if (msg.type === 'widget:event') {
    if (!ready || !pyodide) return;

    let stdout = '';
    let stderr = '';

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

    try {
      await pyodide.runPythonAsync(
        'import webtkinter\n' +
        'webtkinter._handle_event(' + msg.widgetId + ', "' + msg.event + '")\n'
      );

      self.postMessage({
        type: 'callback:result',
        status: 'success',
        stdout: stdout,
        stderr: stderr,
        widgetId: msg.widgetId,
      });
    } catch (err) {
      self.postMessage({
        type: 'callback:result',
        status: 'error',
        stdout: stdout,
        stderr: err.message || String(err),
        widgetId: msg.widgetId,
      });
    }
  }
};

init();
