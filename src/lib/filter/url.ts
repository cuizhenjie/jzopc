/**
 * 筛选 URL 构造 —— 从 `FilterLink` 的事件处理里抽出来的**纯函数**。
 *
 * ## 为什么要抽出来
 *
 * 这里编码的是一条**曾经真的坏过的规则**：切分类时必须保留地址栏里的
 * 其它查询参数（尤其是搜索词 `q`）。原先这段逻辑埋在 `onClick` 里，
 * 只能靠手测覆盖，于是出了「先搜索、再切分类就把搜索词弄丢」的问题。
 * 抽成纯函数后才能写进单测。
 *
 * ## 规则
 *
 * 1. 以 `href` 为底（它自带该按钮的分类参数）；
 * 2. 把**当前地址栏**里除 `param` 以外的参数补进去（`href` 已有的不覆盖）；
 * 3. `value` 为空串表示「全部」→ 删掉 `param`；否则把它设为 `value`。
 */
export function buildFilterUrl({
  href,
  param,
  value,
  currentSearch,
  base,
}: {
  /** 按钮的真实 href（保留无 JS 与「新标签打开」能力） */
  href: string;
  /** 该按钮控制的查询参数名，如 category / tab / type */
  param: string;
  /** 目标值；空串表示「全部」（即删除该参数） */
  value: string;
  /** 当前地址栏的 query（如 `?q=关键词&category=office`） */
  currentSearch: string;
  /** 站点 origin，用于把相对路径补成绝对地址 */
  base: string;
}): string {
  const url = new URL(href, base);

  // 保留当前地址栏里的**其它**参数（如搜索词 q）——否则「先搜索、再切分类」
  // 就会把搜索词丢掉。href 里已有的同名参数不覆盖（href 才是这次点击的意图）。
  for (const [key, val] of new URLSearchParams(currentSearch)) {
    if (key === param) continue;
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
  }

  if (value) url.searchParams.set(param, value);
  else url.searchParams.delete(param);

  return url.toString();
}
