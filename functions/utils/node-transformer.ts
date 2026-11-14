/**
 * 节点统一转换管道 facade。
 *
 * 原单文件（~1000 行）按仓库惯例拆分为 ./node-transformer/ 子模块：
 *   shared.js   —— 解析/编码工具、正则告警去重、配置归一化、地区映射
 *   rename.js   —— 正则过滤、伪装节点识别、正则/脚本重命名（DSL 上下文）
 *   render.js   —— 模板渲染（renderTemplate/applyModifier）与去重键
 *   sort.js     —— 排序比较器
 *   pipeline.js —— nodeUrlsToRecords/recordsToNodeUrls/applyNodeTransformPipeline
 * 本文件保留全部历史公共导出面（operator-runner 以 import * 引用，
 * 调用方与测试无需改动）；新增逻辑放进对应子模块，facade 只做再导出。
 */

export {
    matchesRegexRules,
    ensureRegionInfo,
    setNodeName,
    applyRegexRename,
} from './node-transformer/rename.ts';
export { renderTemplate } from './node-transformer/render.ts';
export { makeComparator } from './node-transformer/sort.ts';
export {
    nodeUrlsToRecords,
    recordsToNodeUrls,
    applyNodeTransformPipeline,
} from './node-transformer/pipeline.ts';
