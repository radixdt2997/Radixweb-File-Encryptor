import { useState } from "react";
import type { TabType } from "./types";
import { useMessage } from "./hooks/useMessage";
import { Tabs } from "./components/Tabs";
import { Message } from "./components/Message";
import { Sender } from "./components/Sender";
import { Recipient } from "./components/Recipient";
import { Legacy } from "./components/Legacy";

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlFileId = urlParams.get("fileId");

  const [activeTab, setActiveTab] = useState<TabType>(
    urlFileId ? "recipient" : "sender",
  );
  const [fileId] = useState<string | null>(urlFileId);
  const { message, showMessage } = useMessage();

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    showMessage(`Switched to ${tab} mode`, "info");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">🔒 Secure File App</h1>

        <Tabs activeTab={activeTab} onTabChange={handleTabChange} />

        {message && <Message text={message.text} type={message.type} />}

        <div className="bg-gray-800 p-6 rounded-lg">
          {activeTab === "sender" && <Sender onMessage={showMessage} />}
          {activeTab === "recipient" && (
            <Recipient fileId={fileId} onMessage={showMessage} />
          )}
          {activeTab === "legacy" && <Legacy onMessage={showMessage} />}
        </div>
      </div>
    </div>
  );
}

export default App;
