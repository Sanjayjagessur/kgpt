import { redirect } from "next/navigation";
import { getStudent } from "@/server/session";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const student = await getStudent();
  if (!student) redirect("/sign-in");
  return children;
}
