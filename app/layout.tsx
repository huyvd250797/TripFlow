import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme.css";
export const metadata: Metadata = {
  title: "TripFlow · Plan. Go. Remember.",
  description:
    "Lập kế hoạch, theo dõi hành trình, kiểm soát ngân sách và lưu lại kỷ niệm chuyến đi.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TripFlow" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B6873",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('tripflow:theme')||'system';if(p!=='light'&&p!=='dark')p='system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.themePreference=p;document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
