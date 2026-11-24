"use client";

import React, { createContext, useContext, useState } from "react";

interface ReceivingFullPageContextValue {
  fullPageActive: boolean;
  setFullPageActive: (active: boolean) => void;
}

const ReceivingFullPageContext = createContext<ReceivingFullPageContextValue>({
  fullPageActive: false,
  setFullPageActive: () => {},
});

export function ReceivingFullPageProvider({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [fullPageActive, setFullPageActive] = useState(false);

  return (
    <ReceivingFullPageContext.Provider value={{ fullPageActive, setFullPageActive }}>
      <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
        {!fullPageActive && header}
        {children}
      </div>
    </ReceivingFullPageContext.Provider>
  );
}

export function useReceivingFullPage() {
  return useContext(ReceivingFullPageContext);
}
