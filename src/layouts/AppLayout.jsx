import React from "react";
import Header from "../components/header/Header";
import { useAuth } from "../context/AuthContext";
import AgentGoalStatusModal from "../components/AgentDashboard/AgentGoalStatusModal";

const AppLayout = ({ children }) => {
  const { user: currentUser } = useAuth();
  const isAgent = Number(currentUser?.role_id) === 6;

  return (
    <>
      <Header currentUser={currentUser} />

      <main className="p-6 bg-slate-50">
        {children}
      </main>

      {isAgent && <AgentGoalStatusModal />}
    </>
  );
};

export default AppLayout;