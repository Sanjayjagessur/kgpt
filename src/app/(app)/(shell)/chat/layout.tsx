import { ChatHistoryProvider, ChatPageSlot } from "@/components/chat/chat-history";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { listChats } from "@/server/chat";
import { requireStudent } from "@/server/session";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  const chats = await listChats();

  return (
    <ChatHistoryProvider initial={chats}>
      {/* Cancels the shell's bottom padding: the composer provides its own. */}
      <div className="-mb-28 flex gap-8 md:-mb-16">
        <aside className="sticky top-[6.5rem] hidden h-[calc(100dvh-8rem)] w-64 shrink-0 md:flex">
          <ChatSidebar className="w-full" />
        </aside>
        <div className="min-w-0 flex-1">
          <ChatPageSlot>{children}</ChatPageSlot>
        </div>
      </div>
    </ChatHistoryProvider>
  );
}
