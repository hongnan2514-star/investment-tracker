// src/utils/marketTime.ts

/**
 * 判断给定时间是否为美股交易日（含节假日判断）
 * @param date 可选，默认当前时间
 * @returns boolean true表示可交易
 */
export function isUSMarketOpen(date: Date = new Date()): boolean {
  const year = date.getFullYear();

  // --- 周末判断 ---
  const day = date.getDay(); // 0 = 周日, 6 = 周六
  if (day === 0 || day === 6) return false;

  // --- 获取当前年份的美股休市列表 ---
  const holidays = getUSHolidays(year);

  // 格式化当前日期为 YYYY-MM-DD
  const dateStr = date.toISOString().split('T')[0];
  if (holidays.includes(dateStr)) return false;

  // --- 提前收盘日 (黑五和圣诞前夜) ---
  const earlyCloseDays = getEarlyCloseDays(year);
  const isEarlyClose = earlyCloseDays.includes(dateStr);
  // 提前收盘日，东部时间下午1点收盘，对应北京时间次日凌晨
  const earlyCloseHour = isDST(date) ? 2 : 3; // 夏令时02:00, 冬令时03:00
  const currentHour = date.getHours();

  // --- 判断交易时段 ---
  const dst = isDST(date);
  let marketOpenHour: number, marketCloseHour: number;
  if (dst) {
    // 夏令时: 21:30 - 次日04:00
    marketOpenHour = 21.5;
    marketCloseHour = 4;
  } else {
    // 冬令时: 22:30 - 次日05:00
    marketOpenHour = 22.5;
    marketCloseHour = 5;
  }

  const currentHourFloat = date.getHours() + date.getMinutes() / 60;

  // 如果今天是提前收盘日，使用提前收盘时间
  if (isEarlyClose) {
    return currentHourFloat < earlyCloseHour;
  }

  // 常规交易时段判断（跨夜）
  if (currentHourFloat >= marketOpenHour || currentHourFloat < marketCloseHour) {
    return true;
  }
  return false;
}

/**
 * 判断当前日期是否处于夏令时（美国）
 * 夏令时从3月第二个周日到11月第一个周日
 */
function isDST(date: Date): boolean {
  const year = date.getFullYear();
  // 3月第二个周日
  const marchSecondSunday = getNthWeekdayOfMonth(year, 3, 0, 2); // 周日=0, 第二个
  // 11月第一个周日
  const novFirstSunday = getNthWeekdayOfMonth(year, 11, 0, 1);

  return date >= marchSecondSunday && date < novFirstSunday;
}

/**
 * 获取某年某月的第N个星期几的日期
 * @param year 年份
 * @param month 月份 (1-12)
 * @param weekday 星期几 (0=周日, 1=周一, ..., 6=周六)
 * @param n 第几个 (1-based)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  let offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

/**
 * 获取某年最后一个星期一的日期（用于阵亡将士纪念日）
 */
function getLastMondayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0); // month+1 月的第0天即上月最后一天
  const lastWeekday = lastDay.getDay();
  const offset = lastWeekday >= 1 ? lastWeekday - 1 : 6; // 星期一=1, 周日=0时需回退6天
  return new Date(year, month - 1, lastDay.getDate() - offset);
}

/**
 * 获取耶稣受难日 (Good Friday) – 复活节前2天
 * 使用高斯算法计算复活节，再减2天
 */
function getGoodFriday(year: number): Date {
  // 高斯复活节算法 (适用于1583-4099年)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  // 复活节日期
  const easter = new Date(year, month - 1, day);
  // 减2天得到耶稣受难日
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);
  return goodFriday;
}

/**
 * 获取某年美股所有休市日期 (YYYY-MM-DD)
 */
function getUSHolidays(year: number): string[] {
  const holidays: Date[] = [];

  // 元旦 (1月1日)
  holidays.push(new Date(year, 0, 1));

  // 马丁·路德·金纪念日 (1月第三个周一)
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 3));

  // 总统日 (2月第三个周一)
  holidays.push(getNthWeekdayOfMonth(year, 2, 1, 3));

  // 耶稣受难日
  holidays.push(getGoodFriday(year));

  // 阵亡将士纪念日 (5月最后一个周一)
  holidays.push(getLastMondayOfMonth(year, 5));

  // 六月节 (6月19日)
  holidays.push(new Date(year, 5, 19));

  // 独立日 (7月4日)
  holidays.push(new Date(year, 6, 4));

  // 劳动节 (9月第一个周一)
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 1));

  // 感恩节 (11月第四个周四)
  holidays.push(getNthWeekdayOfMonth(year, 11, 4, 4));

  // 圣诞节 (12月25日)
  holidays.push(new Date(year, 11, 25));

  // 如果节日落在周末，通常补休（周一或周五），但美股通常不补，直接休市。此处简化：如果落在周六，则周五休市；如果周日，则周一休市。
  const adjustedHolidays: string[] = [];
  holidays.forEach(date => {
    const day = date.getDay();
    let actualDate: Date;
    if (day === 6) { // 周六
      actualDate = new Date(date);
      actualDate.setDate(date.getDate() - 1); // 周五休市
    } else if (day === 0) { // 周日
      actualDate = new Date(date);
      actualDate.setDate(date.getDate() + 1); // 周一休市
    } else {
      actualDate = date;
    }
    adjustedHolidays.push(actualDate.toISOString().split('T')[0]);
  });

  return adjustedHolidays;
}

/**
 * 获取某年提前收盘日 (黑五和圣诞前夜)
 */
function getEarlyCloseDays(year: number): string[] {
  // 感恩节后的周五 (黑五) – 通常提前收盘
  const thanksgiving = getNthWeekdayOfMonth(year, 11, 4, 4);
  const blackFriday = new Date(thanksgiving);
  blackFriday.setDate(thanksgiving.getDate() + 1);
  // 圣诞前夜 (12月24日)
  const xmasEve = new Date(year, 11, 24);
  return [blackFriday.toISOString().split('T')[0], xmasEve.toISOString().split('T')[0]];
}