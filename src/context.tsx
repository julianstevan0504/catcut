import { createContext, useContext } from "react";
import type { Page, Session } from "./types";

export type AppState = {
  session: Session;
  version: number;
  refresh: () => void;
  refreshSession: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  navigate: (page: Page, conversationId?: string) => void;
};
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext no disponible.");
  return value;
}
