// Filter backend error messages for user-friendly frontend display
function filterApiErrorMessage(msg) {
  if (!msg) return "Something went wrong. Please try again.";
  const lower = msg.toLowerCase();
  if (lower.includes("file") && lower.includes("type")) return "Uploaded file type is not allowed. Only Excel files are accepted.";
  if (lower.includes("file") && lower.includes("size")) return "Uploaded file is too large. Max allowed size is 10MB.";
  if (lower.includes("required")) return "Some required fields are missing. Please check your input.";
  if (lower.includes("duplicate")) return "Duplicate entry detected. Please check your data.";
  if (lower.includes("validation")) return "Some fields failed validation. Please review your input.";
  if (lower.includes("excel")) return "There was a problem processing your Excel file. Please check the format.";
  if (lower.includes("not authorized") || lower.includes("unauthorized")) return "You are not authorized to perform this action.";
  if (lower.includes("timeout")) return "The request timed out. Please try again later.";
  // Default: show a generic error but append the backend reason in parentheses
  return `Action failed. (${msg})`;
}
import React, { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { Download, Trash2, RotateCcw, RefreshCw, Copy, ChevronDown, Clock, Info } from "lucide-react";
import { exportToCSV } from '../../utils/csvExport';
import AppLayout from "../../layouts/AppLayout";
import api from "../../services/api";
import nodeApi from "../../services/nodeApi";
import { fileToBase64 } from "../../utils/fileToBase64";
import { useAuth } from "../../context/AuthContext";
import { log, logError } from "../../config/environment";
import SearchableSelect from "../common/SearchableSelect";
import { Briefcase, ListChecks } from "lucide-react";

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const Tracker = ({ embedded = false }) => {
  // Auth context for user info
  const { user } = useAuth();
  
  // Form states
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [shiftType, setShiftType] = useState("day");
  const [baseTarget, setBaseTarget] = useState("");
  const [baseTargetLoading, setBaseTargetLoading] = useState(false);
  const [productionTarget, setProductionTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileBase64, setFileBase64] = useState(null);
  const [fileError, setFileError] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // File upload progress states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  // AI Evaluation states
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);
  const [aiEvalProgress, setAiEvalProgress] = useState(0);
  const [aiEvalComplete, setAiEvalComplete] = useState(false);
  const [aiEvalSuccess, setAiEvalSuccess] = useState(null); // true = passed, false = failed, null = not checked
  const [aiEvalError, setAiEvalError] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [aiTextualSuggestion, setAiTextualSuggestion] = useState("");

  // Duplicate Check states
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [duplicateCheckProgress, setDuplicateCheckProgress] = useState(0);
  const [duplicateCheckComplete, setDuplicateCheckComplete] = useState(false);
  const [duplicateCheckSuccess, setDuplicateCheckSuccess] = useState(null); // true = passed, false = failed, null = not checked
  const [duplicateCheckError, setDuplicateCheckError] = useState("");
  const [duplicateCheckResult, setDuplicateCheckResult] = useState(null);
  const [geminiApiKey, setGeminiApiKey] = useState(() => sessionStorage.getItem("gemini_api_key") || "");

  // Validation requirements based on project configuration
  const [requiresAIValidation, setRequiresAIValidation] = useState(false);
  const [requiresDuplicateCheck, setRequiresDuplicateCheck] = useState(false);

  // Sync geminiApiKey with sessionStorage
  useEffect(() => {
    const syncKey = () => setGeminiApiKey(sessionStorage.getItem("gemini_api_key") || "");
    window.addEventListener("storage", syncKey);
    window.addEventListener("gemini-key-updated", syncKey);
    return () => {
      window.removeEventListener("storage", syncKey);
      window.removeEventListener("gemini-key-updated", syncKey);
    };
  }, []);

  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [, forceUpdate] = useState(0);

  // Date state for header (default to today)
  const [entryDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Table states
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState("");

  // Filter states for table
  const [filterProject, setFilterProject] = useState("");
  const [filterTask, setFilterTask] = useState("");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Custom calendar/dropdown states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);

  // Time window validation states (15-minute submission window)
  const [isSubmissionWindowOpen, setIsSubmissionWindowOpen] = useState(false);
  const [nextWindowTime, setNextWindowTime] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Helper function to check if current time is within 15-minute submission window
  const checkSubmissionWindow = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes < 15;
  };

  // Helper function to calculate next window opening time
  const getNextWindowTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    
    if (minutes < 15) {
      // Window is open, next window is next hour
      const nextWindow = new Date(now);
      nextWindow.setHours(now.getHours() + 1);
      nextWindow.setMinutes(0);
      nextWindow.setSeconds(0);
      return nextWindow;
    } else {
      // Window is closed, show current hour's window
      const nextWindow = new Date(now);
      nextWindow.setHours(now.getHours() + 1);
      nextWindow.setMinutes(0);
      nextWindow.setSeconds(0);
      return nextWindow;
    }
  };

  // Helper function to format time remaining
  const formatTimeRemaining = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    if (minutes < 15) {
      // Window is open - show time until it closes
      const remainingMinutes = 14 - minutes;
      const remainingSeconds = 60 - seconds;
      return `${remainingMinutes}m ${remainingSeconds}s`;
    } else {
      // Window is closed - show time until next window opens
      const remainingMinutes = 59 - minutes;
      const remainingSeconds = 60 - seconds;
      return `${remainingMinutes}m ${remainingSeconds}s`;
    }
  };

  // Function to reset modal form and all file upload states
  const resetModalForm = () => {
    // Reset basic form fields
    setSelectedProject("");
    setSelectedTask("");
    setShiftType("day");
    setBaseTarget("");
    setProductionTarget("");
    setNotes("");
    
    // Reset file states
    setFile(null);
    setFilePreview(null);
    setFileBase64(null);
    setFileError("");
    
    // Reset upload progress states
    setUploadProgress(0);
    setIsUploading(false);
    setUploadComplete(false);
    
    // Reset AI evaluation states
    setIsAIEvaluating(false);
    setAiEvalProgress(0);
    setAiEvalComplete(false);
    setAiEvalSuccess(null);
    setAiEvalError("");
    setEvaluationResult(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setAiTextualSuggestion("");
    
    // Reset duplicate check states
    setIsDuplicateChecking(false);
    setDuplicateCheckProgress(0);
    setDuplicateCheckComplete(false);
    setDuplicateCheckSuccess(null);
    setDuplicateCheckError("");
    setDuplicateCheckResult(null);
    
    // Reset validation states
    setErrors({});
    setTouched({});
  };

  // Time window validation - update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setIsSubmissionWindowOpen(checkSubmissionWindow());
      setNextWindowTime(getNextWindowTime().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setTimeRemaining(formatTimeRemaining());
    }, 1000);

    // Initial check
    setIsSubmissionWindowOpen(checkSubmissionWindow());
    setNextWindowTime(getNextWindowTime().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    setTimeRemaining(formatTimeRemaining());

    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  // Fetch projects with tasks for form (fetch only once on mount or user change)
  useEffect(() => {
    const fetchProjectsWithTasks = async () => {
      try {
        setLoadingProjects(true);
        log('[Tracker] Fetching projects with tasks from dropdown/get API');
        const payload = {
          dropdown_type: "projects with tasks",
          logged_in_user_id: user?.user_id
        };
        const res = await api.post("/dropdown/get", payload);
        const projectsWithTasks = res.data?.data || [];
        
        setProjects(projectsWithTasks);
      } catch (error) {
        logError('[Tracker] Error fetching projects with tasks:', error);
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };
    if (user?.user_id) {
      fetchProjectsWithTasks();
    }
  }, [user?.user_id]);

  // Update tasks when project changes
  useEffect(() => {
    if (!selectedProject) {
      setTasks([]);
      setSelectedTask("");
      setBaseTarget("");
      setRequiresAIValidation(false);
      setRequiresDuplicateCheck(false);
      return;
    }
    setLoadingTasks(true);
    const project = projects.find(p => String(p.project_id) === String(selectedProject));
    setTasks(project?.tasks || []);
    
    // Set validation requirements based on project configuration
    const requiresAI = project?.requires_ai_evaluation ?? false;
    const requiresDuplicate = project?.requires_duplicate_check ?? false;
    
    setRequiresAIValidation(requiresAI);
    setRequiresDuplicateCheck(requiresDuplicate);
    
    if (!project?.tasks?.find(t => String(t.task_id) === String(selectedTask))) {
      setSelectedTask("");
      setBaseTarget("");
    }
    setLoadingTasks(false);
  }, [selectedProject, projects, selectedTask]);

  // Calculate base target as user_tenure * task_target
  useEffect(() => {
    if (!selectedProject || !selectedTask || !user?.user_tenure) {
      setBaseTarget("");
      return;
    }
    setBaseTargetLoading(true);
    const project = projects.find(p => String(p.project_id) === String(selectedProject));
    const task = project?.tasks?.find(t => String(t.task_id) === String(selectedTask));
    if (task && user.user_tenure) {
      setBaseTarget(Number(task.task_target) * Number(user.user_tenure));
    } else {
      setBaseTarget("");
    }
    setBaseTargetLoading(false);
  }, [selectedProject, selectedTask, projects, user]);

  // Simulate upload progress
  const simulateUploadProgress = () => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);
    setAiEvalComplete(false);
    setDuplicateCheckComplete(false);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadComplete(true);
          toast.success('File uploaded successfully!');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Handle AI Evaluation
  const handleAIEvaluation = async () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    if (!selectedProject || !selectedTask) {
      toast.error('Please select a project and task first');
      return;
    }

    if (!geminiApiKey) {
      toast.error('Gemini API key required — please add it in your profile settings (Brain icon in header).', { duration: 5000 });
      return;
    }

    setIsAIEvaluating(true);
    setAiEvalProgress(0);
    setAiEvalSuccess(null);
    setAiEvalError("");
    setEvaluationResult(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setAiTextualSuggestion("");

    let progressInterval;
    
    try {
      // Create FormData for API call
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user?.user_id || 1);
      formData.append('project_id', Number(selectedProject));
      formData.append('task_id', Number(selectedTask));
      if (geminiApiKey) formData.append('gemini_api_key', geminiApiKey);

      // Simulate progress
      progressInterval = setInterval(() => {
        setAiEvalProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);

      const res = await nodeApi.post('/ai/evaluate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 180000 // 3 minutes
      });

      clearInterval(progressInterval);
      setAiEvalProgress(100);

      if (res.data?.status === 'success' || res.status === 200) {
        setAiEvalSuccess(true);
        setEvaluationResult(res.data?.data || {});
        
        // Handle suggestions if present
        if (res.data?.data?.suggestions && res.data.data.suggestions.length > 0) {
          setSuggestions(res.data.data.suggestions);
          setShowSuggestions(true);
        }
        
        // Handle textual suggestion if present
        if (res.data?.data?.ai_textual_suggestion) {
          setAiTextualSuggestion(res.data.data.ai_textual_suggestion);
        }
        
        setIsAIEvaluating(false);
        setAiEvalComplete(true);
        toast.success('AI Evaluation passed successfully!');
      } else {
        throw new Error(res.data?.message || 'AI Evaluation failed');
      }
    } catch (error) {
      clearInterval(progressInterval);
      setIsAIEvaluating(false);
      setAiEvalComplete(true);
      setAiEvalSuccess(false);
      
      const errorMessage = error?.response?.data?.message || error?.message || 'AI Evaluation failed';
      setAiEvalError(errorMessage);
      
      // Show detailed error if available
      if (error?.response?.data?.data) {
        setEvaluationResult(error.response.data.data);
        setShowSuggestions(true);
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle Duplicate Check
  const handleDuplicateCheck = async () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    if (!selectedProject || !selectedTask) {
      toast.error('Please select a project and task first');
      return;
    }

    // Only require AI evaluation to be completed if it's actually required for this project
    if (requiresAIValidation && (!aiEvalComplete || aiEvalSuccess !== true)) {
      toast.error('Please complete AI Evaluation first');
      return;
    }

    setIsDuplicateChecking(true);
    setDuplicateCheckProgress(0);
    setDuplicateCheckSuccess(null);
    setDuplicateCheckError("");
    setDuplicateCheckResult(null);

    let progressInterval;
    
    try {
      // Create FormData for API call
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user?.user_id || 1);
      formData.append('project_id', Number(selectedProject));
      formData.append('task_id', Number(selectedTask));

      // Simulate progress
      progressInterval = setInterval(() => {
        setDuplicateCheckProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);

      const res = await nodeApi.post('/ai/duplicate-check', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 180000 // 3 minutes
      });

      clearInterval(progressInterval);
      setDuplicateCheckProgress(100);

      if (res.data?.success === true || res.status === 200) {
        // Check if duplicates were found
        if (res.data?.data?.hasDuplicates === true) {
          // Duplicates found - this is a failure
          setDuplicateCheckSuccess(false);
          setDuplicateCheckResult(res.data?.data || {});
          setIsDuplicateChecking(false);
          setDuplicateCheckComplete(true);
          
          const duplicateCount = res.data?.data?.duplicateCount || 0;
          const totalRecords = res.data?.data?.totalRecords || 0;
          const errorMessage = `${duplicateCount} record${duplicateCount === 1 ? '' : 's'} out of ${totalRecords} are duplicates. Please fix your file and reapply.`;
          setDuplicateCheckError(errorMessage);
          toast.error(`Duplicate check failed! ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} found.`);
        } else {
          // No duplicates - success
          setDuplicateCheckSuccess(true);
          setDuplicateCheckResult(res.data?.data || {});
          setIsDuplicateChecking(false);
          setDuplicateCheckComplete(true);
          toast.success('Duplicate check passed successfully!');
        }
      } else {
        throw new Error(res.data?.message || 'Duplicate check failed');
      }
    } catch (error) {
      clearInterval(progressInterval);
      setIsDuplicateChecking(false);
      setDuplicateCheckComplete(true);
      setDuplicateCheckSuccess(false);
      
      const errorMessage = error?.response?.data?.message || error?.message || 'Duplicate check failed';
      setDuplicateCheckError(errorMessage);
      
      // Show detailed error if available
      if (error?.response?.data?.data) {
        setDuplicateCheckResult(error.response.data.data);
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle file upload with 10MB size validation
  const handleFileChange = async (e) => {
    const fileObj = e.target.files[0];
    if (!fileObj) return;
    // Only allow Excel files (xlsx, xls)
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];
    const allowedExtensions = [".xlsx", ".xls"];
    const fileName = fileObj.name.toLowerCase();
    const isExcel = allowedTypes.includes(fileObj.type) || allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!isExcel) {
      setFile(null);
      setFilePreview(null);
      setFileBase64(null);
      setFileError("Only Excel files (.xlsx, .xls) are allowed.");
      toast.error("Only Excel files (.xlsx, .xls) are allowed.", { duration: 4000 });
      e.target.value = null;
      return;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (fileObj.size > maxSize) {
      setFileError("File size must not exceed 10MB");
      setFile(null);
      setFilePreview(null);
      setFileBase64(null);
      toast.error("File size exceeds 10MB limit", { duration: 4000 });
      e.target.value = null;
      return;
    }
    setFileError("");
    log('[Tracker] File selected:', fileObj.name);
    setFile(fileObj);
    setFilePreview(URL.createObjectURL(fileObj));
    try {
      const base64 = await fileToBase64(fileObj);
      setFileBase64(base64);
      log('[Tracker] File converted to base64');
      // Start upload progress simulation
      simulateUploadProgress();
    } catch (error) {
      logError('[Tracker] Error converting file:', error);
      setFileBase64(null);
      setFileError("Failed to process file");
      toast.error("Failed to process file");
    }
  };

  // Live validation function
  const validate = () => {
    const newErrors = {};
    if (!selectedProject) newErrors.selectedProject = "Project is required.";
    if (!selectedTask) newErrors.selectedTask = "Task is required.";
    if (!shiftType) newErrors.shiftType = "Shift is required.";
    if (!baseTarget) newErrors.baseTarget = "Base Target is required.";
    if (!productionTarget) newErrors.productionTarget = "Production Target is required.";
    else if (isNaN(Number(productionTarget)) || Number(productionTarget) < 0) newErrors.productionTarget = "Enter a valid number.";
    else if (baseTarget && Number(productionTarget) > (Number(baseTarget) * 2)) {
      newErrors.productionTarget = `Production cannot exceed double the Base Target (Max: ${Number(baseTarget) * 2})`;
    }
    if (fileError) newErrors.file = fileError;
    return newErrors;
  };

  // Live validation on field change
  useEffect(() => {
    const newErrors = {};
    if (!selectedProject) newErrors.selectedProject = "Project is required.";
    if (!selectedTask) newErrors.selectedTask = "Task is required.";
    if (!shiftType) newErrors.shiftType = "Shift is required.";
    if (!baseTarget) newErrors.baseTarget = "Base Target is required.";
    if (!productionTarget) newErrors.productionTarget = "Production Target is required.";
    else if (isNaN(Number(productionTarget)) || Number(productionTarget) < 0) newErrors.productionTarget = "Enter a valid number.";
    else if (baseTarget && Number(productionTarget) > (Number(baseTarget) * 2)) {
      newErrors.productionTarget = `Production cannot exceed double the Base Target (Max: ${Number(baseTarget) * 2})`;
    }
    if (fileError) newErrors.file = fileError;
    setErrors(newErrors);
  }, [selectedProject, selectedTask, shiftType, baseTarget, productionTarget, fileError]);

  // Handle blur for live validation
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate());
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check submission window first
    // if (!isSubmissionWindowOpen) {
    //   toast.error(`Tracker submissions are only allowed in the first 15 minutes of each hour. Next window opens at ${nextWindowTime}`, {
    //     duration: 5000,
    //     icon: '⏰'
    //   });
    //   return;
    // }
    
    setTouched({ 
      selectedProject: true, 
      selectedTask: true, 
      baseTarget: true, 
      productionTarget: true 
    });
    
    setTimeout(async () => {
      const clientErrors = validate();
      setErrors(clientErrors);
      forceUpdate(n => n + 1);
      if (Object.keys(clientErrors).length > 0) return;
      if (fileError) {
        toast.error("Please fix file upload errors before submitting", { duration: 4000 });
        return;
      }
      if ((requiresAIValidation || requiresDuplicateCheck) && !file) {
        toast.error("Please upload a file to complete required validations", { duration: 4000 });
        return;
      }
      if (requiresAIValidation && file) {
        if (!aiEvalComplete) {
          toast.error("Please complete AI Evaluation before submitting", { duration: 4000 });
          return;
        }
        if (aiEvalSuccess !== true) {
          toast.error("AI Evaluation must pass before submitting", { duration: 4000 });
          return;
        }
      }
      
      // Check if Duplicate Check is required and completed successfully
      if (requiresDuplicateCheck && file) {
        if (!duplicateCheckComplete) {
          toast.error("Please complete Duplicate Check before submitting", { duration: 4000 });
          return;
        }
        if (duplicateCheckSuccess !== true) {
          toast.error("Duplicate Check must pass before submitting", { duration: 4000 });
          return;
        }
      }
      setSubmitting(true);
      if (!selectedProject || !selectedTask || !productionTarget) {
        toast.error("Please fill in all required fields");
        setSubmitting(false);
        return;
      }
      
      const formData = new FormData();
      formData.append('project_id', Number(selectedProject));
      formData.append('task_id', Number(selectedTask));
      formData.append('shift', shiftType);
      formData.append('user_id', user?.user_id);
      formData.append('production', Number(productionTarget));
      formData.append('tenure_target', Number(baseTarget));
      
      if (notes && notes.trim()) {
        formData.append('tracker_note', notes.trim());
      }
      
      if (file) {
        formData.append('tracker_file', file);
      }
      
      try {
        log('[Tracker] Submitting tracker with FormData');
        
        // If file is uploaded, run process-excel first to create hashes
        if (file) {
          try {
            log('[Tracker] Running process-excel for file processing first');
            
            // Get the selected project's requires_duplicate_check value
            const selectedProjectData = projects.find(p => p.project_id === Number(selectedProject));
            const projectRequiresDuplicateCheck = selectedProjectData?.requires_duplicate_check || false;
            
            const processFormData = new FormData();
            processFormData.append('file', file);
            processFormData.append('user_id', user?.user_id);
            processFormData.append('project_id', Number(selectedProject));
            processFormData.append('task_id', Number(selectedTask));
            processFormData.append('duplicate_check', projectRequiresDuplicateCheck);
            if (geminiApiKey) processFormData.append('gemini_api_key', geminiApiKey);
            
            const processRes = await nodeApi.post('/tracker/process-excel', processFormData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              },
              timeout: 300000 // 5 minutes for processing
            });
            
            log('[Tracker] Process-excel response:', processRes.data);
            
            // More lenient success check - accept various success indicators
            const isSuccess = 
              processRes.status === 200 || 
              processRes.status === 201 ||
              processRes.data?.success === true || 
              processRes.data?.success === 1 ||
              processRes.data?.status === 'success' ||
              processRes.data?.status === 200 ||
              processRes.data?.message?.toLowerCase().includes('success');
            
            if (!isSuccess) {
              logError('[Tracker] File processing failed:', processRes.data);
              toast.error("File processing failed. Please check your file and try again.");
              setSubmitting(false);
              return;
            }
            
            log('[Tracker] File processed successfully, proceeding to add tracker');
            toast.success("File processed successfully!");
          } catch (processError) {
            logError('[Tracker] Error in process-excel:', processError);
            const errorMsg = processError?.response?.data?.message || processError?.message || "File processing failed.";
            toast.error(filterApiErrorMessage(errorMsg));
            setSubmitting(false);
            return;
          }
        }
        
        // Now submit the tracker (only after successful file processing or if no file)
        const res = await api.post("/tracker/add", formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (res.data?.status === 201 || res.status === 201 || res.status === 200) {
          log('[Tracker] Tracker added successfully');
          toast.success("Tracker added successfully!");
          resetModalForm();
          setShowModal(false);
          fetchTrackers();
        } else {
          logError('[Tracker] Unexpected response:', res.data);
          toast.error(res.data?.message || "Failed to add tracker.");
        }
      } catch (err) {
        logError('[Tracker] Error submitting tracker:', err);
        const backendMsg = err?.response?.data?.message || err?.message || "Failed to add tracker.";
        toast.error(filterApiErrorMessage(backendMsg));
      } finally {
        setSubmitting(false);
      }
    }, 0);
  };

  // Get tasks for selected filter project
  const availableFilterTasks = useMemo(() => {
    if (!filterProject) return [];
    const project = projects.find(p => String(p.project_id) === String(filterProject));
    return project?.tasks || [];
  }, [filterProject, projects]);

  // Lookup helpers
  const getProjectName = (id) => {
    const project = projects.find(p => String(p.project_id) === String(id));
    return project?.project_name || "-";
  };
  
  const getTaskName = (task_id, project_id) => {
    const project = projects.find(p => String(p.project_id) === String(project_id));
    const task = project?.tasks?.find(t => String(t.task_id) === String(task_id));
    return task?.task_name || task?.label || "-";
  };

  // Check if tracker entry is from today
  const isToday = (dateTime) => {
    if (!dateTime) return false;
    const trackerDate = new Date(dateTime);
    const today = new Date();
    return (
      trackerDate.getFullYear() === today.getFullYear() &&
      trackerDate.getMonth() === today.getMonth() &&
      trackerDate.getDate() === today.getDate()
    );
  };

  // Fetch tracker data with filters
  const fetchTrackers = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      setError("");

      let payload = {
        logged_in_user_id: user?.user_id,
        device_id: user.device_id || '',
        device_type: user.device_type || '',
      };

      if (filterProject) payload.project_id = filterProject;
      if (filterTask) payload.task_id = filterTask;
      if (startDate) payload.date_from = startDate;
      if (endDate) payload.date_to = endDate;

      if (!startDate && !endDate) {
        const today = getTodayDate();
        payload.date_from = today;
        payload.date_to = today;
      }

      log('[Tracker] Fetching trackers with filters:', payload);
      const res = await api.post("/tracker/view", payload);
      if (res.status === 200 && res.data?.data) {
        const responseData = res.data.data;
        const fetchedTrackers = responseData.trackers || [];
        const enrichedTrackers = fetchedTrackers.map(tracker => {
          const shiftValue = (tracker.shift || '').toString().toLowerCase();
          return {
            ...tracker,
            project_name: tracker.project_name || getProjectName(tracker.project_id),
            task_name: tracker.task_name || getTaskName(tracker.task_id, tracker.project_id),
            notes: tracker.notes || tracker.tracker_note || '',
            shift: shiftValue || 'day',
          };
        });
        log('[Tracker] Fetched trackers:', enrichedTrackers.length);
        setTrackers(enrichedTrackers);
      } else {
        setTrackers([]);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Unknown error";
      const errorMsg = "Failed to fetch tracker data: " + msg;
      logError('[Tracker] Error fetching trackers:', errorMsg);
      setError(errorMsg);
      setTrackers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trackers on mount and when filters change
  useEffect(() => {
    if (user?.user_id) {
      fetchTrackers();
    }
    // eslint-disable-next-line
  }, [user?.user_id, startDate, endDate, filterProject, filterTask]);

  // Format date and time
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return { date: '-', time: '' };
    
    try {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return { date: dateTimeStr, time: '' };
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getUTCDate();
      const month = monthNames[date.getUTCMonth()];
      const year = date.getUTCFullYear();
      
      let hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = String(minutes).padStart(2, '0');
      
      return {
        date: `${day}/${month}/${year}`,
        time: `${hours}:${minutesStr} ${ampm}`
      };
    } catch  {
      return { date: dateTimeStr, time: '' };
    }
  };

  // Handle delete
  const handleDelete = (tracker_id) => setDeleteConfirm(tracker_id);
  
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      setDeletingId(deleteConfirm);
      setError("");
      
      log('[Tracker] Deleting tracker:', deleteConfirm);
      await api.post("/tracker/delete", { tracker_id: deleteConfirm });
      
      setTrackers(trackers.filter(t => t.tracker_id !== deleteConfirm));
      setDeleteConfirm(null);
      toast.success("Tracker deleted successfully!");
      log('[Tracker] Tracker deleted successfully');
    } catch (err) {
      const errorMsg = "Delete failed. Please try again.";
      logError('[Tracker] Delete error:', err);
      setError(errorMsg);
      toast.error("Failed to delete tracker.");
    } finally {
      setDeletingId(null);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    const today = getTodayDate();
    setFilterProject("");
    setFilterTask("");
    setStartDate(today);
    setEndDate(today);
  };

  // Calculate totals
  const totals = useMemo(() => {
    return trackers.reduce((acc, tracker) => {
      acc.tenureTarget += Number(tracker.tenure_target) || 0;
      acc.production += Number(tracker.production) || 0;
      acc.billableHours += Number(tracker.billable_hours) || 0;
      return acc;
    }, { tenureTarget: 0, production: 0, billableHours: 0 });
  }, [trackers]);

  // Export to CSV
  const handleExportToExcel = () => {
    if (trackers.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const exportData = trackers.map((tracker) => ({
        'Date/Time': tracker.date_time ? tracker.date_time : "-",
        'Project': tracker.project_name || getProjectName(tracker.project_id),
        'Task': tracker.task_name || '-',
        'Shift': tracker.shift_type === 'day' ? 'Day' : tracker.shift_type === 'night' ? 'Night' : '-',
        'Per Hour Target': tracker.tenure_target ?? 0,
        'Production': tracker.production || 0,
        'Billable Hours': tracker.billable_hours !== null && tracker.billable_hours !== undefined
          ? Number(tracker.billable_hours).toFixed(2)
          : "0.00",
        'Notes': tracker.tracker_note || '-',
        'Has File': tracker.tracker_file ? 'Yes' : 'No'
      }));

      exportData.push({
        'Date/Time': '',
        'Project': '',
        'Task': 'TOTAL',
        'Shift': '',
        'Per Hour Target': totals.tenureTarget.toFixed(2),
        'Production': totals.production.toFixed(2),
        'Billable Hours': totals.billableHours.toFixed(2),
        'Notes': '',
        'Has File': ''
      });

      const filename = `Trackers_${startDate}_to_${endDate}.csv`;
      exportToCSV(exportData, filename);

      toast.success(`Exported ${trackers.length} records successfully!`);
      log('[Tracker] CSV export successful:', filename);
    } catch (err) {
      logError('[Tracker] Excel export error:', err);
      toast.error("Failed to export data");
    }
  };

  // Format date helpers
  const formatToStorage = (day, month, year) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const generateCalendar = (currentDate) => {
    const date = currentDate ? new Date(currentDate) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { year, month, daysInMonth, startingDayOfWeek };
  };

  const handleDateSelect = (name, dateValue) => {
    if (name === 'start') {
      setStartDate(dateValue);
      setShowStartPicker(false);
    } else if (name === 'end') {
      setEndDate(dateValue);
      setShowEndPicker(false);
    }
  };

  const CustomDatePicker = ({ name, value, onSelect, show, onClose }) => {
    const [viewDate, setViewDate] = useState(value || new Date().toISOString().split('T')[0]);
    const { year, month, daysInMonth, startingDayOfWeek } = generateCalendar(viewDate);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const handlePrevMonth = () => {
      const newDate = new Date(year, month - 1, 1);
      setViewDate(newDate.toISOString().split('T')[0]);
    };

    const handleNextMonth = () => {
      const newDate = new Date(year, month + 1, 1);
      setViewDate(newDate.toISOString().split('T')[0]);
    };

    if (!show) return null;

    return (
      <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-xl border-2 border-blue-200 p-3 w-64">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="font-bold text-sm text-slate-800">{monthNames[month]} {year}</span>
          <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-600">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatToStorage(day, month + 1, year);
            const isSelected = dateStr === value;
            return (
              <button
                type="button"
                key={day}
                onClick={() => onSelect(name, dateStr)}
                className={`text-xs p-1.5 rounded hover:bg-blue-100 transition-colors ${
                  isSelected ? 'bg-blue-600 text-white font-bold' : 'text-slate-700'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <button 
          type="button"
          onClick={onClose}
          className="w-full mt-3 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs"
        >
          Close
        </button>
      </div>
    );
  };

  const CustomDropdown = ({ options, value, onChange, placeholder, show, onClose, disabled }) => {
    if (!show || disabled) return null;

    return (
      <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border-2 border-blue-200 max-h-60 overflow-y-auto">
        <div
          onClick={() => {
            onChange('');
            onClose();
          }}
          className={`px-4 py-2.5 cursor-pointer transition-all border-b border-slate-100 ${
            !value ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-blue-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {!value && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
            <span className="text-sm">{placeholder}</span>
          </div>
        </div>
        
        {options.map((option) => (
          <div
            key={option.value}
            onClick={() => {
              onChange(option.value);
              onClose();
            }}
            className={`px-4 py-2.5 cursor-pointer transition-all ${
              String(value) === String(option.value)
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'hover:bg-blue-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {String(value) === String(option.value) && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
              <span className="text-sm">{option.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-6 px-4">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Tracker Table Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {/* Table Header */}
          <div className="bg-white border-b border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <path d="M3 3h18v18H3z"/>
                    <path d="M8 8h8M8 12h8M8 16h5"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight cursor-default">Production Tracker</h2>
                  <p className="text-slate-600 text-sm font-medium mt-1 cursor-default">Logged in as <span className="font-semibold text-blue-600">{user?.user_name || user?.name || "-"}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Submission Window Status Indicator */}
                <div className={`flex flex-col items-end gap-1 px-4 py-2 rounded-lg border-2 ${
                  isSubmissionWindowOpen 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-red-50 border-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      isSubmissionWindowOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-xs font-bold uppercase tracking-wide ${
                      isSubmissionWindowOpen ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {isSubmissionWindowOpen ? 'Window Open' : 'Window Closed'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    {isSubmissionWindowOpen ? (
                      <>Closes in: <span className="text-red-600">{timeRemaining}</span></>
                    ) : (
                      <>Opens at: <span className="text-green-600">{nextWindowTime}</span></>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    // Timer validation commented out - modal is now always accessible
                    // if (isSubmissionWindowOpen) {
                      setShowModal(true);
                    // } else {
                    //   toast.error(`Tracker submissions are only allowed in the first 15 minutes of each hour. Next window opens at ${nextWindowTime}`, {
                    //     duration: 5000,
                    //     icon: '⏰'
                    //   });
                    // }
                  }}
                  // disabled={!isSubmissionWindowOpen}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transform hover:scale-105 cursor-pointer"
                  title="Add new tracker"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add Tracker
                </button>
                <button
                  onClick={handleExportToExcel}
                  disabled={loading || trackers.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  title="Export filtered data to CSV"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div className="relative space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                  </svg>
                  Date From
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowStartPicker(!showStartPicker);
                    setShowEndPicker(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left flex items-center justify-between"
                >
                  <span>{startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'Select date'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                  </svg>
                </button>
                <CustomDatePicker 
                  name="start" 
                  value={startDate} 
                  onSelect={handleDateSelect} 
                  show={showStartPicker} 
                  onClose={() => setShowStartPicker(false)} 
                />
              </div>

              {/* Date To */}
              <div className="relative space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                  </svg>
                  Date To
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowEndPicker(!showEndPicker);
                    setShowStartPicker(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left flex items-center justify-between"
                >
                  <span>{endDate ? new Date(endDate).toLocaleDateString('en-GB') : 'Select date'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                  </svg>
                </button>
                <CustomDatePicker 
                  name="end" 
                  value={endDate} 
                  onSelect={handleDateSelect} 
                  show={showEndPicker} 
                  onClose={() => setShowEndPicker(false)} 
                />
              </div>

              {/* Project Filter */}
              <div className="relative space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  Project
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectDropdown(!showProjectDropdown);
                    setShowTaskDropdown(false);
                  }}
                  className={`w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left flex items-center justify-between ${
                    filterProject ? 'text-slate-700' : 'text-slate-500'
                  }`}
                >
                  <span className={filterProject ? 'text-slate-700' : 'text-slate-500'}>
                    {filterProject 
                      ? projects.find(p => String(p.project_id) === String(filterProject))?.project_name || 'All Projects'
                      : 'All Projects'
                    }
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-blue-600 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <CustomDropdown
                  options={projects.map(p => ({ value: p.project_id, label: p.project_name }))}
                  value={filterProject}
                  onChange={(val) => {
                    setFilterProject(val);
                    if (!val) setFilterTask('');
                  }}
                  placeholder="All Projects"
                  show={showProjectDropdown}
                  onClose={() => setShowProjectDropdown(false)}
                />
              </div>

              {/* Task Filter */}
              <div className="relative space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-blue-600" />
                  Task
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskDropdown(!showTaskDropdown);
                    setShowProjectDropdown(false);
                  }}
                  disabled={!filterProject}
                  className={`w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
                    filterTask ? 'text-slate-700' : 'text-slate-500'
                  }`}
                >
                  <span className={filterTask ? 'text-slate-700' : 'text-slate-500'}>
                    {filterTask 
                      ? availableFilterTasks.find(t => String(t.task_id) === String(filterTask))?.label || 'All Tasks'
                      : 'All Tasks'
                    }
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-blue-600 transition-transform ${showTaskDropdown ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <CustomDropdown
                  options={availableFilterTasks.map(t => ({ value: t.task_id, label: t.label }))}
                  value={filterTask}
                  onChange={(val) => setFilterTask(val)}
                  placeholder="All Tasks"
                  show={showTaskDropdown}
                  onClose={() => setShowTaskDropdown(false)}
                  disabled={!filterProject}
                />
              </div>
            </div>

            {/* Filter Action Buttons */}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                type="button"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Reset Filters
              </button>
              
              <button
                onClick={fetchTrackers}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 group"
                type="button"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-6 mt-4 rounded-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="min-w-full text-sm text-slate-700 table-fixed">
                <colgroup>
                  <col style={{ width: '12%' }}/>
                  <col style={{ width: '13%' }}/>
                  <col style={{ width: '13%' }}/>
                  <col style={{ width: '8%' }}/>
                  <col style={{ width: '10%' }}/>
                  <col style={{ width: '10%' }}/>
                  <col style={{ width: '10%' }}/>
                  <col style={{ width: '7%' }}/>
                  <col style={{ width: '8%' }}/>
                  <col style={{ width: '9%' }}/>
                </colgroup>
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Date/Time</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Project</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Task</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">Shift</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Per Hour Target</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Production</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-left">Billable Hours</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">Notes</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">Task File</th>
                    <th className="px-5 py-4 font-bold text-white text-xs uppercase tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <span className="font-semibold text-slate-600">Loading trackers...</span>
                        </div>
                      </td>
                    </tr>
                  ) : trackers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-20">
                        <div className="flex flex-col items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          <span className="text-slate-400 font-medium">No tracker data found</span>
                        </div>
                      </td>
                    </tr>
                  ) : trackers.map((tracker, index) => (
                    <tr key={tracker.tracker_id} className={`hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-5 py-4 align-middle text-slate-700 font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold">{formatDateTime(tracker.date_time).date}</span>
                          <span className="text-xs text-slate-500">{formatDateTime(tracker.date_time).time}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle text-slate-700 font-medium">{tracker.project_name || getProjectName(tracker.project_id)}</td>
                      <td className="px-5 py-4 align-middle text-slate-700">{tracker.task_name || getTaskName(tracker.task_id, tracker.project_id) || '-'}</td>
                      <td className="px-5 py-4 align-middle text-center">
                        {tracker.shift ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            tracker.shift.toLowerCase() === 'day' 
                              ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                              : 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                          }`}>
                            {tracker.shift.toLowerCase() === 'day' ? 'Day' : 'Night'}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle text-slate-700 font-semibold">
                        {tracker.tenure_target !== null && tracker.tenure_target !== undefined 
                          ? Number(tracker.tenure_target).toFixed(2) 
                          : '-'}
                      </td>
                      <td className="px-5 py-4 align-middle text-slate-700 font-semibold">
                        {tracker.production !== null && tracker.production !== undefined
                          ? Number(tracker.production).toFixed(2)
                          : '0.00'}
                      </td>
                      <td className="px-5 py-4 align-middle text-slate-700 font-semibold">
                        {tracker.billable_hours !== null && tracker.billable_hours !== undefined
                          ? Number(tracker.billable_hours).toFixed(2)
                          : "0.00"}
                      </td>
                      <td className="px-5 py-4 align-middle text-slate-600 text-sm">
                        {tracker.notes ? (
                          <div className="relative inline-flex items-center gap-1">
                            <span>
                              {tracker.notes.length > 10
                                ? `${tracker.notes.substring(0, 10)}...`
                                : tracker.notes}
                            </span>
                            {tracker.notes.length > 10 && (
                              <div className="relative group/notes">
                                <Info className="w-4 h-4 text-blue-500 cursor-pointer hover:text-blue-700 transition-colors" />
                                {/* Tooltip - Only shows on hover of icon */}
                                <div className={`absolute right-0 ${index >= trackers.length - 3 ? 'bottom-full mb-2' : 'top-full mt-2'} hidden group-hover/notes:block z-50 pointer-events-none`}>
                                  <div className="bg-white text-slate-800 text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-200 min-w-[400px] max-w-2xl max-h-32 break-words whitespace-normal">
                                    {tracker.notes}
                                    {/* Arrow */}
                                    {index >= trackers.length - 3 ? (
                                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                                    ) : (
                                      <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle text-center">
                        {tracker.tracker_file ? (
                          <a
                            href={tracker.tracker_file}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-600 transition-all bg-blue-50 rounded-lg p-2 shadow-sm"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle text-center">
                        {isToday(tracker.date_time) ? (
                          <button
                            onClick={() => handleDelete(tracker.tracker_id)}
                            disabled={deletingId === tracker.tracker_id}
                            className="inline-flex items-center justify-center text-red-600 hover:text-white hover:bg-red-600 transition-all bg-red-50 rounded-lg p-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Tracker"
                            aria-label="Delete Tracker"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Totals Summary Card */}
        {!loading && trackers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gradient-to-b from-blue-600 to-blue-700 rounded-full"></div>
              Summary Totals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Per Hour Target</p>
                <p className="text-4xl font-extrabold text-blue-900">{totals.tenureTarget.toFixed(2)}</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-2xl p-6 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Production</p>
                <p className="text-4xl font-extrabold text-green-900">{totals.production.toFixed(2)}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-6 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Billable Hours</p>
                <p className="text-4xl font-extrabold text-purple-900">{totals.billableHours.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Tracker Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl transform transition-all my-8 animate-fade-in max-h-[calc(100vh-4rem)] flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2.5 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Add New Tracker</h2>
                      <p className="text-blue-100 text-sm font-medium mt-1">{new Date(entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      resetModalForm();
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-all border border-white/20 group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1">
                <form className="p-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  {/* Project Selection */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <path d="M2 20h20"></path>
                        <path d="m5 9 3-3 3 3"></path>
                        <path d="M2 4h20"></path>
                        <path d="m19 15-3 3-3-3"></path>
                      </svg>
                      Project Name
                      <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      value={selectedProject}
                      onChange={(value) => {
                        setSelectedProject(value);
                        handleBlur('selectedProject');
                      }}
                      options={[
                        { value: '', label: 'Select a project...' },
                        ...projects.map(p => ({ value: String(p.project_id), label: p.project_name }))
                      ]}
                      icon={Briefcase}
                      placeholder="Select a project..."
                      disabled={loadingProjects}
                    />
                    {touched.selectedProject && errors.selectedProject && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" x2="12" y1="8" y2="12"></line>
                          <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        {errors.selectedProject}
                      </p>
                    )}
                  </div>

                  {/* Task Selection */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <path d="M9 11 4 6l5-5 5 5-5 5Z"></path>
                        <path d="M13 13 8 8l5-5 5 5-5 5Z"></path>
                        <path d="m20 16-5 5-5-5 5-5 5 5Z"></path>
                      </svg>
                      Task Name
                      <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      value={selectedTask}
                      onChange={(value) => {
                        const taskValue = String(value);
                        setSelectedTask(taskValue);
                        handleBlur('selectedTask');
                        log('[Tracker] Task selected:', taskValue);
                        setTimeout(() => {
                          const project = projects.find(p => String(p.project_id) === String(selectedProject));
                          const task = project?.tasks?.find(t => String(t.task_id) === String(taskValue));
                          if (task && user?.user_tenure) {
                            const calculated = Number(task.task_target) * Number(user.user_tenure);
                            setBaseTarget(calculated.toFixed(2));
                          } else {
                            setBaseTarget("");
                          }
                        }, 0);
                      }}
                      options={[
                        { value: '', label: 'Select a task...' },
                        ...tasks.map(t => ({ value: String(t.task_id), label: t.task_name || t.label }))
                      ]}
                      icon={ListChecks}
                      placeholder="Select a task..."
                      disabled={!selectedProject || loadingTasks}
                    />
                    {touched.selectedTask && errors.selectedTask && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" x2="12" y1="8" y2="12"></line>
                          <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        {errors.selectedTask}
                      </p>
                    )}
                  </div>

                  {/* Shift Selection */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Shift
                      <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      value={shiftType}
                      onChange={(value) => {
                        setShiftType(value);
                        handleBlur('shiftType');
                      }}
                      options={[
                        { value: 'day', label: 'Day' },
                        { value: 'night', label: 'Night' }
                      ]}
                      icon={Clock}
                      placeholder="Select shift..."
                      disabled={false}
                    />
                    {touched.shiftType && errors.shiftType && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" x2="12" y1="8" y2="12"></line>
                          <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        {errors.shiftType}
                      </p>
                    )}
                  </div>

                  {/* Base Target */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                      </svg>
                      Base Target
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="w-full bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                          <rect width="14" height="10" x="5" y="11" rx="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <span>{baseTargetLoading ? 'Calculating...' : (baseTarget ? Number(baseTarget).toFixed(2) : '—')}</span>
                      </div>
                    </div>
                    {touched.baseTarget && errors.baseTarget && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" x2="12" y1="8" y2="12"></line>
                          <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        {errors.baseTarget}
                      </p>
                    )}
                  </div>

                  {/* Production Target */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <line x1="12" x2="12" y1="2" y2="22"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      Production
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none">
                        <line x1="12" x2="12" y1="2" y2="22"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      <input
                        type="text"
                        className={`w-full bg-slate-50 border rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all shadow-sm hover:bg-white ${
                          touched.productionTarget && errors.productionTarget
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                        }`}
                        value={productionTarget}
                        onChange={e => setProductionTarget(e.target.value)}
                        onBlur={(e) => {
                          handleBlur('productionTarget');
                          // Format to 2 decimal places
                          const value = e.target.value.trim();
                          if (value && !isNaN(value)) {
                            setProductionTarget(parseFloat(value).toFixed(2));
                          }
                        }}
                        placeholder="Enter production"
                      />
                    </div>
                    {touched.productionTarget && errors.productionTarget && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" x2="12" y1="8" y2="12"></line>
                          <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        {errors.productionTarget}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes Section - Spans 3 columns */}
                <div className="space-y-2 md:col-span-3">
                  <label className="flex items-center justify-between text-sm font-bold text-slate-700 uppercase tracking-wide">
                    <span className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Notes
                    </span>
                    <span className={`text-xs font-medium ${
                      notes.length > 200 ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {notes.length}/200
                    </span>
                  </label>
                  <div className="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-3 text-blue-600 pointer-events-none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <textarea
                      rows="3"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition-all shadow-sm hover:bg-white resize-none"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add any additional notes... (Optional)"
                    />
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="mb-3 md:col-span-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    Project Files
                  </label>
                  <div
                    onClick={() => !isUploading && document.getElementById('modal-file-upload').click()}
                    className={`relative border-2 border-dashed rounded-lg px-3 py-3 text-center transition-all ${!isUploading ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} group ${
                      fileError 
                        ? 'border-red-300 bg-red-50/30 hover:border-red-400' 
                        : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
                    }`}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-sm font-bold text-blue-600">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-slate-600 font-semibold">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${
                          fileError ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={fileError ? 'text-red-600' : 'text-blue-600'}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" x2="12" y1="3" y2="15"></line>
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            {file ? (
                              <span className="text-blue-600">{file.name}</span>
                            ) : (
                              <>Click to upload <span className="text-blue-600">or drag and drop</span></>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">Supported formats: <span className="font-semibold text-blue-700">Excel (.xlsx, .xls)</span> • Max 10MB</p>
                        </div>
                      </div>
                    )}
                    <input
                      id="modal-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </div>

                  {/* AI Evaluation and Duplicate Check Buttons */}
                  {uploadComplete && (requiresAIValidation || requiresDuplicateCheck) && (
                    <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        File uploaded! Complete required checks in order:
                        {requiresAIValidation && " ① AI Evaluation"}
                        {requiresAIValidation && requiresDuplicateCheck && " →"}
                        {requiresDuplicateCheck && " ② Duplicate Check"}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* AI Evaluation Button - only show if required */}
                        {requiresAIValidation && (
                        <div>
                          <button
                            type="button"
                            onClick={handleAIEvaluation}
                            disabled={isAIEvaluating || aiEvalComplete || isDuplicateChecking || duplicateCheckComplete}
                            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isAIEvaluating ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Evaluating ({aiEvalProgress}%)
                              </>
                            ) : aiEvalComplete ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Completed
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                                </svg>
                                AI Evaluation
                              </>
                            )}
                          </button>
                          
                          {/* AI Evaluation Result Messages */}
                          {aiEvalComplete && aiEvalSuccess === true && (
                            <div className="mt-3 p-3 bg-green-50 border-2 border-green-300 rounded-lg flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                              <p className="text-sm font-semibold text-green-700">AI Evaluation passed successfully!</p>
                            </div>
                          )}
                          {aiEvalComplete && aiEvalSuccess === false && (
                            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              <div>
                                <p className="text-sm font-bold text-red-700">{aiEvalError}</p>
                                {showSuggestions && suggestions.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-semibold text-red-600 mb-1">Suggestions:</p>
                                    <ul className="text-xs text-red-600 list-disc list-inside space-y-1">
                                      {suggestions.map((suggestion, index) => (
                                        <li key={index}>{suggestion}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {aiTextualSuggestion && (
                                  <div className="mt-2">
                                    <p className="text-xs font-semibold text-red-600 mb-1">AI Suggestion:</p>
                                    <p className="text-xs text-red-600">{aiTextualSuggestion}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        )}

                        {/* Duplicate Check Button - only show if required */}
                        {requiresDuplicateCheck && (
                        <div>
                          <button
                            type="button"
                            onClick={handleDuplicateCheck}
                            disabled={isDuplicateChecking || duplicateCheckComplete || (requiresAIValidation && (!aiEvalComplete || aiEvalSuccess === false))}
                            className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isDuplicateChecking ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Checking ({duplicateCheckProgress}%)
                              </>
                            ) : duplicateCheckComplete ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Completed
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
                                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                  <path d="M12 11h4"></path>
                                  <path d="M12 16h4"></path>
                                  <path d="M8 11h.01"></path>
                                  <path d="M8 16h.01"></path>
                                </svg>
                                Duplicate Check
                              </>
                            )}
                          </button>
                          
                          {/* Duplicate Check Result Messages */}
                          {duplicateCheckComplete && duplicateCheckSuccess === true && (
                            <div className="mt-3 p-3 bg-green-50 border-2 border-green-300 rounded-lg flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                              <p className="text-sm font-semibold text-green-700">No duplicates found. Check passed!</p>
                            </div>
                          )}
                          {duplicateCheckComplete && duplicateCheckSuccess === false && (
                            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" x2="12" y1="8" y2="12"></line>
                                <line x1="12" x2="12.01" y1="16" y2="16"></line>
                              </svg>
                              <div>
                                <p className="text-sm font-bold text-red-700">{duplicateCheckError}</p>
                                {duplicateCheckResult && (
                                  <>
                                  {/* Duplicates List */}
                              {duplicateCheckResult.duplicates && duplicateCheckResult.duplicates.length > 0 && (
                                <div className="mt-4 max-h-60 overflow-y-auto space-y-3 border-t border-red-100 pt-4 pr-1">
                                  <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-2">Duplicate Records Grouped by Match:</p>
                                  
                                  {/* Group duplicates by hash */}
                                  {Object.values(duplicateCheckResult.duplicates.reduce((acc, dup) => {
                                    if (!acc[dup.hash]) {
                                      acc[dup.hash] = { ...dup, allRows: [dup.row] };
                                    } else {
                                      acc[dup.hash].allRows.push(dup.row);
                                    }
                                    return acc;
                                  }, {})).map((dup, idx) => (
                                    <div key={idx} className="bg-red-50/50 p-4 rounded-xl border border-red-200 shadow-sm">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                            <Copy className="w-4 h-4 text-red-600" />
                                          </div>
                                          <span className="text-xs font-bold text-red-900">
                                            {dup.allRows.length} {dup.allRows.length === 1 ? 'Record' : 'Records'} with same data
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                          {dup.allRows.map(r => (
                                            <span key={r} className="text-[10px] font-bold bg-white text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                                              Row {r}
                                            </span>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-1.5 mb-3">
                                        {dup.duplicateColumns && dup.duplicateValues && dup.duplicateColumns.map((col, cIdx) => (
                                          <div key={cIdx} className="flex gap-2 text-xs">
                                            <span className="font-bold text-red-800 shrink-0">{col}:</span>
                                            <span className="text-red-900 break-all">{String(dup.duplicateValues[col] || '(empty)')}</span>
                                          </div>
                                        ))}
                                      </div>

                                      <details className="text-[10px] group">
                                        <summary className="flex items-center gap-1 cursor-pointer font-bold text-red-600/70 hover:text-red-600 uppercase tracking-tighter select-none">
                                          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                          <span>View Full Record Sample</span>
                                        </summary>
                                        <div className="mt-2 grid grid-cols-1 gap-1 p-2 bg-white/50 rounded-lg border border-red-100">
                                          {dup.data && Object.entries(dup.data).map(([key, value]) => (
                                            <div key={key} className="flex gap-2">
                                              <span className="font-semibold text-red-700/60 shrink-0 w-24 text-right">{key}:</span>
                                              <span className="text-red-900">{String(value || '(empty)')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    </div>
                                  ))}
                                </div>
                              )}
                                    {duplicateCheckResult.totalRecords && (
                                      <div className="mt-2">
                                        <p className="text-xs font-semibold text-red-600">Summary:</p>
                                        <p className="text-xs text-red-600">
                                          Total Records: {duplicateCheckResult.totalRecords} | 
                                          Unique Records: {duplicateCheckResult.uniqueRecords} | 
                                          Duplicates: {duplicateCheckResult.duplicateCount}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Info message when no validations are required but file is uploaded */}
                  {uploadComplete && !requiresAIValidation && !requiresDuplicateCheck && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <p className="text-sm font-semibold text-green-900">File uploaded successfully! No validation checks required for this project.</p>
                    </div>
                  )}

                  {/* Success message when all required checks complete and passed */}
                  {uploadComplete && 
                   ((!requiresAIValidation && !requiresDuplicateCheck) || 
                    ((requiresAIValidation ? (aiEvalComplete && aiEvalSuccess === true) : true) && 
                     (requiresDuplicateCheck ? (duplicateCheckComplete && duplicateCheckSuccess === true) : true))) && 
                   (requiresAIValidation || requiresDuplicateCheck) && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-green-900">All validation checks passed!</p>
                        <p className="text-xs text-green-700 mt-1">You can now submit the tracker entry.</p>
                      </div>
                    </div>
                  )}

                  {fileError && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" x2="12" y1="8" y2="12"></line>
                        <line x1="12" x2="12.01" y1="16" y2="16"></line>
                      </svg>
                      {fileError}
                    </p>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetModalForm();
                    }}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                  
                  {/* Submit button - Show when: no file uploaded OR validation requirements met */}
                  {(!file || (
                    // If no validations required, allow submit
                    (!requiresAIValidation && !requiresDuplicateCheck) ||
                    // If validations required, check they're complete and passed
                    ((requiresAIValidation ? (aiEvalComplete && aiEvalSuccess === true) : true) &&
                     (requiresDuplicateCheck ? (duplicateCheckComplete && duplicateCheckSuccess === true) : true))
                  )) && (
                    <button
                      type="submit"
                      // disabled={submitting || isUploading || !isSubmissionWindowOpen}
                      disabled={submitting || isUploading}
                      // className={`px-8 py-3 font-bold text-sm rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 ${
                      //   !isSubmissionWindowOpen
                      //     ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      //     : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed'
                      // }`}
                      className="px-8 py-3 font-bold text-sm rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      // title={!isSubmissionWindowOpen ? `Submissions only allowed in first 15 minutes of each hour. Next window: ${nextWindowTime}` : ''}
                      title="Submit tracker entry"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Submit Entry
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Confirm Delete</h3>
              </div>
              <p className="mb-6 text-slate-600 leading-relaxed">Are you sure you want to delete this tracker entry? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deletingId}
                >
                  Cancel
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  onClick={confirmDelete}
                  disabled={deletingId}
                >
                  {deletingId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return embedded ? content : <AppLayout>{content}</AppLayout>;
}

export default Tracker;
