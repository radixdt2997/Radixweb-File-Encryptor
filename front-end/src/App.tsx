import { useState, useCallback } from "react";
import type { TabType } from "./types";
import { useMessage } from "./hooks/useMessage";
import { Tabs } from "./components/Tabs";
import { Alert } from "./components/ui/Alert";
import { Sender } from "./components/Sender";
import { Recipient } from "./components/Recipient";
import { Legacy } from "./components/Legacy";
import { env } from "./config/env";

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlFileId = urlParams.get("fileId");

  const [activeTab, setActiveTab] = useState<TabType>(
    urlFileId ? "recipient" : "sender",
  );
  const [fileId] = useState<string | null>(urlFileId);
  const { message, showMessage, clearMessage } = useMessage();

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
          disabledTabs={fileId ? [] : ["recipient"]}
        />

        {/* Tab Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === "sender" && <Sender onMessage={showMessage} />}
          {activeTab === "recipient" && (
            <Recipient fileId={fileId} onMessage={showMessage} />
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
