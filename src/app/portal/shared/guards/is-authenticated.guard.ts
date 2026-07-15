import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import {
  ClientSessionService,
  UpdateRequiredError
} from '~/auth/services/client-session.service'
import { UserService } from '~/shared/services/user.service'
import { AuthStore } from '~/shared/store/auth.store'
import { TeacherProfileModel } from '~/teacher-profile/models/TeacherProfile.model'
import { TeacherProfileService } from '~/teacher-profile/services/teacher-profile/teacher-profile.service'
import { AuthUserMapper } from '../mappers/auth-user.mapper'

export const isAuthenticatedGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore)
  const clientSessionService = inject(ClientSessionService)
  const userService = inject(UserService)
  const teacherProfileService = inject(TeacherProfileService)
  const router = inject(Router)

  try {
    const sessionUser = await clientSessionService.restore()

    if (sessionUser === null) return router.parseUrl('/')

    if (authStore.isAuth() && authStore.authUser()?.id === sessionUser.uid)
      return true

    const user = await userService.getAuthUser()

    let profile: TeacherProfileModel

    try {
      profile = await teacherProfileService.getTeacherProfileById(user.id)
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      await clientSessionService.reactivate(sessionUser)
      profile = await teacherProfileService.getTeacherProfileById(user.id)
    }

    const authUser = AuthUserMapper.toModel(user, profile)

    authStore.signIn(authUser)

    return true
  } catch (error) {
    clientSessionService.reportGuardFailure(error)
    if (error instanceof UpdateRequiredError)
      return router.parseUrl('/update-required')
    return router.parseUrl('/')
  }
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'permission-denied'
}
