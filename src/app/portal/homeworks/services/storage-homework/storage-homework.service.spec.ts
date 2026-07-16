import { TestBed } from '@angular/core/testing'
import { ClientSessionService } from '~/auth/services/client-session.service'
import { StorageService } from '~/shared/services/storage.service'
import { StorageHomeworkService } from './storage-homework.service'

describe('StorageHomeworkService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule()
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'problem-1')
    })
  })

  it('validates the current session immediately before uploading', async () => {
    const user = {
      getIdTokenResult: jest.fn().mockResolvedValue({
        token: 'raw-jwt-must-not-be-logged',
        claims: { gow_session_version: 2 }
      })
    }
    const ensureCurrentSession = jest.fn().mockResolvedValue(user)
    const upload = jest.fn().mockResolvedValue('uploaded-path')
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        { provide: ClientSessionService, useValue: { ensureCurrentSession } },
        { provide: StorageService, useValue: { upload } }
      ]
    })
    const service = TestBed.inject(StorageHomeworkService)
    const image = new Blob(['problem'], { type: 'image/png' })

    await expect(
      service.uploadHomeworkProblem(
        {
          schoolId: 'school-1',
          classroomId: 'classroom-1',
          homeworkId: 'homework-1'
        },
        image
      )
    ).resolves.toBe('uploaded-path')

    expect(ensureCurrentSession).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^schools\/school-1\/classrooms\/classroom-1\/homeworks\/homework-1\/problems\//
      ),
      image,
      { contentType: 'image/png' }
    )
    expect(ensureCurrentSession.mock.invocationCallOrder[0]).toBeLessThan(
      upload.mock.invocationCallOrder[0]
    )
    expect(user.getIdTokenResult).toHaveBeenCalledWith()
  })

  it('does not upload when current session validation fails', async () => {
    const upload = jest.fn()
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: {
            ensureCurrentSession: () => Promise.reject(new Error('invalid'))
          }
        },
        { provide: StorageService, useValue: { upload } }
      ]
    })
    const service = TestBed.inject(StorageHomeworkService)

    await expect(
      service.uploadHomeworkProblem(
        {
          schoolId: 'school-1',
          classroomId: 'classroom-1',
          homeworkId: 'homework-1'
        },
        new Blob()
      )
    ).rejects.toThrow('invalid')

    expect(upload).not.toHaveBeenCalled()
  })

  it('logs one sanitized diagnostic after an upload failure without changing it', async () => {
    const error = Object.assign(
      new Error(
        "Firebase Storage: User does not have permission to access 'schools/school-1/private.png'."
      ),
      { code: 'storage/unauthorized' }
    )
    const user = {
      getIdTokenResult: jest.fn().mockResolvedValue({
        token: 'raw-jwt-must-not-be-logged',
        claims: {
          gow_session_version: 2,
          iss: 'https://securetoken.google.com/gow-portal',
          aud: 'gow-portal',
          email: 'teacher@example.com',
          sub: 'teacher-1'
        }
      })
    }
    const upload = jest.fn().mockRejectedValue(error)
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: { ensureCurrentSession: () => Promise.resolve(user) }
        },
        { provide: StorageService, useValue: { upload } }
      ]
    })
    const service = TestBed.inject(StorageHomeworkService)

    await expect(
      service.uploadHomeworkProblem(
        {
          schoolId: 'school-1',
          classroomId: 'classroom-1',
          homeworkId: 'homework-1'
        },
        new Blob()
      )
    ).rejects.toBe(error)

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      'homework_storage_upload_failure',
      {
        timestamp: expect.any(String),
        auth: {
          idTokenResultCaptured: true,
          claimsPresent: true,
          gowSessionVersionPresent: true,
          gowSessionVersion: 2,
          gowSessionVersionType: 'number',
          issuer: 'https://securetoken.google.com/gow-portal',
          audience: 'gow-portal'
        },
        storage: {
          code: 'storage/unauthorized',
          message:
            "Firebase Storage: User does not have permission to access '[redacted]'."
        }
      }
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'raw-jwt-must-not-be-logged'
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'teacher@example.com'
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('teacher-1')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'schools/school-1'
    )
  })
})
