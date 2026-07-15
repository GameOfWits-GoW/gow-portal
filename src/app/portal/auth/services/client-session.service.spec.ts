import { User, authState, signInWithCustomToken } from '@angular/fire/auth'
import { httpsCallable } from '@angular/fire/functions'
import { logEvent } from '@angular/fire/analytics'
import { of } from 'rxjs'
import {
  ClientSessionService,
  UpdateRequiredError,
  clientVersionCode
} from './client-session.service'

jest.mock('@angular/fire/auth', () => ({
  authState: jest.fn(),
  signInWithCustomToken: jest.fn()
}))

jest.mock('@angular/fire/functions', () => ({
  httpsCallable: jest.fn()
}))

jest.mock('@angular/fire/analytics', () => ({
  Analytics: class Analytics {},
  logEvent: jest.fn()
}))

describe('ClientSessionService', () => {
  const callable = jest.fn()
  const normalUser = { uid: 'teacher-1' } as User
  const activatedUser = {
    uid: 'teacher-1',
    getIdTokenResult: jest.fn()
  } as unknown as User

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(httpsCallable).mockReturnValue(callable as never)
    jest.mocked(authState).mockReturnValue(of(normalUser))
    jest.mocked(signInWithCustomToken).mockResolvedValue({
      user: activatedUser
    } as never)
    jest.mocked(activatedUser.getIdTokenResult).mockResolvedValue({
      claims: { gow_session_version: 2 }
    } as never)
  })

  it('activates session and verifies fresh session claim', async () => {
    callable.mockResolvedValue({
      data: { token: 'custom-token', minimumClientVersionCode: 2 }
    })
    const service = new ClientSessionService({} as never, {} as never)

    await expect(service.activate(normalUser)).resolves.toBe(activatedUser)

    expect(httpsCallable).toHaveBeenCalledWith({}, 'activateClientSession')
    expect(callable).toHaveBeenCalledWith({ versionCode: clientVersionCode })
    expect(signInWithCustomToken).toHaveBeenCalledWith({}, 'custom-token')
    expect(activatedUser.getIdTokenResult).toHaveBeenCalledWith(true)
  })

  it('maps UPDATE_REQUIRED without treating other failures as updates', async () => {
    callable.mockRejectedValue({
      code: 'failed-precondition',
      details: { code: 'UPDATE_REQUIRED' }
    })
    const service = new ClientSessionService({} as never, {} as never)

    await expect(service.activate(normalUser)).rejects.toBeInstanceOf(
      UpdateRequiredError
    )
  })

  it('normalizes plain activation failures and reports only safe context', async () => {
    callable.mockRejectedValue('network unavailable')
    const service = new ClientSessionService({} as never, {} as never, {} as never)

    await expect(service.activate(normalUser)).rejects.toThrow(
      'Client session activation failed.'
    )

    expect(logEvent).toHaveBeenCalledWith({}, 'client_session_failure', {
      operation: 'activation',
      reason: 'unknown'
    })
  })

  it('keeps retryable failures unauthenticated and allows a later retry', async () => {
    callable.mockRejectedValueOnce(new Error('network unavailable'))
    callable.mockResolvedValueOnce({
      data: { token: 'custom-token', minimumClientVersionCode: 2 }
    })
    const service = new ClientSessionService({} as never, {} as never)

    await expect(service.activate(normalUser)).rejects.toThrow('network unavailable')
    await expect(service.activate(normalUser)).resolves.toBe(activatedUser)
    expect(callable).toHaveBeenCalledTimes(2)
  })

  it('coalesces restoration and auth-listener activation for same user', async () => {
    let resolveCallable: (value: unknown) => void = () => undefined
    callable.mockReturnValue(
      new Promise(resolve => {
        resolveCallable = resolve
      })
    )
    const service = new ClientSessionService({} as never, {} as never)

    const restored = service.restore()
    const listenerActivation = service.activate(normalUser)

    expect(callable).toHaveBeenCalledTimes(1)
    resolveCallable({
      data: { token: 'custom-token', minimumClientVersionCode: 2 }
    })

    await expect(restored).resolves.toBe(activatedUser)
    await expect(listenerActivation).resolves.toBe(activatedUser)
    expect(callable).toHaveBeenCalledTimes(1)
  })

  it('does not reuse one user activation for another user', async () => {
    const otherUser = { uid: 'teacher-2' } as User
    const otherActivatedUser = {
      uid: 'teacher-2',
      getIdTokenResult: jest.fn().mockResolvedValue({
        claims: { gow_session_version: 2 }
      })
    } as unknown as User
    let resolveFirstCallable: (value: unknown) => void = () => undefined
    let resolveSecondCallable: (value: unknown) => void = () => undefined
    callable
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstCallable = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveSecondCallable = resolve
          })
      )
    jest.mocked(signInWithCustomToken).mockImplementation(
      (_auth, token) =>
        Promise.resolve({
          user: token === 'token-1' ? activatedUser : otherActivatedUser
        } as never)
    )
    const service = new ClientSessionService({} as never, {} as never)

    const firstActivation = service.activate(normalUser)
    const secondActivation = service.activate(otherUser)

    expect(callable).toHaveBeenCalledTimes(2)
    resolveFirstCallable({ data: { token: 'token-1', minimumClientVersionCode: 2 } })
    resolveSecondCallable({ data: { token: 'token-2', minimumClientVersionCode: 2 } })

    await expect(firstActivation).resolves.toBe(activatedUser)
    await expect(secondActivation).resolves.toBe(otherActivatedUser)
  })

  it('allows only one permission-denied reactivation per user session', async () => {
    callable.mockResolvedValue({
      data: { token: 'custom-token', minimumClientVersionCode: 2 }
    })
    const service = new ClientSessionService(
      { currentUser: activatedUser } as never,
      {} as never
    )

    await service.reactivate(normalUser)
    await service.reactivate(normalUser)

    expect(callable).toHaveBeenCalledTimes(1)
  })
})
