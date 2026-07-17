import { MasteryRoadStudentPeriodState } from '~/students/models/MasteryRoadStudentPeriodState'
import { buildMasteryRoadPanelStudentRanking } from './build-mastery-road-panel-student-ranking'

const students: MasteryRoadStudentPeriodState[] = [
  {
    id: 'student-c',
    firstName: 'Zoé',
    lastName: 'Álvarez',
    levelId: 'level-1',
    progressPoints: 20
  },
  {
    id: 'student-b',
    firstName: 'Ana',
    lastName: 'alvarez',
    levelId: 'level-1',
    progressPoints: 10
  },
  {
    id: 'student-a',
    firstName: 'Ana',
    lastName: 'Álvarez',
    levelId: 'level-1',
    progressPoints: 30
  },
  {
    id: 'student-d',
    firstName: 'Beatriz',
    lastName: 'Benítez',
    levelId: 'level-1',
    progressPoints: 40
  }
]

describe('buildMasteryRoadPanelStudentRanking', () => {
  it('orders students by surname, first name, and id independent of points', () => {
    const result = buildMasteryRoadPanelStudentRanking(students)

    expect(result.map(student => student.state.id)).toEqual([
      'student-a',
      'student-b',
      'student-c',
      'student-d'
    ])
  })

  it('keeps name order while recalculating ranking metadata after points change', () => {
    const updatedStudents = students.map(student =>
      student.id === 'student-b'
        ? { ...student, progressPoints: 50 }
        : student
    )

    const result = buildMasteryRoadPanelStudentRanking(updatedStudents)

    expect(result.map(student => student.state.id)).toEqual([
      'student-a',
      'student-b',
      'student-c',
      'student-d'
    ])
    expect(result.map(student => [student.state.id, student.rank])).toEqual([
      ['student-a', 3],
      ['student-b', 1],
      ['student-c', 4],
      ['student-d', 2]
    ])
    expect(result.find(student => student.state.id === 'student-b')).toMatchObject(
      { vigesimalScore: 20 }
    )
  })
})
