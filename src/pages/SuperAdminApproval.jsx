/**
 * File: SuperAdminApproval.jsx
 * Author: Naitik Maisuriya
 * Description: Super Admin Roster Approval Dashboard
 */

import React, { useState, useEffect } from "react";
import {
  Shield,
  Check,
  XCircle,
  Calendar,
  Users,
  Clock,
  Eye,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  FileText,
  Mail,
  Square,
  CheckSquare
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format, subMonths, addMonths } from "date-fns";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const SuperAdminApproval = () => {
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvedRosters, setApprovedRosters] = useState([]);
  const [rejectedRosters, setRejectedRosters] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);

  
  // Filter data based on status and search
  const getFilteredData = () => {
    let data = [];
    
    switch (filterStatus) {
      case 'pending':
        data = pendingApprovals;
        break;
      case 'approved':
        data = approvedRosters;
        break;
      case 'rejected':
        data = rejectedRosters;
        break;
      default:
        data = pendingApprovals;
    }

    if (searchTerm) {
      data = data.filter(item => 
        item.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.requested_by.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return data;
  };

  // Approval actions
  const handleApprove = async (id) => {
    try {
      setLoading(true);
      console.log('Calling Roster Approve API for draft_id:', id);
      
      // Call real API
      const response = await api.post('/roster/approve', { draft_id: id });
      
      if (response.data && response.data.status === 200) {
        // Move from pending to approved
        const approval = pendingApprovals.find(item => item.id === id);
        if (approval) {
          setPendingApprovals(prev => prev.filter(item => item.id !== id));
          setApprovedRosters(prev => [{
            ...approval,
            approved_date: format(new Date(), 'yyyy-MM-dd'),
            approved_by: user?.user_name || 'Super Admin'
          }, ...prev]);
        }
        
        toast.success(response.data.message || 'Roster approved successfully!');
        setShowDetailsModal(false);
      } else {
        toast.error(response.data?.message || 'Failed to approve roster');
      }
    } catch (error) {
      console.error('Error approving roster:', error);
      toast.error(error.response?.data?.message || 'Failed to approve roster');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id, reason = '') => {
    try {
      setLoading(true);
      console.log('Calling Roster Reject API for draft_id:', id);
      
      // Call real API
      const response = await api.post('/roster/reject', { draft_id: id });
      
      if (response.data && response.data.status === 200) {
        // Move from pending to rejected
        const approval = pendingApprovals.find(item => item.id === id);
        if (approval) {
          setPendingApprovals(prev => prev.filter(item => item.id !== id));
          setRejectedRosters(prev => [{
            ...approval,
            rejected_date: format(new Date(), 'yyyy-MM-dd'),
            rejected_by: user?.user_name || 'Super Admin',
            rejection_reason: reason || 'Rejected by admin'
          }, ...prev]);
        }
        
        toast.success(response.data.message || 'Roster rejected successfully!');
        setShowDetailsModal(false);
      } else {
        toast.error(response.data?.message || 'Failed to reject roster');
      }
    } catch (error) {
      console.error('Error rejecting roster:', error);
      toast.error(error.response?.data?.message || 'Failed to reject roster');
    } finally {
      setLoading(false);
    }
  };

  // View details
  const handleViewDetails = (approval) => {
    setSelectedApproval(approval);
    setShowDetailsModal(true);
  };

  // Bulk selection handlers
  const handleToggleSelection = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredData.filter(item => item.status === 'pending').map(item => item.id));
    }
  };

  // Bulk approval/rejection
  const handleBulkApprove = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select items to approve');
      return;
    }

    try {
      setLoading(true);
      
      // Call roster/approve API for each selected draft
      const approvePromises = selectedItems.map(draftId => 
        api.post('/roster/approve', { draft_id: draftId })
      );
      
      console.log('Calling roster/approve API for draft IDs:', selectedItems);
      const results = await Promise.allSettled(approvePromises);
      
      // Check results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.data?.status === 200);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.data?.status !== 200));
      
      // Move successful items from pending to approved
      const approvedIds = successful.map((_, index) => selectedItems[index]);
      const approvedItems = pendingApprovals.filter(item => approvedIds.includes(item.id));
      
      if (approvedItems.length > 0) {
        setPendingApprovals(prev => prev.filter(item => !approvedIds.includes(item.id)));
        setApprovedRosters(prev => [
          ...approvedItems.map(item => ({
            ...item,
            approved_date: format(new Date(), 'yyyy-MM-dd'),
            approved_by: user?.user_name || 'Super Admin'
          })),
          ...prev
        ]);
      }
      
      setSelectedItems([]);
      setBulkSelectionMode(false);
      
      if (failed.length === 0) {
        toast.success(`${approvedItems.length} drafts approved successfully!`);
      } else if (approvedItems.length > 0) {
        toast.success(`${approvedItems.length} approved, ${failed.length} failed`);
      } else {
        toast.error('Failed to approve drafts');
      }
    } catch (error) {
      console.error('Error in bulk approve:', error);
      toast.error('Failed to approve drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select items to reject');
      return;
    }

    const reason = prompt('Please provide rejection reason for all selected items:');
    if (!reason) return;

    try {
      setLoading(true);
      
      // Call roster/reject API for each selected draft
      const rejectPromises = selectedItems.map(draftId => 
        api.post('/roster/reject', { draft_id: draftId })
      );
      
      console.log('Calling roster/reject API for draft IDs:', selectedItems);
      const results = await Promise.allSettled(rejectPromises);
      
      // Check results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.data?.status === 200);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.data?.status !== 200));
      
      // Move successful items from pending to rejected
      const rejectedIds = successful.map((_, index) => selectedItems[index]);
      const rejectedItems = pendingApprovals.filter(item => rejectedIds.includes(item.id));
      
      if (rejectedItems.length > 0) {
        setPendingApprovals(prev => prev.filter(item => !rejectedIds.includes(item.id)));
        setRejectedRosters(prev => [
          ...rejectedItems.map(item => ({
            ...item,
            rejected_date: format(new Date(), 'yyyy-MM-dd'),
            rejected_by: user?.user_name || 'Super Admin',
            rejection_reason: reason
          })),
          ...prev
        ]);
      }
      
      setSelectedItems([]);
      setBulkSelectionMode(false);
      
      if (failed.length === 0) {
        toast.success(`${rejectedItems.length} drafts rejected successfully!`);
      } else if (rejectedItems.length > 0) {
        toast.success(`${rejectedItems.length} rejected, ${failed.length} failed`);
      } else {
        toast.error('Failed to reject drafts');
      }
    } catch (error) {
      console.error('Error in bulk reject:', error);
      toast.error('Failed to reject drafts');
    } finally {
      setLoading(false);
    }
  };

  // Initialize data
  useEffect(() => {
    fetchPendingDrafts();
    fetchApprovedRosters();
    fetchRejectedRosters();
  }, []);

  // Refresh data when month changes
  useEffect(() => {
    fetchPendingDrafts();
    fetchApprovedRosters();
    fetchRejectedRosters();
  }, [selectedMonth]);

  const fetchPendingDrafts = async () => {
    try {
      setLoading(true);
      const userId = user?.user_id || user?.id || 93;
      console.log('Calling roster/get_pending_drafts API...', { logged_in_user_id: userId });

      const response = await api.post('/roster/get_pending_drafts', {
        logged_in_user_id: userId
      });

      console.log('API Response:', response.data);

      if (response.data && response.data.success) {
        // Convert API response to internal format
        const convertedPending = response.data.pending_requests.map(request => {
          const req = request.request || {};
          
          // Determine request type and display info
          let requestType = 'Status Change';
          let displayDetails = '';
          let badgeColor = 'bg-slate-100 text-slate-700';
          
          if (req.leave === "yes") {
            requestType = 'Leave';
            displayDetails = req.leave_type || 'Leave';
            badgeColor = 'bg-orange-100 text-orange-700';
          } else if (req.action?.includes('wfh')) {
            requestType = 'WFH';
            displayDetails = 'Work From Home';
            badgeColor = 'bg-blue-100 text-blue-700';
          } else if (req.action?.includes('half day')) {
            requestType = 'Half Day';
            displayDetails = 'Half Day';
            badgeColor = 'bg-yellow-100 text-yellow-700';
          } else if (req.action?.includes('working day')) {
            requestType = 'Working Day';
            displayDetails = 'Working Day';
            badgeColor = 'bg-green-100 text-green-700';
          } else if (req.shift) {
            requestType = 'Shift Change';
            displayDetails = `Shift: ${req.shift}`;
            badgeColor = 'bg-purple-100 text-purple-700';
          }
          
          return {
            id: request.draft_id,
            employee_name: request.user_name,
            employee_id: request.user_id,
            team_name: request.team?.team_name || 'No Team',
            team_id: request.team?.team_id,
            date: request.date,
            action: req.action || (req.shift ? 'Shift Change' : 'Status Change'),
            leave_type: req.leave_type || null,
            request_type: requestType,
            display_details: displayDetails,
            badge_color: badgeColor,
            shift: req.shift || null,
            is_leave: req.leave === "yes",
            is_planned_leave: req.is_planned === "yes",
            requested_by: request.requested_by,
            requested_date: request.requested_at,
            status: 'pending',
            raw_request: req
          };
        });

        setPendingApprovals(convertedPending);
      } else {
        toast.error('Failed to load pending drafts');
      }
    } catch (error) {
      console.error('Error fetching pending drafts:', error);
      toast.error('Failed to load pending drafts');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedRosters = async () => {
    try {
      setLoading(true);
      const userId = user?.user_id || user?.id || 93;
      const monthYear = format(selectedMonth, 'MMMyyyy').toUpperCase();
      console.log('Calling roster/get_leave_history API for approved...', { logged_in_user_id: userId, status: 'approved', month_year: monthYear });

      const response = await api.post('/roster/get_leave_history', {
        logged_in_user_id: userId,
        status: 'approved',
        month_year: monthYear
      });

      console.log('Approved API Response:', response.data);

      if (response.data && response.data.success) {
        // Convert API response to internal format
        const convertedApproved = response.data.data.map(item => {
          const toDayType = item.changes?.to?.day_type;
          const fromDayType = item.changes?.from?.day_type;
          const toShift = item.changes?.to?.shift;
          const fromShift = item.changes?.from?.shift;
          
          // Determine request type based on day_type and other fields
          let requestType = 'Status Change';
          let displayDetails = '';
          let badgeColor = 'bg-slate-100 text-slate-700';
          let actionText = '';
          
          // Check for shift change first
          if (fromShift && toShift && fromShift !== toShift) {
            requestType = 'Shift Change';
            displayDetails = `${fromShift} → ${toShift}`;
            badgeColor = 'bg-purple-100 text-purple-700';
            actionText = `Shift: ${fromShift} → ${toShift}`;
          } else if (item.is_leave === 1 || toDayType === 'leave') {
            requestType = 'Leave';
            displayDetails = item.leave_type !== 'Unknown' ? item.leave_type : 'Leave';
            badgeColor = 'bg-orange-100 text-orange-700';
            actionText = item.leave_type !== 'Unknown' ? item.leave_type : 'Leave';
          } else if (toDayType === 'wfh') {
            requestType = 'WFH';
            displayDetails = 'Work From Home';
            badgeColor = 'bg-blue-100 text-blue-700';
            actionText = 'Work From Home';
          } else if (toDayType === 'half_day') {
            requestType = 'Half Day';
            displayDetails = 'Half Day';
            badgeColor = 'bg-yellow-100 text-yellow-700';
            actionText = 'Half Day';
          } else if (toDayType === 'weekoff') {
            requestType = 'Week Off';
            displayDetails = 'Week Off';
            badgeColor = 'bg-pink-100 text-pink-700';
            actionText = 'Week Off';
          } else if (toDayType === 'working') {
            requestType = 'Working Day';
            displayDetails = 'Working Day';
            badgeColor = 'bg-green-100 text-green-700';
            actionText = 'Working Day';
          }
          
          return {
            id: item.draft_id,
            employee_name: item.user_name,
            employee_id: item.user_id,
            team_name: item.team?.team_name || 'No Team',
            team_id: item.team?.team_id,
            date: item.date,
            action: actionText || item.action || 'Status Change',
            leave_type: item.leave_type !== 'Unknown' ? item.leave_type : null,
            request_type: requestType,
            display_details: displayDetails,
            badge_color: badgeColor,
            shift: item.shift || toShift || null,
            from_shift: fromShift,
            to_shift: toShift,
            is_leave: item.is_leave === 1 || toDayType === 'leave',
            is_planned_leave: item.is_planned === "yes",
            day_type_from: fromDayType,
            day_type_to: toDayType,
            requested_by: item.requested_by,
            requested_date: item.requested_at,
            status: 'approved',
            changes: item.changes
          };
        });

        setApprovedRosters(convertedApproved);
      } else {
        toast.error('Failed to load approved rosters');
      }
    } catch (error) {
      console.error('Error fetching approved rosters:', error);
      toast.error('Failed to load approved rosters');
    } finally {
      setLoading(false);
    }
  };

  const fetchRejectedRosters = async () => {
    try {
      setLoading(true);
      const userId = user?.user_id || user?.id || 93;
      const monthYear = format(selectedMonth, 'MMMyyyy').toUpperCase();
      console.log('Calling roster/get_leave_history API for rejected...', { logged_in_user_id: userId, status: 'rejected', month_year: monthYear });

      const response = await api.post('/roster/get_leave_history', {
        logged_in_user_id: userId,
        status: 'rejected',
        month_year: monthYear
      });

      console.log('Rejected API Response:', response.data);

      if (response.data && response.data.success) {
        // Convert API response to internal format
        const convertedRejected = response.data.data.map(item => {
          const toDayType = item.changes?.to?.day_type;
          const fromDayType = item.changes?.from?.day_type;
          const toShift = item.changes?.to?.shift;
          const fromShift = item.changes?.from?.shift;
          
          // Determine request type based on day_type and other fields
          let requestType = 'Status Change';
          let displayDetails = '';
          let badgeColor = 'bg-slate-100 text-slate-700';
          let actionText = '';
          
          // Check for shift change first
          if (fromShift && toShift && fromShift !== toShift) {
            requestType = 'Shift Change';
            displayDetails = `${fromShift} → ${toShift}`;
            badgeColor = 'bg-purple-100 text-purple-700';
            actionText = `Shift: ${fromShift} → ${toShift}`;
          } else if (item.is_leave === 1 || toDayType === 'leave') {
            requestType = 'Leave';
            displayDetails = item.leave_type !== 'Unknown' ? item.leave_type : 'Leave';
            badgeColor = 'bg-orange-100 text-orange-700';
            actionText = item.leave_type !== 'Unknown' ? item.leave_type : 'Leave';
          } else if (toDayType === 'wfh') {
            requestType = 'WFH';
            displayDetails = 'Work From Home';
            badgeColor = 'bg-blue-100 text-blue-700';
            actionText = 'Work From Home';
          } else if (toDayType === 'half_day') {
            requestType = 'Half Day';
            displayDetails = 'Half Day';
            badgeColor = 'bg-yellow-100 text-yellow-700';
            actionText = 'Half Day';
          } else if (toDayType === 'weekoff') {
            requestType = 'Week Off';
            displayDetails = 'Week Off';
            badgeColor = 'bg-pink-100 text-pink-700';
            actionText = 'Week Off';
          } else if (toDayType === 'working') {
            requestType = 'Working Day';
            displayDetails = 'Working Day';
            badgeColor = 'bg-green-100 text-green-700';
            actionText = 'Working Day';
          }
          
          return {
            id: item.draft_id,
            employee_name: item.user_name,
            employee_id: item.user_id,
            team_name: item.team?.team_name || 'No Team',
            team_id: item.team?.team_id,
            date: item.date,
            action: actionText || item.action || 'Status Change',
            leave_type: item.leave_type !== 'Unknown' ? item.leave_type : null,
            request_type: requestType,
            display_details: displayDetails,
            badge_color: badgeColor,
            shift: item.shift || toShift || null,
            from_shift: fromShift,
            to_shift: toShift,
            is_leave: item.is_leave === 1 || toDayType === 'leave',
            is_planned_leave: item.is_planned === "yes",
            day_type_from: fromDayType,
            day_type_to: toDayType,
            requested_by: item.requested_by,
            requested_date: item.requested_at,
            status: 'rejected',
            changes: item.changes
          };
        });

        setRejectedRosters(convertedRejected);
      } else {
        toast.error('Failed to load rejected rosters');
      }
    } catch (error) {
      console.error('Error fetching rejected rosters:', error);
      toast.error('Failed to load rejected rosters');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = getFilteredData();
  const stats = {
    pending: pendingApprovals.length,
    approved: approvedRosters.length,
    rejected: rejectedRosters.length,
    total: pendingApprovals.length + approvedRosters.length + rejectedRosters.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 mb-6 border border-blue-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Super Admin - Roster Approvals</h1>
                <p className="text-slate-500">Review and approve roster submissions from assistant managers</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <div className="text-xs text-slate-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-xs text-slate-500">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                <div className="text-xs text-slate-500">Rejected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Month Navigation */}
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
                  onClick={() => {
                    setFilterStatus(status);
                    if (status === 'pending') {
                      fetchPendingDrafts();
                    } else if (status === 'approved') {
                      fetchApprovedRosters();
                    } else if (status === 'rejected') {
                      fetchRejectedRosters();
                    }
                  }}
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

          {/* Bulk Selection Controls */}
          {filterStatus === 'pending' && (
            <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBulkSelectionMode(!bulkSelectionMode)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    bulkSelectionMode 
                      ? 'bg-blue-500 text-white shadow-lg' 
                      : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {bulkSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {bulkSelectionMode ? 'Bulk Selection ON' : 'Bulk Selection'}
                </button>
                
                {bulkSelectionMode && (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-sm"
                    >
                      {selectedItems.length === filteredData.filter(item => item.status === 'pending').length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm text-blue-700 font-medium">
                      {selectedItems.length} of {filteredData.filter(item => item.status === 'pending').length} selected
                    </span>
                  </>
                )}
              </div>

              {selectedItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkApprove}
                    disabled={loading}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve Selected ({selectedItems.length})
                  </button>
                  <button
                    onClick={handleBulkReject}
                    disabled={loading}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Selected ({selectedItems.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Roster List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {filteredData.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-lg">No {filterStatus} found</p>
              <p className="text-slate-400 text-sm">
                {filterStatus === 'pending' && 'All roster submissions have been reviewed'}
                {filterStatus === 'approved' && 'No rosters have been approved yet'}
                {filterStatus === 'rejected' && 'No rosters have been rejected yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredData.map((item) => (
                <div key={item.id} className={`p-6 hover:bg-slate-50 transition-colors ${
                  selectedItems.includes(item.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    {/* Checkbox for bulk selection */}
                    {bulkSelectionMode && item.status === 'pending' && (
                      <div className="mr-4">
                        <button
                          onClick={() => handleToggleSelection(item.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            selectedItems.includes(item.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-white border-slate-300 hover:border-blue-400'
                          }`}
                        >
                          {selectedItems.includes(item.id) && (
                            <CheckSquare className="w-3 h-3 text-white" />
                          )}
                        </button>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h4 className="font-semibold text-slate-800 text-lg">{item.employee_name}</h4>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                          {item.team_name}
                        </span>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                          item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          item.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                        {/* Dynamic Request Type Badge */}
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${item.badge_color || 'bg-purple-100 text-purple-700'}`}>
                          {item.request_type}
                        </span>
                        {/* Show details badge for shift */}
                        {item.shift && (
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                            Shift: {item.shift}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Date: {format(new Date(item.date), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Requested by: {item.requested_by}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Requested At: {format(new Date(item.requested_date), 'dd/MM/yyyy')}</span>
                        </div>
                        {/* Show From → To Status Change */}
                        {(item.day_type_from || item.day_type_to) && (
                          <div className="flex items-center gap-2">
                            <span><strong>Status:</strong> {item.day_type_from || '-'} → {item.day_type_to || '-'}</span>
                          </div>
                        )}
                        {/* Show From → To Shift Change */}
                        {(item.from_shift || item.to_shift) && (
                          <div className="flex items-center gap-2">
                            <span><strong>Shift:</strong> {item.from_shift || '-'} → {item.to_shift || '-'}</span>
                          </div>
                        )}
                        {/* Show Action */}
                        {item.action && item.action !== 'Unknown' && (
                          <div className="flex items-center gap-2">
                            <span><strong>Action:</strong> {item.action}</span>
                          </div>
                        )}
                        {/* Show Planned only for leave requests */}
                        {item.is_leave && (
                          <div className="flex items-center gap-2">
                            <span><strong>Planned:</strong> {item.is_planned_leave ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {/* Show Leave Type only for leave requests */}
                        {item.is_leave && (
                          <div className="flex items-center gap-2">
                            <span><strong>Leave Type:</strong> {item.leave_type || '-'}</span>
                          </div>
                        )}
                      </div>

                      {item.status === 'rejected' && item.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <strong>Rejection Reason:</strong> {item.rejection_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 ml-6">
                      {item.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedApproval && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-800">Roster Details - {selectedApproval.employee_name}</h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Employee:</strong> {selectedApproval.employee_name}</div>
                  <div><strong>Team:</strong> {selectedApproval.team_name}</div>
                  <div><strong>Date:</strong> {format(new Date(selectedApproval.date), 'dd/MM/yyyy')}</div>
                  <div><strong>Requested by:</strong> {selectedApproval.requested_by}</div>
                  <div><strong>Requested date:</strong> {format(new Date(selectedApproval.requested_date), 'dd/MM/yyyy')}</div>
                  <div><strong>Request Type:</strong> {selectedApproval.request_type || 'Status Change'}</div>
                  {/* Show From → To Status Change */}
                  {(selectedApproval.day_type_from || selectedApproval.day_type_to) && (
                    <><div><strong>Status Change:</strong> {selectedApproval.day_type_from || '-'} → {selectedApproval.day_type_to || '-'}</div></>
                  )}
                  {/* Show From → To Shift Change */}
                  {(selectedApproval.from_shift || selectedApproval.to_shift) && (
                    <><div><strong>Shift Change:</strong> {selectedApproval.from_shift || '-'} → {selectedApproval.to_shift || '-'}</div></>
                  )}
                  {/* Show Action if available and not Unknown */}
                  {selectedApproval.action && selectedApproval.action !== 'Unknown' && (
                    <><div><strong>Action:</strong> {selectedApproval.action}</div></>
                  )}
                  {/* Show Planned only for leave requests */}
                  {selectedApproval.is_leave && (
                    <><div><strong>Planned:</strong> {selectedApproval.is_planned_leave ? 'Yes' : 'No'}</div></>
                  )}
                  {/* Show Leave Type only for leave requests */}
                  {selectedApproval.is_leave && (
                    <><div><strong>Leave Type:</strong> {selectedApproval.leave_type || '-'}</div></>
                  )}
                </div>

                
                {selectedApproval.status === 'pending' && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Please provide rejection reason:');
                        if (reason) {
                          handleReject(selectedApproval.id, reason);
                        }
                      }}
                      disabled={loading}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedApproval.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminApproval;
