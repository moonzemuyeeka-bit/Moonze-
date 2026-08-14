"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ActionStoreProvider } from "@/components/providers/action-store";
import { CopilotProvider } from "@/components/providers/copilot-provider";
import { CopilotDrawer } from "@/components/layout/copilot-drawer";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ActionStoreProvider>
        <CopilotProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <CopilotDrawer />
          </TooltipProvider>
        </CopilotProvider>
      </ActionStoreProvider>
    </ThemeProvider>
  );
}
