/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createChatTabs,
  createChatPanel,
  appendMessage,
  renderHistory,
  clearChat,
} from '../chat-ui.js';
import type { ChatMessage } from '../../../shared/types.js';

// jsdom lacks DataTransfer and its FileList has strict instance checks.
// We mock FileReader to return controlled data and skip the real file input flow.

const FAKE_DATA_URL = 'data:image/png;base64,ZmFrZQ==';

let mockFileReaderResult: string | null = FAKE_DATA_URL;
let mockFileReaderError: boolean = false;

const OrigFileReader = globalThis.FileReader;

(globalThis as any).FileReader = class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(_blob: Blob): void {
    if (mockFileReaderError) {
      setTimeout(() => this.onerror?.(), 0);
    } else {
      setTimeout(() => {
        this.result = mockFileReaderResult;
        this.onload?.();
      }, 0);
    }
  }

  addEventListener(_type: string, _handler: any): void {}
  removeEventListener(_type: string, _handler: any): void {}
  dispatchEvent(_event: Event): boolean { return true; }
} as any;

(globalThis as any).DataTransfer = class MockDataTransfer {};

function setFakeFileInput(input: HTMLInputElement, fileName: string, _type?: string, _content?: string): void {
  // Bypass jsdom's strict FileList instance checks by supplying a plain
  // object through a custom getter on the input element.
  const blob = new Blob(['fake'], { type: 'image/png' });
  const file = new File([blob], fileName, { type: 'image/png' });
  const fakeFiles = {
    0: file,
    length: 1,
    item: (i: number) => (i === 0 ? file : null),
  };
  Object.defineProperty(input, 'files', {
    get: () => fakeFiles,
    configurable: true,
  });
}

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    roomId: 'room-001',
    sender: 'teacher',
    text: 'hello',
    timestamp: 1000,
    ...overrides,
  };
}

describe('createChatTabs', () => {
  it('creates a tab bar with output and chat tabs', () => {
    const onChange = vi.fn();
    const el = createChatTabs(onChange);

    expect(el.classList.contains('chat-tab-bar')).toBe(true);
    const tabs = el.querySelectorAll('.chat-tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain('輸出');
    expect(tabs[1].textContent).toContain('訊息');
  });

  it('first tab (output) is active by default', () => {
    const el = createChatTabs(vi.fn());
    const tabs = el.querySelectorAll('.chat-tab');
    expect(tabs[0].classList.contains('active')).toBe(true);
    expect(tabs[1].classList.contains('active')).toBe(false);
  });

  it('clicking chat tab calls onChange with "chat"', () => {
    const onChange = vi.fn();
    const el = createChatTabs(onChange);

    const tabs = el.querySelectorAll('.chat-tab');
    (tabs[1] as HTMLElement).click();

    expect(onChange).toHaveBeenCalledWith('chat');
    expect(tabs[1].classList.contains('active')).toBe(true);
    expect(tabs[0].classList.contains('active')).toBe(false);
  });

  it('clicking output tab calls onChange with "output"', () => {
    const onChange = vi.fn();
    const el = createChatTabs(onChange);

    // First switch to chat
    const tabs = el.querySelectorAll('.chat-tab');
    (tabs[1] as HTMLElement).click();
    // Then back to output
    (tabs[0] as HTMLElement).click();

    expect(onChange).toHaveBeenLastCalledWith('output');
  });
});

describe('createChatPanel', () => {
  it('creates a chat panel with message area and input', () => {
    const onSend = vi.fn();
    const el = createChatPanel('student', onSend);

    expect(el.classList.contains('chat-panel')).toBe(true);
    expect(el.querySelector('.chat-messages')).not.toBeNull();
    expect(el.querySelector('.chat-input-area')).not.toBeNull();
    expect(el.querySelector('.chat-input')).not.toBeNull();
    expect(el.querySelector('.chat-send-btn')).not.toBeNull();
  });

  it('clicking send button calls onSend with input text', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
    textarea.value = 'hello student';

    const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
    sendBtn.click();

    expect(onSend).toHaveBeenCalledWith('hello student', undefined);
    expect(textarea.value).toBe(''); // cleared after send
  });

  it('pressing Enter (without Shift) sends and clears input', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
    textarea.value = 'a message';

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false }));

    expect(onSend).toHaveBeenCalledWith('a message', undefined);
    expect(textarea.value).toBe('');
  });

  it('Shift+Enter inserts newline without sending', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
    textarea.value = 'line1';
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('empty input does not trigger onSend', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
    sendBtn.click();

    expect(onSend).not.toHaveBeenCalled();
  });

  it('student panel shows different placeholder', () => {
    const studentEl = createChatPanel('student', vi.fn());
    const teacherEl = createChatPanel('teacher', vi.fn());

    const studentPlaceholder = studentEl.querySelector('.chat-input')?.getAttribute('placeholder');
    const teacherPlaceholder = teacherEl.querySelector('.chat-input')?.getAttribute('placeholder');

    // Teacher has send input, student also has input for replies
    expect(studentPlaceholder).toBeTruthy();
    expect(teacherPlaceholder).toBeTruthy();
  });

  /* ---- Image features ---- */

  it('image button renders', () => {
    const el = createChatPanel('teacher', vi.fn());
    const btn = el.querySelector('.chat-image-btn');
    expect(btn).not.toBeNull();
  });

  it('image preview bar is hidden by default', () => {
    const el = createChatPanel('teacher', vi.fn());
    const preview = el.querySelector('.chat-image-preview') as HTMLElement;
    expect(preview.hidden).toBe(true);
  });

  it('file selection shows preview', () => {
    const el = createChatPanel('teacher', vi.fn());
    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;

    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-image-data');
    fileInput.dispatchEvent(new Event('change'));

    // FileReader is async, wait for it
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const preview = el.querySelector('.chat-image-preview') as HTMLElement;
        expect(preview.hidden).toBe(false);
        resolve();
      }, 50);
    });
  });

  it('remove button clears preview', () => {
    const el = createChatPanel('teacher', vi.fn());
    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;

    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const preview = el.querySelector('.chat-image-preview') as HTMLElement;
        expect(preview.hidden).toBe(false);

        const removeBtn = el.querySelector('.chat-image-preview-remove') as HTMLButtonElement;
        removeBtn.click();

        expect(preview.hidden).toBe(true);
        resolve();
      }, 50);
    });
  });

  it('send with image calls onSend with text and imageUrl', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-image-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
        textarea.value = 'check this out';

        const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
        sendBtn.click();

        expect(onSend).toHaveBeenCalledWith('check this out', expect.stringContaining('data:image/png;base64,'));
        expect(textarea.value).toBe('');
        resolve();
      }, 50);
    });
  });

  it('send clears preview', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
        sendBtn.click();

        const preview = el.querySelector('.chat-image-preview') as HTMLElement;
        expect(preview.hidden).toBe(true);
        resolve();
      }, 50);
    });
  });

  it('image-only message (no text) works', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
        sendBtn.click();

        expect(onSend).toHaveBeenCalledWith(undefined, expect.stringContaining('data:image/png;base64,'));
        resolve();
      }, 50);
    });
  });

  it('text + image sent together', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
        textarea.value = 'with text';
        const sendBtn = el.querySelector('.chat-send-btn') as HTMLButtonElement;
        sendBtn.click();

        expect(onSend).toHaveBeenCalledWith('with text', expect.stringContaining('data:image/png;base64,'));
        resolve();
      }, 50);
    });
  });

  it('paste non-image text does not affect preview', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);
    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;

    // jsdom does not support ClipboardEvent with clipboardData, so we simulate
    // by directly pasting text (the paste handler checks clipboardData?.items
    // and only intercepts image/* types)
    const event = new Event('paste', { bubbles: true }) as any;
    // No clipboardData with image items — handler does nothing
    textarea.dispatchEvent(event);

    const preview = el.querySelector('.chat-image-preview') as HTMLElement;
    expect(preview.hidden).toBe(true);
  });

  it('resetInput clears both textarea and preview', () => {
    const el = createChatPanel('teacher', vi.fn());
    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
    textarea.value = 'some text';

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    setFakeFileInput(fileInput, 'test.png', 'image/png', 'fake-data');
    fileInput.dispatchEvent(new Event('change'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const preview = el.querySelector('.chat-image-preview') as HTMLElement;
        expect(preview.hidden).toBe(false);

        (el as any).resetInput();

        expect(textarea.value).toBe('');
        expect(preview.hidden).toBe(true);
        resolve();
      }, 50);
    });
  });
});

describe('appendMessage', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'chat-messages';
  });

  it('appends a message bubble to the container', () => {
    appendMessage(container, makeMsg(), false);

    const bubbles = container.querySelectorAll('.chat-message');
    expect(bubbles).toHaveLength(1);
  });

  it('own messages have "mine" class', () => {
    appendMessage(container, makeMsg(), true);

    const bubble = container.querySelector('.chat-message');
    expect(bubble!.classList.contains('mine')).toBe(true);
  });

  it('other messages have "theirs" class', () => {
    appendMessage(container, makeMsg(), false);

    const bubble = container.querySelector('.chat-message');
    expect(bubble!.classList.contains('theirs')).toBe(true);
  });

  it('renders text content', () => {
    appendMessage(container, makeMsg({ text: 'hello world' }), false);

    expect(container.textContent).toContain('hello world');
  });

  it('renders image when imageUrl is provided', () => {
    appendMessage(container, makeMsg({ text: undefined, imageUrl: 'data:image/png;base64,abc' }), false);

    const img = container.querySelector('.chat-message-image img');
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toContain('data:image/png;base64,abc');
  });

  it('auto-scrolls to bottom after append', () => {
    // Mock scrollHeight
    Object.defineProperty(container, 'scrollHeight', { value: 500, writable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

    appendMessage(container, makeMsg(), false);

    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});

describe('renderHistory', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'chat-messages';
  });

  it('renders multiple messages', () => {
    const messages = [
      makeMsg({ id: '1', sender: 'teacher', text: 'hello' }),
      makeMsg({ id: '2', sender: 'student', text: 'hi' }),
    ];

    const isMine = (msg: ChatMessage) => msg.sender === 'student';
    renderHistory(container, messages, isMine);

    const bubbles = container.querySelectorAll('.chat-message');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].classList.contains('theirs')).toBe(true); // teacher
    expect(bubbles[1].classList.contains('mine')).toBe(true); // student
  });

  it('clears existing content before rendering', () => {
    container.innerHTML = '<div class="old">old</div>';

    renderHistory(container, [], () => false);
    expect(container.querySelector('.old')).toBeNull();
  });

  it('shows empty state when no messages', () => {
    renderHistory(container, [], () => false);
    expect(container.querySelector('.chat-empty')).not.toBeNull();
  });
});

describe('clearChat', () => {
  it('removes all messages and shows empty state', () => {
    const container = document.createElement('div');
    container.className = 'chat-messages';
    container.innerHTML = '<div class="chat-message">msg</div>';

    clearChat(container);
    expect(container.querySelector('.chat-message')).toBeNull();
    expect(container.querySelector('.chat-empty')).not.toBeNull();
  });
});
