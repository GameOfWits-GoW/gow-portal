import { TestBed } from '@angular/core/testing'
import { Storage } from '@angular/fire/storage'
import { ClientSessionService } from '~/auth/services/client-session.service'
import { StorageService } from '~/shared/services/storage.service'
import { StorageHomeworkService } from './storage-homework.service'

describe('StorageHomeworkService', () => {
  const storage = {
    app: {
      options: { storageBucket: 'game-of-wits-96e8b.firebasestorage.app' }
    }
  }

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
        { provide: StorageService, useValue: { upload } },
        { provide: Storage, useValue: storage }
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
      { contentType: 'image/png' },
      expect.any(Function)
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
        { provide: StorageService, useValue: { upload } },
        { provide: Storage, useValue: storage }
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
      getIdToken: jest.fn().mockResolvedValue('raw-jwt-must-not-be-logged'),
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
    const response = { status: 403 }
    const fetchMock = jest.fn().mockResolvedValue(response as Response)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock
    })
    const upload = jest
      .fn()
      .mockImplementation(async (_path, _image, _metadata, beforeUpload) => {
        await beforeUpload()
        throw error
      })
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: { ensureCurrentSession: () => Promise.resolve(user) }
        },
        { provide: StorageService, useValue: { upload } },
        { provide: Storage, useValue: storage }
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
        transportProbe: {
          attempted: true,
          httpStatus: 403,
          timestamp: expect.any(String)
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
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      'game-of-wits-96e8b.firebasestorage.app'
    )
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('Bearer')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://firebasestorage.googleapis.com/v0/b/game-of-wits-96e8b.firebasestorage.app/o?maxResults=1',
      expect.objectContaining({
        headers: { Authorization: 'Firebase raw-jwt-must-not-be-logged' },
        signal: expect.any(AbortSignal)
      })
    )
  })

  it('does not change the upload failure when the transport probe fails', async () => {
    const error = Object.assign(new Error('upload failed'), {
      code: 'storage/unknown'
    })
    const user = {
      getIdToken: jest.fn().mockResolvedValue('raw-jwt-must-not-be-logged'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} })
    }
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockRejectedValue(new TypeError('network down'))
    })
    const upload = jest
      .fn()
      .mockImplementation(async (_path, _image, _metadata, beforeUpload) => {
        await beforeUpload()
        throw error
      })
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: { ensureCurrentSession: () => Promise.resolve(user) }
        },
        { provide: StorageService, useValue: { upload } },
        { provide: Storage, useValue: storage }
      ]
    })

    await expect(
      TestBed.inject(StorageHomeworkService).uploadHomeworkProblem(
        {
          schoolId: 'school-1',
          classroomId: 'classroom-1',
          homeworkId: 'homework-1'
        },
        new Blob()
      )
    ).rejects.toBe(error)

    expect(consoleError).toHaveBeenCalledWith(
      'homework_storage_upload_failure',
      expect.objectContaining({
        transportProbe: {
          attempted: true,
          networkFailure: 'request_failed',
          timestamp: expect.any(String)
        }
      })
    )
  })

  it('continues upload after a pending transport probe times out', async () => {
    jest.useFakeTimers()
    const user = {
      getIdToken: jest.fn().mockResolvedValue('raw-jwt-must-not-be-logged'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} })
    }
    const fetchMock = jest.fn().mockImplementation(
      () => new Promise<Response>(() => undefined)
    )
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock
    })
    const upload = jest
      .fn()
      .mockImplementation(async (_path, _image, _metadata, beforeUpload) => {
        await beforeUpload()
        return 'uploaded-path'
      })
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: { ensureCurrentSession: () => Promise.resolve(user) }
        },
        { provide: StorageService, useValue: { upload } },
        { provide: Storage, useValue: storage }
      ]
    })

    const uploadPromise = TestBed.inject(
      StorageHomeworkService
    ).uploadHomeworkProblem(
      {
        schoolId: 'school-1',
        classroomId: 'classroom-1',
        homeworkId: 'homework-1'
      },
      new Blob()
    )
    await jest.advanceTimersByTimeAsync(1_000)

    await expect(uploadPromise).resolves.toBe('uploaded-path')
    expect(upload).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    jest.useRealTimers()
  })
})
