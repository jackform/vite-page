/*
 * 海報頁面 —— AI與編程探索營
 * 面向香港中學生及高年級小學生的編程及AI教育推廣海報
 * 像素風格圖標使用絕對定位 <span> 元素逐像素繪製
 */

import './poster.css';

// ========== 像素圖標系統 ==========
// 每個字符代表一個像素，渲染為獨立的 <span> 元素
// '.' = 透明, '1'/'2'/'3' = 調色板中的顏色索引

interface PixelIconDef {
  grid: string[];
  palette: Record<string, string>;
  scale: number;
}

function renderPixelIcon(def: PixelIconDef): string {
  const { grid, palette, scale } = def;
  const pixels: string[] = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      // '#' 是 '1' 的簡寫 —— 無需雙色的圖標可直接用 #
      const color = palette[c] || palette[c === '#' ? '1' : c];
      if (c !== '.' && color) {
        pixels.push(
          `<span style="position:absolute;left:${x * scale}px;top:${y * scale}px;width:${scale}px;height:${scale}px;background:${color}"></span>`,
        );
      }
    }
  }

  const w = grid[0].length * scale;
  const h = grid.length * scale;

  return `<span class="pixel-icon" style="width:${w}px;height:${h}px">${pixels.join('')}</span>`;
}

// ========== 像素圖標定義 ==========
// 調色板通用約定：1=主色 2=亮色/高光

const pixelIcons = {
  // 12×10 機器人頭像（Hero 用）
  heroRobot: {
    grid: [
      '....####....',
      '...######...',
      '..########..',
      '.##..##..##.',
      '##..##..####',
      '##......####',
      '##..##..####',
      '.##..##..##.',
      '..########..',
      '....####....',
    ],
    palette: { '1': '#00f0ff', '2': '#ffffff' },
    scale: 5,
  } as PixelIconDef,

  // 8×8 CPU 芯片（模塊 1：什麼是AI）
  chip: {
    grid: [
      '.######.',
      '##....##',
      '##.##.##',
      '##.##.##',
      '##.##.##',
      '##.##.##',
      '##....##',
      '.######.',
    ],
    palette: { '1': '#00f0ff', '2': '#80f8ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 顯示器（模塊 2：Python 程式設計）
  monitor: {
    grid: [
      '.######.',
      '##....##',
      '##.##.##',
      '##.#.#.##',
      '##.#.#.##',
      '##.##.##',
      '##....##',
      '.######.',
    ],
    palette: { '1': '#e040fb', '2': '#f098ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 大腦（模塊 3：AI模型）
  brain: {
    grid: [
      '..####..',
      '.##..##.',
      '#.#..#.#',
      '#......#',
      '#..##..#',
      '.#.##.#.',
      '..####..',
      '........',
    ],
    palette: { '1': '#00e676', '2': '#80ffb0' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 星星（模塊 4：提示工程）
  star: {
    grid: [
      '...##...',
      '..####..',
      '.##..##.',
      '##....##',
      '.##..##.',
      '..####..',
      '...##...',
      '........',
    ],
    palette: { '1': '#ffd740', '2': '#ffe9a0' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 火箭（模塊 5：AI專案）
  rocket: {
    grid: [
      '...##...',
      '..####..',
      '..####..',
      '.######.',
      '.######.',
      '..####..',
      '.##..##.',
      '##....##',
    ],
    palette: { '1': '#ff6e40', '2': '#ffb090' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 盾牌（模塊 6：AI倫理）
  shield: {
    grid: [
      '..####..',
      '.######.',
      '########',
      '##.##.##',
      '##....##',
      '.##..##.',
      '..####..',
      '........',
    ],
    palette: { '1': '#b388ff', '2': '#dcc8ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 日曆（📅）- 資訊欄
  calendar: {
    grid: [
      '.######.',
      '#......#',
      '#.####.#',
      '#.#..#.#',
      '#.####.#',
      '#......#',
      '#......#',
      '.######.',
    ],
    palette: { '1': '#00f0ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 時鐘（🕐）- 資訊欄，指針指向 10:10
  clock: {
    grid: [
      '..####..',
      '.##..##.',
      '#.#.##.#',
      '#..##..#',
      '#..#...#',
      '#..#...#',
      '.##..##.',
      '..####..',
    ],
    palette: { '1': '#ffd740' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 地點標記（📍）- 資訊欄
  pin: {
    grid: [
      '...##...',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '...##...',
      '...##...',
      '........',
    ],
    palette: { '1': '#e040fb' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 人群（👥）- 資訊欄，兩個並排的人
  people: {
    grid: [
      '.##..##.',
      '#######.',
      '.#.#.#.#',
      '.##.##..',
      '..###...',
      '..#.#...',
      '........',
      '........',
    ],
    palette: { '1': '#00e676' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 對話框（🗣️）- 資訊欄
  speech: {
    grid: [
      '..####..',
      '.######.',
      '##....##',
      '##....##',
      '.##..##.',
      '..####..',
      '...##...',
      '........',
    ],
    palette: { '1': '#b388ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 靶心（🎯）- 亮點
  target: {
    grid: [
      '...##...',
      '..####..',
      '.##..##.',
      '##.##.##',
      '##.##.##',
      '.##..##.',
      '..####..',
      '...##...',
    ],
    palette: { '1': '#ffd740' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 學位帽（👨‍🏫）- 亮點
  cap: {
    grid: [
      '........',
      '........',
      '...##...',
      '..####..',
      '.######.',
      '########',
      '#......#',
      '........',
    ],
    palette: { '1': '#00f0ff' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 筆記本電腦（💻）- 亮點
  laptop: {
    grid: [
      '.######.',
      '##....##',
      '##....##',
      '##....##',
      '.######.',
      '..####..',
      '..####..',
      '........',
    ],
    palette: { '1': '#e040fb' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 證書（📜）- 亮點，帶印章
  certificate: {
    grid: [
      '.######.',
      '#......#',
      '#..##..#',
      '#.####.#',
      '#..##..#',
      '#......#',
      '.######.',
      '........',
    ],
    palette: { '1': '#00e676' },
    scale: 4,
  } as PixelIconDef,

  // 8×8 獎盃（🏆）- 亮點
  trophy: {
    grid: [
      '...##...',
      '..####..',
      '..####..',
      '.######.',
      '##.##.##',
      '##.##.##',
      '.######.',
      '..####..',
    ],
    palette: { '1': '#ff6e40' },
    scale: 4,
  } as PixelIconDef,
};

// ========== 海報資料類型 ==========
interface CourseModule {
  id: number;
  title: string;
  titleEn: string;
  description: string;
  pixelIcon: PixelIconDef;
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
      pixelIcon: pixelIcons.chip,
    },
    {
      id: 2,
      title: 'Python 程式設計入門',
      titleEn: 'Python Programming',
      description: '零基礎也能學會！用有趣的範例學習變數、條件、迴圈，寫出你的第一個程式。',
      pixelIcon: pixelIcons.monitor,
    },
    {
      id: 3,
      title: '訓練你的第一個AI模型',
      titleEn: 'Train Your First AI',
      description: '用Teachable Machine訓練圖像識別模型，讓電腦學會辨認你的手勢和表情！',
      pixelIcon: pixelIcons.brain,
    },
    {
      id: 4,
      title: '提示工程與創意AI',
      titleEn: 'Prompt Engineering',
      description: '學習如何與AI對話，用精準的提示詞生成驚豔的圖片、故事和音樂。',
      pixelIcon: pixelIcons.star,
    },
    {
      id: 5,
      title: 'AI專案實戰',
      titleEn: 'AI Project',
      description: '綜合所學，設計並展示屬於你自己的AI應用——聊天機器人、智能分類器或創意生成器！',
      pixelIcon: pixelIcons.rocket,
    },
    {
      id: 6,
      title: 'AI倫理與未來',
      titleEn: 'AI Ethics & Future',
      description: '討論AI的倫理議題：偏見、隱私、就業。培養負責任的AI使用者思維。',
      pixelIcon: pixelIcons.shield,
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
      <div class="hero-icon">${renderPixelIcon(pixelIcons.heroRobot)}</div>
      <h1 class="hero-title">${data.title}</h1>
      <p class="hero-subtitle">${data.subtitle}</p>
    </div>
  `;
}

function renderInfoBar(data: PosterData): string {
  const items = [
    { pixelIcon: pixelIcons.calendar, label: '日期', value: data.date },
    { pixelIcon: pixelIcons.clock, label: '時間', value: data.time },
    { pixelIcon: pixelIcons.pin, label: '地點', value: data.location },
    { pixelIcon: pixelIcons.people, label: '對象', value: data.ageRange },
    { pixelIcon: pixelIcons.speech, label: '語言', value: data.language },
  ];

  return `
    <div class="info-bar">
      ${items
        .map(
          (item) => `
          <div class="info-item">
            <div class="info-icon">${renderPixelIcon(item.pixelIcon)}</div>
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
            <div class="module-icon">${renderPixelIcon(m.pixelIcon)}</div>
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
  const icons = [
    pixelIcons.target,
    pixelIcons.cap,
    pixelIcons.laptop,
    pixelIcons.certificate,
    pixelIcons.trophy,
  ];

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
              <span class="highlight-icon">${renderPixelIcon(icons[i])}</span>
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
