import { SubjectArt } from "@/components/common/subject-art";
import { SUBJECT_IDS, subjectStyle } from "@/config/subjects";

/** Decorative grid of every subject in its own colour. */
export function SubjectMosaic() {
  const tiles = [...SUBJECT_IDS, ...SUBJECT_IDS.slice(0, 5)];
  return (
    <div className="absolute inset-0 grid -rotate-6 scale-125 grid-cols-4 gap-4 p-6 opacity-95">
      {tiles.map((id, i) => (
        <div
          key={`${id}-${i}`}
          style={subjectStyle(id)}
          className={`bg-subject-tint flex aspect-[4/3] items-center justify-center rounded-xl ${
            i % 3 === 1 ? "translate-y-8" : ""
          }`}
        >
          <SubjectArt subject={id} className="w-3/4" />
        </div>
      ))}
    </div>
  );
}
