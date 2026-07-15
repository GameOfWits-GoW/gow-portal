import { Injectable, inject } from '@angular/core'
import { ClientSessionService } from '~/auth/services/client-session.service'
import { StorageService } from '~/shared/services/storage.service'

@Injectable({ providedIn: 'root' })
export class StorageHomeworkService {
  private readonly clientSessionService = inject(ClientSessionService)
  private readonly storageService = inject(StorageService)

  public async uploadHomeworkProblem(
    ids: {
      homeworkId: string
      classroomId: string
      schoolId: string
    },
    image: Blob
  ): Promise<string> {
    await this.clientSessionService.ensureCurrentSession()

    return await this.storageService.upload(
      `schools/${ids.schoolId}/classrooms/${ids.classroomId}/homeworks/${ids.homeworkId}/problems/${crypto.randomUUID()}`,
      image,
      { contentType: image.type }
    )
  }
}
