export type UserRole = 'Aggregator' | 'Recycler' | 'MoM'

export interface UserSession {
  facilityId: string
  facilityName: string
  role: UserRole
}

export const SESSION_STORAGE_KEY = 'dhatu_setu_session'

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserSession
    if (parsed && parsed.facilityId && parsed.role) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function setSession(session: UserSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
