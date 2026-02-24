import React from 'react';
import type { TabType } from '../types';
import { cn } from '../utils/tailwind';
import { Button } from './ui/Button';

interface TabsProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    disabledTabs?: TabType[];
}

const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: 'sender', label: 'Send File', icon: '📤' },
    { id: 'recipient', label: 'Receive File', icon: '📥' },
    { id: 'legacy', label: 'Legacy Mode', icon: '🔑' },
];

export const Tabs = React.memo(({ activeTab, onTabChange, disabledTabs = [] }: TabsProps) => {
    return (
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-gray-800/50 rounded-lg border border-gray-700 w-fit">
            {tabs.map((tab) => {
                const isDisabled = disabledTabs.includes(tab.id);
                return (
                    <Button
                        key={tab.id}
                        onClick={() => !isDisabled && onTabChange(tab.id)}
                        disabled={isDisabled}
                        className={cn(
                            'px-4 py-2.5 rounded-md font-medium transition-all duration-200 flex items-center gap-2 text-sm',
                            isDisabled
                                ? 'opacity-50 cursor-not-allowed text-gray-500'
                                : activeTab === tab.id
                                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30'
                                  : 'text-gray-300 hover:text-white hover:bg-gray-700/50',
                        )}
                        aria-selected={activeTab === tab.id}
                        aria-disabled={isDisabled}
                        role="tab"
                        title={isDisabled ? 'Access this mode through email link only' : undefined}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </Button>
                );
            })}
        </div>
    );
});

Tabs.displayName = 'Tabs';
