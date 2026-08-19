import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Search, X, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../../services/api';
import LoadingSpinner from '../../../common/LoadingSpinner';

const AFDManagement = () => {
  const [afdRecords, setAfdRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [showCategoryDeleteModal, setShowCategoryDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  
  // Form state
  const [afdName, setAfdName] = useState('');
  const [categories, setCategories] = useState([
    {
      id: Date.now(),
      name: '',
      score: '',
      subCategories: [{ id: Date.now(), name: '', score: '' }]
    }
  ]);

  // Fetch AFD records from API
  const fetchAFDRecords = async () => {
    try {
      setLoading(true);
      const response = await api.post('/qc_afd/list', {});
      
      if (response.data.status === 200) {
        // Transform API data to component structure
        const transformedData = (response.data.data || []).map(afd => ({
          id: afd.afd_id,
          name: afd.afd_name,
          categories: (afd.categories || []).map(cat => ({
            id: cat.qc_afd_id,
            name: cat.afd_name,
            score: cat.afd_points,
            subCategories: (cat.subcategories || []).map(sub => ({
              id: sub.qc_afd_id,
              name: sub.afd_name,
              score: sub.afd_points
            }))
          }))
        }));
        setAfdRecords(transformedData);
      }
    } catch (error) {
      console.error('Error fetching AFD records:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch AFD records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAFDRecords();
  }, []);

  // Add new category
  const addCategory = () => {
    setCategories([
      ...categories,
      {
        id: Date.now(),
        name: '',
        score: '',
        subCategories: [{ id: Date.now() + 1, name: '', score: '' }]
      }
    ]);
  };

  // Remove category (in edit mode - removes from form state)
  const removeCategory = (categoryId) => {
    setCategories(categories.filter(cat => cat.id !== categoryId));
  };

  // Delete category/subcategory from database
  const handleDeleteCategoryOrSub = (item, parentRecord) => {
    setCategoryToDelete({ item, parentRecord });
    setShowCategoryDeleteModal(true);
  };

  const confirmCategoryDelete = async () => {
    if (!categoryToDelete) return;

    const { item } = categoryToDelete;
    
    try {
      setSubmitting(true);
      const response = await api.delete('/qc_afd/delete', {
        data: {
          qc_afd_ids: [item.id]
        }
      });

      if (response.data.status === 200) {
        toast.success(`${item.isSubcategory ? 'Subcategory' : 'Category'} deleted successfully!`);
        await fetchAFDRecords();
        setShowCategoryDeleteModal(false);
        setCategoryToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting category/subcategory:', error);
      toast.error(error.response?.data?.message || 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  // Update category
  const updateCategory = (categoryId, field, value) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId ? { ...cat, [field]: field === 'score' ? Number(value) || 0 : value } : cat
    ));
  };

  // Add subcategory
  const addSubCategory = (categoryId) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subCategories: [...cat.subCategories, { id: Date.now(), name: '', score: '' }] }
        : cat
    ));
  };

  // Remove subcategory
  const removeSubCategory = (categoryId, subCategoryId) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, subCategories: cat.subCategories.filter(sub => sub.id !== subCategoryId) }
        : cat
    ));
  };

  // Update subcategory
  const updateSubCategory = (categoryId, subCategoryId, field, value) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId
        ? {
            ...cat,
            subCategories: cat.subCategories.map(sub =>
              sub.id === subCategoryId
                ? { ...sub, [field]: field === 'score' ? Number(value) || 0 : value }
                : sub
            )
          }
        : cat
    ));
  };

  // Calculate totals
  const getTotalCategoryScore = () => {
    return categories.reduce((sum, cat) => sum + (Number(cat.score) || 0), 0);
  };

  const getSubCategoryTotal = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.subCategories.reduce((sum, sub) => sum + (Number(sub.score) || 0), 0) : 0;
  };

  // Validate and save AFD
  const handleSaveAFD = async () => {
    // Validation
    if (!afdName.trim()) {
      toast.error('AFD Name is required');
      return;
    }

    if (categories.length === 0) {
      toast.error('At least one category is required');
      return;
    }

    // Check if all categories have names
    const emptyCategoryNames = categories.some(cat => !cat.name.trim());
    if (emptyCategoryNames) {
      toast.error('All categories must have a name');
      return;
    }

    // Check each category's subcategories
    for (const category of categories) {
      const emptySubNames = category.subCategories.some(sub => !sub.name.trim());
      if (emptySubNames) {
        toast.error(`All subcategories in "${category.name}" must have a name`);
        return;
      }
    }

    try {
      setSubmitting(true);

      // Transform data for API
      const apiData = {
        master_afd_name: afdName,
        categories: categories.map(cat => {
          const categoryData = {
            afd_name: cat.name,
            afd_points: cat.score,
            subcategories: cat.subCategories.map(sub => {
              const subData = {
                afd_name: sub.name,
                afd_points: sub.score
              };
              // Include qc_afd_id for existing subcategories during update
              if (editingRecordId && sub.id && sub.id < Date.now() - 1000000000000) {
                subData.qc_afd_id = sub.id;
              }
              return subData;
            })
          };
          // Include qc_afd_id for existing categories during update
          if (editingRecordId && cat.id && cat.id < Date.now() - 1000000000000) {
            categoryData.qc_afd_id = cat.id;
          }
          return categoryData;
        })
      };

      // Save or update
      if (editingRecordId) {
        apiData.master_afd_id = editingRecordId;
        const response = await api.put('/qc_afd/update', apiData);
        
        if (response.data.status === 200) {
          toast.success('AFD updated successfully!');
          await fetchAFDRecords();
          resetForm();
        }
      } else {
        const response = await api.post('/qc_afd/add', apiData);
        
        if (response.data.status === 201) {
          toast.success('AFD added successfully!');
          await fetchAFDRecords();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Error saving AFD:', error);
      toast.error(error.response?.data?.message || 'Failed to save AFD');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setAfdName('');
    setCategories([
      {
        id: Date.now(),
        name: '',
        score: '',
        subCategories: [{ id: Date.now() + 1, name: '', score: '' }]
      }
    ]);
    setEditingRecordId(null);
  };

  // Edit AFD
  const handleEditAFD = (record) => {
    setAfdName(record.name);
    setCategories(JSON.parse(JSON.stringify(record.categories)));
    setEditingRecordId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete AFD
  const handleDeleteAFD = (record) => {
    setRecordToDelete(record);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      setSubmitting(true);
      
      // Collect all qc_afd_ids from categories and subcategories
      const qc_afd_ids = [];
      recordToDelete.categories.forEach(category => {
        qc_afd_ids.push(category.id);
        category.subCategories.forEach(sub => {
          qc_afd_ids.push(sub.id);
        });
      });

      const response = await api.delete('/qc_afd/delete', {
        data: {
          afd_ids: [recordToDelete.id],
          qc_afd_ids: qc_afd_ids
        }
      });

      if (response.data.status === 200) {
        toast.success('AFD deleted successfully!');
        await fetchAFDRecords();
        setShowDeleteModal(false);
        setRecordToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting AFD:', error);
      toast.error(error.response?.data?.message || 'Failed to delete AFD');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = afdRecords.filter(rec =>
    rec.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AFD Management</h2>
              <p className="text-blue-100 text-sm mt-1">Application for Development - Categories & Scoring</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">{afdRecords.length} AFD Records</span>
          </div>
        </div>
      </div>

      {/* AFD Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            {editingRecordId ? 'Edit AFD' : 'Create New AFD'}
          </h3>
          {editingRecordId && (
            <button
              onClick={resetForm}
              className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancel Edit
            </button>
          )}
        </div>

        {/* AFD Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            AFD Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={afdName}
            onChange={(e) => setAfdName(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., Quality Control Checklist"
          />
        </div>

        {/* Categories Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              Categories
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                Total: {getTotalCategoryScore()}
              </span>
            </h4>
            <button
              onClick={addCategory}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {categories.map((category) => {
            const subTotal = getSubCategoryTotal(category.id);
            return (
              <div key={category.id} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                {/* Category Header */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Category Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={category.name}
                        onChange={(e) => updateCategory(category.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="Category name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Category Score <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={category.score}
                        onChange={(e) => updateCategory(category.id, 'score', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="Score"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeCategory(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5"
                    title="Remove Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Subcategories */}
                <div className="ml-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                      Subcategories
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Total: {subTotal}
                      </span>
                    </label>
                    <button
                      onClick={() => addSubCategory(category.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Sub
                    </button>
                  </div>

                  {category.subCategories.map((subCategory) => (
                    <div key={subCategory.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={subCategory.name}
                          onChange={(e) => updateSubCategory(category.id, subCategory.id, 'name', e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Subcategory name"
                        />
                        <input
                          type="text"
                          value={subCategory.score}
                          onChange={(e) => updateSubCategory(category.id, subCategory.id, 'score', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Score"
                        />
                      </div>
                      <button
                        onClick={() => removeSubCategory(category.id, subCategory.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove Subcategory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          {editingRecordId && (
            <button
              onClick={resetForm}
              disabled={submitting}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSaveAFD}
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Saving...' : editingRecordId ? 'Update AFD' : 'Save AFD'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search AFD records by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* AFD Records List */}
      <div className="space-y-4">
        {filteredRecords.map(record => (
          <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  {record.name}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {record.categories.length} Categories
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditAFD(record)}
                  disabled={submitting}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAFD(record)}
                  disabled={submitting}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Categories Display */}
            <div className="space-y-3">
              {record.categories.map(category => (
                <div key={category.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{category.name}</span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                        {category.score} points
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategoryOrSub({ ...category, isSubcategory: false }, record)}
                      disabled={submitting}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="ml-4 space-y-1">
                    {category.subCategories.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between text-sm group">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">• {sub.name}</span>
                          <span className="text-slate-500 font-medium">{sub.score} pts</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCategoryOrSub({ ...sub, isSubcategory: true, categoryName: category.name }, record)}
                          disabled={submitting}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Delete Subcategory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredRecords.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-600 mb-2">No AFD records found</h3>
            <p className="text-slate-500">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first AFD using the form above'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && recordToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Delete AFD Record
              </h2>
              <button onClick={() => {
                setShowDeleteModal(false);
                setRecordToDelete(null);
              }}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete
              <span className="font-semibold text-slate-800"> {recordToDelete.name}</span>?
            </p>
            <p className="text-xs text-red-500 mt-2">
              This action cannot be undone. All categories and subcategories will be deleted.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setRecordToDelete(null);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category/Subcategory Confirmation Modal */}
      {showCategoryDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Delete {categoryToDelete.item.isSubcategory ? 'Subcategory' : 'Category'}
              </h2>
              <button onClick={() => {
                setShowCategoryDeleteModal(false);
                setCategoryToDelete(null);
              }}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the {categoryToDelete.item.isSubcategory ? 'subcategory' : 'category'}
              <span className="font-semibold text-slate-800"> {categoryToDelete.item.name}</span>
              {categoryToDelete.item.isSubcategory && (
                <span> from <span className="font-semibold text-slate-800">{categoryToDelete.item.categoryName}</span></span>
              )}?
            </p>
            {!categoryToDelete.item.isSubcategory && (
              <p className="text-xs text-red-500 mt-2">
                This will also delete all subcategories under this category.
              </p>
            )}
            <p className="text-xs text-red-500 mt-2">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryDeleteModal(false);
                  setCategoryToDelete(null);
                }}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmCategoryDelete}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AFDManagement;
