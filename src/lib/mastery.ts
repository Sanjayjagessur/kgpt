/** What the "unit mastered" moment shows. Built on the server, rendered on the client. */
export type MasteryMoment = {
  unitId: string;
  subjectId: string;
  grade: number;
  position: number;
  title: string;
  lessons: number;
  /** Units mastered in this subject and grade, including this one. */
  mastered: number;
  totalUnits: number;
  nextUnit: { id: string; title: string } | null;
};
