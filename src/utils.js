/**
 * 清理字符串，移除HTML标签和多余的空白字符
 * @param {string} str - 需要清理的字符串
 * @returns {string} 清理后的字符串
 */
function cleanString(str) {
  if (!str) return '';
  // Remove HTML tags (both complete `<tag ...>` and truncated `<tag...` with no closing `>`)
  // in a single pass. The pattern only matches `<` followed by a letter/`/`/`!` so that
  // bare `<` operators in maths (e.g. "a < b") are preserved.
  const text = str.replace(/<[A-Za-z/!][^>]*>?/g, '');
  return text
    .replace(/[ \t]+/g, ' ')      // 合并同行连续空格/Tab
    .replace(/^ +| +$/gm, '')     // 移除每行行首行尾空格
    .replace(/\n{3,}/g, '\n\n')   // 最多保留两个连续换行
    .trim();                      // 移除整个字符串首尾空白
}

/**
 * 提取HTML中的所有匹配标签内容
 * @param {string} html - HTML内容
 * @param {string} regex - 正则表达式
 * @returns {string[]} 匹配的内容数组
 */
function extractAllMatches(html, regex) {
  const matches = [];
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      matches.push(cleanString(match[1]));
    }
  }
  
  return matches;
}

/**
 * 从洛谷题目URL中提取题目ID
 * @param {string} url - 洛谷题目URL
 * @returns {string|null} 题目ID，如果无法提取则返回null
 */
function extractProblemId(url) {
  const match = url.match(/\/problem\/([^\/]+)/);
  return match ? match[1] : null;
}

export { cleanString, extractAllMatches, extractProblemId };