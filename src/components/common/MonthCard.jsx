import React, { useState, useMemo } from "react";
import { Download, ChevronUp, Search, X, Users, RotateCcw } from "lucide-react";
import { useUser } from "../../context/UserContext";
import SearchableSelect from "./SearchableSelect";

export default function MonthCard({ month, users, onExport, onExportMonth, teamOptions = [], hideTeamColumn = false }) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const { isAgent } = useUser();

  // Helper function to get QC score color classes
  const getQCScoreColorClass = (score) => {
    if (score === null || score === undefined || score === '-' || isNaN(Number(score))) return 'text-slate-800';
    const numScore = Number(score);
    if (numScore >= 98) return 'text-green-800 bg-green-100 font-bold';
    if (numScore >= 95) return 'text-yellow-700 bg-yellow-100 font-bold';
    return 'text-red-700 bg-red-200 font-bold';
  };

  // Client-side search filter by user name and team
  const filteredUsers = users.filter((u) => {
    // Filter by search query
    if (searchQuery) {
      const userName = (u.user_name || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!userName.includes(query)) return false;
    }
    // Filter by selected team (match by team_name)
    if (selectedTeam) {
      const userTeamName = String(u.team_name || '').toLowerCase().trim();
      const selectedTeamName = String(selectedTeam).toLowerCase().trim();
      
      if (userTeamName !== selectedTeamName) return false;
    }
    return true;
  });

  // Debug logging
  React.useEffect(() => {
    if (selectedTeam) {
      console.log('=== MonthCard Filter Debug ===');
      console.log('Selected Team Name:', selectedTeam);
      console.log('Search Query:', searchQuery);
      console.log('Total Users:', users.length);
      console.log('Filtered Users:', filteredUsers.length);
      if (users.length > 0) {
        console.log('User Team Names:', users.map(u => ({
          name: u.user_name,
          team_name: u.team_name
        })));
      }
      console.log('==============================');
    }
  }, [selectedTeam, searchQuery, filteredUsers.length, users]);

  return (
    <div className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-l-4 border-blue-500 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mb-6">
      <div
        className="flex items-center gap-4 px-6 py-4 cursor-pointer select-none rounded-t-xl bg-white/90 backdrop-blur"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Month Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 shadow-md">
            <div className="text-lg font-bold leading-none">{month.label}</div>
            <div className="text-xs opacity-90 mt-0.5">{month.year}</div>
          </div>
          <div className="text-sm text-slate-600 font-medium">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
            {(searchQuery || selectedTeam) && (
              <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                Filtered
              </span>
            )}
          </div>
        </div>
        
        <div className="flex-1" />
        
        {/* Export Month Button */}
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          onClick={e => { e.stopPropagation(); if (onExportMonth) onExportMonth(month, filteredUsers); }}
          title="Export month summary"
        >
          <Download className="w-4 h-4" />
          Export Month
        </button>
        
        {/* Expand/Collapse Button */}
        <button
          className="p-2 rounded-lg hover:bg-blue-100 transition-colors duration-200"
          title={expanded ? "Collapse" : "Expand"}
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          <ChevronUp className={`w-5 h-5 text-blue-700 transition-transform duration-300 ${expanded ? '' : 'rotate-180'}`} />
        </button>
      </div>
      {expanded && (
        <div className="bg-white/80 backdrop-blur rounded-b-xl border-t border-blue-100">
          {/* Search and Team Filters */}
          <div className="px-6 py-4 border-b border-blue-100">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search Filter */}
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by user name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Team Filter - Only show if teamOptions are available */}
              {teamOptions && teamOptions.length > 0 && (
                <div className="w-64">
                  <SearchableSelect
                    value={selectedTeam}
                    onChange={setSelectedTeam}
                    options={[
                      { value: '', label: 'All Teams' },
                      ...teamOptions.map(team => ({
                        value: team.label,
                        label: team.label
                      }))
                    ]}
                    icon={Users}
                    placeholder="Select Team"
                    isClearable={true}
                  />
                </div>
              )}

              {/* Reset Filters Button */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTeam('');
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                title="Reset all filters"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto p-6">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No users found matching the selected filters
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-blue-200">
                    <th className="px-4 py-3 text-left font-bold text-blue-700">User Name</th>
                    {!hideTeamColumn && <th className="px-4 py-3 text-left font-bold text-blue-700">Team</th>}
                    <th className="px-4 py-3 text-center font-bold text-blue-700">Billable Hours</th>
                    <th className="px-4 py-3 text-center font-bold text-blue-700">Monthly Goal</th>
                    <th className="px-4 py-3 text-center font-bold text-blue-700">Pending</th>
                    <th className="px-4 py-3 text-center font-bold text-blue-700">Avg. QC</th>
                    {/* <th className="px-4 py-3 text-center font-bold text-blue-700">Action</th> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {filteredUsers.map((user, idx) => {
                    const formatNumber = (val) => {
                      if (val === null || val === undefined || val === '') return '-';
                      const num = Number(val);
                      return isNaN(num) ? '-' : num.toFixed(2);
                    };
                    
                    return (
                      <tr key={user.user_id || idx} className="hover:bg-blue-50/50 transition-colors duration-150">
                        <td className="px-4 py-3 text-slate-800 font-medium">{user.user_name || '-'}</td>
                        {!hideTeamColumn && <td className="px-4 py-3 text-slate-600">{user.team_name || '-'}</td>}
                        <td className="px-4 py-3 text-center text-slate-800 font-semibold">{formatNumber(user.total_billable_hours)}</td>
                        <td className="px-4 py-3 text-center text-slate-800">{user.monthly_total_target ?? '-'}</td>
                        <td className="px-4 py-3 text-center text-slate-800">{formatNumber(user.pending_target)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-lg inline-block ${getQCScoreColorClass(user.avg_qc_score)}`}>
                            {user.avg_qc_score != null && user.avg_qc_score !== '' ? `${formatNumber(user.avg_qc_score)}%` : '-'}
                          </span>
                        </td>
                        {/* <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onExport(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                            title="Export user's daily data"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export
                          </button>
                        </td> */}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-blue-300 bg-blue-50/70">
                    <td className="px-4 py-3 text-slate-900 font-bold">TOTAL</td>
                    {!hideTeamColumn && <td className="px-4 py-3"></td>}
                    <td className="px-4 py-3 text-center text-slate-900 font-bold">
                      {(() => {
                        const total = filteredUsers.reduce((sum, user) => {
                          const val = Number(user.total_billable_hours);
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0);
                        return total.toFixed(2);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-900 font-bold">
                      {(() => {
                        const total = filteredUsers.reduce((sum, user) => {
                          const val = Number(user.monthly_total_target);
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0);
                        return total.toFixed(2);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-900 font-bold">
                      {(() => {
                        const total = filteredUsers.reduce((sum, user) => {
                          const val = Number(user.pending_target);
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0);
                        return total.toFixed(2);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const scores = filteredUsers
                          .map(user => Number(user.avg_qc_score))
                          .filter(val => !isNaN(val) && val !== null);
                        if (scores.length === 0) return <span className="text-slate-900 font-bold">-</span>;
                        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                        return <span className={`px-3 py-1.5 rounded-lg ${getQCScoreColorClass(avg)}`}>{`${avg.toFixed(2)}%`}</span>;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
