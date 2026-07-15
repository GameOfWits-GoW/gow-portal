import { Injectable, inject } from '@angular/core'
import {
  Auth,
  AuthError,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  UserCredential
} from '@angular/fire/auth'
import { ErrorResponse } from '@shared/types/ErrorResponse'
import {
  ClientSessionService,
  UpdateRequiredError
} from './client-session.service'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private fireAuth = inject(Auth)
  private readonly clientSessionService = inject(ClientSessionService)

  public async signIn(
    email: string,
    password: string
  ): Promise<UserCredential> {
    try {
      const credential = await signInWithEmailAndPassword(this.fireAuth, email, password)
      await this.clientSessionService.activate(credential.user)
      return credential
    } catch (err) {
      if (err instanceof UpdateRequiredError) throw err
      const error = err as AuthError
      throw new ErrorResponse(error.code)
    }
  }

  public async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.fireAuth, email)
    } catch (err) {
      const error = err as AuthError
      throw new ErrorResponse(error.code)
    }
  }

  public async signOut(): Promise<void> {
    try {
      await signOut(this.fireAuth)
      this.clientSessionService.invalidate()
    } catch (err) {
      const error = err as AuthError
      throw new ErrorResponse(error.code)
    }
  }
}
