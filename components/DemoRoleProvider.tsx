"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { Role } from "@/lib/types";

const STORAGE_KEY = "buddykids-demo-role";
const CHANGE_EVENT = "buddykids-role-change";
const DEFAULT_ROLE: Role = "parent";

function isValidRole(value: string | null): value is Role {
  return value === "parent" || value === "center_admin" || value === "platform_admin";
}

// Sincronizza il ruolo demo con localStorage tramite useSyncExternalStore,
// l'approccio consigliato da React per leggere uno "store" esterno senza
// impostare lo stato dentro un useEffect.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Role {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidRole(stored) ? stored : DEFAULT_ROLE;
}

function getServerSnapshot(): Role {
  return DEFAULT_ROLE;
}

interface DemoRoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const DemoRoleContext = createContext<DemoRoleContextValue>({
  role: DEFAULT_ROLE,
  setRole: () => {},
});

export function DemoRoleProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRole = useCallback((next: Role) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <DemoRoleContext.Provider value={{ role, setRole }}>{children}</DemoRoleContext.Provider>
  );
}

export function useDemoRole() {
  return useContext(DemoRoleContext);
}
