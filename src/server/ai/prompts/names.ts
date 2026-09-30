import "server-only";

/** English subject names for prompts (UI names come from messages). */
export const SUBJECT_NAMES: Record<string, string> = {
  "art-design": "Art and Design",
  biology: "Biology",
  business: "Business and Entrepreneurship",
  chemistry: "Chemistry",
  "design-technology": "Design and Technology",
  drama: "Drama",
  english: "English",
  "english-literature": "English Literature",
  "food-textiles": "Food and Textiles",
  french: "French",
  "french-literature": "French Literature",
  ict: "ICT",
  "kreol-morisien": "Kreol Morisien",
  "life-skills": "Life Skills",
  mathematics: "Mathematics",
  "physical-education": "Physical Education",
  physics: "Physics",
  "sexuality-education": "Sexuality Education",
  "social-modern-studies": "Social and Modern Studies",
};

export const STAGE_NAMES = { ncf: "NCF", sc: "School Certificate", hsc: "Higher School Certificate" } as const;
