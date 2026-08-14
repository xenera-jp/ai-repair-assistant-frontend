/** 将报告保存时间按当前语言格式化为简洁的本地日期时间。 */
export function formatSavedAt(value: string, language: 'zh-CN' | 'ja-JP') {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}
