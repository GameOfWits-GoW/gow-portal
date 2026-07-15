import { inject } from '@angular/core'
import { CanActivateFn, Router, UrlTree } from '@angular/router'
import {
  ClientSessionService,
  UpdateRequiredError
} from '~/auth/services/client-session.service'
import { AuthStore } from '~/shared/store/auth.store'
import { TeacherProfileModel } from '~/teacher-profile/models/TeacherProfile.model'
import { TeacherProfileService } from '~/teacher-profile/services/teacher-profile/teacher-profile.service'
import { AuthUserMapper } from '../mappers/auth-user.mapper'
import { UserMapper } from '../mappers/user.mapper'

export const isNotAuthenticatedGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const router = inject(Router)
  const clientSessionService = inject(ClientSessionService)
  const teacherProfileService = inject(TeacherProfileService)
  const authStore = inject(AuthStore)

  try {
    const user = await clientSessionService.restore()
    if (user === null) return true

    let teacherProfile: TeacherProfileModel

    try {
      teacherProfile = await teacherProfileService.getTeacherProfileById(user.uid)
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      await clientSessionService.reactivate(user)
      teacherProfile = await teacherProfileService.getTeacherProfileById(user.uid)
    }
    const userMapped = UserMapper.toModel(user)
    const authUser = AuthUserMapper.toModel(userMapped, teacherProfile)

    authStore.signIn(authUser)
    return router.parseUrl('/p/general')
  } catch (error) {
    if (error instanceof UpdateRequiredError)
      return router.parseUrl('/update-required')
    return true
  }
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'permission-denied'
}
