import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Search, CheckCircle, XCircle, Eye, Calendar, User, Clock, FileText } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ManagerRosterRequests = () => {
  const { user: authUser } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingCountRef = useRef(0);
  const [allRequests, setAllRequests] = useState({
    pending: [],
    approved: [],
    rejected: []
  });
  const hasFetchedRef = useRef(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Define fetchRequests function with useCallback for stable reference
  const fetchRequests = useCallback(async (status, userData = null) => {
    try {
      loadingCountRef.current += 1;
      setLoading(true);
      const userDataToUse = userData || authUser;
      const userId = userDataToUse?.user_id || userDataToUse?.id || 111;
      const monthYear = format(selectedMonth, 'MMMyyyy'); // Format: Apr2026
      
      console.log('Calling roster/get_leave_history API...', { 
        logged_in_user_id: userId, 
        status: status, 
        month_year: monthYear 
      });

      const response = await api.post('/roster/get_leave_history', {
        logged_in_user_id: userId,
        status: status,
        month_year: monthYear
      });

      console.log('API Response:', response.data);
      console.log('Response success:', response.data?.success);
      console.log('Response data count:', response.data?.data?.length);

      if (response.data && response.data.success) {
        const data = response.data.data || [];
        console.log('Data array length:', data.length);
        console.log('Raw data sample:', data[0]);
        
        // Convert API response to internal format
        const convertedRequests = data.map(item => {
          const toDayType = item.changes?.to?.day_type;
          const fromDayType = item.changes?.from?.day_type;
          const toShift = item.changes?.to?.shift;
          const fromShift = item.changes?.from?.shift;
          
          // Determine request type and action text
          let requestType = 'Status Change';
          let actionText = '';
          let isLeave = false;
          
          if (item.is_leave === 1 || toDayType === 'leave') {
            requestType = 'Leave';
            actionText = item.leave_type !== 'Unknown' ? item.leave_type : 'Leave';
            isLeave = true;
          } else if (toDayType === 'wfh') {
            requestType = 'WFH';
            actionText = 'Work From Home';
          } else if (toDayType === 'half_day') {
            requestType = 'Half Day';
            actionText = 'Half Day';
          } else if (toDayType === 'weekoff') {
            requestType = 'Week Off';
            actionText = 'Week Off';
          } else if (toDayType === 'working') {
            requestType = 'Working Day';
            actionText = 'Working Day';
          }
          
          return {
            id: item.draft_id,
            user_name: item.user_name,
            employee_id: item.user_id,
            team_name: item.team?.team_name || 'No Team',
            team_id: item.team?.team_id,
            date: item.date,
            leave_type: item.leave_type !== 'Unknown' ? item.leave_type : null,
            day_type: toDayType || '-',
            day_type_from: fromDayType,
            day_type_to: toDayType,
            shift: item.shift || toShift || null,
            from_shift: fromShift,
            to_shift: toShift,
            request_type: requestType,
            action: actionText || item.action || 'Status Change',
            requested_by: item.requested_by,
            requested_at: item.requested_at,
            status: item.status,
            is_planned: item.is_planned === "yes",
            is_leave: isLeave,
            changes: item.changes
          };
        });
        
        console.log('Converted requests sample:', convertedRequests[0]);

        console.log('Converted requests:', convertedRequests.length);

        // Store data in allRequests based on status
        setAllRequests(prev => ({
          ...prev,
          [status]: convertedRequests
        }));
        
        // Don't set requests state here - let the sync useEffect handle it
        
        toast.success(`Loaded ${convertedRequests.length} ${status} requests`);
      } else {
        toast.error('Failed to load requests');
        setAllRequests(prev => ({ ...prev, [status]: [] }));
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to load requests');
      setAllRequests(prev => ({ ...prev, [status]: [] }));
    } finally {
      loadingCountRef.current -= 1;
      if (loadingCountRef.current <= 0) {
        setLoading(false);
        loadingCountRef.current = 0;
      }
    }
  }, [authUser, selectedMonth]); // Dependencies for fetchRequests                                                   

  // Debug: Track allRequests changes
  useEffect(() => {
    console.log('allRequests updated:', allRequests);
    console.log('Current filterStatus:', filterStatus);
    console.log('Current tab data:', allRequests[filterStatus]);
  }, [allRequests, filterStatus]);

  // Initialize data - fetch all three statuses when authUser is available (only once)
  useEffect(() => {
    if (authUser && !hasFetchedRef.current) {
      console.log('Auth user available:', authUser);
      console.log('Fetching all three statuses...');
      hasFetchedRef.current = true; // Set flag immediately before API calls
      fetchRequests('pending', authUser);
      fetchRequests('approved', authUser);
      fetchRequests('rejected', authUser);
    }
  }, [authUser, fetchRequests]);

  // Re-fetch when month changes
  useEffect(() => {
    if (authUser) {
      console.log('Month changed, re-fetching...');
      // Reset hasFetchedRef to allow re-fetching
      hasFetchedRef.current = true;
      // Clear current data
      setAllRequests({
        pending: [],
        approved: [],
        rejected: []
      });
      // Fetch all statuses for new month
      fetchRequests('pending', authUser);
      fetchRequests('approved', authUser);
      fetchRequests('rejected', authUser);
    }
  }, [selectedMonth, authUser, fetchRequests]);

  const handleTabChange = (status) => {
    setFilterStatus(status);
    // Fetch data if not already cached
    if (!allRequests[status] || allRequests[status].length === 0) {
      fetchRequests(status, authUser);
    }
  };

  const currentRequests = allRequests[filterStatus] || [];
  const filteredRequests = currentRequests.filter(item =>
    item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.requested_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Debug render values
  console.log('Render - filterStatus:', filterStatus);
  console.log('Render - currentRequests.length:', currentRequests.length);
  console.log('Render - filteredRequests.length:', filteredRequests.length);
  console.log('Render - loading:', loading);

  const stats = {
    pending: allRequests.pending.length,
    approved: allRequests.approved.length,
    rejected: allRequests.rejected.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      {/* Full Page Loader Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center">
            <div className="relative mb-4">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
            </div>
            <p className="text-slate-700 font-semibold text-lg">Loading requests...</p>
            <p className="text-slate-500 text-sm mt-1">Please wait while we fetch the data</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Roster Requests</h1>
          <p className="text-slate-600">View and manage roster change requests</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Month Selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-center min-w-[150px]">
                <h3 className="text-lg font-semibold text-slate-800">
                  {format(selectedMonth, 'MMMM yyyy')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
              {['pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleTabChange(status)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="ml-1 px-1.5 py-0.5 bg-slate-200 rounded-full text-xs">
                    {stats[status]}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, team, or submitter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none w-64"
              />
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-lg">No {filterStatus} requests found</p>
              <p className="text-slate-400 text-sm">
                {filterStatus === 'pending' && 'No pending requests for this month'}
                {filterStatus === 'approved' && 'No approved requests for this month'}
                {filterStatus === 'rejected' && 'No rejected requests for this month'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Request Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-800 truncate">
                            {request.user_name}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {request.team_name}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          request.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-600">
                          <strong>Date:</strong> {format(new Date(request.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-slate-600">
                          <strong>Requested At:</strong> {format(new Date(request.requested_at), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-slate-600">
                          <strong>Requested By:</strong> {request.requested_by}
                        </div>
                        {/* Show From → To Status Change */}
                        {(request.day_type_from || request.day_type_to) && (
                          <div className="text-slate-600">
                            <strong>Status:</strong> {request.day_type_from || '-'} → {request.day_type_to || '-'}
                          </div>
                        )}
                        {/* Show From → To Shift Change */}
                        {(request.from_shift || request.to_shift) && (
                          <div className="text-slate-600">
                            <strong>Shift:</strong> {request.from_shift || '-'} → {request.to_shift || '-'}
                          </div>
                        )}
                        {/* Show Action if available and not Unknown */}
                        {request.action && request.action !== 'Unknown' && (
                          <div className="text-slate-600">
                            <strong>Action:</strong> {request.action}
                          </div>
                        )}
                        {/* Show Leave Type only for leave requests */}
                        {request.is_leave && (
                          <div className="text-slate-600">
                            <strong>Leave Type:</strong> {request.leave_type || '-'}
                          </div>
                        )}
                        {/* Show Planned only for leave requests */}
                        {request.is_leave && (
                          <div className="text-slate-600">
                            <strong>Planned:</strong> {request.is_planned ? 'Yes' : 'No'}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Request Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-lg">{selectedRequest.user_name}</h4>
                  <p className="text-sm text-slate-500">{selectedRequest.team_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Date</p>
                  <p className="font-medium text-slate-800">{format(new Date(selectedRequest.date), 'dd/MM/yyyy')}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    selectedRequest.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedRequest.status ? selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1) : ''}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Request Type</p>
                  <p className="font-medium text-slate-800">{selectedRequest.request_type || 'Status Change'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Requested By</p>
                  <p className="font-medium text-slate-800">{selectedRequest.requested_by}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Requested At</p>
                  <p className="font-medium text-slate-800">{format(new Date(selectedRequest.requested_at), 'dd/MM/yyyy')}</p>
                </div>
                {/* Show From → To Status Change */}
                {(selectedRequest.day_type_from || selectedRequest.day_type_to) && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Status Change</p>
                    <p className="font-medium text-slate-800">{selectedRequest.day_type_from || '-'} → {selectedRequest.day_type_to || '-'}</p>
                  </div>
                )}
                {/* Show From → To Shift Change */}
                {(selectedRequest.from_shift || selectedRequest.to_shift) && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Shift Change</p>
                    <p className="font-medium text-slate-800">{selectedRequest.from_shift || '-'} → {selectedRequest.to_shift || '-'}</p>
                  </div>
                )}
              </div>

              {/* Show Leave Type and Planned only for leave requests */}
              {selectedRequest.is_leave && (
                <>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Leave Type</p>
                    <p className="font-medium text-slate-800">{selectedRequest.leave_type || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Planned</p>
                    <p className="font-medium text-slate-800">{selectedRequest.is_planned ? 'Yes' : 'No'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerRosterRequests;
