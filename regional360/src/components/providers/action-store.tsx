"use client";

import * as React from "react";
import type { ActionStatus, RecommendedAction } from "@/lib/types";

interface ActionStoreValue {
  statuses: Record<string, ActionStatus>;
  custom: RecommendedAction[];
  assignees: Record<string, string>;
  setStatus: (id: string, status: ActionStatus) => void;
  assign: (id: string, to: string) => void;
  addCustom: (action: RecommendedAction) => void;
  statusOf: (id: string) => ActionStatus;
  reset: () => void;
}

const ActionStoreContext = React.createContext<ActionStoreValue | null>(null);
const KEY = "r360-actions";

interface Persisted {
  statuses: Record<string, ActionStatus>;
  custom: RecommendedAction[];
  assignees: Record<string, string>;
}

export function ActionStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<Persisted>({
    statuses: {},
    custom: [],
    assignees: {},
  });

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = React.useCallback((next: Persisted) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<ActionStoreValue>(
    () => ({
      statuses: state.statuses,
      custom: state.custom,
      assignees: state.assignees,
      setStatus: (id, status) =>
        persist({ ...state, statuses: { ...state.statuses, [id]: status } }),
      assign: (id, to) =>
        persist({
          ...state,
          assignees: { ...state.assignees, [id]: to },
          statuses: { ...state.statuses, [id]: "Assigned" },
        }),
      addCustom: (action) => {
        if (state.custom.some((a) => a.id === action.id)) {
          persist({
            ...state,
            statuses: { ...state.statuses, [action.id]: "Accepted" },
          });
          return;
        }
        persist({
          ...state,
          custom: [action, ...state.custom],
          statuses: { ...state.statuses, [action.id]: "Accepted" },
        });
      },
      statusOf: (id) => state.statuses[id] ?? "Open",
      reset: () => persist({ statuses: {}, custom: [], assignees: {} }),
    }),
    [state, persist],
  );

  return (
    <ActionStoreContext.Provider value={value}>
      {children}
    </ActionStoreContext.Provider>
  );
}

export function useActionStore() {
  const ctx = React.useContext(ActionStoreContext);
  if (!ctx)
    throw new Error("useActionStore must be used within ActionStoreProvider");
  return ctx;
}
