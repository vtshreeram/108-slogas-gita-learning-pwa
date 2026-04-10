import { ReactNode } from "react";
import { DialogContent } from "@/components/ui/dialog";

type DialogCardProps = {
  children: ReactNode;
  maxWidth?: "max-w-xs sm:max-w-sm" | "max-w-sm" | "max-w-md" | "max-w-lg";
  responsiveRounded?: boolean;
  responsivePadding?: boolean;
};

/**
 * Styled dialog content wrapper with consistent theming.
 * Applies the app's color scheme and spacing to all dialog content.
 *
 * @param maxWidth - Max width constraint (default: max-w-sm, supports responsive like "max-w-xs sm:max-w-sm")
 * @param responsiveRounded - Use responsive border radius for mobile (default: false)
 * @param responsivePadding - Use responsive padding for mobile (default: false)
 * @param children - Dialog content (Header, body, Footer)
 */
export function DialogCard({
  children,
  maxWidth = "max-w-sm",
  responsiveRounded = false,
  responsivePadding = false,
}: DialogCardProps) {
  const roundedClass = responsiveRounded ? "rounded-2xl sm:rounded-3xl" : "rounded-3xl";
  const paddingClass = responsivePadding ? "p-4 sm:p-6" : "p-5";

  return (
    <DialogContent
      className={`${maxWidth} border-[#ccb385] dark:border-[#423321] !bg-white !dark:bg-[#1e1710] ${paddingClass} shadow-2xl ${roundedClass}`}
    >
      {children}
    </DialogContent>
  );
}
