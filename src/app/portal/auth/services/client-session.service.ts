import { Inject, Injectable, Optional } from '@angular/core'
import {
  Auth,
  User,
  authState,
  signInWithCustomToken
} from '@angular/fire/auth'
import { Functions, httpsCallable } from '@angular/fire/functions'
import { Analytics, logEvent } from '@angular/fire/analytics'
import { firstValueFrom, take } from 'rxjs'

export const clientVersionCode = 2

type ActivateClientSessionRequest = {
  versionCode: number
}

type ActivateClientSessionResponse = {
  token: string
  minimumClientVersionCode: number
}

type CallableFailure = {
  code?: string
  details?: unknown
}

export class UpdateRequiredError extends Error {
  constructor() {
    super('A newer version of this portal is required.')
    this.name = 'UpdateRequiredError'
  }
}

@Injectable({ providedIn: 'root' })
export class ClientSessionService {
  private activatedUserId: string | null = null
  private reactivatedUserId: string | null = null
  private readonly activations = new Map<string, Promise<User>>()

  constructor(
    private readonly auth: Auth,
    private readonly functions: Functions,
    @Optional()
    @Inject(Analytics)
    private readonly analytics: Analytics | null = null
  ) {}

  public async restore(): Promise<User | null> {
    const user = await firstValueFrom(authState(this.auth).pipe(take(1)))

    if (user === null) {
      this.activatedUserId = null
      this.reactivatedUserId = null
      return null
    }

    return this.activate(user)
  }

  public async activate(user: User): Promise<User> {
    if (this.activatedUserId === user.uid) return user
    const inFlightActivation = this.activations.get(user.uid)
    if (inFlightActivation !== undefined) return inFlightActivation

    const activation = this.activateUser(user)
    this.activations.set(user.uid, activation)

    try {
      return await activation
    } finally {
      if (this.activations.get(user.uid) === activation)
        this.activations.delete(user.uid)
    }
  }

  public invalidate(): void {
    this.activatedUserId = null
    this.reactivatedUserId = null
  }

  public async reactivate(user: User): Promise<User> {
    const inFlightActivation = this.activations.get(user.uid)
    if (this.reactivatedUserId === user.uid && inFlightActivation !== undefined)
      return inFlightActivation
    if (this.reactivatedUserId === user.uid)
      return this.auth.currentUser ?? user

    this.reactivatedUserId = user.uid
    this.activatedUserId = null
    return this.activate(user)
  }

  public reportGuardFailure(error: unknown): void {
    this.reportFailure('guard', error)
  }

  private async activateUser(user: User): Promise<User> {
    try {
      const activateClientSession = httpsCallable<
        ActivateClientSessionRequest,
        ActivateClientSessionResponse
      >(this.functions, 'activateClientSession')
      const result = await activateClientSession({
        versionCode: clientVersionCode
      })

      const credential = await signInWithCustomToken(this.auth, result.data.token)
      if (credential.user.uid !== user.uid) {
        throw new Error('Activated session user does not match authenticated user.')
      }
      const token = await credential.user.getIdTokenResult(true)

      if (token.claims['gow_session_version'] === undefined) {
        throw new Error(
          'Activated session token does not contain gow_session_version.'
        )
      }

      this.activatedUserId = credential.user.uid
      return credential.user
    } catch (error) {
      this.activatedUserId = null
      this.reportFailure('activation', error)
      throw this.toSessionError(error)
    }
  }

  private toSessionError(error: unknown): Error {
    const failure =
      typeof error === 'object' && error !== null
        ? (error as CallableFailure)
        : {}
    const details = failure.details as { code?: unknown } | undefined

    if (
      failure.code === 'failed-precondition' &&
      details?.code === 'UPDATE_REQUIRED'
    ) {
      return new UpdateRequiredError()
    }

    return error instanceof Error ? error : new Error('Client session activation failed.')
  }

  private reportFailure(operation: 'activation' | 'guard', error: unknown): void {
    if (this.analytics === null) return

    try {
      logEvent(this.analytics, 'client_session_failure', {
        operation,
        reason: this.failureReason(error)
      })
    } catch {
      // Analytics must not affect authentication or navigation.
    }
  }

  private failureReason(error: unknown): string {
    if (error instanceof UpdateRequiredError) return 'update_required'
    if ((error as { code?: unknown })?.code === 'permission-denied')
      return 'permission_denied'
    return 'unknown'
  }
}
