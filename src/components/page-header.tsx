import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** One header for every inner screen: back on the left, the page title centred, an optional action on the right. */
export function PageHeader({ title, backHref = "/", backLabel = "Back to reading", action, className = "" }: { title: string; backHref?: string; backLabel?: string; action?: ReactNode; className?: string }) {
  return <header className={`page-header ${className}`}>
    <Link className="icon-button page-header-back" href={backHref} aria-label={backLabel}><ChevronLeft className="h-6 w-6" aria-hidden="true" /></Link>
    <h1 className="page-header-title">{title}</h1>
    <div className="page-header-action">{action}</div>
  </header>;
}
