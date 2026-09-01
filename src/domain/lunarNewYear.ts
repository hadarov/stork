/**
 * The Chinese zodiac animal turns over at Lunar New Year, not on 1 January, so
 * every baby born in January or early February gets the previous year's animal.
 * That date moves around, so it has to be looked up rather than computed.
 *
 * Values are [month, day] of Lunar New Year, keyed by Gregorian year.
 */
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  1990: [1, 27], 1991: [2, 15], 1992: [2, 4], 1993: [1, 23], 1994: [2, 10],
  1995: [1, 31], 1996: [2, 19], 1997: [2, 7], 1998: [1, 28], 1999: [2, 16],
  2000: [2, 5], 2001: [1, 24], 2002: [2, 12], 2003: [2, 1], 2004: [1, 22],
  2005: [2, 9], 2006: [1, 29], 2007: [2, 18], 2008: [2, 7], 2009: [1, 26],
  2010: [2, 14], 2011: [2, 3], 2012: [1, 23], 2013: [2, 10], 2014: [1, 31],
  2015: [2, 19], 2016: [2, 8], 2017: [1, 28], 2018: [2, 16], 2019: [2, 5],
  2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10],
  2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19],
  2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24],
  2040: [2, 12], 2041: [2, 1], 2042: [1, 22], 2043: [2, 10], 2044: [1, 30],
  2045: [2, 17],
};

/**
 * Outside the table, fall back to 1 February: wrong by at most a fortnight for
 * dates far outside the range this app will realistically see, and never wrong
 * by a whole animal for the great majority of birthdays.
 */
export function lunarNewYearFor(year: number): { month: number; day: number } {
  const entry = LUNAR_NEW_YEAR[year] ?? [2, 1];
  return { month: entry[0], day: entry[1] };
}

/** The zodiac year a date belongs to, which is not always its Gregorian year. */
export function zodiacYearFor(date: Date): number {
  const year = date.getFullYear();
  const { month, day } = lunarNewYearFor(year);
  const beforeNewYear =
    date.getMonth() + 1 < month || (date.getMonth() + 1 === month && date.getDate() < day);
  return beforeNewYear ? year - 1 : year;
}
