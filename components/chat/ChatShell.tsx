"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PanelLeftClose, X } from "lucide-react";
import { listChatsAction } from "@/lib/db/actions";
import type { ChatSummary } from "@/lib/db/chats";

interface SidebarContextValue {
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  closeMobileSidebar: () => void;
  registerNewChatHandler: (handler: () => void) => () => void;
  triggerNewChat: () => void;
  freshChats: ChatSummary[] | null;
  refreshChats: () => Promise<void>;
  clearFreshChats: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a ChatShell.");
  }
  return ctx;
}

interface ChatShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function ChatShell({ sidebar, children }: ChatShellProps) {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [freshChats, setFreshChats] = useState<ChatSummary[] | null>(null);
  const newChatHandlerRef = useRef<(() => void) | null>(null);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const refreshChats = useCallback(async () => {
    const chats = await listChatsAction();
    if (chats) {
      setFreshChats(chats);
    }
  }, []);

  const clearFreshChats = useCallback(() => {
    setFreshChats(null);
  }, []);

  const registerNewChatHandler = useCallback((handler: () => void) => {
    newChatHandlerRef.current = handler;
    return () => {
      if (newChatHandlerRef.current === handler) {
        newChatHandlerRef.current = null;
      }
    };
  }, []);

  const triggerNewChat = useCallback(() => {
    newChatHandlerRef.current?.();
  }, []);

  const toggleSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsDesktopOpen((prev) => !prev);
      return;
    }
    setIsMobileOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    }

    function handlePopState() {
      setIsMobileOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMobileOpen]);

  return (
    <SidebarContext.Provider
      value={{
        isDesktopOpen,
        isMobileOpen,
        toggleSidebar,
        closeMobileSidebar,
        registerNewChatHandler,
        triggerNewChat,
        freshChats,
        refreshChats,
        clearFreshChats,
      }}
    >
      <div
        className="relative flex w-full overflow-hidden bg-background text-text"
        style={{
          height: "var(--app-viewport-height, 100dvh)",
          top: "var(--app-viewport-top, 0px)",
        }}
      >
        {isMobileOpen && (
          <div
            aria-hidden="true"
            onClick={closeMobileSidebar}
            className="fixed inset-0 z-40 bg-text/30 lg:hidden"
          />
        )}

        <aside
          aria-label="Chat history"
          className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform duration-200 lg:static lg:z-auto lg:w-72 lg:shrink-0 lg:transition-none ${
            isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full invisible pointer-events-none"
          } ${
            isDesktopOpen
              ? "lg:flex lg:translate-x-0 lg:visible lg:pointer-events-auto"
              : "lg:hidden"
          }`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 sm:py-2.5 landscape:py-1.5">
            <span className="font-serif text-base font-semibold text-text">
              Chat history
            </span>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Collapse chat history sidebar"
              className="hidden lg:inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={closeMobileSidebar}
              aria-label="Close chat history sidebar"
              className="inline-flex lg:hidden min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1">{sidebar}</div>
        </aside>

        <div className="relative h-full min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
