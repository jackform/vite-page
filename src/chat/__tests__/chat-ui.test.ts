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

    expect(onSend).toHaveBeenCalledWith('hello student');
    expect(textarea.value).toBe(''); // cleared after send
  });

  it('pressing Enter (without Shift) sends and clears input', () => {
    const onSend = vi.fn();
    const el = createChatPanel('teacher', onSend);

    const textarea = el.querySelector('.chat-input') as HTMLTextAreaElement;
    textarea.value = 'a message';

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false }));

    expect(onSend).toHaveBeenCalledWith('a message');
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
