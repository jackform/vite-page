/*
 * ========================================
 * 入口文件 —— 个人页面渲染
 *
 * 本文件演示 TypeScript 在 DOM 操作中的使用：
 * - DOM 类型断言（querySelector<HTMLDivElement>）
 * - 非空断言（!）
 * - 事件处理类型
 * - 可选链（?.）
 * - 模板字符串
 * - async/await
 * ========================================
 */

// Vite 支持直接导入 CSS 文件，构建时会自动处理
import './style.css';

// 导入类型 —— import type 不会生成 JS 代码，仅存在于编译阶段
import type { Person, Skill, Experience, Education, SocialLink } from './types';
// 导入数据
import { person } from './data';
// 导入工具函数
import { groupBy, isAdvanced, formatExperienceDate, getSkillLevel, fetchPerson } from './utils';

// ========== DOM 操作：获取根节点 ==========
// querySelector<HTMLDivElement> —— 泛型告诉 TS 这是一个 div 元素
// 末尾的 ! 是非空断言：告诉 TS "我确定这个元素存在，不会是 null"
// 如果不用 !，TS 会报错：Object is possibly 'null'
const app = document.querySelector<HTMLDivElement>('#app')!;

// ========== 渲染函数 ==========
// 每个函数接收明确类型标注的参数，返回 string

function renderHeader(p: Person): string {
  // 可选链 ?. 和空值合并 ??
  // p.avatar 是可选的，用 ?? 提供默认值（avatar 为空时显示名字首字）
  const avatarContent = p.avatar
    ? `<img src="${p.avatar}" alt="${p.name}" class="avatar" />`
    : `<div class="avatar">${p.name.charAt(0)}</div>`;

  return `
    <div class="card header">
      ${avatarContent}
      <h1 class="name">${p.name}</h1>
      <p class="title">${p.title}</p>
      <div class="social-links">
        ${p.socialLinks.map(renderSocialLink).join('')}
      </div>
    </div>
  `;
}

function renderSocialLink(link: SocialLink): string {
  return `
    <a href="${link.url}" class="social-link" target="_blank" rel="noopener">
      ${link.icon} ${link.platform}
    </a>
  `;
}

function renderCodeEntrance(): string {
  return `
    <div class="card code-entrance">
      <div class="poster-entrance-content">
        <span class="poster-entrance-icon">
          <span class="pixel-icon" style="width:32px;height:32px">
            <span style="position:absolute;left:0;top:4px;width:4px;height:24px;background:#a6e3a1"></span>
            <span style="position:absolute;left:8px;top:12px;width:4px;height:16px;background:#a6e3a1"></span>
            <span style="position:absolute;left:16px;top:8px;width:4px;height:8px;background:#f9e2af"></span>
            <span style="position:absolute;left:28px;top:0;width:4px;height:32px;background:#89b4fa"></span>
          </span>
        </span>
        <div class="poster-entrance-text">
          <h3>Python 程式設計實驗室</h3>
          <p>線上 Python 程式編輯器 — 像 LeetCode 一樣在瀏覽器中寫代碼！</p>
        </div>
        <a href="./code.html" class="poster-entrance-btn">開始編程</a>
      </div>
    </div>
  `;
}

function renderPosterEntrance(): string {
  // 8×8 像素機器人圖標
  const robotGrid = [
    '..####..',
    '.##..##.',
    '##.##.##',
    '##....##',
    '##.##.##',
    '##....##',
    '.##..##.',
    '..####..',
  ];
  const s = 4;
  const pixels: string[] = [];
  for (let y = 0; y < robotGrid.length; y++) {
    for (let x = 0; x < robotGrid[y].length; x++) {
      if (robotGrid[y][x] === '#') {
        pixels.push(
          `<span style="position:absolute;left:${x * s}px;top:${y * s}px;width:${s}px;height:${s}px;background:#fff"></span>`,
        );
      }
    }
  }
  const pixelRobot = `<span class="pixel-icon" style="width:${8 * s}px;height:${8 * s}px">${pixels.join('')}</span>`;

  return `
    <div class="card poster-entrance">
      <div class="poster-entrance-content">
        <span class="poster-entrance-icon">${pixelRobot}</span>
        <div class="poster-entrance-text">
          <h3>AI與編程探索營</h3>
          <p>適合中小學生的趣味AI及編程課程 — 點擊了解更多！</p>
        </div>
        <a href="./poster.html" class="poster-entrance-btn">查看海報</a>
      </div>
    </div>
  `;
}

function renderAbout(p: Person): string {
  return `
    <div class="card">
      <h2 class="section-title">📋 关于我</h2>
      <p>${p.bio}</p>
    </div>
  `;
}

function renderSkills(skills: Skill[]): string {
  // 使用泛型函数 groupBy —— 按 proficiency 分组
  const grouped = groupBy(skills, 'proficiency');

  return `
    <div class="card">
      <h2 class="section-title">🛠 技能</h2>
      <div class="skills-grid">
        ${skills
          .map((s) => {
            // 使用类型守卫 isAdvanced —— 高级技能显示特殊标签
            const label = isAdvanced(s) ? '🔥 精通' : getSkillLevel(s.years);
            return `
              <div class="skill-item">
                <span>${s.name}</span>
                <span class="skill-tag">${label}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderExperience(experiences: Experience[]): string {
  return `
    <div class="card">
      <h2 class="section-title">💼 工作经历</h2>
      <div class="timeline">
        ${experiences.map(renderExperienceItem).join('')}
      </div>
    </div>
  `;
}

function renderExperienceItem(exp: Experience): string {
  // 使用函数重载的 formatExperienceDate
  const dateRange = formatExperienceDate(exp);

  return `
    <div class="timeline-item">
      <div class="timeline-role">${exp.role}</div>
      <div class="timeline-company">${exp.company}</div>
      <div class="timeline-date">${dateRange}</div>
      <p class="timeline-desc">${exp.description}</p>
      <ul class="timeline-highlights">
        ${exp.highlights.map((h) => `<li>${h}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderEducation(eduList: Education[]): string {
  return `
    <div class="card">
      <h2 class="section-title">🎓 教育背景</h2>
      ${eduList
        .map(
          (edu) => `
          <div class="edu-item">
            <div>
              <span class="edu-school">${edu.school}</span>
              <span class="edu-degree"> · ${edu.degree} · ${edu.field}</span>
            </div>
            <span class="edu-date">${edu.startYear} - ${edu.endYear}</span>
          </div>
        `,
        )
        .join('')}
    </div>
  `;
}

function renderFooter(): string {
  return `
    <div class="footer">
      Built with Vite + TypeScript &copy; ${new Date().getFullYear()}
    </div>
  `;
}

// ========== 组装页面 ==========
function renderPage(p: Person): void {
  app.innerHTML = `
    <div class="container">
      ${renderHeader(p)}
      ${renderCodeEntrance()}
      ${renderPosterEntrance()}
      ${renderAbout(p)}
      ${renderSkills(p.skills)}
      ${renderExperience(p.experience)}
      ${renderEducation(p.education)}
      ${renderFooter()}
    </div>
  `;
}

// ========== 页面启动 ==========
// 使用 async/await 演示异步数据加载
async function init(): Promise<void> {
  // 先展示一个简单的加载状态
  app.innerHTML = '<div class="container"><div class="card" style="text-align:center">加载中...</div></div>';

  try {
    // 模拟从 API 获取数据 —— 实际项目中会是 fetch('/api/profile')
    const data: Person = await fetchPerson();
    renderPage(data);
  } catch (error) {
    // 错误处理：展示错误信息
    app.innerHTML = `
      <div class="container">
        <div class="card" style="text-align:center;color:red">
          加载失败：${error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    `;
    // 在生产代码中，这里应该上报错误监控
    console.error('个人页面加载失败:', error);
  }
}

// ========== 事件绑定 ==========
// 页面加载完成后，初始化
// DOMContentLoaded 是浏览器原生事件，确保 DOM 树完整
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => {
    // 可选链 ?. 的另一种用法：安全地调用可能不存在的方法
    // 这里演示对 DOM 元素的操作
    const header = document.querySelector<HTMLElement>('.header');
    // 如果 header 存在，打印调试信息
    header?.setAttribute('data-loaded', 'true');
  });
});
