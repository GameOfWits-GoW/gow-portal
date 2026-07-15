import { DatePipe } from '@angular/common'
import { Component, computed, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { ErrorResponse } from '@shared/types/ErrorResponse'
import { LucideAngularModule, Plus } from 'lucide-angular'
import { MessageService } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { TableModule } from 'primeng/table'
import { Toast } from 'primeng/toast'
import { ClassroomAdminPanelContextService } from '~/classrooms/contexts/classroom-admin-panel-context/classroom-admin-panel-context.service'
import {
  HomeworkGroupFormDialogComponent,
  HomeworkGroupFormSubmit
} from '~/homeworks/components/homework-group-form-dialog/homework-group-form-dialog.component'
import { HomeworkGroupModel } from '~/homeworks/models/HomeworkGroup.model'
import { HomeworkGroupService } from '~/homeworks/services/homework-group/homework-group.service'
import { SectionTitleComponent } from '~/shared/components/ui/section-title/section-title.component'
import { commonErrorMessages } from '~/shared/data/commonErrorMessages'

const homeworkGroupsLoadingErrorMessages = {
  ...commonErrorMessages
}

@Component({
  selector: 'gow-classroom-admin-panel-homeworks',
  templateUrl: './classroom-admin-panel-homeworks.component.html',
  imports: [
    DatePipe,
    TableModule,
    SectionTitleComponent,
    RouterLink,
    Toast,
    ButtonModule,
    LucideAngularModule,
    HomeworkGroupFormDialogComponent
  ],
  providers: [MessageService]
})
export class ClassroomAdminPanelHomeworksPageComponent implements OnInit {
  public readonly addIcon = Plus

  private readonly homeworkGroupService = inject(HomeworkGroupService)

  private readonly context = inject(ClassroomAdminPanelContextService)
  private readonly toastService = inject(MessageService)
  private readonly router = inject(Router)
  private readonly activatedRoute = inject(ActivatedRoute)

  public homeworkGroups = signal<HomeworkGroupModel[]>([])
  public isHomeworkGroupsLoading = signal<boolean>(true)

  public showCreateHomeworkGroup = signal<boolean>(false)

  public deliveredHomeworkGroups = computed(() =>
    this.homeworkGroups().filter(group => group.deliveredAt !== null)
  )
  public notDeliveredHomeworkGroups = computed(() =>
    this.homeworkGroups().filter(group => group.deliveredAt === null)
  )

  ngOnInit(): void {
    this.loadHomeworkGroups()
  }

  public loadHomeworkGroups() {
    const classroomId = this.context.classroom()?.id ?? null

    if (classroomId === null) return

    this.isHomeworkGroupsLoading.set(true)

    this.homeworkGroupService
      .getAllHomeworkGroupsByClassroomAsync(classroomId)
      .then(groups => {
        this.homeworkGroups.set(groups)
        this.isHomeworkGroupsLoading.set(false)
      })
      .catch(err => {
        const error = err as ErrorResponse
        this.showHomeworkGroupsLoadingErrorMessage(error.code)
      })
  }

  public onOpenCreateHomeworkGroup() {
    this.showCreateHomeworkGroup.set(true)
  }

  public onCreateHomeworkGroup(submit: HomeworkGroupFormSubmit) {
    const classroomId = this.context.classroom()?.id ?? null

    if (classroomId === null) return

    this.homeworkGroupService
      .create({ classroomId, name: submit.result.formData.name })
      .then(homeworkGroup => {
        this.router.navigate([`g/${homeworkGroup.id}`], {
          relativeTo: this.activatedRoute
        })
        this.homeworkGroups.update(homeworkGroups => {
          return [...homeworkGroups, homeworkGroup]
        })
        submit.onFinish()
      })
      .catch(err => {
        const error = err as ErrorResponse
        this.showCreateHomeworkGroupErrorMessage(error.code)
      })
  }

  public onCloseDialog() {
    this.showCreateHomeworkGroup.set(false)
  }

  public isBaseDateLimitExpired(baseDateLimit: Date | null, now = new Date()): boolean {
    return baseDateLimit !== null && baseDateLimit <= now
  }

  private showCreateHomeworkGroupErrorMessage(code: string) {
    const { summary, message } = homeworkGroupsLoadingErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private showHomeworkGroupsLoadingErrorMessage(code: string) {
    const { summary, message } = homeworkGroupsLoadingErrorMessages[code]
    this.showErrorMessage(summary, message)
  }

  private showErrorMessage(summary: string, detail: string) {
    this.toastService.add({ severity: 'error', summary, detail })
  }
}
