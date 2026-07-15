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
  Bolt,
  Check,
  CheckCheck,
  Download,
  EllipsisVertical,
  Gavel,
  LucideAngularModule,
  Minus,
  Plus,
  Square,
  X
} from 'lucide-angular'
import { MessageService } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { ProgressSpinnerModule } from 'primeng/progressspinner'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { Toast } from 'primeng/toast'
import { Subject, takeUntil, tap } from 'rxjs'
import { StudentAbilityUsageCardComponent } from '~/abilities/components/student-ability-usage-card/student-ability-usage-card.component'
import { StudentAbilityUsageModel } from '~/abilities/models/StudentAbilityUsage.model'
import { StudentAbilityUsageService } from '~/abilities/services/student-ability-usage/student-ability-usage.service'
import { ExperienceSessionService } from '~/class-sessions/services/experience-session/experience-session.service'
import {
  ApplyPenaltyToStudentFormDialogComponent,
  ApplyPenaltyToStudentSuccess
} from '~/classrooms/components/apply-penalty-to-student-form-dialog/apply-penalty-to-student-form-dialog.component'
import { ClassroomAdminPanelContextService } from '~/classrooms/contexts/classroom-admin-panel-context/classroom-admin-panel-context.service'
import { LevelModel } from '~/levels/models/Level.model'
import { LevelService } from '~/levels/services/level/level.service'
import { commonErrorMessages } from '~/shared/data/commonErrorMessages'
import { PointsModifier } from '~/shared/models/PointsModifier'
import { ErrorMessages } from '~/shared/types/ErrorMessages'
import { rankingStyles } from '~/students/data/rankingStyles'
import { MasteryRoadStudentPeriodState } from '~/students/models/MasteryRoadStudentPeriodState'
import { MasteryRoadStudentPeriodStateRanking } from '~/students/models/MasteryRoadStudentPeriodStateRanking'
import { StudentPeriodStateService } from '~/students/services/student-period-state/student-period-state.service'
import { calcMasteryRoadStudentPeriodStatesRanking } from '~/students/utils/calcMasteryRoadStudentPeriodStatesRanking'

const studentAbilityUsagesErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const studentsErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const endOfExperienceSessionErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

const modifyStudentProgressPointsErrorMessages: ErrorMessages = {
  ...commonErrorMessages
}

interface StudentPointsEdit {
  studentId: string
  originalPoints: number
  currentPoints: number
}

interface StudentPointsUpdateResult {
  studentId: string
  newLevelId: string
  newProgressPoints: number
}

@Component({
  selector: 'gow-mastery-road-experience-panel',
  templateUrl: './mastery-road-experience-panel.component.html',
  imports: [
    StudentAbilityUsageCardComponent,
    TableModule,
    ProgressSpinnerModule,
    ButtonModule,
    NgOptimizedImage,
    Toast,
    TagModule,
    ApplyPenaltyToStudentFormDialogComponent,
    LucideAngularModule
  ],
  providers: [MessageService]
})
export class MasteryRoadExperiencePanelComponent implements OnInit, OnDestroy {
  public readonly optionsIcon = EllipsisVertical
  public readonly stopIcon = Square
  public readonly plusIcon = Plus
  public readonly minusIcon = Minus
  public readonly applyIcon = Check
  public readonly applyAllIcon = CheckCheck
  public readonly cancelIcon = X
  public readonly modifyPointsIcon = Bolt
  public readonly applyPenaltyIcon = Gavel
  public readonly rankingStyles: Record<
    number,
    { styleClass: string | null; textIcon: string | null } | undefined
  > = rankingStyles
  public readonly downloadIcon = Download

  private destroy$ = new Subject<void>()

  private readonly studentPeriodStateService = inject(StudentPeriodStateService)
  private readonly experienceSessionService = inject(ExperienceSessionService)
  private readonly studentAbilityUsageService = inject(
    StudentAbilityUsageService
  )
  private readonly levelService = inject(LevelService)

  private readonly context = inject(ClassroomAdminPanelContextService)
  private readonly toastService = inject(MessageService)

  public isDownloadingReport = signal<boolean>(false)

  public isExperienceSessionEndingLoading = signal<boolean>(false)

  public isStudentsLoading = signal<boolean>(true)
  public studentsRanking = signal<MasteryRoadStudentPeriodStateRanking[]>([])

  public isStudentAbilitiesUsagesLoading = signal<boolean>(true)
  public studentAbilityUsages = signal<StudentAbilityUsageModel[]>([])

  public levels = signal<LevelModel[]>([])
  public isLevelsLoading = signal<boolean>(true)

  public editingStudentsPointsMap = signal<Map<string, StudentPointsEdit>>(
    new Map()
  )
  public isSavingPoints = signal<boolean>(false)

  public showApplyStudentPenaltyDialog = signal<boolean>(false)
  public applyStudentPenaltySelected = signal<{
    studentPeriodStateId: string | null
    fullName: string | null
    currentProgressPoints: number
  }>({
    studentPeriodStateId: null,
    fullName: null,
    currentProgressPoints: 0
  })

  public readonly levelsMap = computed(
    () => new Map(this.levels().map(level => [level.id, level.name]))
  )

  public readonly hasEditingStudentsPoints = computed(
    () => this.editingStudentsPointsMap().size > 0
  )

  public adminPanelOverviewLoading = output<boolean>({ alias: 'loading' })

  ngOnInit(): void {
    this.loadLevels()
    this.loadStudents()
    this.loadStudentAbilityUsages()
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  public getLevelName(levelId: string): string | null {
    return this.levelsMap().get(levelId) ?? null
  }

  public async onDownloadReport() {
    const classroomId = this.context.classroom()?.id ?? null
    const academicPeriodId = this.context.activeAcademicPeriod()?.id ?? null

    if (classroomId === null || academicPeriodId === null) {
      this.toastService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo obtener la información del aula o período académico'
      })
      return
    }

    this.isDownloadingReport.set(true)

    try {
      const { downloadReportUrl } =
        await this.studentPeriodStateService.downloadReportOfMasteryRoadStudentPeriodStates(
          {
            classroomId,
            academicPeriodId
          }
        )

      window.open(downloadReportUrl, '_blank')

      this.toastService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Reporte generado correctamente'
      })
    } catch (err) {
      const error = err as ErrorResponse
      this.showErrorMessage(
        'Error',
        error.message || 'No se pudo generar el reporte'
      )
    } finally {
      this.isDownloadingReport.set(false)
    }
  }

  public onSuccessApplyPenaltyToStudent(result: ApplyPenaltyToStudentSuccess) {
    this.studentsRanking.update(students => {
      const studentIndex = students.findIndex(
        student => student.state.id === result.studentPeriodStateId
      )

      if (studentIndex === -1) return students

      students[studentIndex].state.progressPoints =
        result.newStudentProgressPoints
      students[studentIndex].state.levelId = result.newLevelId

      return students
    })

    const studentStates = this.studentsRanking().map(student => student.state)

    this.studentsRanking.set(
      calcMasteryRoadStudentPeriodStatesRanking(studentStates)
    )
  }

  public isEditingStudent(studentId: string): boolean {
    return this.editingStudentsPointsMap().has(studentId)
  }

  public getDisplayPoints(student: MasteryRoadStudentPeriodState): number {
    const editing = this.editingStudentsPointsMap().get(student.id)
    if (editing) return editing.currentPoints
    return student.progressPoints
  }

  public getEditingStudent(studentId: string): StudentPointsEdit | null {
    return this.editingStudentsPointsMap().get(studentId) ?? null
  }

  public onIncrementPoints(student: MasteryRoadStudentPeriodState) {
    this.editingStudentsPointsMap.update(map => {
      const newMap = new Map(map)
      const editing = newMap.get(student.id)

      if (editing) {
        newMap.set(student.id, {
          ...editing,
          currentPoints: editing.currentPoints + 1
        })
      } else {
        newMap.set(student.id, {
          studentId: student.id,
          originalPoints: student.progressPoints,
          currentPoints: student.progressPoints + 1
        })
      }

      return newMap
    })
  }

  public onDecrementPoints(student: MasteryRoadStudentPeriodState) {
    this.editingStudentsPointsMap.update(map => {
      const newMap = new Map(map)
      const editing = newMap.get(student.id)

      if (editing) {
        newMap.set(student.id, {
          ...editing,
          currentPoints: Math.max(0, editing.currentPoints - 1)
        })
      } else {
        newMap.set(student.id, {
          studentId: student.id,
          originalPoints: student.progressPoints,
          currentPoints: student.progressPoints - 1
        })
      }

      return newMap
    })
  }

  public onCancelEditingPoints(studentId: string) {
    this.editingStudentsPointsMap.update(map => {
      const newMap = new Map(map)
      newMap.delete(studentId)
      return newMap
    })
  }

  public async onApplyPointsChange(studentId: string) {
    const editing = this.editingStudentsPointsMap().get(studentId)
    const experienceSessionId = this.context.experienceSession()?.id ?? null

    if (!editing || experienceSessionId === null) return

    const pointsDifference = Math.abs(
      editing.currentPoints - editing.originalPoints
    )

    if (pointsDifference === 0) {
      this.onCancelEditingPoints(studentId)
      return
    }

    this.isSavingPoints.set(true)

    this.studentPeriodStateService
      .modifyStudentProgressPoints(studentId, experienceSessionId, {
        modifier:
          editing.originalPoints < editing.currentPoints
            ? PointsModifier.INCREMENT
            : PointsModifier.DECREASE,
        points: pointsDifference
      })
      .then(({ newLevelId, newProgressPoints }) => {
        this.studentsRanking.update(students => {
          const studentIndex = students.findIndex(
            student => student.state.id === editing.studentId
          )

          if (studentIndex === -1) return students

          students[studentIndex].state.progressPoints = newProgressPoints
          students[studentIndex].state.levelId = newLevelId

          return students
        })

        const studentStates = this.studentsRanking().map(
          student => student.state
        )

        this.studentsRanking.set(
          calcMasteryRoadStudentPeriodStatesRanking(studentStates)
        )

        this.editingStudentsPointsMap.update(map => {
          const newMap = new Map(map)
          newMap.delete(studentId)
          return newMap
        })

        this.toastService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Puntos modificados correctamente'
        })
      })
      .catch(err => {
        const error = err as ErrorResponse
        this.showModifyStudentProgressPointsErrorMessage(error.code)
      })
      .finally(() => {
        this.isSavingPoints.set(false)
      })
  }

  public async onApplyAllPointsChanges() {
    const editingStudentsPointsMap = this.editingStudentsPointsMap()
    const experienceSessionId = this.context.experienceSession()?.id ?? null

    if (editingStudentsPointsMap.size === 0 || experienceSessionId === null)
      return

    this.isSavingPoints.set(true)

    const studentsPointsToUpdate = Array.from(
      editingStudentsPointsMap.entries()
    ).filter(
      ([_, editingPoints]) =>
        editingPoints.currentPoints !== editingPoints.originalPoints
    )

    if (studentsPointsToUpdate.length === 0) {
      this.editingStudentsPointsMap.set(new Map())
      this.isSavingPoints.set(false)
      return
    }

    const updatePromises = studentsPointsToUpdate.map(
      async ([studentId, editingPoints]) => {
        const pointsDifference = Math.abs(
          editingPoints.currentPoints - editingPoints.originalPoints
        )

        return this.studentPeriodStateService
          .modifyStudentProgressPoints(studentId, experienceSessionId, {
            points: pointsDifference,
            modifier:
              editingPoints.originalPoints < editingPoints.currentPoints
                ? PointsModifier.INCREMENT
                : PointsModifier.DECREASE
          })
          .then(({ newLevelId, newProgressPoints }) => ({
            studentId,
            newLevelId,
            newProgressPoints
          }))
          .catch(err => {
            const error = err as ErrorResponse
            this.showModifyStudentProgressPointsErrorMessage(error.code)
            return null
          })
      }
    )

    Promise.all(updatePromises)
      .then(studentPointsUpdateResults => {
        const successfulUpdates = studentPointsUpdateResults.filter(
          (result): result is StudentPointsUpdateResult => result !== null
        )

        this.studentsRanking.update(students => {
          successfulUpdates.forEach(
            ({ studentId, newLevelId, newProgressPoints }) => {
              const studentIndex = students.findIndex(
                student => student.state.id === studentId
              )

              if (studentIndex === -1) return

              students[studentIndex].state.progressPoints = newProgressPoints
              students[studentIndex].state.levelId = newLevelId
            }
          )

          return students
        })

        this.editingStudentsPointsMap.update(map => {
          const newMap = new Map(map)
          successfulUpdates.forEach(({ studentId }) => {
            newMap.delete(studentId)
          })
          return newMap
        })

        if (successfulUpdates.length > 0) {
          const studentStates = this.studentsRanking().map(
            student => student.state
          )

          this.studentsRanking.set(
            calcMasteryRoadStudentPeriodStatesRanking(studentStates)
          )

          this.toastService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Puntos modificados correctamente para ${successfulUpdates.length} estudiante(s)`
          })
        }
      })
      .finally(() => {
        this.isSavingPoints.set(false)
      })
  }

  public onOpenApplyStudentPenaltyDialog(studentPeriodStateId: string) {
    const student = this.studentsRanking().find(
      student => student.state.id === studentPeriodStateId
    )

    if (student === undefined) return

    this.showApplyStudentPenaltyDialog.set(true)
    this.applyStudentPenaltySelected.set({
      fullName: student.state.firstName + ' ' + student.state.lastName,
      currentProgressPoints: student.state.progressPoints,
      studentPeriodStateId: student.state.id
    })
  }

  public onCloseApplyStudentPenaltyDialog() {
    this.showApplyStudentPenaltyDialog.set(false)
    this.applyStudentPenaltySelected.set({
      studentPeriodStateId: null,
      currentProgressPoints: 0,
      fullName: null
    })
  }

  public onEndOfExperienceSession() {
    const experienceSessionId = this.context.experienceSession()?.id ?? null

    if (experienceSessionId === null) return

    this.isExperienceSessionEndingLoading.set(true)

    this.experienceSessionService
      .endOfExperienceSession(experienceSessionId)
      .then(() => {
        this.adminPanelOverviewLoading.emit(true)
        this.context.experienceSession.set(null)
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

  private loadStudentAbilityUsages() {
    const experienceSession = this.context.experienceSession()

    if (experienceSession === null) return

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
          this.isStudentAbilitiesUsagesLoading.set(false)
        },
        error: err => {
          this.isStudentAbilitiesUsagesLoading.set(false)
          const error = err as ErrorResponse
          this.onStudentAbilityUsagesErrorMessage(error.code)
        }
      })
  }

  private loadStudents() {
    const classroomId = this.context.classroom()?.id ?? null
    const academicPeriodId = this.context.activeAcademicPeriod()?.id ?? null

    if (classroomId === null || academicPeriodId === null) return

    this.isStudentsLoading.set(true)

    this.studentPeriodStateService
      .getAllMasteryRoadStudentPeriodStates({ classroomId, academicPeriodId })
      .subscribe({
        next: students => {
          this.studentsRanking.set(
            [...calcMasteryRoadStudentPeriodStatesRanking(students)].sort(
              (a, b) => a.state.lastName.localeCompare(b.state.lastName)
            )
          )
          this.isStudentsLoading.set(false)
        },
        error: err => {
          const error = err as ErrorResponse
          this.onShowStudentsLoadingErrorMessage(error.code)
        }
      })
  }

  private loadLevels() {
    const classroomId = this.context.classroom()?.id ?? null

    if (classroomId === null) return

    this.isStudentsLoading.set(true)

    this.levelService.getAllLevelsByClassroom(classroomId).subscribe({
      next: levels => {
        this.levels.set(levels)
        this.isLevelsLoading.set(false)
      },
      error: err => {
        const error = err as ErrorResponse
        this.onShowStudentsLoadingErrorMessage(error.code)
      }
    })
  }

  private onShowStudentsLoadingErrorMessage(code: string) {
    const { summary, message } = studentsErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private onShowEndOfExperienceSessionErrorMessage(code: string) {
    const { summary, message } = endOfExperienceSessionErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private showModifyStudentProgressPointsErrorMessage(code: string) {
    const { summary, message } = modifyStudentProgressPointsErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private onStudentAbilityUsagesErrorMessage(code: string) {
    const { summary, message } = studentAbilityUsagesErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private showErrorMessage(summary: string, detail: string) {
    this.toastService.add({ severity: 'error', summary, detail })
  }
}
