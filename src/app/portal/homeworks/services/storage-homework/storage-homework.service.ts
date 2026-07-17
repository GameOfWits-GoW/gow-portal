import { Injectable, inject } from '@angular/core'
import { User } from '@angular/fire/auth'
import { Storage } from '@angular/fire/storage'
import { ClientSessionService } from '~/auth/services/client-session.service'
import { StorageService } from '~/shared/services/storage.service'

type UploadAuthDiagnostic = {
  idTokenResultCaptured: boolean
  claimsPresent: boolean
  gowSessionVersionPresent: boolean
  gowSessionVersion: string | number | boolean | null
  gowSessionVersionType: string
  issuer?: string
  audience?: string
}

type StorageTransportProbe = {
  attempted: boolean
  timestamp: string
  httpStatus?: number
  networkFailure?: 'request_failed' | 'timed_out'
}

const STORAGE_TRANSPORT_PROBE_TIMEOUT_MS = 1_000

@Injectable({ providedIn: 'root' })
export class StorageHomeworkService {
  private readonly clientSessionService = inject(ClientSessionService)
  private readonly storageService = inject(StorageService)
  private readonly storage = inject(Storage)

  public async uploadHomeworkProblem(
    ids: {
      homeworkId: string
      classroomId: string
      schoolId: string
    },
    image: Blob
  ): Promise<string> {
    const user = await this.clientSessionService.ensureCurrentSession()
    const authDiagnostic = await this.captureAuthDiagnostic(user)
    const path = `schools/${ids.schoolId}/classrooms/${ids.classroomId}/homeworks/${ids.homeworkId}/problems/${crypto.randomUUID()}`
    let transportProbe: StorageTransportProbe = {
      attempted: false,
      timestamp: new Date().toISOString()
    }

    try {
      return await this.storageService.upload(
        path,
        image,
        {
          contentType: image.type
        },
        async () => {
          transportProbe = await this.probeStorageTransport(user)
        }
      )
    } catch (error) {
      console.log(error)
      this.reportUploadFailure(authDiagnostic, transportProbe, error)
      throw error
    }
  }

  private async probeStorageTransport(
    user: User
  ): Promise<StorageTransportProbe> {
    const timestamp = new Date().toISOString()
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      return await Promise.race([
        this.requestStorageTransportProbe(user, controller.signal, timestamp),
        new Promise<StorageTransportProbe>((resolve) => {
          timeout = setTimeout(() => {
            controller.abort()
            resolve({ attempted: true, networkFailure: 'timed_out', timestamp })
          }, STORAGE_TRANSPORT_PROBE_TIMEOUT_MS)
        })
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private async requestStorageTransportProbe(
    user: User,
    signal: AbortSignal,
    timestamp: string
  ): Promise<StorageTransportProbe> {
    let token: string

    try {
      token = await user.getIdToken()
    } catch {
      return { attempted: false, timestamp }
    }

    try {
      if (signal.aborted)
        return { attempted: true, networkFailure: 'timed_out', timestamp }

      const bucket = this.storage.app.options.storageBucket
      if (!bucket) return { attempted: false, timestamp }

      const response = await fetch(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`,
        { headers: { Authorization: `Firebase ${token}` }, signal }
      )
      return { attempted: true, httpStatus: response.status, timestamp }
    } catch {
      return { attempted: true, networkFailure: 'request_failed', timestamp }
    }
  }

  private async captureAuthDiagnostic(
    user: User
  ): Promise<UploadAuthDiagnostic> {
    try {
      const token = await user.getIdTokenResult()
      const claims = token.claims
      const sessionVersion = claims['gow_session_version']
      const sessionVersionType = typeof sessionVersion

      return {
        idTokenResultCaptured: true,
        claimsPresent: claims !== null && typeof claims === 'object',
        gowSessionVersionPresent: Object.hasOwn(claims, 'gow_session_version'),
        gowSessionVersion: this.safeSessionVersion(sessionVersion),
        gowSessionVersionType: sessionVersionType,
        ...this.safeTokenProject(token.claims)
      }
    } catch {
      return {
        idTokenResultCaptured: false,
        claimsPresent: false,
        gowSessionVersionPresent: false,
        gowSessionVersion: null,
        gowSessionVersionType: 'unavailable'
      }
    }
  }

  private safeSessionVersion(value: unknown): string | number | boolean | null {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value
    return null
  }

  private safeTokenProject(claims: Record<string, unknown>): {
    issuer?: string
    audience?: string
  } {
    const audience =
      typeof claims['aud'] === 'string' && /^[a-z0-9-]+$/.test(claims['aud'])
        ? claims['aud']
        : undefined
    const issuer =
      typeof claims['iss'] === 'string' &&
      /^https:\/\/securetoken\.google\.com\/[a-z0-9-]+$/.test(claims['iss'])
        ? claims['iss']
        : undefined

    return { issuer, audience }
  }

  private reportUploadFailure(
    auth: UploadAuthDiagnostic,
    transportProbe: StorageTransportProbe,
    error: unknown
  ): void {
    try {
      const storageError = error as { code?: unknown; message?: unknown }
      // biome-ignore lint/suspicious/noConsole: Temporary browser diagnostic for Storage 403 correlation.
      console.error('homework_storage_upload_failure', {
        timestamp: new Date().toISOString(),
        auth,
        transportProbe,
        storage: {
          code:
            typeof storageError?.code === 'string'
              ? storageError.code
              : 'unknown',
          message: this.safeStorageErrorMessage(storageError?.message)
        }
      })
    } catch {
      // Diagnostics must never affect the upload result.
    }
  }

  private safeStorageErrorMessage(message: unknown): string {
    if (typeof message !== 'string') return 'Unknown Firebase Storage error.'

    return message
      .replace(/(['"])[\s\S]*?\1/g, "'[redacted]'")
      .replace(/\b(?:https?|gs):\/\/\S+/gi, '[redacted-url]')
      .replace(/\b(?:bearer|basic)\s+\S+/gi, '$1 [redacted]')
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[redacted-email]')
      .replace(/\b(?:[a-z0-9._-]+\/){1,}[a-z0-9._-]+\b/gi, '[redacted-path]')
  }
}
