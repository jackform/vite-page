import type { ChatMessage } from '../../shared/types';

export function createChatTabs(onChange: (tab: 'output' | 'chat') => void): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'chat-tab-bar';

  const outputTab = document.createElement('button');
  outputTab.className = 'chat-tab active';
  outputTab.textContent = '輸出';
  outputTab.dataset.tab = 'output';

  const chatTab = document.createElement('button');
  chatTab.className = 'chat-tab';
  chatTab.textContent = '訊息';
  chatTab.dataset.tab = 'chat';

  function switchTab(tab: 'output' | 'chat') {
    outputTab.classList.toggle('active', tab === 'output');
    chatTab.classList.toggle('active', tab === 'chat');
    onChange(tab);
  }

  outputTab.addEventListener('click', () => switchTab('output'));
  chatTab.addEventListener('click', () => switchTab('chat'));

  bar.appendChild(outputTab);
  bar.appendChild(chatTab);

  return bar;
}

export function createChatPanel(
  senderType: 'student' | 'teacher',
  onSend: (text: string) => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'chat-panel';

  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'chat-messages';
  panel.appendChild(messagesContainer);

  clearChat(messagesContainer);

  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';

  const textarea = document.createElement('textarea');
  textarea.className = 'chat-input';
  textarea.placeholder = senderType === 'teacher'
    ? '輸入訊息... (Enter 發送)'
    : '輸入訊息... (Enter 發送)';
  textarea.rows = 1;

  const sendBtn = document.createElement('button');
  sendBtn.className = 'chat-send-btn';
  sendBtn.textContent = '發送';

  function doSend(): void {
    const text = textarea.value.trim();
    if (!text) return;
    onSend(text);
    textarea.value = '';
  }

  sendBtn.addEventListener('click', doSend);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  inputArea.appendChild(textarea);
  inputArea.appendChild(sendBtn);
  panel.appendChild(inputArea);

  return panel;
}

export function appendMessage(
  container: HTMLElement,
  msg: ChatMessage,
  isMine: boolean
): void {
  // Remove empty state if present
  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  const bubble = document.createElement('div');
  bubble.className = `chat-message ${isMine ? 'mine' : 'theirs'}`;

  if (msg.text) {
    const textEl = document.createElement('div');
    textEl.className = 'chat-message-text';
    textEl.textContent = msg.text;
    bubble.appendChild(textEl);
  }

  if (msg.imageUrl) {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'chat-message-image';
    const img = document.createElement('img');
    img.src = msg.imageUrl;
    img.alt = '圖片';
    imgWrapper.appendChild(img);
    bubble.appendChild(imgWrapper);
  }

  const meta = document.createElement('div');
  meta.className = 'chat-message-meta';
  meta.textContent = formatTime(msg.timestamp);
  bubble.appendChild(meta);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

export function renderHistory(
  container: HTMLElement,
  messages: ChatMessage[],
  isMine: (msg: ChatMessage) => boolean
): void {
  container.innerHTML = '';

  if (messages.length === 0) {
    clearChat(container);
    return;
  }

  for (const msg of messages) {
    appendMessage(container, msg, isMine(msg));
  }
}

export function clearChat(container: HTMLElement): void {
  container.innerHTML = `
    <div class="chat-empty">
      <span class="chat-empty-icon">💬</span>
      <span>尚無訊息</span>
    </div>
  `;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
