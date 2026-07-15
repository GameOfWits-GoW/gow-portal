import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import {
  ClientSessionService,
  UpdateRequiredError
} from '~/auth/services/client-session.service'
import { catchError, from, of, switchMap, throwError } from 'rxjs'
import { SchoolService } from '~/schools/services/school/school.service'
import { SchoolGradeYearService } from '~/schools/services/school-grade-year/school-grade-year.service'
import { DefaultSchoolStore } from '../store/default-school.store'

export const getDefaultSchoolGuard: CanActivateFn = () => {
  const schoolService = inject(SchoolService)
  const schoolGradeYearService = inject(SchoolGradeYearService)
  const defaultSchoolStore = inject(DefaultSchoolStore)
  const clientSessionService = inject(ClientSessionService)
  const router = inject(Router)

  const loadDefaultSchool = () =>
    schoolService.getFirstSchool().pipe(
      switchMap(async school => {
        if (school == null) return router.parseUrl('/')

        defaultSchoolStore.setSchool(school)

        try {
          const gradeYears = await schoolGradeYearService.getGradeYearBySchoolId(
            school.id
          )
          defaultSchoolStore.setSchoolGradeYears(gradeYears)

          return true
        } catch {
          return router.parseUrl('/')
        }
      })
    )

  return from(clientSessionService.restore()).pipe(
    switchMap(user => {
      if (user === null) return of(router.parseUrl('/'))

      return loadDefaultSchool().pipe(
        catchError(error => {
          if (!isPermissionDenied(error)) return throwError(() => error)
          return from(clientSessionService.reactivate(user)).pipe(
            switchMap(() => loadDefaultSchool())
          )
        })
      )
    }),
    catchError(error => {
      clientSessionService.reportGuardFailure(error)
      return of(
        router.parseUrl(
          error instanceof UpdateRequiredError ? '/update-required' : '/'
        )
      )
    })
  )
}

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'permission-denied'
}
