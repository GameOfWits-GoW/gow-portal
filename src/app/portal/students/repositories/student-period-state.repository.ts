import { Injectable, inject } from '@angular/core'
import {
  collection,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  doc,
  documentId,
  Firestore,
  getDoc,
  getDocs,
  QuerySnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from '@angular/fire/firestore'
import { chuckArray } from '@shared/utils/chuckArray'
import { forkJoin, from, map, Observable, of, switchMap } from 'rxjs'
import { AcademicPeriodRespository } from '~/academic-periods/repositories/academic-period.repository'
import { CharacterRepository } from '~/characters/repositories/character.repository'
import { ExperienceSessionRepository } from '~/class-sessions/repositories/experience-session.repository'
import { ClassroomDbModel } from '~/classrooms/models/ClassroomDb.model'
import { ClassroomRepository } from '~/classrooms/repositories/classroom.repository'
import { LevelDbModel } from '~/levels/models/LevelDb.model'
import { LevelRepository } from '~/levels/repositories/level.repository'
import { LevelRewardRepository } from '~/levels/repositories/level-reward.repository'
import { ProgressPointsMovementsRepository } from '~/levels/repositories/progress-points-movements.repository'
import { EducationalExperience } from '~/shared/models/EducationalExperience'
import { PointsModifier } from '~/shared/models/PointsModifier'
import { EliminationMotivation } from '../models/EliminationMotivation.model'
import {
  MasteryRoadExperienceStateDb,
  ShadowWarfareExperienceStateDb,
  StudentPeriodStatesDbModel
} from '../models/StudentPeriodStatesDb.model'
import { EliminatedStudentRepository } from './eliminated-student.repository'
import { StudentRepository } from './student.repository'

@Injectable({ providedIn: 'root' })
export class StudentPeriodStateRepository {
  private readonly firestore = inject(Firestore)

  private readonly levelRepository = inject(LevelRepository)
  private readonly eliminatedStudentRepository = inject(
    EliminatedStudentRepository
  )
  private readonly levelRewardRepository = inject(LevelRewardRepository)

  private static readonly collectionName = 'student_period_states'
  private readonly collectionName = StudentPeriodStateRepository.collectionName

  public async getByIdAsync(
    id: string
  ): Promise<StudentPeriodStatesDbModel | null> {
    const ref = this.getRefById(id)

    const snapshot = await getDoc(ref)
    if (!snapshot.exists()) return null

    return {
      id: snapshot.id,
      ...snapshot.data()
    } as StudentPeriodStatesDbModel
  }

  public async getAllByRefsAndAcademicPeriod(
    academicPeriodId: string,
    ids: DocumentReference[]
  ): Promise<StudentPeriodStatesDbModel[]> {
    const collection = this.getCollectionRef()

    const academicPeriodRef = AcademicPeriodRespository.getRefById(
      this.firestore,
      academicPeriodId
    )

    const studentPeriodStatesChunk = chuckArray(ids, 10)
    const studentperiodStatesSnapshots: DocumentSnapshot[] = []

    const studentPeriodStateChunkPromises = studentPeriodStatesChunk.map(
      async chunk => {
        const studentPeriodStatesQuery = query(
          collection,
          where(documentId(), 'in', chunk),
          where('academicPeriod', '==', academicPeriodRef)
        )
        return await getDocs(studentPeriodStatesQuery)
      }
    )

    const querySnapshots = await Promise.all(studentPeriodStateChunkPromises)

    querySnapshots.forEach(querySnapshot => {
      querySnapshot.docs.forEach(doc => studentperiodStatesSnapshots.push(doc))
    })

    return studentperiodStatesSnapshots
      .filter(snapshot => snapshot.exists())
      .map(
        snapshot =>
          ({
            id: snapshot.id,
            ...snapshot.data()
          }) as StudentPeriodStatesDbModel
      )
  }

  public getAllByClassroomIdAndExperienceSession({
    classroomId,
    academicPeriodId
  }: {
    classroomId: string
    academicPeriodId: string
  }): Observable<StudentPeriodStatesDbModel[]> {
    const classroomRef = ClassroomRepository.getRefById(
      this.firestore,
      classroomId
    )
    const academicPeriodRef = AcademicPeriodRespository.getRefById(
      this.firestore,
      academicPeriodId
    )

    const studentsQuery = StudentRepository.queryAllByClassroomRef(
      this.firestore,
      classroomRef
    )

    return from(getDocs(studentsQuery)).pipe(
      switchMap((studentsSnapshot: QuerySnapshot<DocumentData>) => {
        const studentRefs = studentsSnapshot.docs.map(doc => doc.ref)

        if (studentRefs.length === 0) return of([])

        const studentRefsChunks = chuckArray(studentRefs, 30)

        const studentPeriodStateQueryObservables = studentRefsChunks.map(
          studentRefsChunk => {
            const studentPeriodStatesQuery = query(
              this.getCollectionRef(),
              where('student', 'in', studentRefsChunk),
              where('academicPeriod', '==', academicPeriodRef)
            )

            return from(getDocs(studentPeriodStatesQuery))
          }
        )

        return forkJoin(studentPeriodStateQueryObservables).pipe(
          map((snapshots: QuerySnapshot<DocumentData>[]) => {
            return snapshots.flatMap(snapshot =>
              snapshot.docs.map(
                doc =>
                  ({
                    id: doc.id,
                    ...doc.data()
                  }) as StudentPeriodStatesDbModel
              )
            )
          })
        )
      })
    )
  }

  public async getAllByStudentId(
    studentId: string
  ): Promise<StudentPeriodStatesDbModel[]> {
    const studentRef = StudentRepository.getRefById(this.firestore, studentId)

    const studentPeriodStatesQuery = query(
      this.getCollectionRef(),
      where('student', '==', studentRef)
    )

    const studentPeriodStatesSnapshot = await getDocs(studentPeriodStatesQuery)

    return studentPeriodStatesSnapshot.docs.map(
      doc => ({ id: doc.id, ...doc.data() }) as StudentPeriodStatesDbModel
    )
  }

  public async modifyStudentHealthPoints(
    studentPeriodState: StudentPeriodStatesDbModel,
    data: {
      modifier: PointsModifier
      points: number
    }
  ): Promise<number> {
    const classroomSnapshot = await getDoc(studentPeriodState.classroom)

    const classroom = classroomSnapshot.data() as ClassroomDbModel

    const shadowWarfareStudentExperience = studentPeriodState.experiences[
      EducationalExperience.SHADOW_WARFARE
    ] as ShadowWarfareExperienceStateDb

    let newStudentHealthPoints = shadowWarfareStudentExperience.healthPoints

    if (data.modifier === PointsModifier.INCREMENT) {
      newStudentHealthPoints = Math.min(
        classroom.experiences.SHADOW_WARFARE.healthPointsBase,
        newStudentHealthPoints + data.points
      )
    } else if (data.modifier === PointsModifier.DECREASE) {
      newStudentHealthPoints = Math.max(0, newStudentHealthPoints - data.points)
    }

    if (shadowWarfareStudentExperience.healthPoints === newStudentHealthPoints)
      return shadowWarfareStudentExperience.healthPoints

    const batch = writeBatch(this.firestore)

    const studentPeriodStateRef = this.getRefById(studentPeriodState.id)

    batch.update(studentPeriodStateRef, {
      experiences: {
        ...studentPeriodState.experiences,
        SHADOW_WARFARE: {
          ...shadowWarfareStudentExperience,
          healthPoints: newStudentHealthPoints
        }
      }
    })

    if (newStudentHealthPoints === 0) {
      const eliminatedStudentRef = EliminatedStudentRepository.generateRef(
        this.firestore
      )

      const studentCharacterRef = CharacterRepository.getRefById(
        this.firestore,
        shadowWarfareStudentExperience.character.id
      )
      const studentTeamRef = CharacterRepository.getRefById(
        this.firestore,
        shadowWarfareStudentExperience.team.id
      )

      batch.set(eliminatedStudentRef, {
        studentState: studentPeriodStateRef,
        academicPeriod: studentPeriodState.academicPeriod,
        classroom: studentPeriodState.classroom,
        character: studentCharacterRef,
        team: studentTeamRef,
        eliminatedAt: serverTimestamp(),
        motivation: {
          motive: EliminationMotivation.HEALTH
        }
      })
    }

    await batch.commit()

    return newStudentHealthPoints
  }

  public async eliminateStudentByVotes(
    studentPeriodState: StudentPeriodStatesDbModel,
    votes: number
  ): Promise<void> {
    const batch = writeBatch(this.firestore)

    const shadowWarfareStudentExperience = studentPeriodState.experiences[
      EducationalExperience.SHADOW_WARFARE
    ] as ShadowWarfareExperienceStateDb

    const studentPeriodStateRef = this.getRefById(studentPeriodState.id)

    batch.update(studentPeriodStateRef, {
      experiences: {
        ...studentPeriodState.experiences,
        SHADOW_WARFARE: {
          ...shadowWarfareStudentExperience,
          healthPoints: 0
        }
      }
    })

    const eliminatedStudentRef = EliminatedStudentRepository.generateRef(
      this.firestore
    )

    const studentCharacterRef = CharacterRepository.getRefById(
      this.firestore,
      shadowWarfareStudentExperience.character.id
    )
    const studentTeamRef = CharacterRepository.getRefById(
      this.firestore,
      shadowWarfareStudentExperience.team.id
    )

    batch.set(eliminatedStudentRef, {
      studentState: studentPeriodStateRef,
      academicPeriod: studentPeriodState.academicPeriod,
      classroom: studentPeriodState.classroom,
      character: studentCharacterRef,
      team: studentTeamRef,
      eliminatedAt: serverTimestamp(),
      motivation: {
        motive: EliminationMotivation.VOTE,
        votes: votes
      }
    })

    await batch.commit()
  }

  public async modifyStudentProgressPoints(
    studentPeriodState: StudentPeriodStatesDbModel,
    experienceSessionId: string,
    data: {
      modifier: PointsModifier
      points: number
    }
  ): Promise<{
    newProgressPoints: number
    newLevelId: string
  }> {
    const masteryRoadStudentExperience = studentPeriodState.experiences[
      EducationalExperience.MASTERY_ROAD
    ] as MasteryRoadExperienceStateDb

    let newStudentProgressPoints = masteryRoadStudentExperience.progressPoints

    if (data.modifier === PointsModifier.INCREMENT) {
      newStudentProgressPoints = newStudentProgressPoints + data.points
    } else if (data.modifier === PointsModifier.DECREASE) {
      newStudentProgressPoints = Math.max(
        0,
        newStudentProgressPoints - data.points
      )
    }

    if (
      masteryRoadStudentExperience.progressPoints === newStudentProgressPoints
    )
      return {
        newProgressPoints: masteryRoadStudentExperience.progressPoints,
        newLevelId: masteryRoadStudentExperience.currentLevel.id
      }

    const batch = writeBatch(this.firestore)

    const studentPeriodStateRef = this.getRefById(studentPeriodState.id)

    const classroomLevels = await this.levelRepository.getAllByClassroomIdAsync(
      studentPeriodState.classroom.id
    )

    const currentLevelSnapshot = await getDoc(
      masteryRoadStudentExperience.currentLevel
    )

    const currentLevel = {
      ...currentLevelSnapshot.data(),
      id: currentLevelSnapshot.id
    } as LevelDbModel

    let newCurrentLevel: DocumentReference | null = currentLevelSnapshot.ref
    const newLevelRewards: DocumentReference[] = []

    if (data.modifier === PointsModifier.INCREMENT) {
      const nextLevels = classroomLevels.filter(
        level => currentLevel.requiredPoints < level.requiredPoints
      )

      const studentLevelRewards =
        await this.levelRewardRepository.getAllByStudentPeriodStateIdAsync(
          studentPeriodState.id
        )

      const levelsAchieved: LevelDbModel[] = []

      for (const level of nextLevels) {
        if (level.requiredPoints > newStudentProgressPoints) continue
        levelsAchieved.push(level)
      }

      levelsAchieved.forEach(level => {
        const levelRef = LevelRepository.getRefById(this.firestore, level.id)
        const levelRewardRef = LevelRewardRepository.generateRef(this.firestore)

        if (
          studentLevelRewards.some(
            levelReward => levelReward.achievedLevel.id === level.id
          )
        )
          return

        batch.set(levelRewardRef, {
          achievedLevel: levelRef,
          studentState: studentPeriodStateRef,
          claimed: false
        })

        newLevelRewards.push(levelRewardRef)
      })

      const lastLevelAchieved = levelsAchieved.reduce(
        (currentLevel, nextLevel) => {
          if (!currentLevel) return nextLevel
          return currentLevel.requiredPoints > nextLevel.requiredPoints
            ? currentLevel
            : nextLevel
        },
        null as LevelDbModel | null
      )

      if (lastLevelAchieved !== null)
        newCurrentLevel = LevelRepository.getRefById(
          this.firestore,
          lastLevelAchieved.id
        )
    } else if (data.modifier === PointsModifier.DECREASE) {
      const eligibleLevels = classroomLevels.filter(
        level => level.requiredPoints <= newStudentProgressPoints
      )

      const newLevel = eligibleLevels.reduce(
        (highest, current) => {
          if (!highest) return current
          return current.requiredPoints > highest.requiredPoints
            ? current
            : highest
        },
        null as LevelDbModel | null
      )

      if (newLevel !== null) {
        newCurrentLevel = LevelRepository.getRefById(
          this.firestore,
          newLevel.id
        )
      }
    }

    const experienceSessionRef = ExperienceSessionRepository.getRefById(
      this.firestore,
      experienceSessionId
    )

    const progressPointsMovementRef =
      ProgressPointsMovementsRepository.generateRef(this.firestore)

    batch.set(progressPointsMovementRef, {
      studentState: studentPeriodStateRef,
      experienceSession: experienceSessionRef,
      pointsBefore: masteryRoadStudentExperience.progressPoints,
      pointsAfter: newStudentProgressPoints,
      pointsChanged: data.points,
      createdAt: serverTimestamp(),
      action: data.modifier
    })

    const updatedLevelRewards = [
      ...masteryRoadStudentExperience.levelRewards,
      ...newLevelRewards
    ]

    batch.update(studentPeriodStateRef, {
      experiences: {
        ...studentPeriodState.experiences,
        MASTERY_ROAD: {
          ...masteryRoadStudentExperience,
          levelRewards: updatedLevelRewards,
          progressPoints: newStudentProgressPoints,
          currentLevel: newCurrentLevel
        }
      }
    })

    await batch.commit()

    return {
      newProgressPoints: newStudentProgressPoints,
      newLevelId: newCurrentLevel.id
    }
  }

  public async reviveStudentPeriodState(
    studentPeriodStateId: string
  ): Promise<void> {
    const eliminatedStudent =
      await this.eliminatedStudentRepository.getByStudentPeriodStateId(
        studentPeriodStateId
      )
    if (eliminatedStudent === null) return

    const studentPeriodState = await this.getByIdAsync(studentPeriodStateId)
    if (studentPeriodState === null) return

    const classroomSnapshot = await getDoc(studentPeriodState.classroom)
    const classroom = {
      ...classroomSnapshot.data(),
      id: classroomSnapshot.id
    } as ClassroomDbModel

    const eliminatedStudentRef = EliminatedStudentRepository.getRefById(
      this.firestore,
      eliminatedStudent.id
    )
    const studentPeriodStateRef = this.getRefById(studentPeriodState.id)

    const batch = writeBatch(this.firestore)

    const shadowWarfareStudentExperience = studentPeriodState.experiences[
      EducationalExperience.SHADOW_WARFARE
    ] as ShadowWarfareExperienceStateDb
    const shadowWarfareConfig = classroom.experiences.SHADOW_WARFARE

    batch.delete(eliminatedStudentRef)

    batch.update(studentPeriodStateRef, {
      experiences: {
        ...studentPeriodState.experiences,
        SHADOW_WARFARE: {
          ...shadowWarfareStudentExperience,
          healthPoints: shadowWarfareConfig.healthPointsBase
        }
      }
    })

    await batch.commit()
  }

  private getCollectionRef() {
    return collection(this.firestore, this.collectionName)
  }

  private getRefById(id: string) {
    return doc(this.firestore, `${this.collectionName}/${id}`)
  }

  public static getCollectionRef(db: Firestore) {
    return collection(db, StudentPeriodStateRepository.collectionName)
  }

  public static getRefById(db: Firestore, id: string) {
    return doc(db, `${StudentPeriodStateRepository.collectionName}/${id}`)
  }
}
