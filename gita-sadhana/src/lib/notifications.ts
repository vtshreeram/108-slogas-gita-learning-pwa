/**
 * Schedules a daily reminder using the Notification API.
 * Since true server-sent Web Push requires a backend, we use a
 * client-side approach: schedule a notification via setTimeout when
 * the app is open, and register a periodic background sync when available.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function scheduleLocalReminder(timeStr: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const [hours, minutes] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  // If time already passed today, schedule for tomorrow
  if (target <= now) target.setDate(target.getDate() + 1)

  const delay = target.getTime() - now.getTime()

  // Store timeout id in sessionStorage so we can clear on re-schedule
  const existingId = sessionStorage.getItem('reminderTimeout')
  if (existingId) clearTimeout(Number(existingId))

  const id = window.setTimeout(() => {
    new Notification('Gita Sadhana', {
      body: "Time for your daily practice 🙏 Don't break your streak!",
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'daily-reminder',
    })
    // Re-schedule for next day
    scheduleLocalReminder(timeStr)
  }, delay)

  sessionStorage.setItem('reminderTimeout', String(id))
}

export function cancelReminder(): void {
  const existingId = sessionStorage.getItem('reminderTimeout')
  if (existingId) {
    clearTimeout(Number(existingId))
    sessionStorage.removeItem('reminderTimeout')
  }
}
