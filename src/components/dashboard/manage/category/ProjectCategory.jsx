import React, { useState, useEffect } from 'react';
import { FolderKanban, Plus, Edit2, Trash2, Search, Save, X, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SearchableSelect from '../../../common/SearchableSelect';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import LoadingSpinner from '../../../common/LoadingSpinner';

const ProjectCategory = () => {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    afdId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [afdOptions, setAfdOptions] = useState([]);

  // Fetch AFD options from API
  const fetchAFDOptions = async () => {
    try {
      const response = await api.post('/dropdown/get', {
        logged_in_user_id: userId,
        dropdown_type: 'afd'
      });

      console.log('AFD API Response:', response.data);

      if (response.data.status === 200) {
        const options = response.data.data.map(afd => ({
          value: afd.afd_id,
          label: afd.label
        }));
        console.log('AFD Options:', options);
        setAfdOptions(options);
      }
    } catch (error) {
      console.error('Error fetching AFD options:', error);
      toast.error('Failed to load AFD options');
    }
  };

  // Fetch project categories from API
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.post('/project_category/list', {});

      console.log('Categories API Response:', response.data);

      if (response.data.status === 200) {
        console.log('Categories Data:', response.data.data);
        setCategories(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (userId) {
      fetchAFDOptions();
      fetchCategories();
    }
  }, [userId]);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }
    if (!formData.afdId) {
      errors.afdId = 'AFD Name is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCategory = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/project_category/create', {
        project_category_name: formData.name.trim(),
        afd_id: formData.afdId
      });

      if (response.data.status === 201) {
        toast.success('Category added successfully!');
        setFormData({ name: '', afdId: '' });
        setFormErrors({});
        fetchCategories(); // Refresh the list
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error(error.response?.data?.message || 'Failed to add category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (category) => {
    setEditingId(category.project_category_id);
    setFormData({
      name: category.project_category_name,
      afdId: category.afd?.[0]?.afd_id || ''
    });
    setFormErrors({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', afdId: '' });
    setFormErrors({});
  };

  const handleSaveEdit = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post('/project_category/update', {
        project_category_id: editingId,
        project_category_name: formData.name.trim(),
        afd_id: formData.afdId
      });

      if (response.data.status === 200) {
        toast.success('Category updated successfully!');
        setEditingId(null);
        setFormData({ name: '', afdId: '' });
        setFormErrors({});
        fetchCategories(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error.response?.data?.message || 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      setSubmitting(true);
      const response = await api.post('/project_category/delete', {
        project_category_id: categoryToDelete.project_category_id
      });

      if (response.data.status === 200) {
        toast.success('Category deleted successfully!');
        setShowDeleteModal(false);
        setCategoryToDelete(null);
        fetchCategories(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error.response?.data?.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.project_category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get AFD name from category object
  const getAfdLabel = (category) => {
    // The AFD name is directly in the category response
    const afdName = category.afd?.[0]?.afd_name;
    console.log('Getting AFD name for category:', category.project_category_name);
    console.log('AFD data:', category.afd);
    console.log('AFD name:', afdName);
    return afdName || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <FolderKanban className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Project Categories</h2>
              <p className="text-blue-100 text-sm mt-1">Create and manage your project categories</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
            <FolderKanban className="w-5 h-5" />
            <span className="font-semibold">{categories.length} Categories</span>
          </div>
        </div>
      </div>

      {/* Add Category Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Add New Category</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Category Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setFormErrors({ ...formErrors, name: '' });
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                formErrors.name ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="e.g., Web Development"
            />
            {formErrors.name && (
              <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              AFD Name <span className="text-red-600">*</span>
            </label>
            <SearchableSelect
              value={formData.afdId}
              onChange={(value) => {
                setFormData({ ...formData, afdId: value });
                setFormErrors({ ...formErrors, afdId: '' });
              }}
              options={afdOptions}
              icon={FileText}
              placeholder="Select AFD"
              error={!!formErrors.afdId}
              errorMessage={formErrors.afdId}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAddCategory}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add Category
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories by name or AFD name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Sr. No.
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Category Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                  AFD Name
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCategories.map((category, index) => (
                <tr key={category.project_category_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === category.project_category_id ? (
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          setFormErrors({ ...formErrors, name: '' });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.name ? 'border-red-500' : 'border-slate-300'
                        }`}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-slate-800">{category.project_category_name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === category.project_category_id ? (
                      <SearchableSelect
                        value={formData.afdId}
                        onChange={(value) => {
                          setFormData({ ...formData, afdId: value });
                          setFormErrors({ ...formErrors, afdId: '' });
                        }}
                        options={afdOptions}
                        icon={FileText}
                        placeholder="Select AFD"
                        error={!!formErrors.afdId}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-slate-700 font-medium">{getAfdLabel(category)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === category.project_category_id ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            disabled={submitting}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={submitting}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditClick(category)}
                            disabled={submitting}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            disabled={submitting}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCategories.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <FolderKanban className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-600 mb-2">No categories found</h3>
            <p className="text-slate-500 text-sm">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first category using the form above'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Delete Category
              </h2>
              <button onClick={() => {
                setShowDeleteModal(false);
                setCategoryToDelete(null);
              }}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete
              <span className="font-semibold text-slate-800"> {categoryToDelete.project_category_name}</span>?
            </p>
            <p className="text-xs text-red-500 mt-2">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCategoryToDelete(null);
                }}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCategory;
