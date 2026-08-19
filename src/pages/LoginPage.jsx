import React, { useState } from "react";
import { User, Lock, LogIn, Loader2, Eye, EyeOff, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { loginUser, forgotPassword } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { useDeviceInfo } from "../hooks/useDeviceInfo";
import { log, logError } from "../config/environment";



// Role ID to role string mapping
const ROLE_MAP = {
  1: "SUPER_ADMIN",
  2: "ADMIN",
  3: "PROJECT_MANAGER",
  4: "ASSISTANT_MANAGER",
  5: "QA_AGENT",
  6: "AGENT"
};

// Email format checker
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const LoginPage = () => {
    console.log('[LoginPage] Component loaded/rendered at:', new Date().toISOString());
    
    // Block Ctrl+Shift+C and F12 to prevent opening dev tools/console
    React.useEffect(() => {
      const blockConsoleShortcuts = (e) => {
        // Block Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Block F12
        if (e.key === 'F12' || e.code === 'F12') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      window.addEventListener('keydown', blockConsoleShortcuts, true);
      return () => {
        window.removeEventListener('keydown', blockConsoleShortcuts, true);
      };
    }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Frontend validation errors
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Backend field-specific errors
  const [backendUsernameError, setBackendUsernameError] = useState("");
  const [backendPasswordError, setBackendPasswordError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);

  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { device_id, device_type } = useDeviceInfo();

  // Redirect logged-in users away from login page
  React.useEffect(() => {
    if (user && window.location.pathname !== "/dashboard" && window.location.pathname !== "/agent") {
      // Role-based redirect for already logged-in users
      const roleId = Number(user.role_id);
      if (roleId === 6) {
        navigate("/agent", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, navigate]);


  // LIVE email validation
  const handleUsernameChange = (value) => {
    setUsername(value);
    setBackendUsernameError(""); // clear backend error

    if (!value.trim()) {
      setUsernameError("Please enter your email");
    } else if (!isValidEmail(value)) {
      setUsernameError("Please enter a valid email address");
    } else {
      setUsernameError("");
    }
  };

  // LIVE password validation
  const handlePasswordChange = (value) => {
    setPassword(value);
    setBackendPasswordError(""); // clear backend error

    if (!value.trim()) {
      setPasswordError("Please enter your password");
    } else if (value.length < 6) {
      setPasswordError("Password must be at least 6 characters");
    } else {
      setPasswordError("");
    }
  };

  const handleSubmit = async (e) => {
    console.log('[LoginPage] handleSubmit called, event:', e.type);
    
    // Prevent default form submission and page reload
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[LoginPage] preventDefault and stopPropagation called successfully');
    } else {
      console.error('[LoginPage] Event or preventDefault not available!', e);
    }

    // Clear previous backend errors
    setBackendUsernameError("");
    setBackendPasswordError("");

    // Final validation check
    if (usernameError || passwordError || !username || !password) {
      console.log('[LoginPage] Frontend validation failed');
      
      // Show toast for validation errors
      if (!username && !password) {
        toast.error("Please enter your email and password", { duration: 3000 });
        setUsernameError("Please enter your email");
        setPasswordError("Please enter your password");
      } else if (!username) {
        toast.error("Please enter your email", { duration: 3000 });
        setUsernameError("Please enter your email");
      } else if (!password) {
        toast.error("Please enter your password", { duration: 3000 });
        setPasswordError("Please enter your password");
      } else if (usernameError) {
        toast.error(usernameError, { duration: 3000 });
      } else if (passwordError) {
        toast.error(passwordError, { duration: 3000 });
      }
      
      return;
    }

    console.log('[LoginPage] Starting login request...');
    setIsLoading(true);

    try {
      const response = await loginUser(username, password, device_id, device_type);
      log('[LoginPage] Login successful');
      
      // Backend returns nested structure: response.data.data contains the user
      const userData = response.data?.data || response.data?.user || response.data;
      
      if (!userData || !userData.user_id) {
        setIsLoading(false);
        toast.error('Invalid response format from backend', { duration: 4000 });
        return;
      }
      
      // Check if user account is active
      if (userData.is_active === 0 || userData.is_active === false) {
        setIsLoading(false);
        toast.error("Your account is inactive. Please contact your admin.", { duration: 5000 });
        return;
      }
      
      login(userData);
      
      // Get role ID from user data
      const roleId = Number(userData.role_id);
      const role = ROLE_MAP[roleId] || "";

      toast.success("You are now logged in!", { duration: 4000 });

      // Role-based navigation after login
      if (roleId === 6) {
        // Agents go to tracker entry page
        navigate("/agent", { replace: true });
      } else {
        // All other roles go to dashboard
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error('[LoginPage] ========== ERROR CAUGHT ==========');
      console.error('[LoginPage] Error object:', err);
      console.error('[LoginPage] Error response:', err?.response);
      console.error('[LoginPage] Error response data:', err?.response?.data);
      console.error('[LoginPage] ========== END ERROR ==========');
      logError('[LoginPage] Login failed:', err);
      
      // Extract error message from various possible error formats
      let message = "Invalid credentials";
      
      if (err?.response?.data?.message) {
        message = err.response.data.message;
      } else if (err?.response?.data?.error) {
        message = err.response.data.error;
      } else if (err?.message) {
        message = err.message;
      }
      
      console.log('[LoginPage] Error message extracted:', message);
      
      // Convert message to lowercase for checking
      const lowerMessage = message.toLowerCase();
      
      // Show proper error messages in toast
      if (lowerMessage.includes("email not found") || 
          lowerMessage.includes("user not found") || 
          lowerMessage.includes("email does not exist") ||
          lowerMessage.includes("no user found") ||
          lowerMessage.includes("user does not exist")) {
        console.log('[LoginPage] Showing email not found error');
        const toastId = toast.error("Email not found. Please check your email address.", { duration: 4000 });
        console.log('[LoginPage] Toast ID:', toastId);
        setBackendUsernameError("This email is not registered");
      } else if (lowerMessage.includes("incorrect password") || 
                 lowerMessage.includes("wrong password") ||
                 lowerMessage.includes("invalid password") ||
                 lowerMessage.includes("password is incorrect")) {
        console.log('[LoginPage] Showing password error');
        toast.error("Incorrect password. Please try again.", { duration: 4000 });
        setBackendPasswordError("Password is incorrect");
      } else if (lowerMessage.includes("invalid credentials") || 
                 lowerMessage.includes("invalid email or password")) {
        console.log('[LoginPage] Showing invalid credentials error');
        toast.error("Invalid email or password. Please try again.", { duration: 4000 });
        setBackendUsernameError("Invalid credentials");
      } else if (lowerMessage.includes("email")) {
        console.log('[LoginPage] Showing generic email error');
        toast.error(message, { duration: 4000 });
        setBackendUsernameError(message);
      } else if (lowerMessage.includes("password")) {
        console.log('[LoginPage] Showing generic password error');
        toast.error(message, { duration: 4000 });
        setBackendPasswordError(message);
      } else {
        // General error toast - show whatever message we have
        console.log('[LoginPage] Showing general error');
        toast.error(message || "Login failed. Please try again.", { duration: 4000 });
      }
    } finally {
      console.log('[LoginPage] Finally block, setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async () => {
    // Validate email is entered
    if (!username.trim()) {
      setUsernameError("Please enter your email to reset password");
      toast.error("Please enter your email address", { duration: 3000 });
      return;
    }

    // Validate email format
    if (!isValidEmail(username)) {
      setUsernameError("Please enter a valid email address");
      toast.error("Please enter a valid email address", { duration: 3000 });
      return;
    }

    setIsSendingResetLink(true);

    try {
      const response = await forgotPassword(username, device_id, device_type);
      
      if (response.status === 200) {
        toast.success(
          "Password reset link has been sent to your email. Please check your inbox and spam folder.",
          { duration: 6000 }
        );
      } else {
        toast.error("Failed to send reset link. Please try again.", { duration: 4000 });
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || "Failed to send reset link. Please try again.";
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-xl">
        <div className="bg-[#1e40af] p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Welcome Back</h1>
          <p className="text-blue-100 font-medium">Sign in to TFS Ops Tracker</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <User className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="Enter email"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg 
                    focus:outline-none focus:ring-2 bg-gray-50
                    ${
                      usernameError || backendUsernameError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 focus:ring-blue-500"
                    }`}
                />
              </div>

              {/* Frontend validation */}
              {usernameError && (
                <p className="text-red-600 text-sm mt-1">{usernameError}</p>
              )}

              {/* Backend validation */}
              {!usernameError && backendUsernameError && (
                <p className="text-red-600 text-sm mt-1">
                  {backendUsernameError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg appearance-none
                    focus:outline-none focus:ring-2 bg-gray-50 tracking-widest
                    ${
                      passwordError || backendPasswordError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 focus:ring-blue-500"
                    }`}
                  style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-200"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Frontend validation */}
              {passwordError && (
                <p className="text-red-600 text-sm mt-1">{passwordError}</p>
              )}

              {/* Backend validation */}
              {!passwordError && backendPasswordError && (
                <p className="text-red-600 text-sm mt-1">
                  {backendPasswordError}
                </p>
              )}
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center items-center py-3 rounded-lg text-white gap-2
                ${
                  isLoading
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSendingResetLink}
                className={`text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors inline-flex items-center gap-2
                  ${isSendingResetLink ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSendingResetLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending reset link...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Forgot Password?
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}

export default LoginPage;
