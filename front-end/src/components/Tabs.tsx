import type { TabType } from "../types";

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Tabs = ({ activeTab, onTabChange }: TabsProps) => {
  const tabs: { id: TabType; label: string }[] = [
    { id: "sender", label: "Send File" },
    { id: "recipient", label: "Receive File" },
    { id: "legacy", label: "Legacy" },
  ];

  return (
    <div className="flex mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-5 py-2 mr-1 cursor-pointer ${
            activeTab === tab.id
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
