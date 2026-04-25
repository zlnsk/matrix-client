import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matrix",
  description: "A premium Matrix client — secure, fast, yours.",
  applicationName: "Matrix",
  // manifest <link> is injected manually below with crossOrigin="use-credentials"
  // so Chrome sends the Pangolin session cookie when fetching it; otherwise the
  // gate 302-redirects the anonymous manifest fetch and Chrome treats the app
  // as non-installable.
  icons: {
    icon: [
      { url: "/Matrix/icon.svg", type: "image/svg+xml" },
      { url: "/Matrix/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/Matrix/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/Matrix/icon-192.png", sizes: "192x192" },
      { url: "/Matrix/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Matrix",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b0d10" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" />
        <link rel="manifest" href="/Matrix/manifest.webmanifest" crossOrigin="use-credentials" />
        <script
          // avoid FOUC for theme
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('matrix:theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t?t==='dark':m;document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}`,
          }}
        />
        <script
          // Mirror visualViewport height into --kb-inset so CSS can keep the
          // composer above the on-screen keyboard even when the browser (iOS
          // Safari in particular) doesn't honour interactive-widget=resizes-content.
          dangerouslySetInnerHTML={{
            __html: `try{(function(){var vv=window.visualViewport;if(!vv)return;var r=function(){var inset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);document.documentElement.style.setProperty('--kb-inset',inset+'px');};vv.addEventListener('resize',r);vv.addEventListener('scroll',r);r();})();}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/Matrix/sw.js',{scope:'/Matrix/'}).catch(function(){});});}`,
          }}
        />
      </body>
    </html>
  );
}
