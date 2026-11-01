import { createContext, useContext, type ReactNode } from 'react';
import type { SupplyAgentContextValue } from './contracts';

const SupplyAgentContext = createContext<SupplyAgentContextValue | null>(null);

export function SupplyAgentProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SupplyAgentContextValue;
}) {
  return <SupplyAgentContext.Provider value={value}>{children}</SupplyAgentContext.Provider>;
}

export function useSupplyAgent() {
  const value = useContext(SupplyAgentContext);

  if (!value) {
    throw new Error('useSupplyAgent must be used inside SupplyAgentProvider');
  }

  return value;
}
