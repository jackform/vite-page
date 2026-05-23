/*
 * 海報頁面 —— AI與編程探索營
 * 面向香港中學生及高年級小學生的編程及AI教育推廣海報
 */

import './poster.css';

// ========== 海報資料類型 ==========
interface CourseModule {
  id: number;
  title: string;
  titleEn: string;
  description: string;
  icon: string;
}

interface PosterData {
  title: string;
  subtitle: string;
  date: string;
  time: string;
  location: string;
  ageRange: string;
  language: string;
  modules: CourseModule[];
  highlights: string[];
  ctaText: string;
}

// ========== 硬編碼海報內容 ==========
const posterData: PosterData = {
  title: 'AI與編程探索營',
  subtitle: '激發創意，掌握未來科技的鑰匙！適合中小學生的趣味AI入門課程',
  date: '2026年7月15日 - 8月25日',
  time: '每週二、四 14:00 - 16:00',
  location: '香港九龍塘創新中心',
  ageRange: '10-15歲（小五至中三）',
  language: '粵語授課，輔以英文教材',
  modules: [
    {
      id: 1,
      title: '什麼是人工智能？',
      titleEn: 'What is AI?',
      description: '從AlphaGo到ChatGPT，了解AI如何改變世界。透過互動遊戲認識機器學習的基本概念。',
      icon: '🤖',
    },
    {
      id: 2,
      title: 'Python 程式設計入門',
      titleEn: 'Python Programming',
      description: '零基礎也能學會！用有趣的範例學習變數、條件、迴圈，寫出你的第一個程式。',
      icon: '💻',
    },
    {
      id: 3,
      title: '訓練你的第一個AI模型',
      titleEn: 'Train Your First AI',
      description: '用Teachable Machine訓練圖像識別模型，讓電腦學會辨認你的手勢和表情！',
      icon: '🧠',
    },
    {
      id: 4,
      title: '提示工程與創意AI',
      titleEn: 'Prompt Engineering',
      description: '學習如何與AI對話，用精準的提示詞生成驚豔的圖片、故事和音樂。',
      icon: '✨',
    },
    {
      id: 5,
      title: 'AI專案實戰',
      titleEn: 'AI Project',
      description: '綜合所學，設計並展示屬於你自己的AI應用——聊天機器人、智能分類器或創意生成器！',
      icon: '🚀',
    },
    {
      id: 6,
      title: 'AI倫理與未來',
      titleEn: 'AI Ethics & Future',
      description: '討論AI的倫理議題：偏見、隱私、就業。培養負責任的AI使用者思維。',
      icon: '🛡️',
    },
  ],
  highlights: [
    '無需編程經驗，專業導師循序漸進指導',
    '小班教學（每班最多15人），確保學習質量',
    '每人一台電腦實操，理論與實踐並重',
    '完成全部課程可獲頒證書',
    '優秀學員作品將在結業展覽中展出',
  ],
  ctaText: '立即報名',
};

// ========== DOM 根節點 ==========
const posterApp = document.querySelector<HTMLDivElement>('#poster-app')!;

// ========== 渲染函數 ==========

function renderBackLink(): string {
  return `
    <a href="./" class="back-link">
      ← 返回個人主頁
    </a>
  `;
}

function renderHero(data: PosterData): string {
  return `
    <div class="hero">
      <div class="hero-icon">🤖</div>
      <h1 class="hero-title">${data.title}</h1>
      <p class="hero-subtitle">${data.subtitle}</p>
    </div>
  `;
}

function renderInfoBar(data: PosterData): string {
  const items = [
    { icon: '📅', label: '日期', value: data.date },
    { icon: '🕐', label: '時間', value: data.time },
    { icon: '📍', label: '地點', value: data.location },
    { icon: '👥', label: '對象', value: data.ageRange },
    { icon: '🗣️', label: '語言', value: data.language },
  ];

  return `
    <div class="info-bar">
      ${items
        .map(
          (item) => `
          <div class="info-item">
            <div class="info-icon">${item.icon}</div>
            <div class="info-label">${item.label}</div>
            <div class="info-value">${item.value}</div>
          </div>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderModules(modules: CourseModule[]): string {
  return `
    <div class="section-header">
      <div class="section-label">Course Outline</div>
      <h2 class="section-title">課程大綱</h2>
    </div>
    <div class="modules-grid">
      ${modules
        .map(
          (m) => `
          <div class="module-card">
            <div class="module-number">0${m.id}</div>
            <div class="module-icon">${m.icon}</div>
            <div class="module-title">${m.title}</div>
            <div class="module-title-en">${m.titleEn}</div>
            <div class="module-desc">${m.description}</div>
          </div>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderHighlights(highlights: string[]): string {
  const icons = ['🎯', '👨‍🏫', '💻', '📜', '🏆'];

  return `
    <div class="highlights-section">
      <div class="section-header">
        <div class="section-label">Why Join Us</div>
        <h2 class="section-title">為什麼選擇我們？</h2>
      </div>
      <div class="highlights-grid">
        ${highlights
          .map(
            (h, i) => `
            <div class="highlight-item">
              <span class="highlight-icon">${icons[i]}</span>
              <span class="highlight-text">${h}</span>
            </div>
          `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderCTA(data: PosterData): string {
  return `
    <div class="cta-section">
      <a href="#" class="cta-btn">${data.ctaText}</a>
      <p class="cta-note">名額有限，先到先得！</p>
    </div>
  `;
}

function renderFooter(): string {
  return `
    <div class="poster-footer">
      AI與編程探索營 · 為下一代打造科技思維 &copy; ${new Date().getFullYear()}
    </div>
  `;
}

// ========== 組裝頁面 ==========
function renderPoster(data: PosterData): void {
  posterApp.innerHTML = `
    <div class="poster-page">
      <div class="poster-container">
        ${renderBackLink()}
        ${renderHero(data)}
        ${renderInfoBar(data)}
        ${renderModules(data.modules)}
        ${renderHighlights(data.highlights)}
        ${renderCTA(data)}
        ${renderFooter()}
      </div>
    </div>
  `;
}

// ========== 頁面啟動 ==========
document.addEventListener('DOMContentLoaded', () => {
  renderPoster(posterData);
});
