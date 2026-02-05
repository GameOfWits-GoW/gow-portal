import { NgOptimizedImage } from '@angular/common'
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  output,
  signal
} from '@angular/core'
import { ErrorResponse } from '@shared/types/ErrorResponse'
import {
  EllipsisVertical,
  HeartPlus,
  HeartPulse,
  LucideAngularModule,
  Square,
  Vote
} from 'lucide-angular'
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { ConfirmDialogModule } from 'primeng/confirmdialog'
import { MenuModule } from 'primeng/menu'
import { ProgressSpinnerModule } from 'primeng/progressspinner'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { Toast } from 'primeng/toast'
import { Subject, takeUntil, tap } from 'rxjs'
import { StudentAbilityUsageCardComponent } from '~/abilities/components/student-ability-usage-card/student-ability-usage-card.component'
import { StudentAbilityUsageModel } from '~/abilities/models/StudentAbilityUsage.model'
import { StudentAbilityUsageService } from '~/abilities/services/student-ability-usage/student-ability-usage.service'
import { CharacterModel } from '~/characters/models/Character.model'
import { CharacterService } from '~/characters/services/character/character.service'
import { ExperienceSessionModel } from '~/class-sessions/models/ExperienceSession.model'
import { ExperienceSessionService } from '~/class-sessions/services/experience-session/experience-session.service'
import { EliminateStudentByVotesFormDialogComponent } from '~/classrooms/components/eliminate-student-by-votes-form-dialog/eliminate-student-by-votes-form-dialog.component'
import {
  ModifyStudentHealthPointsFormDialogComponent,
  ModifyStudentHealthPointsSuccess
} from '~/classrooms/components/modify-student-health-points-form-dialog/modify-student-health-points-form-dialog.component'
import { ClassroomAdminPanelContextService } from '~/classrooms/contexts/classroom-admin-panel-context/classroom-admin-panel-context.service'
import { classShiftFormats } from '~/shared/data/classShiftFormats'
import { commonErrorMessages } from '~/shared/data/commonErrorMessages'
import { ClassShift } from '~/shared/models/ClassShift'
import { ErrorMessages } from '~/shared/types/ErrorMessages'
import { ShadowWarfareStudentPeriodState } from '~/students/models/ShadowWarfareStudentPeriodState'
import { StudentPeriodStateService } from '~/students/services/student-period-state/student-period-state.service'
import { TeamModel } from '~/teams/models/Team.model'
import { TeamService } from '~/teams/services/team/team.service'

const reviveStudentErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const studentAbilityUsagesErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const studentsErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const endOfExperienceSessionErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const charactersLoadingErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const teamsLoadingErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

// TODO: Componetizar todo este panel
@Component({
  selector: 'gow-shadow-warfare-experience-panel',
  templateUrl: './shadow-warfare-experience-panel.component.html',
  imports: [
    StudentAbilityUsageCardComponent,
    TableModule,
    ProgressSpinnerModule,
    MenuModule,
    ButtonModule,
    Toast,
    NgOptimizedImage,
    LucideAngularModule,
    ModifyStudentHealthPointsFormDialogComponent,
    EliminateStudentByVotesFormDialogComponent,
    ConfirmDialogModule,
    TagModule
  ],
  providers: [MessageService, ConfirmationService]
})
export class ShadowWarfareExperiencePanelComponent
  implements OnInit, OnDestroy
{
  public readonly optionsIcon = EllipsisVertical
  public readonly stopIcon = Square
  public readonly modifyHealthPointsIcon = HeartPulse
  public readonly eliminateForVotesIcon = Vote
  public readonly reviveIcon = HeartPlus

  public readonly classShiftFormats = classShiftFormats
  public readonly classShift = ClassShift

  private destroy$ = new Subject<void>()

  private readonly studentPeriodStateService = inject(StudentPeriodStateService)
  private readonly experienceSessionService = inject(ExperienceSessionService)
  private readonly studentAbilityUsageService = inject(
    StudentAbilityUsageService
  )
  private readonly characterService = inject(CharacterService)
  private readonly teamService = inject(TeamService)

  private readonly classroomContext = inject(ClassroomAdminPanelContextService)
  private readonly toastService = inject(MessageService)
  private readonly confirmationService = inject(ConfirmationService)

  public isStudentsLoading = signal<boolean>(true)
  public students = signal<ShadowWarfareStudentPeriodState[]>([])

  public isExperienceSessionEndingLoading = signal<boolean>(false)

  public isStudentAbilitiesUsagesLoading = signal<boolean>(true)
  public studentAbilityUsages = signal<StudentAbilityUsageModel[]>([])

  public isCharactersLoading = signal<boolean>(true)
  public characters = signal<CharacterModel[]>([])

  public isTeamsLoading = signal<boolean>(true)
  public teams = signal<TeamModel[]>([])

  public showModifyStudentHealthPointsDialog = signal<boolean>(false)
  public modifyStudentHealthPointsSelected = signal<{
    periodStateId: string | null
    fullName: string | null
    currentHealthPoints: number
  }>({
    periodStateId: null,
    fullName: null,
    currentHealthPoints: 0
  })

  public showEliminateStudentByVotesDialog = signal<boolean>(false)
  public eliminateStudentByVotesSelected = signal<{
    periodStateId: string | null
    fullName: string | null
  }>({
    periodStateId: null,
    fullName: null
  })

  public isRevivingStudentLoading = signal<boolean>(false)

  public experienceShiftRule = computed(
    () => this.classroomContext.experienceSession()?.rules?.shift ?? null
  )

  public readonly charactersMap = computed(
    () =>
      new Map(
        this.characters().map(character => [character.id, character.name])
      )
  )

  public readonly teamsMap = computed(
    () => new Map(this.teams().map(team => [team.id, team.name]))
  )

  public adminPanelOverviewLoading = output<boolean>({ alias: 'loading' })

  public isClassShiftUpdatingLoading = signal<boolean>(false)
  public readonly shadowWarfareOptions: MenuItem[] = [
    {
      label: 'Activar turno noche',
      command: () => {
        this.isClassShiftUpdatingLoading.set(true)

        const experienceSessionId =
          this.classroomContext.experienceSession()?.id ?? null

        if (experienceSessionId == null) return

        this.experienceSessionService
          .startNightShiftExperienceSession(experienceSessionId)
          .then(() => {
            this.classroomContext.experienceSession.update(
              experienceSession => {
                if (experienceSession == null) return experienceSession
                return {
                  ...experienceSession,
                  rules: { shift: ClassShift.NIGHT }
                }
              }
            )
          })
          .finally(() => {
            this.isClassShiftUpdatingLoading.set(false)
          })
      }
    }
  ]

  ngOnInit(): void {
    const classroomId = this.classroomContext.classroom()?.id ?? null
    const academicPeriodId =
      this.classroomContext.activeAcademicPeriod()?.id ?? null
    const experienceSession = this.classroomContext.experienceSession()

    if (
      classroomId === null ||
      academicPeriodId === null ||
      experienceSession === null
    )
      return

    this.loadAllTeams(classroomId)
    this.loadAllCharacters(classroomId)
    this.loadStudents({ classroomId, academicPeriodId })
    this.loadStudentAbilitiesUsages(experienceSession)
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  public onOpenReviveStudent(studentPeriodStateId: string, event: Event) {
    const student = this.students().find(
      student => student.id === studentPeriodStateId
    )

    if (student === undefined) return

    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `¿Estas seguro de revivir al estudiante "${student.firstName + ' ' + student.lastName}"?`,
      header: 'Revivir estudiante',
      rejectLabel: 'Cancelar',
      rejectButtonProps: {
        label: 'Cancelar',
        severity: 'secondary',
        outlined: true,
        loading: this.isRevivingStudentLoading()
      },
      acceptButtonProps: {
        label: 'Revivir',
        severity: 'success',
        loading: this.isRevivingStudentLoading()
      },
      accept: async () => {
        this.isRevivingStudentLoading.set(true)

        try {
          await this.studentPeriodStateService.reviveStudentPeriodState(
            studentPeriodStateId
          )

          this.students.update(students => {
            const studentIndex = students.findIndex(
              student => student.id === studentPeriodStateId
            )

            if (studentIndex === -1) return students

            students[studentIndex].healthPoints =
              this.classroomContext.classroom()?.experiences.SHADOW_WARFARE
                .healthPointsBase ?? 0

            return students
          })
        } catch (err) {
          const error = err as ErrorResponse
          this.onShowReviveStudentErrorMessage(error.code)
        } finally {
          this.isRevivingStudentLoading.set(false)
        }
      }
    })
  }

  public onSuccessModifyStudentHealthPoints(
    result: ModifyStudentHealthPointsSuccess
  ) {
    this.students.update(students => {
      const studentIndex = students.findIndex(
        student => student.id === result.studentPeriodStateId
      )

      if (studentIndex === -1) return students

      students[studentIndex].healthPoints = result.newStudentHealthPoints

      return students
    })
  }

  public onSuccessEliminateStudentByVotes(studentPeriodStateId: string) {
    this.students.update(students => {
      const studentIndex = students.findIndex(
        student => student.id === studentPeriodStateId
      )

      if (studentIndex === -1) return students

      students[studentIndex].healthPoints = 0

      return students
    })
  }

  public onOpenModifyStudentHealthPointsDialog(studentPeriodStateId: string) {
    const student = this.students().find(
      student => student.id === studentPeriodStateId
    )

    if (student === undefined) return

    this.showModifyStudentHealthPointsDialog.set(true)
    this.modifyStudentHealthPointsSelected.set({
      currentHealthPoints: student.healthPoints,
      fullName: student.firstName + ' ' + student.lastName,
      periodStateId: student.id
    })
  }

  public onCloseModifyStudentHealthPointsDialog() {
    this.showModifyStudentHealthPointsDialog.set(false)
    this.modifyStudentHealthPointsSelected.set({
      currentHealthPoints: 0,
      fullName: null,
      periodStateId: null
    })
  }

  public onOpenEliminateStudentByVotesDialog(studentPeriodStateId: string) {
    const student = this.students().find(
      student => student.id === studentPeriodStateId
    )

    if (student === undefined) return

    this.showEliminateStudentByVotesDialog.set(true)
    this.eliminateStudentByVotesSelected.set({
      fullName: student.firstName + ' ' + student.lastName,
      periodStateId: student.id
    })
  }

  public onCloseEliminateStudentByVotesDialog() {
    this.showEliminateStudentByVotesDialog.set(false)
    this.eliminateStudentByVotesSelected.set({
      fullName: null,
      periodStateId: null
    })
  }

  public onEndOfExperienceSession() {
    const experienceSessionId =
      this.classroomContext.experienceSession()?.id ?? null

    if (experienceSessionId === null) return

    this.isExperienceSessionEndingLoading.set(true)

    this.experienceSessionService
      .endOfExperienceSession(experienceSessionId)
      .then(() => {
        this.adminPanelOverviewLoading.emit(true)
        this.classroomContext.experienceSession.set(null)
      })
      .catch(err => {
        const error = err as ErrorResponse
        this.onShowEndOfExperienceSessionErrorMessage(error.code)
      })
      .finally(() => {
        this.isExperienceSessionEndingLoading.set(false)
        this.adminPanelOverviewLoading.emit(false)
      })
  }

  public getCharacterName(characterId: string): string | null {
    return this.charactersMap().get(characterId) ?? null
  }

  public getTeamName(teamId: string): string | null {
    return this.teamsMap().get(teamId) ?? null
  }

  private loadAllTeams(classroomId: string) {
    this.teamService.getAllTeamsByClassroom(classroomId).subscribe({
      next: teams => {
        this.teams.set(teams)
        this.isTeamsLoading.set(false)
      },
      error: err => {
        const error = err as ErrorResponse
        this.onShowTeamsLoadingErrorMessage(error.code)
      }
    })
  }

  private loadAllCharacters(classroomId: string) {
    this.characterService.getAllCharactersByClassroom(classroomId).subscribe({
      next: characters => {
        this.characters.set(characters)
        this.isCharactersLoading.set(false)
      },
      error: err => {
        const error = err as ErrorResponse
        this.onShowCharactersLoadingErrorMessage(error.code)
      }
    })
  }

  private loadStudentAbilitiesUsages(
    experienceSession: ExperienceSessionModel
  ) {
    this.studentAbilityUsageService
      .watchByExperienceSession(experienceSession.id)
      .pipe(
        takeUntil(this.destroy$),
        tap(() => {
          if (this.isStudentAbilitiesUsagesLoading()) {
            this.isStudentAbilitiesUsagesLoading.set(false)
          }
        })
      )
      .subscribe({
        next: studentAbilityUsages => {
          this.studentAbilityUsages.set(studentAbilityUsages)
        },
        error: err => {
          this.isStudentAbilitiesUsagesLoading.set(false)
          const error = err as ErrorResponse
          this.onStudentAbilityUsagesErrorMessage(error.code)
        }
      })
  }

  private loadStudents({
    classroomId,
    academicPeriodId
  }: {
    classroomId: string
    academicPeriodId: string
  }) {
    this.studentPeriodStateService
      .getAllShadowWarfareStudentPeriodStates({ classroomId, academicPeriodId })
      .subscribe({
        next: students => {
          this.students.set(
            [...students.sort((a, b) =>
              a.lastName.localeCompare(b.lastName)
            )]
          )
          this.isStudentsLoading.set(false)
        },
        error: err => {
          const error = err as ErrorResponse
          this.onShowStudentsLoadingErrorMessage(error.code)
        }
      })
  }

  private onShowReviveStudentErrorMessage(code: string) {
    const { summary, message } = reviveStudentErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }

  private onShowStudentsLoadingErrorMessage(code: string) {
    const { summary, message } = studentsErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }

  private onShowEndOfExperienceSessionErrorMessage(code: string) {
    const { summary, message } = endOfExperienceSessionErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }

  private onStudentAbilityUsagesErrorMessage(code: string) {
    const { summary, message } = studentAbilityUsagesErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }

  private onShowCharactersLoadingErrorMessage(code: string) {
    const { summary, message } = charactersLoadingErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }

  private onShowTeamsLoadingErrorMessage(code: string) {
    const { summary, message } = teamsLoadingErrorMessages[code]
    this.toastService.add({ summary, detail: message })
  }
}
