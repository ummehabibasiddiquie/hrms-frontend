import React, { useEffect, useState } from "react";
import { History, Eye } from "lucide-react";
import { toast } from "react-hot-toast";
import { getRosterVersionDetail, listRosterVersions } from "../../services/rosterService";
import { getFriendlyErrorMessage } from "../../utils/errorMessages";
import LoadingSpinner from "../common/LoadingSpinner";

const RosterVersionHistory = ({ rosterMonthId, isOpen, onClose }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isOpen || !rosterMonthId) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await listRosterVersions({ roster_month_id: rosterMonthId });
        setVersions(res.data || []);
      } catch (err) {
        toast.error(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
    setDetail(null);
  }, [isOpen, rosterMonthId]);

  const viewDetail = async (versionId) => {
    try {
      setLoadingDetail(true);
      const res = await getRosterVersionDetail({ version_id: versionId });
      setDetail(res.data);
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Version History
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <LoadingSpinner />
          ) : versions.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No versions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.version_id}
                  className="flex items-center justify-between gap-4 p-4 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Version {v.roster_version}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Approved: {v.approved_date || "—"}
                    </p>
                    {v.reviewer_comment && (
                      <p className="text-sm text-slate-600 mt-1">{v.reviewer_comment}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => viewDetail(v.version_id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          {loadingDetail && <div className="mt-4"><LoadingSpinner size="sm" /></div>}
          {detail && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-800 mb-2">Snapshot — Version {detail.roster_version}</h3>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-auto max-h-64">
                {JSON.stringify(detail.snapshot_json, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RosterVersionHistory;
