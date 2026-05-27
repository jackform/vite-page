import type { CodeProblem } from './code-types';

/**
 * Sample problem definitions.
 * In production this data would come from a backend API.
 */

const twoSum: CodeProblem = {
  id: 'two-sum',
  title: '1. Two Sum',
  difficulty: 'easy',
  description: `
    <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <strong>indices of the two numbers</strong> such that they add up to <code>target</code>.</p>
    <p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
    <p>You can return the answer in any order.</p>
  `,
  examples: [
    {
      input: 'nums = [2, 7, 11, 15], target = 9',
      output: '[0, 1]',
      explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
    },
    {
      input: 'nums = [3, 2, 4], target = 6',
      output: '[1, 2]',
    },
    {
      input: 'nums = [3, 3], target = 6',
      output: '[0, 1]',
    },
  ],
  constraints: [
    '2 ≤ nums.length ≤ 10⁴',
    '-10⁹ ≤ nums[i] ≤ 10⁹',
    '-10⁹ ≤ target ≤ 10⁹',
    'Only one valid answer exists.',
  ],
  starterCode: `def two_sum(nums, target):
    # Write your solution here
    pass
`,
  testCases: [
    { input: '[2, 7, 11, 15]\n9', expected: '[0, 1]' },
    { input: '[3, 2, 4]\n6', expected: '[1, 2]' },
    { input: '[3, 3]\n6', expected: '[0, 1]' },
  ],
};

const fizzBuzz: CodeProblem = {
  id: 'fizzbuzz',
  title: '412. Fizz Buzz',
  difficulty: 'easy',
  description: `
    <p>Given an integer <code>n</code>, return a <strong>list of strings</strong> where:</p>
    <ul>
      <li>For multiples of 3, use <code>"Fizz"</code> instead of the number.</li>
      <li>For multiples of 5, use <code>"Buzz"</code> instead of the number.</li>
      <li>For numbers which are multiples of both 3 and 5, use <code>"FizzBuzz"</code>.</li>
      <li>Otherwise, use the number as a string.</li>
    </ul>
  `,
  examples: [
    {
      input: 'n = 3',
      output: '["1", "2", "Fizz"]',
    },
    {
      input: 'n = 5',
      output: '["1", "2", "Fizz", "4", "Buzz"]',
    },
    {
      input: 'n = 15',
      output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]',
    },
  ],
  constraints: ['1 ≤ n ≤ 10⁴'],
  starterCode: `def fizz_buzz(n):
    # Write your solution here
    pass
`,
  testCases: [
    { input: '3', expected: "['1', '2', 'Fizz']" },
    { input: '5', expected: "['1', '2', 'Fizz', '4', 'Buzz']" },
    { input: '15', expected: "['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']" },
  ],
};

const numpyDemo: CodeProblem = {
  id: 'numpy-demo',
  title: 'NumPy - 陣列運算示範',
  difficulty: 'easy',
  description: `
    <p><strong>NumPy</strong> 陣列運算示範 — 使用 <code>np.array</code> 建立多維陣列，進行矩陣乘法、元素運算。</p>
    <p>此範例需要在 <strong>Pyodide</strong> 引擎下執行（不支援 Skulpt）。</p>
  `,
  examples: [],
  constraints: [],
  starterCode: `import numpy as np

# 建立矩陣
a = np.array([[1, 2, 3], [4, 5, 6]])
print("Matrix A (2x3):")
print(a)

b = np.array([[7, 8], [9, 10], [11, 12]])
print("\\nMatrix B (3x2):")
print(b)

# 矩陣乘法
c = np.dot(a, b)
print("\\nA @ B (2x2):")
print(c)

# 建立隨機陣列
rng = np.random.default_rng(42)
d = rng.random((3, 3))
print("\\nRandom 3x3:")
print(d)

# 基本統計
print("\\nMean:", d.mean())
print("Std:", d.std())`,
  testCases: [],
};

const pandasDemo: CodeProblem = {
  id: 'pandas-demo',
  title: 'Pandas — 資料分析示範',
  difficulty: 'easy',
  description: `
    <p><strong>Pandas</strong> DataFrame 範例 — 建立表格資料、篩選、分組聚合。</p>
    <p>此範例需要在 <strong>Pyodide</strong> 引擎下執行（不支援 Skulpt）。</p>
  `,
  examples: [],
  constraints: [],
  starterCode: `import pandas as pd

# 建立 DataFrame
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    'age': [25, 30, 35, 28, 22],
    'score': [85, 92, 78, 95, 88],
    'city': ['Taipei', 'Kaohsiung', 'Taipei', 'Tainan', 'Kaohsiung']
})
print("Full DataFrame:")
print(df)
print()

# 篩選 score > 80
print("Score > 80:")
print(df[df['score'] > 80])
print()

# 分組聚合
print("Average score by city:")
print(df.groupby('city')['score'].mean())`,
  testCases: [],
};

const sklearnDemo: CodeProblem = {
  id: 'sklearn-demo',
  title: 'Scikit-learn — 分類器示範',
  difficulty: 'medium',
  description: `
    <p><strong>Scikit-learn</strong> 機器學習範例 — 使用 Iris 資料集訓練 Random Forest 分類器。</p>
    <p>此範例需要在 <strong>Pyodide</strong> 引擎下執行（不支援 Skulpt）。</p>
  `,
  examples: [],
  constraints: [],
  starterCode: `from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# 載入 Iris 資料集
iris = load_iris()
X, y = iris.data, iris.target

# 分割訓練/測試集
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)
print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")

# 訓練 Random Forest
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 評估
accuracy = clf.score(X_test, y_test)
print(f"Accuracy: {accuracy:.4f}")

# 預測
sample = X_test[:3]
pred = clf.predict(sample)
print(f"\\nPredictions for first 3 test samples: {pred}")
print(f"Actual labels:                     {y_test[:3]}")
print(f"Class names: {iris.target_names[pred]}")`,
  testCases: [],
};

const scipyDemo: CodeProblem = {
  id: 'scipy-demo',
  title: 'SciPy — 統計與最佳化示範',
  difficulty: 'medium',
  description: `
    <p><strong>SciPy</strong> 科學計算範例 — 使用 <code>scipy.stats</code> 進行統計描述，<code>scipy.optimize</code> 求函數最小值。</p>
    <p>此範例需要在 <strong>Pyodide</strong> 引擎下執行（不支援 Skulpt）。</p>
  `,
  examples: [],
  constraints: [],
  starterCode: `import numpy as np
from scipy import stats, optimize

# 1. 統計描述
data = np.random.default_rng(42).normal(100, 15, 1000)
desc = stats.describe(data)
print("Statistical Description:")
print(f"  N = {desc.nobs}")
print(f"  Min/Max = {desc.minmax}")
print(f"  Mean = {desc.mean:.2f}")
print(f"  Variance = {desc.variance:.2f}")
print(f"  Skewness = {desc.skewness:.2f}")
print(f"  Kurtosis = {desc.kurtosis:.2f}")

# 2. 單樣本 t 檢定 (H₀: mean = 100)
t_stat, p_value = stats.ttest_1samp(data, 100)
print(f"\\nT-test (H₀: mean=100): t={t_stat:.4f}, p={p_value:.4f}")

# 3. 函數最小值求解
def f(x):
    return x**2 + 10*np.sin(x)

result = optimize.minimize(f, x0=0, method='BFGS')
print(f"\\nMinimize f(x) = x² + 10sin(x):")
print(f"  x_min = {result.x[0]:.4f}")
print(f"  f(x_min) = {result.fun:.4f}")`,
  testCases: [],
};

/** All available problems keyed by id for easy lookup. */
export const problems: Record<string, CodeProblem> = {
  'two-sum': twoSum,
  fizzbuzz: fizzBuzz,
  'numpy-demo': numpyDemo,
  'pandas-demo': pandasDemo,
  'sklearn-demo': sklearnDemo,
  'scipy-demo': scipyDemo,
};

/** Default problem loaded on page open. */
export const defaultProblem = twoSum;
