import { createContext, useContext, type ReactNode } from 'react';
import type { MetricLoopAgentContextValue } from './metricLoopContracts';

const MetricLoopAgentContext = createContext<MetricLoopAgentContextValue | null>(null);

export function MetricLoopAgentProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: MetricLoopAgentContextValue;
}) {
  return <MetricLoopAgentContext.Provider value={value}>{children}</MetricLoopAgentContext.Provider>;
}

export function useMetricLoopAgent() {
  const value = useContext(MetricLoopAgentContext);

  if (!value) {
    throw new Error('useMetricLoopAgent must be used inside MetricLoopAgentProvider');
  }

  return value;
}
