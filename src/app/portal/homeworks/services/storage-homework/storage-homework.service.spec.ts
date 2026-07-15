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
    const ensureCurrentSession = jest.fn().mockResolvedValue({ uid: 'teacher-1' })
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

    await expect(service.uploadHomeworkProblem({
      schoolId: 'school-1',
      classroomId: 'classroom-1',
      homeworkId: 'homework-1'
    }, image)).resolves.toBe('uploaded-path')

    expect(ensureCurrentSession).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^schools\/school-1\/classrooms\/classroom-1\/homeworks\/homework-1\/problems\//),
      image,
      { contentType: 'image/png' }
    )
    expect(ensureCurrentSession.mock.invocationCallOrder[0]).toBeLessThan(
      upload.mock.invocationCallOrder[0]
    )
  })

  it('does not upload when current session validation fails', async () => {
    const upload = jest.fn()
    TestBed.configureTestingModule({
      providers: [
        StorageHomeworkService,
        {
          provide: ClientSessionService,
          useValue: { ensureCurrentSession: () => Promise.reject(new Error('invalid')) }
        },
        { provide: StorageService, useValue: { upload } }
      ]
    })
    const service = TestBed.inject(StorageHomeworkService)

    await expect(service.uploadHomeworkProblem({
      schoolId: 'school-1',
      classroomId: 'classroom-1',
      homeworkId: 'homework-1'
    }, new Blob())).rejects.toThrow('invalid')

    expect(upload).not.toHaveBeenCalled()
  })
})
