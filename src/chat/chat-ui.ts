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
  onSend: (text?: string, imageUrl?: string) => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'chat-panel';

  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'chat-messages';
  panel.appendChild(messagesContainer);

  clearChat(messagesContainer);

  let imagePreviewDataUrl: string | null = null;

  // Image preview bar (hidden by default)
  const imagePreview = document.createElement('div');
  imagePreview.className = 'chat-image-preview';
  imagePreview.hidden = true;

  const previewThumb = document.createElement('img');
  previewThumb.className = 'chat-image-preview-thumb';
  previewThumb.alt = 'Preview';
  imagePreview.appendChild(previewThumb);

  const previewLabel = document.createElement('span');
  previewLabel.className = 'chat-image-preview-label';
  imagePreview.appendChild(previewLabel);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'chat-image-preview-remove';
  removeBtn.textContent = '\u00d7';
  removeBtn.title = '移除圖片';
  removeBtn.addEventListener('click', clearImagePreview);
  imagePreview.appendChild(removeBtn);

  panel.appendChild(imagePreview);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.cssText = 'position:absolute;left:-99999px';
  panel.appendChild(fileInput);

  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';

  const textarea = document.createElement('textarea');
  textarea.className = 'chat-input';
  textarea.placeholder = senderType === 'teacher'
    ? '輸入訊息... (Enter 發送)'
    : '輸入訊息... (Enter 發送)';
  textarea.rows = 1;

  const imageBtn = document.createElement('button');
  imageBtn.className = 'chat-image-btn';
  imageBtn.textContent = '\ud83d\uddbc';
  imageBtn.title = '附加圖片';
  imageBtn.addEventListener('click', () => fileInput.click());

  const sendBtn = document.createElement('button');
  sendBtn.className = 'chat-send-btn';
  sendBtn.textContent = '發送';

  function clearImagePreview(): void {
    imagePreviewDataUrl = null;
    imagePreview.hidden = true;
    fileInput.value = '';
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Client-side size check: reject files > 2MB raw
    if (file.size > 2_000_000) {
      alert('圖片大小不能超過 2MB');
      fileInput.value = '';
      return;
    }

    try {
      const dataUrl = await fileToBase64(file);
      imagePreviewDataUrl = dataUrl;
      previewThumb.src = dataUrl;
      previewLabel.textContent = file.name;
      imagePreview.hidden = false;
    } catch {
      alert('讀取圖片失敗');
    }
  }

  fileInput.addEventListener('change', () => handleFileSelect(fileInput.files));

  textarea.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          // Client-side size check for pasted images too
          if (file.size > 2_000_000) {
            alert('圖片大小不能超過 2MB');
            return;
          }
          fileToBase64(file).then((dataUrl) => {
            imagePreviewDataUrl = dataUrl;
            previewThumb.src = dataUrl;
            previewLabel.textContent = 'Pasted image';
            imagePreview.hidden = false;
          }).catch(() => {
            alert('讀取圖片失敗');
          });
        }
        return;
      }
    }
  });

  function doSend(): void {
    const text = textarea.value.trim();
    if (!text && !imagePreviewDataUrl) return;
    onSend(text || undefined, imagePreviewDataUrl || undefined);
    textarea.value = '';
    clearImagePreview();
  }

  sendBtn.addEventListener('click', doSend);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  inputArea.appendChild(textarea);
  inputArea.appendChild(imageBtn);
  inputArea.appendChild(sendBtn);
  panel.appendChild(inputArea);

  // Attach resetInput to the panel for external cleanup
  (panel as any).resetInput = () => {
    textarea.value = '';
    clearImagePreview();
  };

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
