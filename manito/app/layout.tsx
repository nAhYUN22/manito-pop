import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "마니또 팝 — 우리 사이, 작은 비밀",
  description: "이름을 모으고, 두근두근 섞고, 나의 마니또만 살짝 확인하세요.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
