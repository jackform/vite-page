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
#
# tkinter compatibility: all params are accepted (stored in _props).
# Supported params are rendered by the JS side; unsupported params are
# silently ignored. See WEBTKINTER_GAPS.md for details.

import js

_widget_commands = []
_widget_next_id = 1
_event_handlers = {}  # key: (widget_id, event_type_str)
_input_values = {}  # current DOM values synced from main thread on each event

END = "end"


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
    handler = _event_handlers.get((widget_id, event_type))
    if not handler:
        return
    # Try calling with no args, then with None if that fails.
    # Catch ALL exceptions to avoid breaking the callback protocol.
    try:
        handler()
    except Exception:
        try:
            handler(None)
        except Exception:
            pass


def _get_element(widget_id):
    """Get DOM element by widget id, or None if not yet rendered."""
    try:
        doc = js.document
        if doc:
            return doc.getElementById('widget-' + str(widget_id))
    except Exception:
        pass
    return None


def _serialize_font(font_spec):
    """Convert tkinter font tuple to CSS-compatible string."""
    if isinstance(font_spec, str):
        return font_spec
    if isinstance(font_spec, (list, tuple)):
        parts = list(font_spec)
        family = str(parts[0]) if len(parts) > 0 else 'sans-serif'
        size = str(parts[1]) + 'px' if len(parts) > 1 else '12px'
        weight = 'bold' if len(parts) > 2 and parts[2] == 'bold' else 'normal'
        return weight + " " + size + " '" + family + "'"
    return str(font_spec)


def _emit_create(widget):
    """Emit a create command for a widget."""
    cmd = {
        'cmd': 'create',
        'id': widget._id,
        'type': widget._type,
        'props': widget._props.copy(),
        'layout': widget._layout.copy() if widget._layout else {},
    }
    if widget._parent_id is not None:
        cmd['parentId'] = widget._parent_id
    _widget_commands.append(cmd)


# ============================================================
# Widget base class
# ============================================================

class Widget:
    def __init__(self, widget_type, parent=None, **props):
        self._id = _next_id()
        self._type = widget_type
        self._props = {}
        self._layout = {}
        self._parent_id = parent._id if parent is not None else None
        # Merge known params + any extra kwargs
        for k, v in props.items():
            self._props[k] = v

    def pack(self, side='top', fill=None, padx=0, pady=0, **kwargs):
        self._layout = {
            'type': 'pack',
            'side': side,
            'fill': fill,
            'padx': padx,
            'pady': pady,
        }
        _emit_create(self)
        return self

    def grid(self, row=0, column=0, padx=0, pady=0, **kwargs):
        self._layout = {
            'type': 'grid',
            'row': row,
            'column': column,
            'padx': padx,
            'pady': pady,
        }
        # Store extra grid opts for future use
        for k, v in kwargs.items():
            self._layout[k] = v
        _emit_create(self)
        return self

    def configure(self, **kwargs):
        for k, v in kwargs.items():
            self._props[k] = str(v) if not isinstance(v, str) else v
        _widget_commands.append({
            'cmd': 'configure',
            'id': self._id,
            'props': self._props.copy(),
        })

    def config(self, **kwargs):
        self.configure(**kwargs)

    def bind(self, event_name, callback):
        event_map = {
            '<Button-1>': 'click',
            '<Button-2>': 'contextmenu',
            '<Button-3>': 'contextmenu',
            '<Enter>': 'mouseenter',
            '<Leave>': 'mouseleave',
        }
        web_event = event_map.get(event_name, event_name)
        _event_handlers[(self._id, web_event)] = callback

    def destroy(self):
        _widget_commands.append({'cmd': 'destroy', 'id': self._id})
        # Clean up event handlers for this widget
        keys_to_del = [k for k in _event_handlers if k[0] == self._id]
        for k in keys_to_del:
            del _event_handlers[k]


# ============================================================
# Tk — root window
# ============================================================

class Tk(Widget):
    def __init__(self, screenName=None, baseName=None, className='Tk', useTk=1, sync=0, use=None):
        super().__init__('root', parent=None)
        self._id = 0  # Root always has id 0
        self._props['title'] = 'tk'
        _emit_create(self)

    def title(self, text=None):
        if text is not None:
            self._props['title'] = str(text)
            _widget_commands.append({
                'cmd': 'configure',
                'id': 0,
                'props': {'title': str(text)},
            })

    def geometry(self, geom):
        self._props['geometry'] = str(geom)

    def mainloop(self):
        pass  # No event loop in web context


# ============================================================
# Toplevel — popup window
# ============================================================

class Toplevel(Widget):
    def __init__(self, parent=None, **kwargs):
        super().__init__('toplevel', parent=parent, **kwargs)
        self._props['title'] = 'Toplevel'

    def title(self, text=None):
        if text is not None:
            self._props['title'] = str(text)

    def geometry(self, geom):
        self._props['geometry'] = str(geom)

    def mainloop(self):
        pass


# ============================================================
# Frame — plain container
# ============================================================

class Frame(Widget):
    def __init__(self, parent=None, **kwargs):
        super().__init__('frame', parent=parent, **kwargs)


# ============================================================
# LabelFrame — labeled container
# ============================================================

class LabelFrame(Widget):
    def __init__(self, parent=None, **kwargs):
        super().__init__('labelframe', parent=parent, **kwargs)


# ============================================================
# Label
# ============================================================

class Label(Widget):
    def __init__(self, parent=None, text="", font=None, bg=None, fg=None,
                 justify=None, **kwargs):
        props = {'text': str(text)}
        if font:
            props['font'] = _serialize_font(font)
        if bg:
            props['bg'] = str(bg)
        if fg:
            props['fg'] = str(fg)
        if justify:
            props['justify'] = str(justify)
        props.update(kwargs)
        super().__init__('label', parent=parent, **props)


# ============================================================
# Button
# ============================================================

class Button(Widget):
    def __init__(self, parent=None, text="Button", font=None, command=None,
                 bg=None, fg=None, width=None, **kwargs):
        props = {'text': str(text)}
        if font:
            props['font'] = _serialize_font(font)
        if bg:
            props['bg'] = str(bg)
        if fg:
            props['fg'] = str(fg)
        if width is not None:
            props['width'] = str(width)
        props.update(kwargs)
        super().__init__('button', parent=parent, **props)
        if command:
            _event_handlers[(self._id, 'click')] = command


# ============================================================
# Entry — single-line text input
# ============================================================

class Entry(Widget):
    def __init__(self, parent=None, font=None, width=None, justify=None,
                 placeholder="", **kwargs):
        props = {'placeholder': str(placeholder)}
        if font:
            props['font'] = _serialize_font(font)
        if width is not None:
            props['width'] = str(width)
        if justify:
            props['justify'] = str(justify)
        props.update(kwargs)
        super().__init__('entry', parent=parent, **props)

    def insert(self, pos, text):
        el = _get_element(self._id)
        if el and js.document:
            el.value = str(text) + el.value if str(pos) == '0' or pos == 0 else el.value + str(text)
        else:
            current = self._props.get('value', '')
            self._props['value'] = current + str(text)
            _widget_commands.append({
                'cmd': 'configure', 'id': self._id,
                'props': {'value': self._props['value']},
            })

    def get(self):
        sid = str(self._id)
        if sid in _input_values:
            return _input_values[sid]
        return self._props.get('value', '')

    def delete(self, pos1, pos2=None):
        el = _get_element(self._id)
        if el and js.document:
            el.value = ''
        else:
            self._props['value'] = ''
            _widget_commands.append({
                'cmd': 'configure', 'id': self._id,
                'props': {'value': ''},
            })

    @property
    def value(self):
        return self.get()


# ============================================================
# Text — multi-line text area
# ============================================================

class Text(Widget):
    def __init__(self, parent=None, font=None, width=None, height=None,
                 bg=None, fg=None, **kwargs):
        if font:
            kwargs['font'] = _serialize_font(font)
        if width is not None:
            kwargs['width'] = str(width)
        if height is not None:
            kwargs['height'] = str(height)
        if bg:
            kwargs['bg'] = str(bg)
        if fg:
            kwargs['fg'] = str(fg)
        super().__init__('text', parent=parent, **kwargs)

    def delete(self, pos1, pos2=None):
        el = _get_element(self._id)
        if el and js.document:
            el.value = ''
        else:
            self._props['text'] = ''
            _widget_commands.append({
                'cmd': 'configure', 'id': self._id,
                'props': {'text': ''},
            })

    def insert(self, pos, text):
        el = _get_element(self._id)
        if el and js.document:
            if str(pos) in ('end', '1.0', END):
                el.value = el.value + str(text)
            else:
                el.value = str(text) + el.value
        else:
            current = self._props.get('text', '')
            self._props['text'] = current + str(text)
            _widget_commands.append({
                'cmd': 'configure', 'id': self._id,
                'props': {'text': self._props['text']},
            })

    def get(self, pos1, pos2=None):
        sid = str(self._id)
        if sid in _input_values:
            return _input_values[sid]
        return self._props.get('text', '')


# ============================================================
# messagebox
# ============================================================

class _MessageBox:
    @staticmethod
    def showwarning(title, message):
        _widget_commands.append({
            'cmd': 'messagebox',
            'messageboxType': 'showwarning',
            'title': str(title),
            'message': str(message),
        })

    @staticmethod
    def showinfo(title, message):
        _widget_commands.append({
            'cmd': 'messagebox',
            'messageboxType': 'showinfo',
            'title': str(title),
            'message': str(message),
        })


messagebox = _MessageBox()
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
      // Rewrite tkinter imports to webtkinter so original .py files work
      let adaptedCode = msg.code
        .replace(/^import tkinter as tk\b/gm, 'import webtkinter as tk')
        .replace(/^from tkinter import messagebox\b/gm, 'from webtkinter import messagebox');

      // Prepend the webtkinter import so user code can use the widgets
      const fullCode = 'import webtkinter\n' + adaptedCode;

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

    // Sync current DOM input values into Python so Entry.get() / Text.get()
    // return what the user actually typed, not the initial _props value.
    if (msg.inputValues) {
      const setInputs = 'import webtkinter\n' +
        'webtkinter._input_values = ' + JSON.stringify(msg.inputValues) + '\n';
      await pyodide.runPythonAsync(setInputs);
    }

    try {
      await pyodide.runPythonAsync(
        'import webtkinter\n' +
        'webtkinter._handle_event(' + msg.widgetId + ', "' + msg.event + '")\n' +
        '\n_cb_widgets = webtkinter._get_widget_commands()\n'
      );

      const cbWidgets = pyodide.globals.get('_cb_widgets').toJs({ dict_converter: Object.fromEntries });
      pyodide.globals.delete('_cb_widgets');

      self.postMessage({
        type: 'callback:result',
        status: 'success',
        stdout: stdout,
        stderr: stderr,
        widgetId: msg.widgetId,
        widgets: cbWidgets,
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
