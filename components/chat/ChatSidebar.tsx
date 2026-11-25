"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { useDialogFocusTrap } from "@/hooks/useDialogFocusTrap";
import { deleteChatAction } from "@/lib/db/actions";
import type { ChatSummary } from "@/lib/db/chats";
import { useSidebar } from "./ChatShell";

interface ChatSidebarProps {
  chats: ChatSummary[];
}

export function ChatSidebarSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading saved chats"
      className="flex h-full flex-col gap-4 p-3"
    >
      <div className="h-11 w-full animate-pulse rounded-lg bg-border/60" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-11 w-full animate-pulse rounded-lg bg-border/40"
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatSidebar({ chats }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    closeMobileSidebar,
    triggerNewChat,
    freshChats,
    clearFreshChats,
  } = useSidebar();

  const visibleChats = freshChats ?? chats;

  const [confirmingChat, setConfirmingChat] = useState<ChatSummary | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancelDelete() {
    if (isPending) {
      return;
    }
    setConfirmingChat(null);
    setDeleteError(null);
  }

  function handleConfirmDelete() {
    if (!confirmingChat) {
      return;
    }

    const targetChatId = confirmingChat.id;
    setDeleteError(null);

    startTransition(async () => {
      const result = await deleteChatAction(targetChatId);

      if (result.status === "error") {
        setDeleteError(result.message);
        return;
      }

      clearFreshChats();
      setConfirmingChat(null);

      if (pathname === `/chat/${targetChatId}`) {
        closeMobileSidebar();
        triggerNewChat();
        router.push("/");
      }
    });
  }

  return (
    <>
      <div className="flex h-full flex-col bg-surface text-text">
        <div className="shrink-0 border-b border-border p-3">
          <Link
            href="/"
            onClick={() => {
              closeMobileSidebar();
              triggerNewChat();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <Plus
              className="h-4 w-4 shrink-0 text-accent-strong"
              aria-hidden="true"
            />
            <span>New chat</span>
          </Link>
        </div>

        <nav
          aria-label="Saved chats"
          className="flex-1 min-h-0 overflow-y-auto px-2 py-3"
        >
          <p className="px-2 pb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
            Past chats
          </p>

          {visibleChats.length === 0 ? (
            <p className="px-2 py-4 text-sm leading-relaxed text-text-muted">
              No saved chats yet. Ask a cooking question to start one.
            </p>
          ) : (
            <ul className="space-y-1">
              {visibleChats.map((chat) => {
                const chatHref = `/chat/${chat.id}`;
                const isActive = pathname === chatHref;

                return (
                  <li
                    key={chat.id}
                    className={`group flex items-center gap-1 rounded-lg transition-colors ${
                      isActive
                        ? "bg-user-message text-text"
                        : "text-text-muted hover:bg-background hover:text-text"
                    }`}
                  >
                    <Link
                      href={chatHref}
                      onClick={closeMobileSidebar}
                      aria-current={isActive ? "page" : undefined}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <MessageSquare
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? "text-accent-strong" : "text-text-muted"
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`truncate ${isActive ? "font-medium text-text" : ""}`}
                        title={chat.title}
                      >
                        {chat.title}
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmingChat(chat);
                      }}
                      aria-label={`Delete chat ${chat.title}`}
                      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </div>

      {confirmingChat && (
        <DeleteChatModal
          chatTitle={confirmingChat.title}
          deleteError={deleteError}
          isPending={isPending}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

interface DeleteChatModalProps {
  chatTitle: string;
  deleteError: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteChatModal({
  chatTitle,
  deleteError,
  isPending,
  onCancel,
  onConfirm,
}: DeleteChatModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap({
    isLocked: isPending,
    firstFocusRef: cancelButtonRef,
    lastFocusRef: confirmButtonRef,
    onEscape: onCancel,
  });

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-dialog-title"
      aria-describedby="delete-chat-dialog-description"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-text/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-text sm:p-6">
        <h2
          id="delete-chat-dialog-title"
          className="font-serif text-lg font-semibold text-text sm:text-xl"
        >
          Delete this chat?
        </h2>
        <p
          id="delete-chat-dialog-description"
          className="mt-2 text-sm leading-relaxed text-text-muted"
        >
          Are you sure you want to delete{" "}
          <span className="font-medium text-text">&ldquo;{chatTitle}&rdquo;</span>
          ? All messages in this conversation will be permanently removed.
        </p>

        {deleteError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-warning bg-background px-3 py-2.5 text-sm text-warning"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>{isPending ? "Deleting..." : "Delete chat"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
