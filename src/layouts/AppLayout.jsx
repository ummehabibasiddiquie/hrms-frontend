import React from "react";
import Header from "../components/header/Header";
import { useAuth } from "../context/AuthContext";

const AppLayout = ({ children }) => {
  const { user: currentUser } = useAuth();

  return (
    <>
      <Header currentUser={currentUser} />

      <main className="p-6 bg-slate-50">
        {children}
      </main>
    </>
  );
};

export default AppLayout;
