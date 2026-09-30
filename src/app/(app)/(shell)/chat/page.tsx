import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatView } from "@/components/chat/chat-view";
import { isSubjectId } from "@/config/subjects";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("chat") };
}

export default async function NewChatPage(props: PageProps<"/chat">) {
  const student = await requireStudent();
  const { subject } = await props.searchParams;
  const initialSubject =
    typeof subject === "string" && isSubjectId(subject) && student.subjects.includes(subject) ? subject : null;

  return (
    <ChatView
      userId={student.id}
      chatId={null}
      title=""
      initialMessages={[]}
      initialMode="auto"
      subjects={student.subjects}
      initialSubject={initialSubject}
    />
  );
}
