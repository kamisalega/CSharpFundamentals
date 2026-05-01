import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { headers } from "next/headers";
import { theme } from "./theme";

export const metadata: Metadata = {
  title: "Hotel WhatsApp Bot",
  description: "Hotel booking bot",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let nonce: string | undefined;
  try {
    nonce = (await headers()).get("x-csp-nonce") ?? undefined;
  } catch {
    nonce = undefined;
  }

  return (
    <html lang="pl">
      <body suppressHydrationWarning>
        <AppRouterCacheProvider
          options={{
            enableCssLayer: true,
            ...(nonce !== undefined && { nonce }),
          }}
        >
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
