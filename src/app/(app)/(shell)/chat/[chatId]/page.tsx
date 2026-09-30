import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ChatView } from "@/components/chat/chat-view";
import { isSubjectId } from "@/config/subjects";
import { getChat } from "@/server/chat";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/chat/[chatId]">;

async function load(props: Props) {
  const { chatId } = await props.params;
  if (!z.uuid().safeParse(chatId).success) notFound();
  const student = await requireStudent();
  const data = await getChat(chatId);
  if (!data) notFound();
  return { student, ...data };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { chat } = await load(props);
  const t = await getTranslations("chat");
  return { title: chat.title || t("untitled") };
}

export default async function ChatPage(props: Props) {
  const { student, chat, messages } = await load(props);
  return (
    <ChatView
      key={chat.id}
      userId={student.id}
      chatId={chat.id}
      title={chat.title}
      initialMessages={messages}
      initialMode={chat.mode}
      subjects={student.subjects}
      initialSubject={chat.subject_id && isSubjectId(chat.subject_id) ? chat.subject_id : null}
    />
  );
}
