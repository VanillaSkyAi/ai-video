import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "VanillaSky AI scene director POC",
  description: "Prompt-driven scene planning with generated images, seek-safe stickers, Lottie motion, and visible creative rationale.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
