import { MasteryRoadStudentPeriodState } from '~/students/models/MasteryRoadStudentPeriodState'
import { MasteryRoadStudentPeriodStateRanking } from '~/students/models/MasteryRoadStudentPeriodStateRanking'
import { calcMasteryRoadStudentPeriodStatesRanking } from '~/students/utils/calcMasteryRoadStudentPeriodStatesRanking'

const compareNames = (a: string, b: string): number =>
  a.localeCompare(b, 'es', { sensitivity: 'base' })

export const buildMasteryRoadPanelStudentRanking = (
  students: MasteryRoadStudentPeriodState[]
): MasteryRoadStudentPeriodStateRanking[] =>
  calcMasteryRoadStudentPeriodStatesRanking(students).sort(
    (a, b) =>
      compareNames(a.state.lastName, b.state.lastName) ||
      compareNames(a.state.firstName, b.state.firstName) ||
      a.state.id.localeCompare(b.state.id)
  )
