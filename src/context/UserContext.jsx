// context/UserContext.jsx
import React, { createContext, useContext, useState, useMemo } from 'react';

export const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState({
    name: "John Doe",
    role: "ADMIN", // Change this to test: "AGENT", "PROJECT_MANAGER", "FINANCE_HR"
    designation: "Manager"
  });

  // Memoize derived values
  const value = useMemo(() => {
    const isAgent = currentUser.role === "AGENT";
    const canAccessManage = ["ADMIN", "PROJECT_MANAGER", "FINANCE_HR"].includes(currentUser.role);
    const canAccessQuality = ["ADMIN", "PROJECT_MANAGER", "QA"].includes(currentUser.role);
    const canAccessEntry = isAgent || ["ADMIN", "PROJECT_MANAGER"].includes(currentUser.role);

    return {
      currentUser,
      setCurrentUser,
      isAgent,
      canAccessManage,
      canAccessQuality,
      canAccessEntry
    };
  }, [currentUser]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};