import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';

const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];
const WATERMARKS = ['', 'DRAFT', 'CONFIDENTIAL', 'FINAL', 'OFFICIAL'];

const AVAILABLE_FIELDS = [
  { group: 'Employee', fields: ['employee.full_name', 'employee.id', 'employee.position', 'employee.salary', 'employee.join_date', 'employee.department'] },
  { group: 'Finance', fields: ['finance.basic', 'finance.allowances', 'finance.deductions', 'finance.net'] },
  { group: 'Student', fields: ['student.full_name', 'student.id', 'student.program', 'student.cgpa'] },
  { group: 'System', fields: ['generation_date', 'effective_date', 'doc_id', 'org_name'] },
];

export default function TemplateFormPage() {
  const { id } = useParams(); // if exists → edit mode
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: 'HR',
    data_source: 'employees',
    version: 1,
    description: '',
    watermark_text: 'DRAFT',
    is_active: true,
    header_html: '',
    body_html: '',
    footer_html: '',
  });

  // Load template if editing
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      axiosInstance
        .get(`/templates/${id}`)
        .then((res) => {
          const t = res.data;
          setForm({
            name: t.name || '',
            category: t.category || 'HR',
            data_source: t.data_source || 'employees',
            version: t.version || 1,
            description: t.description || '',
            watermark_text: t.watermark_text || '',
            is_active: t.is_active ?? true,
            header_html: t.header_html || '',
            body_html: t.body_html || '',
            footer_html: t.footer_html || '',
          });
        })
        .catch(() => toast.error('Failed to load template'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const insertPlaceholder = (field) => {
    const placeholder = `{{${field}}}`;
    // Insert into body by default
    setForm((prev) => ({
      ...prev,
      body_html: prev.body_html + placeholder,
    }));
    toast.success(`Inserted ${placeholder}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (!form.version || form.version < 1) {
      toast.error('Version must be 1 or higher');
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        // On edit → version will be increased by backend
        await axiosInstance.put(`/templates/${id}`, form);
        toast.success('Template updated successfully (new version created)');
      } else {
        await axiosInstance.post('/templates', form);
        toast.success('Template created successfully');
      }
      navigate('/templates');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading template...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Template' : 'Create New Template'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEdit
              ? `Editing version ${form.version} → will become version ${form.version + 1}`
              : 'Fill in the details to create a new document template'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left - Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-900">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Salary Certificate"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data Source</label>
                <select
                  value={form.data_source}
                  onChange={(e) => handleChange('data_source', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                >
                  <option value="employees">employees</option>
                  <option value="students">students</option>
                  <option value="suppliers">suppliers</option>
                  <option value="finance">finance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Version
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.version}
                  disabled={isEdit}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= 1 || e.target.value === '') {
                      handleChange('version', value >= 1 ? value : 1);
                    }
                  }}
                  onBlur={() => {
                    if (!form.version || form.version < 1) {
                      handleChange('version', 1);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                />
                {isEdit ? (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Version will automatically increase when you save
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Must be 1 or higher
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                placeholder="Short description of this template..."
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Watermark</label>
                <select
                  value={form.watermark_text}
                  onChange={(e) => handleChange('watermark_text', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                >
                  {WATERMARKS.map((w) => (
                    <option key={w} value={w}>{w || 'None'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_active === true}
                      onChange={() => handleChange('is_active', true)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_active === false}
                      onChange={() => handleChange('is_active', false)}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Archived</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Available Fields - Dropdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Insert Placeholder</h2>
            <p className="text-[11px] text-gray-400 mb-4">Select a field then click Insert</p>

            <div className="flex gap-3">
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">-- Select Field --</option>
                {AVAILABLE_FIELDS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.fields.map((field) => (
                      <option key={field} value={field}>
                        {`{{${field}}}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedField}
                onClick={() => {
                  if (selectedField) {
                    insertPlaceholder(selectedField);
                    setSelectedField('');
                  }
                }}
                className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Insert
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Header HTML</h2>
            <textarea
              value={form.header_html}
              onChange={(e) => handleChange('header_html', e.target.value)}
              rows={4}
              placeholder="<div style='text-align:center'><h2>{{org_name}}</h2></div>"
              className="w-full px-3.5 py-3 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
            />
          </div>

          {/* Body */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Body HTML</h2>
            <textarea
              value={form.body_html}
              onChange={(e) => handleChange('body_html', e.target.value)}
              rows={12}
              placeholder={`<h1>Salary Certificate</h1>
<p>This is to certify that <strong>{{employee.full_name}}</strong>...</p>`}
              className="w-full px-3.5 py-3 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
            />
          </div>

          {/* Footer */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Footer HTML</h2>
            <textarea
              value={form.footer_html}
              onChange={(e) => handleChange('footer_html', e.target.value)}
              rows={3}
              placeholder="<div style='text-align:center;font-size:10px'>Verify at /verify | Doc ID: {{doc_id}}</div>"
              className="w-full px-3.5 py-3 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
            />
          </div>
        </div>

        {/* Right Side - Live Preview */}
        <div className="xl:sticky xl:top-6 h-fit">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Live Preview</h2>
              <span className="text-[10px] text-gray-400">Real-time</span>
            </div>

            <div className="p-6 min-h-[500px] bg-white relative">
              {form.watermark_text && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-6xl font-bold text-gray-200 rotate-[-25deg] opacity-30 select-none">
                    {form.watermark_text}
                  </span>
                </div>
              )}

              <div
                className="prose prose-sm max-w-none mb-6"
                dangerouslySetInnerHTML={{
                  __html: form.header_html || '<p class="text-gray-300">Header will appear here</p>',
                }}
              />

              <hr className="border-gray-100 my-4" />

              <div
                className="prose prose-sm max-w-none min-h-[200px]"
                dangerouslySetInnerHTML={{
                  __html: form.body_html || '<p class="text-gray-300">Body content will appear here</p>',
                }}
              />

              <hr className="border-gray-100 my-4" />

              <div
                className="prose prose-sm max-w-none text-xs text-gray-500"
                dangerouslySetInnerHTML={{
                  __html: form.footer_html || '<p class="text-gray-300">Footer will appear here</p>',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}