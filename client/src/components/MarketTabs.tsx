import React from 'react';

interface Props {
  statTypes: string[];
  activeStatType: string;
  onChange: (statType: string) => void;
}

const ALL_TAB = '';

const formatLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const MarketTabs: React.FC<Props> = ({ statTypes, activeStatType, onChange }) => {
  const tabs: { value: string; label: string }[] = [
    { value: ALL_TAB, label: 'All' },
    ...statTypes.map((s) => ({ value: s, label: formatLabel(s) }))
  ];

  return (
    <div className="tabs-container" role="tablist" aria-label="Filter markets by stat type">
      {tabs.map((tab) => {
        const isActive = activeStatType === tab.value;
        return (
          <button
            key={tab.value || 'all'}
            role="tab"
            aria-selected={isActive}
            className={`tab${isActive ? ' tab-active' : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
