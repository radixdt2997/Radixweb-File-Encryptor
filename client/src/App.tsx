import { useCallback, useEffect, useState } from "react";
import { api, setAuthErrorHandler } from "./api/client";
import { Legacy } from "./components/Legacy";
import { Login } from "./components/Login";
import { Recipient } from "./components/Recipient";
import { Sender } from "./components/Sender";
import { Tabs } from "./components/Tabs";
import { Transactions } from "./components/Transactions";
import { Alert } from "./components/ui/Alert";
import { Button } from "./components/ui/Button";
import { env } from "./config/env";
import { useMessage } from "./hooks/useMessage";
import { useAuthStore } from "./stores/authStore";
import type { TabType } from "./types";

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlFileId = urlParams.get("fileId");

  const [activeTab, setActiveTab] = useState<TabType>(
    urlFileId ? "recipient" : "sender",
  );
  const [fileId] = useState<string | null>(urlFileId);
  const { message, showMessage, clearMessage } = useMessage();
  const { token, user, logout } = useAuthStore();

  // Rehydrate: validate token on load
  useEffect(() => {
    const t = useAuthStore.getState().token;
    if (!t) return;
    api
      .getMe(t)
      .then((res) => {
        useAuthStore.getState().setUser(res.user);
      })
      .catch(() => {
        useAuthStore.getState().logout();
      });
  }, []);

  // Global 401 handler: logout and show message when session expires
  useEffect(() => {
    setAuthErrorHandler(() => {
      useAuthStore.getState().logout();
      showMessage("Session expired", "info");
    });
  }, [showMessage]);

  const handleResetRecipient = () => {
    window.history.replaceState({}, "", window.location.pathname);
    setActiveTab("sender");
    showMessage("Reset complete", "info");
  };

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      showMessage(`Switched to ${tab} mode`, "info");
    },
    [showMessage],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 backdrop-blur-md bg-slate-900/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🔒</div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Secure File App
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Zero-knowledge encrypted file sharing
                </p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {user.email}
                  {user.role === "admin" && (
                    <span className="ml-2 text-cyan-400">Admin</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    showMessage("Logged out", "info");
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Log out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toast Container - Fixed Position */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50">
          <Alert
            text={message.text}
            type={message.type}
            onClose={clearMessage}
            autoClose={true}
            duration={
              message.type === "error"
                ? env.toast.durationError
                : env.toast.durationDefault
            }
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <Tabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          disabledTabs={
            (fileId
              ? token
                ? []
                : ["transactions"]
              : ["recipient", ...(token ? [] : ["transactions"])]) as TabType[]
          }
        />

        {/* Tab Content: Send and Transactions require login; Recipient and Legacy do not */}
        <div className="animate-in fade-in duration-300 pt-2">
          {activeTab === "sender" && !token && (
            <Login
              onSuccess={() => setActiveTab("sender")}
              onMessage={showMessage}
            />
          )}
          {activeTab === "sender" && token && (
            <Sender onMessage={showMessage} />
          )}
          {activeTab === "transactions" && !token && (
            <Login
              onSuccess={() => setActiveTab("transactions")}
              onMessage={showMessage}
            />
          )}
          {activeTab === "transactions" && token && <Transactions />}
          {activeTab === "recipient" && (
            <Recipient
              fileId={fileId}
              onMessage={showMessage}
              onReset={handleResetRecipient}
            />
          )}
          {activeTab === "legacy" && <Legacy onMessage={showMessage} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-slate-900/50 mt-16 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
          <p>
            🔐 All encryption happens client-side. Your files are never stored
            unencrypted.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
