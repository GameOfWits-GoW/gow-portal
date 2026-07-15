import { ClassroomAdminPanelHomeworksPageComponent } from './classroom-admin-panel-homeworks.component'

describe('ClassroomAdminPanelHomeworksPageComponent', () => {
  const component = Object.create(
    ClassroomAdminPanelHomeworksPageComponent.prototype
  ) as ClassroomAdminPanelHomeworksPageComponent
  const now = new Date('2026-07-14T12:00:00.000Z')

  it('does not mark a missing deadline as expired', () => {
    expect(component.isBaseDateLimitExpired(null, now)).toBe(false)
  })

  it('does not mark a future deadline as expired', () => {
    expect(
      component.isBaseDateLimitExpired(new Date('2026-07-14T12:00:00.001Z'), now)
    ).toBe(false)
  })

  it('marks a past deadline as expired', () => {
    expect(
      component.isBaseDateLimitExpired(new Date('2026-07-14T11:59:59.999Z'), now)
    ).toBe(true)
  })

  it('marks a deadline at the exact reference time as expired', () => {
    expect(component.isBaseDateLimitExpired(new Date(now), now)).toBe(true)
  })
})
