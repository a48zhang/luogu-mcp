/**
 * 清理字符串，移除HTML标签和多余的空白字符
 * @param {string} str - 需要清理的字符串
 * @returns {string} 清理后的字符串
 */
function cleanString(str) {
  if (!str) return '';
  // 先移除HTML标签
  const withoutHtml = str.replace(/<[^>]+>/g, '');
  // 移除多余空格：
  // 1. 替换连续的空白字符为单个空格
  // 2. 移除开头和结尾的空白
  // 3. 将多行的空格替换为单个换行符
  return withoutHtml
    .replace(/\s+/g, ' ')      // 替换连续空白为单个空格
    .replace(/\n\s+/g, '\n')   // 移除每行开头的空白
    .replace(/\s+\n/g, '\n')   // 移除每行结尾的空白
    .replace(/\n+/g, '\n')     // 替换多个换行为单个换行
    .trim();                   // 移除整个字符串首尾的空白
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