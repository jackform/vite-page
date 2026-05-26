import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

/**
 * Wraps a CodeMirror 6 editor instance.
 *
 * The rest of the app interacts with the editor exclusively through
 * this class — never touching CodeMirror APIs directly. This keeps
 * the editor implementation replaceable.
 */
export class CodeEditor {
  private view: EditorView;
  private onChangeCallback: ((code: string) => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    container: HTMLElement,
    initialCode: string,
    readOnly = false
  ) {
    const extensions = [
      basicSetup,
      python(),
      oneDark,
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && this.onChangeCallback) {
          this.debouncedNotify(this.onChangeCallback);
        }
      }),
    ];

    if (readOnly) {
      extensions.push(EditorView.editable.of(false));
    }

    this.view = new EditorView({
      state: EditorState.create({
        doc: initialCode,
        extensions,
      }),
      parent: container,
    });
  }

  /** Get the current editor content. */
  getCode(): string {
    return this.view.state.doc.toString();
  }

  /** Replace the entire editor content (e.g., loading a new problem or remote update). */
  setCode(code: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: code,
      },
    });
  }

  /**
   * Register a callback for code changes.
   * The callback is debounced at 300ms to avoid excessive firing
   * during rapid typing and to batch network syncs in the future.
   */
  onChange(callback: (code: string) => void): void {
    this.onChangeCallback = callback;
  }

  /** Destroy the editor and clean up resources. */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.view.destroy();
  }

  private debouncedNotify(callback: (code: string) => void): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      callback(this.getCode());
    }, 300);
  }
}
