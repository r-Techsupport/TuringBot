/**
 * @file
 * This file exports helper methods that are used multiple times in modules/other code.
 */

/**
 * Formats the current date to YYYY-MM-DD HH:MM:SS
 * @param date The current date
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
