/**
 * File: QCFormPage.jsx
 * Author: Naitik Maisuriya
 * Description: QC Form page for quality checking with dynamic form fields
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Download,
  Save,
  FileText,
  User,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Briefcase,
  FolderOpen,
  Target,
  ListChecks,
  XCircle,
  Award,
  ClipboardCheck,
  Send
} from 'lucide-react';
import api from '../services/api';
import config from '../config/environment';
import { generateQCSample, saveQCRecord } from '../services/qcService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import MultiSelectWithCheckbox from '../components/common/MultiSelectWithCheckbox';
import SearchableSelect from '../components/common/SearchableSelect';
import QCConfirmationModal from '../components/common/QCConfirmationModal';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';

const QCFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const trackerData = location.state?.tracker;
  const { user } = useAuth();
  
  // Debug: Log trackerData on component mount to see what we receive
  useEffect(() => {
    console.log('[QCFormPage] Component mounted with trackerData:', trackerData);
    console.log('[QCFormPage] TrackerData fields:', {
      agent_id: trackerData?.agent_id,
      user_id: trackerData?.user_id,
      agent_user_id: trackerData?.agent_user_id,
      project_id: trackerData?.project_id,
      task_id: trackerData?.task_id,
      agent_name: trackerData?.agent_name,
      project_name: trackerData?.project_name,
      task_name: trackerData?.task_name,
      all_keys: trackerData ? Object.keys(trackerData) : []
    });
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Form data from API
  const [formData, setFormData] = useState([]);
  const [afdData, setAfdData] = useState(null); // AFD with categories and subcategories
  const [totalRecords, setTotalRecords] = useState(0); // Total records from API
  const [sampleSize, setSampleSize] = useState(0); // Sample size from API
  const [sampleFilePath, setSampleFilePath] = useState(''); // Sample file path from API
  
  // Use ref as backup for file path to avoid React state timing issues
  const sampleFilePathRef = useRef('');
  
  // Form state - errors selected for each record
  const [formRows, setFormRows] = useState([]);
  const [qcScore, setQcScore] = useState(0);
  
  // State for error selection - now stored per row ID to persist across pagination
  const [pendingSelections, setPendingSelections] = useState({}); // { rowId: { category, subcategories } }

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Lazy loading state
  const [displayedRows, setDisplayedRows] = useState(100); // Initial rows to display
  
  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submissionType, setSubmissionType] = useState(''); // 'regular', 'rework', 'correction'

  // Calculate error metrics
  const errorMetrics = useMemo(() => {
    const recordCount = formRows.length;
    const samplingPercentage = trackerData?.qc_percentage || 10;
    const sampleCount = Math.ceil(recordCount * (samplingPercentage / 100));
    
    // Count total errors marked
    const totalErrors = formRows.reduce((sum, row) => sum + row.errors.length, 0);
    
    // Get unique error list with counts
    const errorMap = new Map();
    formRows.forEach(row => {
      row.errors.forEach(error => {
        const category = afdData?.categories.find(cat => cat.qc_afd_id === error.categoryId);
        const subcategory = category?.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
        
        if (category && subcategory) {
          const key = `${category.name} - ${subcategory.name}`;
          errorMap.set(key, (errorMap.get(key) || 0) + 1);
        }
      });
    });
    
    const errorList = Array.from(errorMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
    
    // Determine status based on score
    // 100: regular, 98-99.99: correction, Below 98: rework
    let status = 'regular';
    if (qcScore < 98) {
      status = 'rework';
    } else if (qcScore < 100) {
      status = 'correction';
    }
    
    return {
      recordCount,
      sampleCount,
      totalErrors,
      errorList,
      status
    };
  }, [formRows, afdData, qcScore, trackerData?.qc_percentage]);

  // Lazy loading - calculate visible rows and pagination
  const visibleFormRows = formRows.slice(0, displayedRows);
  const totalPages = Math.ceil(visibleFormRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = visibleFormRows.slice(startIndex, endIndex);

  // Load more rows when user reaches near the end
  useEffect(() => {
    if (displayedRows < formRows.length && currentPage >= totalPages - 2) {
      setDisplayedRows(prev => Math.min(prev + 100, formRows.length));
    }
  }, [currentPage, totalPages, displayedRows, formRows.length]);

  // Fetch QC Form data
  useEffect(() => {
    if (!trackerData) {
      toast.error('No tracker data found');
      navigate(-1);
      return;
    }
    fetchQCFormData();
  }, [trackerData]);

  const fetchQCFormData = async () => {
    try {
      setLoading(true);
      setError(null);

      let transformedAFD = null;

      // Fetch AFD data from Python API
      const afdResponse = await api.post('/qc_afd/list', {
        project_category_id: trackerData.project_category_id
      });
      
      if (afdResponse.data.status === 200 && afdResponse.data.data.length > 0) {
        // Get the first AFD (or match by project/tracker)
        const afd = afdResponse.data.data.find(a => a.categories && a.categories.length > 0) || afdResponse.data.data[0];
        
        // Transform AFD data structure
        transformedAFD = {
          afd_id: afd.afd_id,
          afd_name: afd.afd_name,
          categories: (afd.categories || []).map(cat => ({
            qc_afd_id: cat.qc_afd_id,
            name: cat.afd_name,
            points: cat.afd_points,
            subcategories: (cat.subcategories || []).map(sub => ({
              qc_afd_id: sub.qc_afd_id,
              name: sub.afd_name,
              points: sub.afd_points
            }))
          }))
        };
        
        setAfdData(transformedAFD);
      }

      // Fetch sample data from tracker using Node API
      let sampleData = [];
      
      if (trackerData.tracker_id && user?.user_id) {
        try {
          const sampleResponse = await generateQCSample(
            trackerData.tracker_id,
            user.user_id,
            trackerData.qc_percentage || 10
          );
          
          // Log full response structure to debug - IMMEDIATELY after receiving
          console.log('=== SAMPLE GENERATION RESPONSE START ===');
          console.log('[QCFormPage] Raw API Response Object:', sampleResponse);
          console.log('[QCFormPage] Response.success:', sampleResponse?.success);
          console.log('[QCFormPage] Response.data:', sampleResponse?.data);
          console.log('[QCFormPage] Full API Response (stringified):', JSON.stringify(sampleResponse, null, 2));
          
          // Check all possible locations for file path
          console.log('[QCFormPage] File path location check:', {
            'sampleResponse.file_path': sampleResponse?.file_path,
            'sampleResponse["10%_file_path"]': sampleResponse?.['10%_file_path'],
            'sampleResponse.data.file_path': sampleResponse?.data?.file_path,
            'sampleResponse.data["10%_file_path"]': sampleResponse?.data?.['10%_file_path'],
            'sampleResponse.data.sample_file_path': sampleResponse?.data?.sample_file_path,
            'sampleResponse.data.url': sampleResponse?.data?.url,
            'sampleResponse.data.fileUrl': sampleResponse?.data?.fileUrl,
            'sampleResponse.data.file_url': sampleResponse?.data?.file_url
          });
          console.log('=== SAMPLE GENERATION RESPONSE END ===');
          
          if (sampleResponse.success && sampleResponse.data) {
            sampleData = sampleResponse.data.sample_data || [];
            
            // Extract total_records, sample_size, and file_path from API response
            const apiTotalRecords = sampleResponse.data.total_records || 0;
            const apiSampleSize = sampleResponse.data.sample_size || 0;
            
            // Try multiple possible locations for the file path
            let apiFilePath = sampleResponse.data.file_path 
              || sampleResponse.data['10%_file_path']
              || sampleResponse.data.sample_file_path
              || sampleResponse.data.sample_file_url
              || sampleResponse.data.url
              || sampleResponse.data.fileUrl
              || sampleResponse.data.file_url
              || sampleResponse.file_path 
              || sampleResponse['10%_file_path']
              || '';
            
            // If no file path from API, construct download URL as fallback
            if (!apiFilePath && trackerData?.tracker_id) {
              const backendUrl = config.apiNodeBaseUrl || 'http://localhost:8000/api/v1';
              apiFilePath = `${backendUrl}/qc-records/download-sample/${trackerData.tracker_id}?logged_in_user_id=${user?.user_id}`;
              console.log('[QCFormPage] No file path in API response, using download URL as fallback:', apiFilePath);
            }
            
            setTotalRecords(apiTotalRecords);
            setSampleSize(apiSampleSize);
            setSampleFilePath(apiFilePath);
            sampleFilePathRef.current = apiFilePath; // Also store in ref
            
            console.log('[QCFormPage] ===== STATE VALUES SET =====');
            console.log('[QCFormPage] Sample data generated, records count:', sampleData.length);
            console.log('[QCFormPage] Total Records:', apiTotalRecords, 'Sample Size:', apiSampleSize);
            console.log('[QCFormPage] Sample File Path extracted:', apiFilePath);
            console.log('[QCFormPage] Sample File Path set in state:', apiFilePath);
            console.log('[QCFormPage] Sample File Path set in ref:', sampleFilePathRef.current);
            console.log('[QCFormPage] Sample File Path length:', apiFilePath?.length || 0);
            console.log('[QCFormPage] Sample File Path is empty?:', !apiFilePath);
            console.log('[QCFormPage] Response data keys:', Object.keys(sampleResponse.data || {}));
            console.log('[QCFormPage] ===== STATE VALUES END =====');
          } else {
            console.warn('[QCFormPage] No sample data returned');
          }
        } catch (sampleError) {
          console.error('[QCFormPage] Error generating sample:', sampleError);
          toast.error('Failed to generate sample data');
        }
      }

      setFormData(sampleData);

      // Initialize form rows with errors structure
      const initialRows = sampleData.map((data, index) => ({
        id: data.id || index + 1, // Use data.id if available, otherwise use index + 1
        originalData: data,
        errors: [] // Array of { categoryId, subcategoryId }
      }));
      setFormRows(initialRows);
      calculateQCScore(initialRows, transformedAFD);

    } catch (err) {
      console.error('[QCFormPage] Error fetching form data:', err);
      setError(err.message || 'Failed to load QC form data');
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  // Add error to a record
  const handleAddError = (rowIndex, categoryId, subcategoryId) => {
    setFormRows(prevRows => {
      const updatedRows = [...prevRows];
      const row = updatedRows[rowIndex];
      
      // Check if error already exists in this row
      const errorExists = row.errors.some(
        err => err.categoryId === categoryId && err.subcategoryId === subcategoryId
      );
      
      if (!errorExists) {
        row.errors.push({ categoryId, subcategoryId });
        // Trigger score calculation after state update
        setTimeout(() => calculateQCScore(updatedRows, afdData), 0);
      }
      return updatedRows;
    });
  };

  // Update pending selection for a row
  const updatePendingSelection = (rowId, category, subcategories) => {
    setPendingSelections(prev => ({
      ...prev,
      [rowId]: { category, subcategories }
    }));
  };

  // Clear pending selection for a row
  const clearPendingSelection = (rowId) => {
    setPendingSelections(prev => {
      const updated = { ...prev };
      delete updated[rowId];
      return updated;
    });
  };

  // Remove error from a record
  const handleRemoveError = (rowIndex, errorIndex) => {
    setFormRows(prevRows => {
      const updatedRows = [...prevRows];
      updatedRows[rowIndex].errors.splice(errorIndex, 1);
      // Trigger score calculation after state update
      setTimeout(() => calculateQCScore(updatedRows, afdData), 0);
      return updatedRows;
    });
  };

  // Calculate QC Score for all records
  const calculateQCScore = (rows, afd) => {
    if (!afd || !afd.categories || afd.categories.length === 0) {
      setQcScore(0);
      return;
    }

    // Calculate score for each record
    const recordScores = rows.map(row => calculateRecordScore(row, afd));
    
    // Calculate average of all record scores = Final QC Score
    const avgScore = recordScores.length > 0
      ? recordScores.reduce((sum, score) => sum + score, 0) / recordScores.length
      : 0;
    
    setQcScore(Number(avgScore.toFixed(2)));
  };

  // Calculate score for a single record
  const calculateRecordScore = (row, afd) => {
    if (!afd || !afd.categories) return 100;

    // Check if any error is a fatal error (points = 100)
    const hasFatalError = row.errors.some(error => {
      const category = afd.categories.find(cat => cat.qc_afd_id === error.categoryId);
      if (category) {
        const subcategory = category.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
        if (subcategory && subcategory.points >= 100) {
          return true; // Fatal error found
        }
      }
      return false;
    });

    // If fatal error exists, record score is 0
    if (hasFatalError) {
      return 0;
    }

    // Calculate score for each category
    const categoryScores = afd.categories.map(category => {
      // Start with 100 points for this category
      let categoryScore = 100;
      
      // Find all errors in this category for this record
      const categoryErrors = row.errors.filter(err => err.categoryId === category.qc_afd_id);
      
      // Deduct points for each error
      categoryErrors.forEach(error => {
        const subcategory = category.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
        if (subcategory) {
          categoryScore -= subcategory.points;
        }
      });
      
      // Ensure score doesn't go below 0
      return Math.max(0, categoryScore);
    });

    // Calculate average of all category scores for this record
    const recordScore = categoryScores.length > 0
      ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length
      : 100;
    
    return recordScore;
  };

  // Get category score for a specific record
  const getCategoryScore = (row, categoryId) => {
    if (!afdData) return 100;
    
    // Check if this record has any fatal error (across all categories)
    const hasFatalError = row.errors.some(error => {
      const cat = afdData.categories.find(c => c.qc_afd_id === error.categoryId);
      if (cat) {
        const subcategory = cat.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
        if (subcategory && subcategory.points >= 100) {
          return true; // Fatal error found
        }
      }
      return false;
    });

    // If fatal error exists, return 0 for this category too
    if (hasFatalError) {
      return 0;
    }
    
    const category = afdData.categories.find(cat => cat.qc_afd_id === categoryId);
    if (!category) return 100;

    let categoryScore = 100;
    const categoryErrors = row.errors.filter(err => err.categoryId === categoryId);
    
    categoryErrors.forEach(error => {
      const subcategory = category.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
      if (subcategory) {
        categoryScore -= subcategory.points;
      }
    });
    
    return Math.max(0, categoryScore);
  };

  // Get total deduction for a subcategory across all records
  const getSubcategoryTotalDeduction = (categoryId, subcategoryId) => {
    let totalDeduction = 0;
    formRows.forEach(row => {
      const hasError = row.errors.some(
        err => err.categoryId === categoryId && err.subcategoryId === subcategoryId
      );
      if (hasError) {
        const category = afdData?.categories.find(cat => cat.qc_afd_id === categoryId);
        const subcategory = category?.subcategories.find(sub => sub.qc_afd_id === subcategoryId);
        if (subcategory) {
          totalDeduction += subcategory.points;
        }
      }
    });
    return totalDeduction;
  };

  // Handle Regular Submit (score >= 95)
  const handleRegularSubmit = () => {
    setSubmissionType('regular');
    setShowConfirmModal(true);
  };

  // Handle Rework Submit (score < 95)
  const handleReworkSubmit = () => {
    setSubmissionType('rework');
    setShowConfirmModal(true);
  };

  // Handle Correction
  const handleCorrection = () => {
    setSubmissionType('correction');
    setShowConfirmModal(true);
  };

  // Handle actual submission from modal
  const handleConfirmSubmission = async (comments) => {
    try {
      setSaving(true);

      // Validate required data
      if (!trackerData || !user) {
        throw new Error('Missing tracker data or user information');
      }

      // Format error list from formRows
      const errorList = [];
      formRows.forEach((row, rowIndex) => {
        row.errors.forEach(error => {
          const category = afdData?.categories.find(cat => cat.qc_afd_id === error.categoryId);
          const subcategory = category?.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
          
          if (category && subcategory) {
            errorList.push({
              row: rowIndex + 1,
              category: category.name,
              subcategory: subcategory.name,
              error: `${category.name} - ${subcategory.name}`,
              points: subcategory.points
            });
          }
        });
      });

      // Use the user-selected submission type as the status
      // This allows QA to override the auto-calculated status if needed
      const status = submissionType || errorMetrics.status;

      // Extract date from tracker data and format to YYYY-MM-DD
      let formattedDate = '';
      
      // Try different date fields from tracker data
      const possibleDates = [
        trackerData.tracker_date,
        trackerData.date_time,
        trackerData.created_at,
        trackerData.submission_date,
        trackerData.date
      ];
      
      // Find first valid date
      const dateSource = possibleDates.find(date => date && date.trim() !== '');
      
      if (dateSource) {
        // Remove time and GMT parts if present
        let cleanDate = dateSource.trim();
        
        // Handle formats like "Wed, 05 Mar 2026 14:30:23 GMT"
        if (cleanDate.includes(',')) {
          const parts = cleanDate.split(',')[1].trim(); // Get "05 Mar 2026 14:30:23 GMT"
          const dateParts = parts.split(' '); // ["05", "Mar", "2026", ...]
          
          if (dateParts.length >= 3) {
            const day = dateParts[0];
            const month = dateParts[1];
            const year = dateParts[2];
            
            // Convert month name to number
            const monthMap = {
              'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
              'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
              'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            
            const monthNum = monthMap[month] || '01';
            formattedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
          }
        }
        // Handle ISO format "2026-03-05T14:30:23Z"
        else if (cleanDate.includes('T')) {
          formattedDate = cleanDate.split('T')[0];
        }
        // Handle format "2026-03-05 14:30:23"
        else if (cleanDate.includes(' ')) {
          formattedDate = cleanDate.split(' ')[0];
        }
        // Handle format "2026-03-05"
        else if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          formattedDate = cleanDate;
        }
      }
      
      // If still no valid date, use today's date
      if (!formattedDate || formattedDate === '') {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }
      
      console.log('[QCFormPage] Date extraction:', {
        trackerDate: trackerData.tracker_date,
        dateTime: trackerData.date_time,
        createdAt: trackerData.created_at,
        formattedDate
      });

      // Validate date format
      if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('[QCFormPage] Invalid date format:', formattedDate);
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }

      // Extract assistant manager ID from tracker data with multiple fallbacks
      // Only accept valid IDs (not null, undefined, 0, or empty string)
      const extractValidId = (id) => {
        const numId = id ? Number(id) : null;
        return numId && numId > 0 ? numId : null;
      };
      
      const ass_manager_id = extractValidId(trackerData.assistant_manager_id)
        || extractValidId(trackerData.asst_manager_id)
        || extractValidId(trackerData.ass_manager_id)
        || extractValidId(trackerData.project_manager_id)
        || extractValidId(trackerData.manager_id)
        || null;

      console.log('[QCFormPage] Assistant Manager ID Extraction:', {
        assistant_manager_id: trackerData.assistant_manager_id,
        asst_manager_id: trackerData.asst_manager_id,
        ass_manager_id: trackerData.ass_manager_id,
        project_manager_id: trackerData.project_manager_id,
        manager_id: trackerData.manager_id,
        extracted_value: ass_manager_id,
        is_null: ass_manager_id === null,
        is_valid: ass_manager_id !== null && ass_manager_id > 0
      });

      // Log the sample file path before creating payload
      console.log('[QCFormPage] ===== PRE-SUBMISSION FILE PATH CHECK =====');
      console.log('[QCFormPage] Before payload - sampleFilePath state:', sampleFilePath);
      console.log('[QCFormPage] Before payload - sampleFilePathRef.current:', sampleFilePathRef.current);
      console.log('[QCFormPage] Before payload - sampleFilePath type:', typeof sampleFilePath);
      console.log('[QCFormPage] Before payload - sampleFilePath is empty?:', !sampleFilePath);
      console.log('[QCFormPage] Before payload - ref is empty?:', !sampleFilePathRef.current);
      
      // Use ref value as fallback if state is empty (React state timing issue)
      const filePathToUse = sampleFilePath || sampleFilePathRef.current || '';
      console.log('[QCFormPage] File path to use in payload:', filePathToUse);
      console.log('[QCFormPage] ===== END PRE-SUBMISSION FILE PATH CHECK =====');

      // Prepare payload for API - matching database schema exactly
      const payload = {
        // Authentication & Reference
        logged_in_user_id: user?.user_id || user?.id,
        tracker_id: trackerData.tracker_id,
        
        // Database Fields (matching exact schema)
        assistant_manager_id: ass_manager_id, 
        qa_user_id: user?.user_id || user?.id,
        agent_id: trackerData.user_id || trackerData.agent_user_id || trackerData.agent_id,
        project_id: trackerData.project_id,
        task_id: trackerData.task_id,
        whole_file_path: trackerData.tracker_file || trackerData.file_path || '',
        qc_file_path: filePathToUse, 
        date_of_file_submission: formattedDate,
        qc_score: parseFloat(qcScore.toFixed(2)),
        status: status,
        file_record_count: totalRecords || errorMetrics.recordCount,
        qc_generated_count: sampleSize || errorMetrics.sampleCount, 
        qc_file_records: formData, 
        error_list: errorList, 
        comments: comments || '',
        sampling_percentage: trackerData.qc_percentage || 10
      };

      console.log('[QCFormPage] Tracker Data:', trackerData);
      console.log('[QCFormPage] User Data:', user);
      console.log('[QCFormPage] Submitting QC record with payload:', JSON.stringify(payload, null, 2));
      console.log('[QCFormPage] Payload field validation:', {
        assistant_manager_id: payload.assistant_manager_id,
        qa_user_id: payload.qa_user_id,
        agent_id: payload.agent_id,
        project_id: payload.project_id,
        task_id: payload.task_id,
        whole_file_path: payload.whole_file_path,
        qc_file_path: payload.qc_file_path,
        date_of_file_submission: payload.date_of_file_submission,
        qc_score: payload.qc_score,
        status: payload.status,
        file_record_count: payload.file_record_count,
        qc_generated_count: payload.qc_generated_count,
        qc_file_records_count: payload.qc_file_records?.length,
        error_list_count: payload.error_list.length
      });

      // Validate required fields
      const requiredFields = ['qa_user_id', 'agent_id', 'project_id', 'task_id', 'date_of_file_submission'];
      const missingFields = requiredFields.filter(field => !payload[field]);
      
      if (missingFields.length > 0) {
        console.error('[QCFormPage] Missing required fields:', missingFields);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate date is not empty
      if (!payload.date_of_file_submission || payload.date_of_file_submission === '') {
        throw new Error('Date of file submission is required and cannot be empty');
      }

      // Call API to save QC record
      const response = await saveQCRecord(payload);

      console.log('[QCFormPage] API Response:', response);

      if (response.success || response.status === 200) {
        const successMessage = submissionType === 'regular' 
          ? 'QC Form submitted & email notification sent!' 
          : submissionType === 'rework'
          ? 'QC submitted for Rework & email notification sent!'
          : 'Correction request submitted & email notification sent!';
        
        toast.success(successMessage);
        setShowConfirmModal(false);
        
        // Navigate to QC Form Report after successful submission
        setTimeout(() => {
          navigate('/dashboard?tab=agent_file_report&subtab=qc_report');
        }, 500);
      } else {
        throw new Error(response.message || 'Failed to save QC record');
      }

    } catch (err) {
      console.error('[QCFormPage] Error submitting form:', err);
      console.error('[QCFormPage] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Failed to submit QC form';
      
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle file download
  const handleDownload = () => {
    if (trackerData?.tracker_id) {
      const backendUrl = config.apiNodeBaseUrl || 'http://localhost:8000/api/v1';
      // Strip /v1 if present to form route, though typically routes start without /v1 here if backend is set up directly. 
      // Checking the qcService.js, it uses nodeApi.post("/qc-records/generate-sample").
      // nodeApi probably configures baseURL as VITE_API_NODE_BASE_URL.
      // So this URL is correct:
      const fileUrl = `${backendUrl}/qc-records/download-sample/${trackerData.tracker_id}?logged_in_user_id=${user?.user_id}`;
      // Open the streaming API endpoint directly to trigger browser download
      window.open(fileUrl, '_blank');
      toast.success(`Downloading ${trackerData.qc_percentage || 10}% sample file...`);
    } else {
      toast.error('No file available for download');
    }
  };

  if (!trackerData) {
    return (
      <div className="flex items-center justify-center h-64">
        <ErrorMessage message="No tracker data available" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  // Get the first three keys from the first data object for dynamic columns
  const dynamicKeys = formData.length > 0 ? Object.keys(formData[0]).filter(key => key !== 'id').slice(0, 3) : [];

  // Generate page numbers for pagination display
  const getPageNumbers = () => {
    const pages = [];
    
    if (totalPages <= 8) {
      // Show all pages if total pages <= 8
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first 6 pages
      for (let i = 1; i <= Math.min(6, totalPages); i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (totalPages > 8) {
        pages.push('ellipsis');
      }
      
      // Add last 2 pages
      for (let i = Math.max(7, totalPages - 1); i <= totalPages; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* QC Form Heading */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-3">
          <FileText className="w-8 h-8" />
          QC Form
        </h1>
      </div>

      {/* Agent Info & File Details */}
      <div className="bg-white rounded-xl shadow-md p-6 border-2 border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Agent Name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Agent Name</p>
              <p className="text-lg font-bold text-slate-800">
                {trackerData.agent_name || trackerData.user_name || 'N/A'}
              </p>
            </div>
          </div>

          {/* File Name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 font-medium">File Name</p>
              <p className="text-lg font-bold text-slate-800 truncate">
                {trackerData.tracker_file ? trackerData.tracker_file.split('/').pop() : 'No file'}
              </p>
            </div>
          </div>

          {/* Download File */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Download className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 font-medium">Download File</p>
              <button
                onClick={handleDownload}
                disabled={!trackerData.tracker_file}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 underline"
              >
                {trackerData.tracker_file ? 'Click to Download' : 'No file available'}
              </button>
            </div>
          </div>

          {/* Submission Date & Time */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Submission Date & Time</p>
              <p className="text-lg font-bold text-slate-800">
                {trackerData.date_of_file_submission
                  ? new Date(trackerData.date_of_file_submission).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : trackerData.updated_at
                  ? new Date(trackerData.updated_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : trackerData.date_time 
                  ? trackerData.date_time.replace(/:\d{2}\s*GMT.*$/, '').trim()
                  : trackerData.tracker_date 
                  ? trackerData.tracker_date.replace(/:\d{2}\s*GMT.*$/, '').trim()
                  : trackerData.created_at 
                  ? trackerData.created_at.replace(/:\d{2}\s*GMT.*$/, '').trim()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Project Name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 font-medium">Project Name</p>
              <p className="text-lg font-bold text-slate-800 truncate">
                {trackerData.project_name || 'N/A'}
              </p>
            </div>
          </div>

          {/* Task Name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 font-medium">Task Name</p>
              <p className="text-lg font-bold text-slate-800 truncate">
                {trackerData.task_name || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QC Form Table */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200">
        <div className="overflow-x-auto" style={{overflowY: 'visible'}}>
          <div className="min-w-max">
        <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0 z-[100]">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-blue-500">
                  Sr. No.
                </th>
                {dynamicKeys.map((key, index) => (
                  <th
                    key={index}
                    className="px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-blue-500"
                  >
                    {key.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-blue-500">
                  Select Error
                </th>
                <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-blue-500">
                  Selected Errors
                </th>
                {afdData?.categories.map((cat) => (
                  <th
                    key={cat.qc_afd_id}
                    className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-blue-500"
                  >
                    {cat.name}
                  </th>
                ))}
                <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                  Record Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentPageData.map((row, rowIndex) => {
                const recordScore = calculateRecordScore(row, afdData);
                const actualRowIndex = formRows.findIndex(r => r.id === row.id);
                const displayRowNum = startIndex + rowIndex + 1;
                
                return (
                  <tr key={row.id} className="hover:bg-blue-50 transition-colors">
                    {/* Sr. No. */}
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 border-r border-slate-200">
                      {displayRowNum}
                    </td>

                    {/* Dynamic Columns */}
                    {dynamicKeys.map((key, colIndex) => (
                      <td
                        key={colIndex}
                        className="px-4 py-4 text-sm text-slate-600 border-r border-slate-200"
                      >
                        {row.originalData[key]}
                      </td>
                    ))}

                    {/* Error Selection Dropdown */}
                    <td className="px-4 py-4 border-r border-slate-200 relative">
                      <div className="flex flex-col gap-3">        
                        <SearchableSelect
                          value={pendingSelections[row.id]?.category || ''}
                          onChange={(value) => {
                            updatePendingSelection(row.id, value, []);
                          }}
                          options={afdData?.categories.map((cat) => ({
                            value: cat.qc_afd_id,
                            label: cat.name
                          })) || []}
                          placeholder="Select Category"
                          icon={FileText}
                          isClearable={true}
                        />

                        <MultiSelectWithCheckbox
                          value={pendingSelections[row.id]?.subcategories || []}
                          onChange={(values) => {
                            const currentCategory = pendingSelections[row.id]?.category || '';
                            updatePendingSelection(row.id, currentCategory, values);
                          }}
                          options={pendingSelections[row.id]?.category && afdData?.categories
                            .find(cat => cat.qc_afd_id === parseInt(pendingSelections[row.id].category))
                            ?.subcategories.map((sub) => ({
                              value: sub.qc_afd_id,
                              label: `${sub.name} (-${sub.points} pts)`
                            })) || []}
                          placeholder="Select Errors"
                          disabled={!pendingSelections[row.id]?.category}
                          showSelectAll={true}
                          icon={AlertCircle}
                        />

                        <button
                          onClick={() => {
                            const pending = pendingSelections[row.id];
                            if (pending?.category && pending?.subcategories?.length > 0) {
                              pending.subcategories.forEach(subcategoryId => {
                                handleAddError(actualRowIndex, parseInt(pending.category), subcategoryId);
                              });
                              clearPendingSelection(row.id);
                            }
                          }}
                          disabled={!pendingSelections[row.id]?.category || !pendingSelections[row.id]?.subcategories?.length}
                          className="w-full px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold rounded-lg transition-all shadow-sm hover:shadow-md"
                        >
                          Add {pendingSelections[row.id]?.subcategories?.length > 0 ? `(${pendingSelections[row.id].subcategories.length})` : ''} Error{pendingSelections[row.id]?.subcategories?.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                    </td>

                    {/* Selected Errors */}
                    <td className="px-4 py-4 border-r border-slate-200">
                      <div className="flex flex-col gap-1 max-w-xs">
                        {row.errors.length > 0 ? (
                          row.errors.map((error, errorIndex) => {
                            const category = afdData?.categories.find(cat => cat.qc_afd_id === error.categoryId);
                            const subcategory = category?.subcategories.find(sub => sub.qc_afd_id === error.subcategoryId);
                            
                            return (
                              <div
                                key={errorIndex}
                                className="flex items-center justify-between gap-1 bg-red-50 border border-red-300 px-2 py-1 rounded text-xs"
                              >
                                <span className="font-semibold text-red-800 truncate">
                                  {subcategory?.name} (-{subcategory?.points})
                                </span>
                                <button
                                  onClick={() => handleRemoveError(actualRowIndex, errorIndex)}
                                  className="text-red-600 hover:text-red-800 font-bold flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">No errors</span>
                        )}
                      </div>
                    </td>

                    {/* Category Scores */}
                    {afdData?.categories.map((category) => {
                      const catScore = getCategoryScore(row, category.qc_afd_id);
                      
                      return (
                        <td
                          key={category.qc_afd_id}
                          className="px-4 py-4 text-center border-r border-slate-200"
                        >
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-bold text-sm min-w-[60px] ${
                              catScore === 100
                                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                                : catScore >= 80
                                ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
                                : 'bg-red-100 text-red-700 border-2 border-red-300'
                            }`}
                          >
                            {catScore}%
                          </span>
                        </td>
                      );
                    })}

                    {/* Record Score */}
                    <td className="px-4 py-4 text-center border-r border-slate-200">
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-bold text-sm min-w-[60px] ${
                          recordScore >= 80
                            ? 'bg-green-100 text-green-700 border-2 border-green-300'
                            : recordScore >= 60
                            ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
                            : 'bg-red-100 text-red-700 border-2 border-red-300'
                        }`}
                      >
                        {recordScore.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Enhanced Pagination Controls */}
        <div className="px-6 py-5 border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex items-center justify-between gap-6">
            {/* Items Per Page Selector - LEFT */}
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg border-2 border-blue-200 shadow-sm">
              <span className="text-sm font-semibold text-slate-700">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-md text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <span className="text-sm font-semibold text-slate-700">entries per page</span>
            </div>

            {/* Pagination Buttons - RIGHT */}
            {totalPages > 1 && (
              <div>
                <PaginationContent className="gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(currentPage - 1)}
                      className={`h-10 px-5 py-2 rounded-lg font-semibold transition-all shadow-sm flex items-center gap-2 ${
                        currentPage === 1
                          ? 'pointer-events-none opacity-40 bg-slate-200 text-slate-400'
                          : 'bg-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white text-slate-700 border-2 border-slate-300 hover:border-transparent hover:shadow-md cursor-pointer'
                      }`}
                    />
                  </PaginationItem>

                  {pageNumbers.map((pageNum, index) => (
                    <PaginationItem key={index}>
                      {pageNum === 'ellipsis' ? (
                        <PaginationEllipsis className="text-slate-500 font-bold text-lg" />
                      ) : (
                        <PaginationLink
                          onClick={() => handlePageChange(pageNum)}
                          isActive={currentPage === pageNum}
                          className={`min-w-[40px] h-10 rounded-lg font-bold transition-all shadow-sm ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-110 border-2 border-blue-400'
                              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-2 border-slate-300 hover:border-blue-400 hover:shadow-md'
                          } cursor-pointer`}
                        >
                          {pageNum}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(currentPage + 1)}
                      className={`h-10 px-5 py-2 rounded-lg font-semibold transition-all shadow-sm flex items-center gap-2 ${
                        currentPage === totalPages
                          ? 'pointer-events-none opacity-40 bg-slate-200 text-slate-400'
                          : 'bg-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white text-slate-700 border-2 border-slate-300 hover:border-transparent hover:shadow-md cursor-pointer'
                      }`}
                    />
                  </PaginationItem>
                </PaginationContent>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QA Information Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" />
          Quality Assurance Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* QA Name */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">QA Name</p>
                <p className="text-lg font-bold text-slate-800">
                  {user?.user_name || user?.name || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Final QC Score */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                qcScore >= 95 ? 'bg-green-100' : qcScore >= 80 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <Award className={`w-6 h-6 ${
                  qcScore >= 95 ? 'text-green-600' : qcScore >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Final QC Score</p>
                <p className={`text-2xl font-bold ${
                  qcScore >= 95 ? 'text-green-600' : qcScore >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {qcScore.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                errorMetrics.status === 'regular' ? 'bg-green-100' : 
                errorMetrics.status === 'rework' ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {errorMetrics.status === 'regular' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : errorMetrics.status === 'rework' ? (
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Status</p>
                <p className={`text-lg font-bold ${
                  errorMetrics.status === 'regular' ? 'text-green-600' : 
                  errorMetrics.status === 'rework' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {errorMetrics.status.charAt(0).toUpperCase() + errorMetrics.status.slice(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Record Count */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Record Count in File</p>
                <p className="text-2xl font-bold text-slate-800">
                  {totalRecords || errorMetrics.recordCount}
                </p>
              </div>
            </div>
          </div>

          {/* QC Sample Data Count */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Data Generated for QC</p>
                <p className="text-2xl font-bold text-slate-800">
                  {sampleSize || errorMetrics.tenPercentCount}
                </p>
              </div>
            </div>
          </div>

          {/* Error Score */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Errors Marked</p>
                <p className="text-2xl font-bold text-red-600">
                  {errorMetrics.totalErrors}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error List */}
        {errorMetrics.errorList.length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-5 shadow-sm border border-blue-100">
            <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-blue-600" />
              Error Breakdown
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {errorMetrics.errorList.map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-medium text-slate-700">{error.name}</span>
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-bold rounded-full">
                    {error.count} {error.count === 1 ? 'error' : 'errors'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all shadow-md"
        >
          Cancel
        </button>
        
        {/* Action Buttons with strict validation */}
        <button
          onClick={handleCorrection}
          disabled={saving || qcScore >= 100 || qcScore < 98}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
        >
          {saving && submissionType === 'correction' ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5" />
              Correction
            </>
          )}
        </button>

        <button
          onClick={handleRegularSubmit}
          disabled={saving || qcScore < 100}
          className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
        >
          {saving && submissionType === 'regular' ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Regular Submit
            </>
          )}
        </button>

        <button
          onClick={handleReworkSubmit}
          disabled={saving || qcScore >= 98}
          className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
        >
          {saving && submissionType === 'rework' ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Rework Submit
            </>
          )}
        </button>
      </div>
      </div>

      {/* Confirmation Modal */}
      <QCConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmission}
        submissionType={submissionType}
        loading={saving}
        data={{
          qaName: user?.user_name || user?.name || 'N/A',
          agentEmail: trackerData?.user_email || trackerData?.email || 'N/A',
          projectName: trackerData?.project_name || 'N/A',
          taskName: trackerData?.task_name || 'N/A',
          status: submissionType || errorMetrics.status,
          qcScore: qcScore,
          errorCount: errorMetrics.totalErrors,
          errorList: errorMetrics.errorList
        }}
      />
    </>
  );
};

export default QCFormPage;
