import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { ClientSessionService } from '~/auth/services/client-session.service'
import { UpdateRequiredError } from '~/auth/services/client-session.service'
import { UserService } from '~/shared/services/user.service'
import { AuthStore } from '~/shared/store/auth.store'
import { TeacherProfileService } from '~/teacher-profile/services/teacher-profile/teacher-profile.service'
import { isAuthenticatedGuard } from './is-authenticated.guard'

describe('isAuthenticatedGuard', () => {
  beforeEach(() => TestBed.resetTestingModule())

  it('does not resolve profile data before session activation finishes', async () => {
    let activateSession: (value: { uid: string }) => void = () => undefined
    const session = new Promise<{ uid: string }>(resolve => {
      activateSession = resolve
    })
    const getAuthUser = jest.fn().mockResolvedValue({
      id: 'teacher-1',
      email: 'teacher@example.com',
      photoUrl: null
    })
    const getTeacherProfileById = jest.fn().mockResolvedValue({
      id: 'teacher-1',
      firstName: 'Ada',
      lastName: 'Lovelace'
    })

    TestBed.configureTestingModule({
      providers: [
        { provide: ClientSessionService, useValue: { restore: () => session } },
        { provide: UserService, useValue: { getAuthUser } },
        { provide: TeacherProfileService, useValue: { getTeacherProfileById } },
        {
          provide: AuthStore,
          useValue: {
            isAuth: () => false,
            authUser: () => null,
            signIn: jest.fn()
          }
        },
        {
          provide: Router,
          useValue: { parseUrl: jest.fn(path => path) }
        }
      ]
    })

    const result = TestBed.runInInjectionContext(() => isAuthenticatedGuard(
      {} as never,
      {} as never
    )) as unknown as Promise<unknown>

    expect(getAuthUser).not.toHaveBeenCalled()
    expect(getTeacherProfileById).not.toHaveBeenCalled()

    activateSession({ uid: 'teacher-1' })

    await expect(result).resolves.toBe(true)
    expect(getAuthUser).toHaveBeenCalledTimes(1)
    expect(getTeacherProfileById).toHaveBeenCalledWith('teacher-1')
  })

  it('redirects update-required failures to recovery route', async () => {
    const parseUrl = jest.fn(path => path)
    const reportGuardFailure = jest.fn()

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientSessionService,
          useValue: {
            restore: () => Promise.reject(new UpdateRequiredError()),
            reportGuardFailure
          }
        },
        { provide: UserService, useValue: {} },
        { provide: TeacherProfileService, useValue: {} },
        { provide: AuthStore, useValue: {} },
        { provide: Router, useValue: { parseUrl } }
      ]
    })

    const result = TestBed.runInInjectionContext(() => isAuthenticatedGuard(
      {} as never,
      {} as never
    )) as unknown as Promise<unknown>

    await expect(result).resolves.toBe('/update-required')
    expect(parseUrl).toHaveBeenCalledWith('/update-required')
    expect(reportGuardFailure).toHaveBeenCalledWith(expect.any(UpdateRequiredError))
  })

  it('retries permission-denied profile reads without redirecting to update route', async () => {
    const parseUrl = jest.fn(path => path)
    const reactivate = jest.fn().mockResolvedValue({ uid: 'teacher-1' })
    const getTeacherProfileById = jest
      .fn()
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce({ id: 'teacher-1' })

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientSessionService,
          useValue: {
            restore: () => Promise.resolve({ uid: 'teacher-1' }),
            reactivate,
            reportGuardFailure: jest.fn()
          }
        },
        {
          provide: UserService,
          useValue: { getAuthUser: jest.fn().mockResolvedValue({ id: 'teacher-1' }) }
        },
        { provide: TeacherProfileService, useValue: { getTeacherProfileById } },
        {
          provide: AuthStore,
          useValue: { isAuth: () => false, authUser: () => null, signIn: jest.fn() }
        },
        { provide: Router, useValue: { parseUrl } }
      ]
    })

    const result = TestBed.runInInjectionContext(() => isAuthenticatedGuard(
      {} as never,
      {} as never
    )) as unknown as Promise<unknown>

    await expect(result).resolves.toBe(true)
    expect(reactivate).toHaveBeenCalledWith({ uid: 'teacher-1' })
    expect(parseUrl).not.toHaveBeenCalledWith('/update-required')
  })
})
