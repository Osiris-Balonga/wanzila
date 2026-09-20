import 'server-only'

import { createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'

const scrypt = promisify(scryptCallback)

export const ADMIN_SESSION_COOKIE = 'wanzila_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8

interface AdminRecord {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: 'admin'
  password_hash: string
  active: boolean
}

export interface AdminSession {
  sub: string
  email: string
  name: string
  avatarUrl?: string
  role: 'admin'
  exp: number
}

function sessionSecret() {
  const configured = process.env.ADMIN_SESSION_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_SESSION_SECRET is required in production.')
  return 'wanzila-local-session-secret-change-before-production'
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function signAdminSession(admin: Omit<AdminSession, 'exp'>) {
  const payload = encode(JSON.stringify({ ...admin, exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE }))
  return `${payload}.${signature(payload)}`
}

export function verifyAdminSession(token?: string | null): AdminSession | null {
  if (!token) return null
  const [payload, providedSignature] = token.split('.')
  if (!payload || !providedSignature) return null
  const expectedSignature = signature(payload)
  const provided = Buffer.from(providedSignature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const session = JSON.parse(decode(payload)) as AdminSession
    if (session.role !== 'admin' || session.exp <= Math.floor(Date.now() / 1000)) return null
    return session
  } catch {
    return null
  }
}

async function readAdmins(): Promise<AdminRecord[]> {
  const raw = await readFile(join(process.cwd(), 'db.json'), 'utf8')
  const database = JSON.parse(raw) as { admin_users?: AdminRecord[] }
  return database.admin_users ?? []
}

export async function authenticateAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const admin = (await readAdmins()).find(item => item.active && item.email.toLowerCase() === normalizedEmail)
  if (!admin) return null
  const [algorithm, salt, storedHex] = admin.password_hash.split('$')
  if (algorithm !== 'scrypt' || !salt || !storedHex) return null
  const derived = await scrypt(password, salt, 64) as Buffer
  const stored = Buffer.from(storedHex, 'hex')
  if (stored.length !== derived.length || !timingSafeEqual(stored, derived)) return null
  return { sub: admin.id, email: admin.email, name: admin.name, avatarUrl: admin.avatar_url, role: admin.role } as const
}

export async function getAdminSession() {
  const cookieStore = await cookies()
  return verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
}
