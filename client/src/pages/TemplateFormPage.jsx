import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { useToast } from '../context/ToastContext';
import axiosInstance from '../api/axiosInstance';

const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];
const WATERMARK_PRESETS = ['', 'DRAFT', 'CONFIDENTIAL', 'FINAL', 'OFFICIAL'];

// ── Internal DocuVault tables — never shown in the field picker ───────────────
// These are system tables the template editor should not expose to admins.
const INTERNAL_TABLES = new Set([
  'audit_logs', 'bulk_jobs', 'delivery_logs', 'digital_signatures',
  'email_verifications', 'generated_docs', 'notifications',
  'password_reset_tokens', 'recipient_access_sessions',
  'signature_requests', 'system_settings', 'template_placeholders',
  'templates',
]);

// ── System / auto-date placeholders injected by the server at generation time ─
// These are not DB columns — they are always available regardless of data source.
const SYSTEM_FIELDS = [
  { field: 'generation_date',     placeholder: '{{generation_date}}'     },
  { field: 'generation_time',     placeholder: '{{generation_time}}'     },
  { field: 'generation_datetime', placeholder: '{{generation_datetime}}' },
  { field: 'generation_year',     placeholder: '{{generation_year}}'     },
  { field: 'generation_month',    placeholder: '{{generation_month}}'    },
  { field: 'generation_day',      placeholder: '{{generation_day}}'      },
  { field: 'effective_date',      placeholder: '{{effective_date}}'      },
  { field: 'expiry_date',         placeholder: '{{expiry_date}}'         },
  { field: 'issue_date',          placeholder: '{{issue_date}}'          },
  { field: 'system.company_name', placeholder: '{{system.company_name}}' },
  { field: 'system.department',   placeholder: '{{system.department}}'   },
  { field: 'system.logo_url',     placeholder: '{{system.logo_url}}'     },
  { field: 'system.company_seal', placeholder: '{{system.company_seal}}' },
];

// ── Toolbar Button ───────────────────────────────────────────
function ToolbarButton({ onClick, active, disabled, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// ── Rich Editor Component ────────────────────────────────────
function RichEditor({ content, onChange, onOpenImageModal }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[180px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();
    const newContent = content || '';

    if (newContent !== currentContent) {
      editor.commands.setContent(newContent, false);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m-4 0h8" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4v6a6 6 0 0012 0V4M4 20h16" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M8 12h8M6 18h12" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M8 18h12" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarButton onClick={onOpenImageModal} title="Insert Image / Logo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor Area */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Image / Logo Modal ─────────────────────────────────────
function ImageInsertModal({
  open,
  onClose,
  onInsert,
}) {
  const [preview, setPreview] = useState('');
  const [size, setSize] = useState(140);
  const [type, setType] = useState('image');
  const [position, setPosition] = useState('center');
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please upload an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert('Image is too large. Please use an image smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFile = (e) => {
    processFile(e.target.files?.[0]);
  };

  const resetModal = () => {
    setPreview('');
    setSize(140);
    setType('image');
    setPosition('center');
    setIsDragging(false);
  };

  const increaseSize = () => setSize((previousSize) => Math.min(previousSize + 20, 400));
  const decreaseSize = () => setSize((previousSize) => Math.max(previousSize - 20, 40));

  const handleInsert = () => {
    if (!preview) return;

    let html = '';
    if (type === 'logo') {
      const textAlign = ['left', 'center', 'right'].includes(position) ? position : 'center';
      const margin = position === 'top' ? '0 0 12px' : position === 'bottom' ? '12px 0 0' : '12px 0';
      html = `
        <div data-logo-position="${position}" style="text-align:${textAlign}; margin: ${margin};">
          <img src="${preview}" alt="Logo" style="width:${size}px; height:auto;" />
        </div>
      `;
    } else {
      html = `<img src="${preview}" alt="Image" style="width:${size}px; height:auto; margin: 8px 0;" />`;
    }

    onInsert(html, type);
    resetModal();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Insert Image / Logo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              processFile(e.dataTransfer.files?.[0]);
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-indigo-300'
            }`}
          >
            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  style={{ width: `${size}px`, height: 'auto' }}
                  className="mx-auto rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setPreview('')}
                  aria-label="Remove selected image"
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
                >
                  X
                </button>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-2">[ ]</div>
                <p className="text-sm font-medium text-gray-700 mb-1">Drag and drop image here</p>
                <p className="text-xs text-gray-400 mb-3">or</p>
                <label className="inline-block px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700">
                  Choose File
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={type === 'image'}
                  onChange={() => setType('image')}
                />
                Normal Image
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={type === 'logo'}
                  onChange={() => setType('logo')}
                />
                Logo
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Size ({size}px)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={decreaseSize}
                disabled={size <= 40}
                aria-label="Decrease image size"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-lg font-bold disabled:opacity-40"
              >
                &minus;
              </button>
              <input
                type="range"
                min="40"
                max="400"
                step="10"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="Image size"
                className="flex-1"
              />
              <button
                type="button"
                onClick={increaseSize}
                disabled={size >= 400}
                aria-label="Increase image size"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-lg font-bold disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {type === 'logo' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Logo Position</label>
              <div className="grid grid-cols-5 gap-2">
                {['left', 'center', 'right', 'top', 'bottom'].map((optionPosition) => (
                  <button
                    key={optionPosition}
                    type="button"
                    onClick={() => setPosition(optionPosition)}
                    className={`py-2 text-xs rounded-lg capitalize font-medium ${
                      position === optionPosition
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {optionPosition}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!preview}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            type="button"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Signature Modal ──────────────────────────────────────────
function SignatureModal({ open, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [open]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;

    if (canvas.toDataURL() === blank.toDataURL()) {
      return;
    }

    setUploading(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Unable to create signature image');

      const formData = new FormData();
      formData.append('file', blob, 'signature.png');

      const response = await axiosInstance.post('/upload/signature', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSave(response.data.url);
      onClose();
    } catch (error) {
      console.error(error);
      window.alert(error.response?.data?.message || 'Failed to upload signature');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Draw Your Signature</h3>
          <button onClick={onClose} disabled={uploading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full h-48 touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Draw your signature using mouse or touch
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleClear}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-60"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Save Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function TemplateFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState(null);   // live DB schema from GET /templates/schema
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [selectedField, setSelectedField] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [watermarkMode, setWatermarkMode] = useState('preset');
  const [activeSection, setActiveSection] = useState('body'); // header | body | footer
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'html'

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

  // Fetch live DB schema for the field picker (FR-003)
  useEffect(() => {
    axiosInstance.get('/templates/schema')
      .then(r => setSchema(r.data))
      .catch(() => setSchema({}))
      .finally(() => setSchemaLoading(false));
  }, []);

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
          setWatermarkMode(WATERMARK_PRESETS.includes(t.watermark_text || '') ? 'preset' : 'custom');
        })
        .catch(() => toast.error('Failed to load template'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const insertPlaceholder = () => {
    if (!selectedField) return;
    const placeholder = `{{${selectedField}}}`;
    const key = `${activeSection}_html`;
    handleChange(key, (form[key] || '') + placeholder);
    toast.success(`Inserted ${placeholder}`);
    setSelectedField('');
  };

  const handleInsertImage = (html, type) => {
    const key = `${activeSection}_html`;
    handleChange(key, (form[key] || '') + html);
    toast.success(type === 'logo' ? 'Logo inserted' : 'Image inserted');
  };

  const insertSignature = (imageUrl) => {
    const imgTag = `<img src="${imageUrl}" alt="Signature" style="max-height:80px;" />`;
    const key = `${activeSection}_html`;
    handleChange(key, (form[key] || '') + imgTag);
    toast.success('Signature inserted');
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
        await axiosInstance.put(`/templates/${id}`, form);
        toast.success('Template updated (new version created)');
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
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading template...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Template' : 'Create New Template'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEdit
              ? `Editing version ${form.version} → will become version ${form.version + 1}`
              : 'Create a professional document template with rich editing'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT - Form + Editor */}
        <div className="xl:col-span-3 space-y-5">
          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-900">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Salary Certificate"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none"
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
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none"
                >
                  <option value="employees">employees</option>
                  <option value="students">students</option>
                  <option value="suppliers">suppliers</option>
                  <option value="finance">finance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Version</label>
                <input
                  type="number"
                  min={1}
                  value={form.version}
                  disabled={isEdit}
                  onChange={(e) => handleChange('version', Number(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Watermark</label>
                <select
                  value={watermarkMode === 'custom' ? 'custom' : form.watermark_text}
                  onChange={(e) => {
                    const value = e.target.value;
                    setWatermarkMode(value === 'custom' ? 'custom' : 'preset');
                    handleChange('watermark_text', value === 'custom' ? '' : value);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none mb-2"
                >
                  {WATERMARK_PRESETS.map((watermark) => (
                    <option key={watermark} value={watermark}>{watermark || 'None'}</option>
                  ))}
                  <option value="custom">Custom Text...</option>
                </select>
                {(watermarkMode === 'custom' || form.watermark_text) && (
                  <input
                    type="text"
                    value={form.watermark_text}
                    onChange={(e) => {
                      setWatermarkMode('custom');
                      handleChange('watermark_text', e.target.value);
                    }}
                    placeholder="Type custom watermark text..."
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={form.is_active}
                      onChange={() => handleChange('is_active', true)}
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={!form.is_active}
                      onChange={() => handleChange('is_active', false)}
                    />
                    Archived
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-2">
            {['header', 'body', 'footer'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-4 py-2 text-sm font-medium rounded-xl capitalize transition-colors ${
                  activeSection === section
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Rich Editor */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 capitalize">
                {activeSection} Content
              </h2>

              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditorMode('visual')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      editorMode === 'visual'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('html')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      editorMode === 'html'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    HTML
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowImageModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Image / Logo
                </button>

                <button
                  type="button"
                  onClick={() => setShowSignature(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Draw Signature
                </button>
              </div>
            </div>

            {editorMode === 'visual' ? (
              <RichEditor
                content={form[`${activeSection}_html`]}
                onChange={(html) => handleChange(`${activeSection}_html`, html)}
                onOpenImageModal={() => setShowImageModal(true)}
              />
            ) : (
              <textarea
                value={form[`${activeSection}_html`] || ''}
                onChange={(e) => handleChange(`${activeSection}_html`, e.target.value)}
                rows={12}
                className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none resize-none"
                placeholder="Write or paste HTML here..."
              />
            )}
          </div>

          {/* Insert Placeholder */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Insert Placeholder</h2>
            <div className="flex gap-3">
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                disabled={schemaLoading}
                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none disabled:opacity-50"
              >
                <option value="">
                  {schemaLoading ? 'Loading fields…' : '-- Select Field --'}
                </option>

                {/* ── Live DB table groups ─────────────────────────────── */}
                {schema && Object.entries(schema)
                  .filter(([table]) => !INTERNAL_TABLES.has(table))
                  .map(([table, cols]) => (
                    <optgroup key={table} label={table}>
                      {cols.map(col => (
                        <option key={col.field} value={col.field}>
                          {col.placeholder}
                        </option>
                      ))}
                    </optgroup>
                  ))
                }

                {/* ── System / auto-date fields (always available) ─────── */}
                <optgroup label="System (auto-filled)">
                  {SYSTEM_FIELDS.map(f => (
                    <option key={f.field} value={f.field}>
                      {f.placeholder}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                type="button"
                disabled={!selectedField}
                onClick={insertPlaceholder}
                className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                Insert
              </button>
            </div>
            {schema && Object.keys(schema).filter(t => !INTERNAL_TABLES.has(t)).length === 0 && !schemaLoading && (
              <p className="text-xs text-amber-600 mt-2">
                No domain tables found in database. Only system fields are available.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT - Live Preview */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-6 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Live Preview</h2>
              <span className="text-[10px] text-gray-400">Real-time</span>
            </div>

            <div className="p-6 min-h-[500px] relative bg-white">
              {form.watermark_text && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-5xl font-bold text-gray-200 rotate-[-25deg] opacity-30 select-none">
                    {form.watermark_text}
                  </span>
                </div>
              )}

              <div
                className="prose prose-sm max-w-none mb-4"
                dangerouslySetInnerHTML={{
                  __html: form.header_html || '<p class="text-gray-300">Header...</p>',
                }}
              />

              <hr className="border-gray-100 my-4" />

              <div
                className="prose prose-sm max-w-none min-h-[180px]"
                dangerouslySetInnerHTML={{
                  __html: form.body_html || '<p class="text-gray-300">Body content...</p>',
                }}
              />

              <hr className="border-gray-100 my-4" />

              <div
                className="prose prose-sm max-w-none text-xs text-gray-500"
                dangerouslySetInnerHTML={{
                  __html: form.footer_html || '<p class="text-gray-300">Footer...</p>',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <ImageInsertModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onInsert={handleInsertImage}
      />

      {/* Signature Modal */}
      <SignatureModal
        open={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={insertSignature}
      />
    </div>
  );
}