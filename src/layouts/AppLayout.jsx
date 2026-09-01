import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/header/Header";
import { useAuth } from "../context/AuthContext";
import { ROUTES } from "../routes/paths";

const AppLayout = ({ children }) => {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <>
      <Header currentUser={currentUser} handleLogout={handleLogout} />
      <main className="p-6 bg-slate-50">{children}</main>
    </>
  );
};

export default AppLayout;
