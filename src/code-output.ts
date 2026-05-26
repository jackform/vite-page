import type { TestRunResult } from './code-types';

export function renderOutput(result: TestRunResult): string {
  let html = '';

  if (result.stdout.trim()) {
    html += `<div class="output-stdout">${escapeHtml(result.stdout.trim())}</div>`;
  }

  if (result.stderr.trim()) {
    html += `<div class="output-stderr">${escapeHtml(result.stderr.trim())}</div>`;
  }

  if (result.returnValue !== undefined && result.returnValue !== 'None') {
    html += `<div class="output-stdout">⇒ ${escapeHtml(result.returnValue)}</div>`;
  }

  if (result.testResults && result.testResults.length > 0) {
    html += '<div class="test-results">';

    const allPassed = result.testResults.every((t) => t.passed);
    html += `<div class="test-result-summary ${allPassed ? 'all-passed' : 'has-failures'}">`;
    html += `${allPassed ? '✓' : '✗'} ${result.passedCount}/${result.totalCount} tests passed`;
    html += '</div>';

    for (const tr of result.testResults) {
      html += `
        <div class="test-case-item ${tr.passed ? 'test-passed' : 'test-failed'}">
          <span class="test-case-index">Test ${tr.index + 1}</span>
          <div class="test-case-detail">
            <div><span class="label">Input: </span><span class="value">${escapeHtml(tr.input)}</span></div>
            <div><span class="label">Expected: </span><span class="value">${escapeHtml(tr.expected)}</span></div>
            <div><span class="label">Actual: </span><span class="${tr.passed ? 'value' : 'actual-error'}">${escapeHtml(tr.actual)}</span></div>
          </div>
        </div>
      `;
    }

    html += '</div>';
  }

  if (result.executionTime !== undefined) {
    html += `<div class="output-meta">Execution time: ${result.executionTime}ms</div>`;
  }

  if (result.status === 'timeout') {
    html += `<div class="output-stderr">⏱ ${escapeHtml(result.stderr)}</div>`;
  }

  return html;
}

export function renderOutputLoading(): string {
  return '<div class="output-loading"><span class="loading-spinner"></span> Running...</div>';
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
