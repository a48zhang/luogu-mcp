/**
 * 抓取洛谷题目页面内容
 * @param {string} url - 洛谷题目URL
 * @returns {Promise<string>} 页面HTML内容
 */
async function fetchProblemPage(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export { fetchProblemPage };