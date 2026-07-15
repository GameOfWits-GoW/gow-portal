import { Routes } from '@angular/router'
import { ClassroomAdminPanelAbiltiesPageComponent } from '~/abilities/pages/classroom-admin-panel-abilities/classroom-admin-panel-abilities.component'
import { ClassroomAdminPanelAbilityDetailsPageComponent } from '~/abilities/pages/classroom-admin-panel-ability-details/classroom-admin-panel-ability-details.component'
import { AuthLayoutComponent } from '~/auth/layouts/auth-layout/auth-layout.component'
import { ForgotPasswordPageComponent } from '~/auth/pages/forgot-password/forgot-password.component'
import { SignInPageComponent } from '~/auth/pages/sign-in/sign-in.component'
import { ClassroomAdminPanelLayoutComponent } from '~/classrooms/layouts/classroom-admin-panel-layout/classroom-admin-panel-layout.component'
import { ClassroomAdminPanelOverviewPageComponent } from '~/classrooms/pages/classroom-admin-panel-overview/classroom-admin-panel-overview.component'
import { PortalCreateClassroomPageComponent } from '~/classrooms/pages/portal-create-classroom/portal-create-classroom.component'
import { ClassroomAdminPanelHomeworkDetailsPageComponent } from '~/homeworks/pages/classroom-admin-panel-homework-details/classroom-admin-panel-homework-details.component'
import { ClassroomAdminPanelHomeworkGroupDetailsPageComponent } from '~/homeworks/pages/classroom-admin-panel-homework-group-details/classroom-admin-panel-homework-group-details.component'
import { ClassroomAdminPanelHomeworksPageComponent } from '~/homeworks/pages/classroom-admin-panel-homeworks/classroom-admin-panel-homeworks.component'
import { ClassroomAdminPanelLevelsPageComponent } from '~/levels/pages/classroom-admin-panel-levels/classroom-admin-panel-levels.component'
import { ClassroomAdminPanelPenaltiesPageComponent } from '~/penalties/pages/classroom-admin-panel-penalties/classroom-admin-panel-penalties.component'
import { getDefaultSchoolGuard } from '~/shared/guards/default-school.guard'
import { isAuthenticatedGuard } from '~/shared/guards/is-authenticated.guard'
import { isNotAuthenticatedGuard } from '~/shared/guards/is-not-authenticated.guard'
import { PortalLayoutComponent } from '~/shared/layouts/portal-layout/portal-layout.component'
import { LandingPageComponent } from '~/shared/pages/landing/landing.component'
import { PortalGeneralPageComponent } from '~/shared/pages/portal-general/portal-general.component'
import { UpdateRequiredPageComponent } from '~/shared/pages/update-required/update-required.component'
import { ClassroomAdminPanelStudentDetailsPageComponent } from '~/students/pages/classroom-admin-panel-student-details/classroom-admin-panel-student-details.component'
import { ClassroomAdminPanelStudentsPageComponent } from '~/students/pages/classroom-admin-panel-students/classroom-admin-panel-students.component'
import { ClassroomAdminPanelTeamsCharactersPageComponent } from '~/teams/pages/classroom-admin-panel-teams-characters/classroom-admin-panel-teams-characters.component'

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    canActivate: [isNotAuthenticatedGuard]
  },
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [isNotAuthenticatedGuard],
    children: [
      {
        path: 'sign-in',
        component: SignInPageComponent
      },
      {
        path: 'forgot-password',
        component: ForgotPasswordPageComponent
      }
    ]
  },
  {
    path: 'update-required',
    component: UpdateRequiredPageComponent
  },
  {
    path: 'p',
    component: PortalLayoutComponent,
    canActivate: [isAuthenticatedGuard, getDefaultSchoolGuard],
    children: [
      {
        path: 'general',
        component: PortalGeneralPageComponent
      },
      {
        path: 's/:schoolId',
        children: [
          {
            path: 'classroom/create',
            component: PortalCreateClassroomPageComponent
          },
          {
            path: 'c/:classroomId',
            component: ClassroomAdminPanelLayoutComponent,
            children: [
              {
                path: '',
                redirectTo: 'overview',
                pathMatch: 'full'
              },
              {
                path: 'overview',
                component: ClassroomAdminPanelOverviewPageComponent
              },
              {
                path: 'students',
                component: ClassroomAdminPanelStudentsPageComponent
              },
              {
                path: 'students/:studentId',
                component: ClassroomAdminPanelStudentDetailsPageComponent
              },
              {
                path: 'teams',
                component: ClassroomAdminPanelTeamsCharactersPageComponent
              },
              {
                path: 'homeworks',
                children: [
                  {
                    path: '',
                    component: ClassroomAdminPanelHomeworksPageComponent
                  },
                  {
                    path: 'g/:homeworkGroupId',
                    children: [
                      {
                        path: '',
                        component:
                          ClassroomAdminPanelHomeworkGroupDetailsPageComponent
                      },
                      {
                        path: 'h/:homeworkId',
                        component:
                          ClassroomAdminPanelHomeworkDetailsPageComponent
                      }
                    ]
                  }
                ]
              },
              {
                path: 'levels',
                component: ClassroomAdminPanelLevelsPageComponent
              },
              {
                path: 'abilities',
                component: ClassroomAdminPanelAbiltiesPageComponent
              },
              {
                path: 'abilities/:abilityId',
                component: ClassroomAdminPanelAbilityDetailsPageComponent
              },
              {
                path: 'penalties',
                component: ClassroomAdminPanelPenaltiesPageComponent
              }
            ]
          }
        ]
      }
    ]
  }
]
