import { cleanString } from './utils.js';
import { createTagMap } from './tags.js';

/**
 * 将数字难度等级映射到对应的文字描述
 * @param {number|string} difficultyNum - 难度数字(1-7)
 * @returns {string} 难度的文字描述
 */
function mapDifficulty(difficultyNum) {
  const difficultyMap = {
    '1': '入门',
    '2': '普及-',
    '3': '普及/提高-',
    '4': '普及+/提高',
    '5': '提高+/省选-',
    '6': '省选/NOI-',
    '7': 'NOI/NOI+/CTSC'
  };
  
  // 确保输入是字符串格式
  const diffKey = String(difficultyNum);
  
  // 如果在映射表中找到对应值，则返回映射后的文字描述
  // 否则返回原始值或'未知难度'
  return difficultyMap[diffKey] || diffKey || '未知难度';
}

/**
 * 解析HTML内容提取题目信息
 * @param {string} html - 页面HTML内容
 * @returns {object} 题目信息对象
 */
function parseProblemHtml(html) {
  // 尝试从lentille-context脚本标签中提取JSON数据
  const scriptTagRegex = /<script id="lentille-context" type="application\/json">([\s\S]*?)<\/script>/i;
  const scriptMatch = html.match(scriptTagRegex);
  
  let jsonData = null;
  if (scriptMatch && scriptMatch[1]) {
    try {
      jsonData = JSON.parse(scriptMatch[1]);
    } catch (error) {
      // JSON解析失败
    }
  }
  
  // 从JSON中提取难度和标签
  let difficultyNum = null;
  let difficultyText = '未知难度';
  let tags = [];
  let tagNames = [];
  
  // 创建标签ID到名称的映射
  const tagMap = createTagMap();
  
  if (jsonData && jsonData.data && jsonData.data.problem) {
    const problem = jsonData.data.problem;
    
    // 提取难度
    if (problem.difficulty !== undefined) {
      difficultyNum = problem.difficulty;
      difficultyText = mapDifficulty(difficultyNum);
    }
    
    // 提取标签IDs并转换为标签名称
    if (problem.tags && Array.isArray(problem.tags)) {
      tags = problem.tags.map(tag => tag.toString());
      
      // 将标签ID转换为标签名称
      tagNames = tags.map(id => {
        const tagId = parseInt(id, 10);
        return tagMap.has(tagId) ? tagMap.get(tagId) : `未知标签(${id})`;
      });
    }
  }
  
  // 基本信息提取 (使用原有正则表达式方法或从JSON中提取)
  const title = jsonData && jsonData.data && jsonData.data.problem && jsonData.data.problem.title 
    ? cleanString(jsonData.data.problem.title)
    : (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ? cleanString(html.match(/<h1[^>]*>([^<]+)<\/h1>/i)[1]) : '未知标题');
  
  // 提取题目描述
  const description = jsonData && jsonData.data && jsonData.data.problem && 
                     jsonData.data.problem.content && jsonData.data.problem.content.description
    ? cleanString(jsonData.data.problem.content.description)
    : (html.match(/<h2[^>]*>题目描述<\/h2>([\s\S]*?)<h2/i) 
        ? cleanString(html.match(/<h2[^>]*>题目描述<\/h2>([\s\S]*?)<h2/i)[1]) 
        : '无题目描述');
  
  // 提取输入输出格式
  const inputFormat = jsonData && jsonData.data && jsonData.data.problem && 
                     jsonData.data.problem.content && jsonData.data.problem.content.formatI
    ? cleanString(jsonData.data.problem.content.formatI)
    : (html.match(/<h2[^>]*>输入格式<\/h2>([\s\S]*?)<h2/i)
        ? cleanString(html.match(/<h2[^>]*>输入格式<\/h2>([\s\S]*?)<h2/i)[1])
        : '无输入格式');
  
  const outputFormat = jsonData && jsonData.data && jsonData.data.problem && 
                      jsonData.data.problem.content && jsonData.data.problem.content.formatO
    ? cleanString(jsonData.data.problem.content.formatO)
    : (html.match(/<h2[^>]*>输出格式<\/h2>([\s\S]*?)<h2/i)
        ? cleanString(html.match(/<h2[^>]*>输出格式<\/h2>([\s\S]*?)<h2/i)[1])
        : '无输出格式');
  
  // 提取样例
  let samples = [];
  
  if (jsonData && jsonData.data && jsonData.data.problem && 
      jsonData.data.problem.samples && Array.isArray(jsonData.data.problem.samples)) {
    samples = jsonData.data.problem.samples.map(sample => ({
      input: cleanString(sample[0]),
      output: cleanString(sample[1])
    }));
  } else {
    // 使用原有正则表达式方法
    let sampleMatch;
    const sampleRegex = /<h2[^>]*>输入样例 (\d+)<\/h2>([\s\S]*?)<h2[^>]*>输出样例 \1<\/h2>([\s\S]*?)(?:<h2|$)/gi;
    
    while ((sampleMatch = sampleRegex.exec(html)) !== null) {
      samples.push({
        input: cleanString(sampleMatch[2]),
        output: cleanString(sampleMatch[3])
      });
    }
  }
  
  // 提取数据范围
  const limit = jsonData && jsonData.data && jsonData.data.problem && 
               jsonData.data.problem.content && jsonData.data.problem.content.hint
    ? cleanString(jsonData.data.problem.content.hint)
    : (html.match(/<h2[^>]*>说明\/提示<\/h2>([\s\S]*?)(?:<h2|$)/i)
        ? cleanString(html.match(/<h2[^>]*>说明\/提示<\/h2>([\s\S]*?)(?:<h2|$)/i)[1])
        : '无数据范围说明');
  
  return {
    title,
    difficultyNum,  // 返回原始数字难度
    difficulty: difficultyText, // 返回映射后的文字难度
    tags: tagNames, // 返回标签名称而不是ID
    description,
    inputFormat,
    outputFormat,
    samples,
    limit
  };
}

export { parseProblemHtml, mapDifficulty };