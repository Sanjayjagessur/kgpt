import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { SubjectMosaic } from "@/components/auth/subject-mosaic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 pt-5 pb-8 sm:px-8 lg:px-14">
        <Link href="/" className="w-fit rounded-md" aria-label="myKPT home">
          <Logo />
        </Link>
        <main id="main" className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside aria-hidden="true" className="relative hidden overflow-hidden bg-sunken lg:block">
        <SubjectMosaic />
      </aside>
    </div>
  );
}
