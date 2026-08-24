import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { useForm } from 'react-hook-form';
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  TableCellsIcon,
  PhotoIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import axiosInstance from '../api/axiosInstance';
import { useToast } from '../context/ToastContext';

const CATEGORIES = ['HR', 'Finance', 'Academic', 'Procurement', 'General'];
const WATERMARKS = ['', 'DRAFT', 'CONFIDENTIAL', 'FINAL'];

// ── Internal system tables that should NOT appear in the sidebar ─────────────
// These are DocuVault's own tables — not document data sources
const SYSTEM_TABLES = new Set([
  'users', 'templates', 'template_placeholders', 'generated_docs',
  'signature_requests', 'digital_signatures', 'delivery_logs',
  'audit_logs', 'system_settings', 'bulk_jobs', 'field_mappings',
  'notifications',
]);
const STATIC_FIELDS = {
  '👤 Employee': [
    { label: 'Full Name',    tag: '{{employee.full_name}}' },
    { label: 'Position',     tag: '{{employee.position}}' },
    { label: 'Department',   tag: '{{employee.department}}' },
    { label: 'Email',        tag: '{{employee.email}}' },
    { label: 'Phone',        tag: '{{employee.phone}}' },
    { label: 'Employee ID',  tag: '{{employee.id}}' },
    { label: 'Join Date',    tag: '{{employee.join_date}}' },
  ],
  '💰 Finance': [
    { label: 'Salary',       tag: '{{finance.salary}}' },
    { label: 'Currency',     tag: '{{finance.currency}}' },
    { label: 'Pay Date',     tag: '{{finance.pay_date}}' },
    { label: 'Bank Name',    tag: '{{finance.bank_name}}' },
    { label: 'Account No.',  tag: '{{finance.account_number}}' },
  ],
  '🏢 System / Org': [
    { label: 'Company Name',   tag: '{{system.company_name}}' },
    { label: 'Department',     tag: '{{system.department}}' },
    { label: 'Address',        tag: '{{system.address}}' },
    { label: 'Contact Email',  tag: '{{system.contact_email}}' },
    { label: 'Contact Phone',  tag: '{{system.contact_phone}}' },
    { label: 'Company Seal',   tag: '{{system.company_seal}}' },
    { label: 'Logo URL',       tag: '{{system.logo_url}}' },
  ],
  '✍️ Approver': [
    { label: 'Full Name',       tag: '{{approver.full_name}}' },
    { label: 'Role / Title',    tag: '{{approver.role}}' },
    { label: 'Department',      tag: '{{approver.department}}' },
    { label: 'Signature Image', tag: '{{approver.signature_image}}' },
  ],
  '📅 Dates': [
    { label: 'Generation Date',    tag: '{{generation_date}}' },
    { label: 'Generation Time',    tag: '{{generation_time}}' },
    { label: 'Generation DateTime',tag: '{{generation_datetime}}' },
    { label: 'Effective Date',     tag: '{{effective_date}}' },
    { label: 'Year',               tag: '{{generation_year}}' },
    { label: 'Month',              tag: '{{generation_month}}' },
  ],
  '🔀 Logic Blocks': [
    { label: '{{#if}} block',      tag: '{{#if condition}}\nContent shown when true\n{{/if}}' },
    { label: '{{#if}} with else',  tag: '{{#if condition}}\nTrue content\n{{else}}\nFalse content\n{{/if}}' },
    { label: '{{#each}} loop',     tag: '{{#each items}}\n{{this.field_name}}\n{{/each}}' },
  ],
};

// ── Sample data for live preview ──────────────────────────────────────────────
const SAMPLE = {
  'employee.full_name': 'Sara Ahmed',
  'employee.position':  'HR Manager',
  'employee.department':'Human Resources',
  'employee.email':     'sara@company.com',
  'employee.phone':     '+251 912 345 678',
  'employee.id':        'EMP-0042',
  'employee.join_date': '01 Jan 2022',
  'finance.salary':     'ETB 45,000',
  'finance.currency':   'ETB',
  'finance.pay_date':   '30 Aug 2026',
  'finance.bank_name':  'Commercial Bank of Ethiopia',
  'finance.account_number': '1000123456789',
  'system.company_name':   'Kombolcha Institute of Technology',
  'system.department':     'Human Resources',
  'system.address':        'Kombolcha, Amhara, Ethiopia',
  'system.contact_email':  'hr@kit.edu.et',
  'system.contact_phone':  '+251 331 234 567',
  'approver.full_name':    'Dr. Abebe Tadesse',
  'approver.role':         'Finance Director',
  'approver.department':   'Finance Office',
  generation_date:     new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
  generation_time:     new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
  generation_datetime: new Date().toLocaleString('en-US'),
  generation_year:     String(new Date().getFullYear()),
  generation_month:    new Date().toLocaleDateString('en-US', { month:'long' }),
  effective_date:      new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
};

function renderPreview(html) {
  if (!html) return '';
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  let result = html;

  // Fix relative image src paths (e.g. storage/uploads/logo.png → full URL)
  result = result.replace(
    /src="(?!http|data:)([^"]+)"/g,
    (_, path) => `src="${API}/${path.replace(/^\//, '')}"`
  );

  Object.entries(SAMPLE).forEach(([key, value]) => {
    const escaped = key.replace(/\./g, '\\.');
    result = result.replace(
      new RegExp(`{{${escaped}}}`, 'g'),
      `<mark style="background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:4px;font-weight:600">${value}</mark>`
    );
  });

  result = result.replace(
    /{{#if\s+.+?}}([\s\S]*?){{\/if}}/g,
    '<div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:6px 10px;margin:4px 0;border-radius:0 4px 4px 0">$1</div>'
  );
  result = result.replace(
    /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g,
    '<div style="background:#fff7ed;border-left:3px solid #ea580c;padding:6px 10px;margin:4px 0"><em style="font-size:10px;color:#ea580c">LOOP ($1):</em> $2</div>'
  );
  result = result.replace(
    /{{[\w.]+}}/g,
    (match) => `<mark style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px">${match}</mark>`
  );

  return result;
}

function ToolBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor, onInsert, templateId }) {
  if (!editor) return null;

  // ── Resize selected image — correct TipTap approach ────────────────────
  const resizeImage = (width) => {
    // Use TipTap's chain API which handles selection correctly
    editor.chain().focus().updateAttributes('image', {
      style: width === '100%'
        ? 'width:100%;height:auto;display:block;margin:8px 0;border-radius:8px;'
        : `width:${width};height:auto;display:block;margin:8px auto;border-radius:8px;`,
    }).run();
  };

  const isImageSelected = editor.isActive('image');

  const uploadImage = async () => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await axiosInstance.post('/templates/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const imageUrl = response.data.url || response.data.fullUrl || URL.createObjectURL(file);
        editor.chain().focus().insertContent({
          type:  'image',
          attrs: {
            src:   imageUrl,
            alt:   file.name,
            style: 'width:320px;height:auto;display:block;margin:8px auto;border-radius:8px;',
          },
        }).run();
      } catch {
        // Fallback to local blob URL
        editor.chain().focus().insertContent({
          type:  'image',
          attrs: {
            src:   URL.createObjectURL(file),
            alt:   file.name,
            style: 'width:320px;height:auto;display:block;margin:8px auto;border-radius:8px;',
          },
        }).run();
      }
    };
    input.click();
  };

  return (
    <div className="border-b border-slate-200 bg-white">

      {/* ── Row 1: Text formatting ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Bold">
          <BoldIcon className="h-3.5 w-3.5"/>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Italic">
          <ItalicIcon className="h-3.5 w-3.5"/>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')} title="Underline">
          <span className="text-[11px] font-black underline">U</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Strikethrough">
          <span className="text-[11px] font-black line-through">S</span>
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200"/>

        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <span className="text-[10px] font-black">H1</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <span className="text-[10px] font-black">H2</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <span className="text-[10px] font-black">H3</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')} title="Paragraph">
          <span className="text-[10px] font-bold">P</span>
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200"/>

        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <span className="text-[11px] font-bold">L</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <span className="text-[11px] font-bold">C</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <span className="text-[11px] font-bold">R</span>
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-slate-200"/>

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Bullet list">
          <ListBulletIcon className="h-3.5 w-3.5"/>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Numbered list">
          <span className="text-[10px] font-bold">1.</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')} title="Quote">
          <span className="text-[10px] font-bold">❝</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule">
          <span className="text-[10px] font-bold">—</span>
        </ToolBtn>
      </div>

      {/* ── Row 2: Insert media + smart placeholders ────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">

        {/* Upload image — only option for images */}
        <button type="button" onClick={uploadImage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
            bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700
            transition-colors hover:bg-slate-50">
          <PhotoIcon className="h-3.5 w-3.5"/>
          Insert Image
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200"/>

        {/* Logo — inserts text placeholder that resolves at generation time */}
        <button type="button"
          onClick={() => onInsert('{{system.logo_url}}')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200
            bg-purple-50 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700
            transition-colors hover:bg-purple-100"
          title="Inserts the organisation logo — resolved from System Configuration at PDF generation">
          🏢 Logo
        </button>

        {/* Seal — inserts text placeholder */}
        <button type="button"
          onClick={() => onInsert('{{system.company_seal}}')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200
            bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700
            transition-colors hover:bg-indigo-100"
          title="Inserts the official company seal — resolved from System Configuration at PDF generation">
          🔏 Seal
        </button>

        {/* Signature — inserts text placeholder */}
        <button type="button"
          onClick={() => onInsert('{{approver.signature_image}}')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200
            bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700
            transition-colors hover:bg-emerald-100"
          title="Inserts the approver signature — resolved when the document is approved">
          ✍️ Sign
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200"/>

        {/* Quick shortcut chips */}
        <ToolBtn onClick={() => onInsert('{{employee.full_name}}')}
          title="Insert employee full name">
          <span className="text-[9px] font-bold text-blue-600">{'{{name}}'}</span>
        </ToolBtn>
        <ToolBtn onClick={() => onInsert('{{finance.salary}}')}
          title="Insert finance salary">
          <span className="text-[9px] font-bold text-emerald-600">{'{{salary}}'}</span>
        </ToolBtn>
        <ToolBtn onClick={() => onInsert('{{generation_date}}')}
          title="Insert auto-filled generation date">
          <span className="text-[9px] font-bold text-violet-600">{'{{date}}'}</span>
        </ToolBtn>
      </div>

      {/* ── Row 3: Image resize bar (only when image is selected) ── */}
      {isImageSelected && (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-blue-50 px-3 py-2">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mr-1">
            Resize:
          </span>
          {[
            { label: 'XS',   width: '80px',  title: 'Extra small — 80px (seal / icon)' },
            { label: 'S',    width: '160px', title: 'Small — 160px (signature / logo)' },
            { label: 'M',    width: '320px', title: 'Medium — 320px' },
            { label: 'L',    width: '480px', title: 'Large — 480px' },
            { label: 'Full', width: '100%',  title: 'Full page width' },
          ].map(({ label, width, title }) => (
            <button
              key={label}
              type="button"
              title={title}
              onClick={() => resizeImage(width)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg
                bg-white border border-blue-200 text-blue-700
                hover:bg-blue-600 hover:text-white hover:border-blue-600
                transition-colors"
            >
              {label}
            </button>
          ))}
          <span className="text-[10px] text-blue-400 ml-1 hidden sm:block">
            ← resize selected image
          </span>
        </div>
      )}
    </div>
  );
}

const PROSE_CSS = `
.ProseMirror {
  min-height: 100%;
  outline: none;
  padding: 24px;
  font-family: Inter, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.75;
  color: #1a1a1a;
}
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}
.ProseMirror h1 { font-size: 23px; font-weight: 700; margin: 0 0 8px; }
.ProseMirror h2 { font-size: 19px; font-weight: 700; margin: 0 0 6px; }
.ProseMirror h3 { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
.ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 10px 0; }
.ProseMirror blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
  color: #475569;
  margin: 10px 0;
}
.ProseMirror hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
.ProseMirror img {
  max-width: 100%;
  height: auto;
  cursor: pointer;
  border-radius: 12px;
  display: block;
  margin: 12px auto;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}
.ProseMirror img.ProseMirror-selectednode {
  outline: 3px solid #3b82f6;
  outline-offset: 4px;
}
`;

export default function TemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name:           '',
      description:    '',
      category:       'HR',
      watermark_text: '',
      data_source:    '',
      version:        1,
      is_active:      true,
    },
  });

  const [section, setSection]     = useState('body'); // tracks which editor has focus for insertPlaceholder
  const [rightTab, setRightTab]   = useState('fields');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [schema, setSchema] = useState({});
  const [openTables, setOpenTables] = useState({});
  const [fieldSearch, setFieldSearch] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [bodyHtml, setBodyHtml] = useState('');
  const [headerHtml, setHeaderHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');

  const makeExtensions = (placeholder) => [
    StarterKit,
    Placeholder.configure({ placeholder }),
    Underline,
    TextStyle,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ resizable: true, inline: false, allowBase64: true }),
  ];

  const bodyEditor = useEditor({
    extensions: makeExtensions('Start writing your document body here…'),
    onUpdate: ({ editor }) => setBodyHtml(editor.getHTML()),
  });

  const headerEditor = useEditor({
    extensions: makeExtensions('Optional header content…'),
    onUpdate: ({ editor }) => setHeaderHtml(editor.getHTML()),
  });

  const footerEditor = useEditor({
    extensions: makeExtensions('Optional footer content…'),
    onUpdate: ({ editor }) => setFooterHtml(editor.getHTML()),
  });

  const editors = { body: bodyEditor, header: headerEditor, footer: footerEditor };
  const activeEditor = editors[section];

  const insertPlaceholder = useCallback((tag) => {
    if (!activeEditor) return;
    activeEditor.chain().focus().insertContent(tag).run();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [activeEditor]);

  useEffect(() => {
    // Open the first 3 static groups by default
    const defaultOpen = Object.keys(STATIC_FIELDS)
      .slice(0, 3)
      .reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setOpenTables(defaultOpen);

    axiosInstance.get('/templates/schema')
      .then((response) => {
        setSchema(response.data || {});
        // Add DB tables to open state without overwriting static defaults
        const firstDbKey = Object.keys(response.data || {})[0];
        if (firstDbKey) {
          setOpenTables(prev => ({ ...prev, [`db_${firstDbKey}`]: true }));
        }
      })
      .catch(() => {});

    if (!isEdit) {
      setLoading(false);
      return;
    }

    axiosInstance.get(`/templates/${id}`)
      .then((response) => {
        const template = response.data;
        setValue('name',           template.name          || '');
        setValue('description',    template.description   || '');
        setValue('category',       template.category      || 'HR');
        setValue('watermark_text', template.watermark_text || '');
        setValue('data_source',    template.data_source   || '');
        setValue('version',        template.version       || 1);
        setValue('is_active',      Boolean(template.is_active));

        if (template.header_html && headerEditor) {
          headerEditor.commands.setContent(template.header_html);
          setHeaderHtml(template.header_html);
        }
        if (template.body_html && bodyEditor) {
          bodyEditor.commands.setContent(template.body_html);
          setBodyHtml(template.body_html);
        }
        if (template.footer_html && footerEditor) {
          footerEditor.commands.setContent(template.footer_html);
          setFooterHtml(template.footer_html);
        }
        if (template.logo_path) setLogoPreview(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${template.logo_path}`);
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false));
  }, [bodyEditor, footerEditor, headerEditor, id, isEdit, setValue, toast]);

  const onSubmit = async (data, activate = false) => {
    if (!bodyHtml || bodyHtml === '<p></p>') {
      toast.error('Body content is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...data,
        is_active:   activate ? true : data.is_active,
        header_html: headerHtml,
        body_html:   bodyHtml,
        footer_html: footerHtml,
        data_source: data.data_source || null,
      };

      let savedId = id;
      if (isEdit) {
        await axiosInstance.put(`/templates/${id}`, payload);
        toast.success('Template updated');
      } else {
        const response = await axiosInstance.post('/templates', payload);
        savedId = response.data.id;
        toast.success('Template created');
      }

      if (logo && savedId) {
        const formData = new FormData();
        formData.append('logo', logo);
        await axiosInstance.post(`/templates/${savedId}/logo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate('/templates');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const watchedWatermark = watch('watermark_text');

  // ── Download a real sample PDF preview ───────────────────────────────────
  const downloadPreviewPdf = async () => {
    if (!id) {
      toast.error('Save the template first (Save Draft), then click Download Preview PDF.');
      return;
    }
    setPreviewLoading(true);
    try {
      // Use axiosInstance.post with blob responseType — goes through Vite proxy correctly
      const res = await axiosInstance.post(`/templates/${id}/preview-pdf`, {}, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `preview-${(watch('name') || 'template').replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Preview PDF downloaded');
    } catch (err) {
      // If blob response contains error JSON, read it
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text().catch(() => '');
        const parsed = JSON.parse(text).catch?.(() => ({})) || {};
        toast.error(parsed.message || 'Preview PDF generation failed');
      } else {
        toast.error(err.response?.data?.message || err.message || 'Preview PDF generation failed');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Merge static fields with live DB schema ──────────────────────────────
  // Static groups always appear first; DB tables appear below with a "DB:" prefix
  const filteredSchema = Object.entries(schema).reduce((acc, [table, fields]) => {
    const query    = fieldSearch.toLowerCase();
    const filtered = fields.filter(f =>
      f.field.toLowerCase().includes(query) || f.placeholder.toLowerCase().includes(query)
    );
    if (filtered.length) acc[table] = filtered;
    return acc;
  }, {});

  const dbGroups = Object.entries(filteredSchema)
    .filter(([table]) => !SYSTEM_TABLES.has(table))  // hide internal DocuVault tables
    .map(([table, fields]) => ({
      key:    `db_${table}`,
      label:  `🗄 ${table}`,
      isDb:   true,
      fields: fields.map(f => ({ label: f.field, tag: f.placeholder })),
    }));

  const staticGroups = Object.entries(STATIC_FIELDS).map(([group, fields]) => {
    const q       = fieldSearch.toLowerCase();
    const visible = fields.filter(f =>
      `${group} ${f.label} ${f.tag}`.toLowerCase().includes(q)
    );
    return { key: group, label: group, isDb: false, fields: visible };
  }).filter(g => g.fields.length > 0);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const resolvedLogo = logoPreview
    ? (logoPreview.startsWith('http') || logoPreview.startsWith('data:') || logoPreview.startsWith('blob:')
        ? logoPreview
        : `${API_BASE}/${logoPreview.replace(/^\//, '')}`)
    : '';

  const previewContent = `
    <div style="font-family:Inter,Arial,sans-serif;font-size:12.5px;color:#111;line-height:1.75">
      ${resolvedLogo ? `<img src="${resolvedLogo}" style="max-height:48px;object-fit:contain;margin-bottom:12px" alt="logo"/>` : ''}
      ${headerHtml && headerHtml !== '<p></p>' ? `<div style="border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:14px">${renderPreview(headerHtml)}</div>` : ''}
      <div>${renderPreview(bodyHtml)}</div>
      ${footerHtml && footerHtml !== '<p></p>' ? `<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:10px;font-size:11px;color:#6b7280">${renderPreview(footerHtml)}</div>` : ''}
    </div>`;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data, false))}
      className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[var(--color-bg)]">
      <style>{PROSE_CSS}</style>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate('/templates')}
              className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                Template Builder
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-xl font-bold text-[var(--color-text-primary)]">
                  {watch('name') || 'New Template'}
                </span>
                {id && (
                  <span className="text-[11px] font-bold bg-indigo-100 text-[#3b5bdb]
                    px-2 py-0.5 rounded-full flex-shrink-0">
                    v{watch('version') || 1}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/templates')}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                px-3.5 py-2 text-sm font-semibold text-[var(--color-text-secondary)]
                transition-colors hover:bg-[var(--color-surface-raised)]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                px-3.5 py-2 text-sm font-semibold text-[var(--color-text-primary)]
                transition-colors hover:bg-[var(--color-surface-raised)] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" disabled={saving}
              onClick={handleSubmit((data) => onSubmit(data, true))}
              className="flex items-center gap-2 rounded-xl bg-[#3b5bdb] px-4 py-2.5 text-sm
                font-bold text-white shadow-sm shadow-indigo-200/60
                transition-colors hover:bg-[#2f4ac4] disabled:opacity-50">
              <CheckCircleIcon className="h-4 w-4" />
              Activate
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-[280px] flex-shrink-0 flex flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b border-[var(--color-border)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Dynamic Fields</h2>
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Live</span>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)}
                placeholder="Search fields"
                className="w-full rounded-xl border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)]
                  placeholder-[var(--color-text-secondary)]
                  py-2 pl-9 pr-3 text-sm
                  focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-scroll space-y-3 p-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            {[...staticGroups, ...dbGroups].map((group) => (
              <div key={group.key}
                className={`rounded-2xl border ${group.isDb
                  ? 'border-indigo-200/70 bg-indigo-50/30'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-raised)]'
                }`}>
                <button
                  type="button"
                  onClick={() => setOpenTables(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)] truncate">
                      {group.label}
                    </span>
                    {group.isDb && (
                      <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        DB
                      </span>
                    )}
                  </div>
                  <ChevronDownIcon className={`h-4 w-4 text-[var(--color-text-secondary)] transition-transform flex-shrink-0 ${openTables[group.key] !== false ? 'rotate-180' : ''}`} />
                </button>

                {openTables[group.key] !== false && (
                  <div className="space-y-1.5 p-2">
                    {group.fields.map((field) => (
                      <button
                        key={field.tag}
                        type="button"
                        onClick={() => insertPlaceholder(field.tag)}
                        className={`w-full rounded-xl border text-left shadow-sm transition-all
                          hover:shadow-md active:scale-[0.98]
                          ${field.tag.startsWith('{{#') || field.tag.startsWith('{{/') || field.tag.includes('#each') || field.tag.includes('#if')
                            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                            : field.tag.startsWith('{{system.')
                            ? 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                            : field.tag.startsWith('{{approver.')
                            ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-indigo-200 hover:bg-indigo-50'
                          } px-3 py-2`}
                      >
                        <div className="text-[11px] font-semibold text-[var(--color-text-primary)]">{field.label}</div>
                        <div className="mt-0.5 break-all font-mono text-[9px] text-[var(--color-text-secondary)] leading-tight">
                          {field.tag.length > 40 ? field.tag.slice(0, 38) + '…' : field.tag}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* DB schema source indicator */}
            {dbGroups.length > 0 && (
              <div className="flex items-center gap-1.5 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                <span className="text-[10px] text-slate-400">
                  {dbGroups.length} live DB table{dbGroups.length !== 1 ? 's' : ''} loaded
                </span>
              </div>
            )}
            {dbGroups.length === 0 && (
              <div className="flex items-center gap-1.5 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>
                <span className="text-[10px] text-slate-400">DB schema not connected</span>
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Template Name</label>
                <input {...register('name', { required: 'Template name is required' })} placeholder="Employee Salary Slip" className={`h-10 w-full rounded-xl border bg-white px-3 text-sm focus:outline-none ${errors.name ? 'border-red-300' : 'border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'}`} />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Category</label>
                <select {...register('category')} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div className="col-span-4">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Description</label>
                <input {...register('description')} placeholder="Optional summary" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>

              <div className="col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Watermark</label>
                <select {...register('watermark_text')} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {WATERMARKS.map((option) => <option key={option || 'none'} value={option}>{option || 'None'}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Data Source row (FR-009) ─────────────────────────── */}
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9C18.5 4 20 5 20 7M4 7h16M12 11v6M8 11v6M16 11v6"/>
              </svg>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                Data Source
              </span>
              <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">
                FR-009
              </span>
            </div>
            <select
              {...register('data_source')}
              className="h-8 flex-1 max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-xs
                focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">— No specific table (manual data entry) —</option>
              {Object.keys(schema).map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 hidden lg:block">
              Binding a table auto-suggests fields and enables record-ID generation
            </p>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-100 p-4 space-y-4">

            {/* ── HEADER section ──────────────────────────────────────── */}
            <div className="mx-auto max-w-[860px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"/>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Header
                  </span>
                </div>
                <div className="flex-1 h-px bg-slate-200"/>
                <span className="text-[10px] text-slate-400">
                  Organization name, logo, letterhead
                </span>
              </div>
              <div
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden
                  transition-shadow ${section === 'header' ? 'border-blue-300 shadow-blue-100/50' : 'border-slate-200'}`}
                onFocus={() => setSection('header')}
              >
                <EditorToolbar editor={headerEditor} onInsert={insertPlaceholder} templateId={id} />
                <div className="min-h-[120px] bg-white">
                  <EditorContent editor={headerEditor} />
                </div>
              </div>
            </div>

            {/* ── BODY section ────────────────────────────────────────── */}
            <div className="mx-auto max-w-[860px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"/>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Body
                  </span>
                </div>
                <div className="flex-1 h-px bg-slate-200"/>
                <span className="text-[10px] text-slate-400">
                  Main document content
                </span>
              </div>
              <div
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden
                  transition-shadow ${section === 'body' ? 'border-blue-300 shadow-blue-100/50' : 'border-slate-200'}`}
                onFocus={() => setSection('body')}
              >
                <EditorToolbar editor={bodyEditor} onInsert={insertPlaceholder} templateId={id} />
                <div className="min-h-[360px] bg-white">
                  <EditorContent editor={bodyEditor} />
                </div>
              </div>
            </div>

            {/* ── FOOTER section ──────────────────────────────────────── */}
            <div className="mx-auto max-w-[860px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400"/>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Footer
                  </span>
                </div>
                <div className="flex-1 h-px bg-slate-200"/>
                <span className="text-[10px] text-slate-400">
                  Signature block, seal, page reference
                </span>
              </div>
              <div
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden
                  transition-shadow ${section === 'footer' ? 'border-blue-300 shadow-blue-100/50' : 'border-slate-200'}`}
                onFocus={() => setSection('footer')}
              >
                <EditorToolbar editor={footerEditor} onInsert={insertPlaceholder} templateId={id} />
                <div className="min-h-[160px] bg-white">
                  <EditorContent editor={footerEditor} />
                </div>
              </div>
            </div>

          </div>

          <div className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Active
                </label>
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  {saved ? '✓ Saved' : 'Auto-save ready'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Download real sample PDF */}
                <button
                  type="button"
                  onClick={downloadPreviewPdf}
                  disabled={previewLoading || !id}
                  title={!id ? 'Save the template first to generate a preview PDF' : 'Download a real PDF with sample data'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200
                    bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700
                    hover:bg-emerald-600 hover:text-white hover:border-emerald-600
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {previewLoading
                    ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>Generating…</>
                    : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>Download Preview PDF</>
                  }
                </button>

                {/* Switch to preview tab */}
                <button type="button" onClick={() => setRightTab('preview')}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold
                    text-slate-700 hover:bg-slate-200 transition-colors">
                  Preview
                </button>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-[380px] flex-shrink-0 overflow-hidden border-l border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            <button type="button" onClick={() => setRightTab('properties')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${rightTab === 'properties' ? 'bg-slate-50 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              Properties
            </button>
            <button type="button" onClick={() => setRightTab('preview')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${rightTab === 'preview' ? 'bg-slate-50 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              Preview
            </button>
          </div>

          {rightTab === 'properties' ? (
            <div className="space-y-4 overflow-y-auto p-4">

              {/* ── Template Logo (FR-008) ────────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Template Logo</span>
                  <span className="text-[9px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">FR-008</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Shown in the document header. Use <code className="bg-white px-1 rounded font-mono text-purple-600">{'{{system.logo_url}}'}</code> in the Header editor or click 🏢 Logo in toolbar.
                </p>
                {logoPreview ? (
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-2.5">
                    <img src={logoPreview} alt="Logo preview"
                      className="h-10 w-24 rounded-lg border border-slate-200 bg-white object-contain flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 truncate">Logo uploaded</p>
                    </div>
                    <button type="button" onClick={() => { setLogo(null); setLogoPreview(''); }}
                      className="text-[10px] font-semibold text-red-500 hover:text-red-600 flex-shrink-0">
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-dashed border-slate-300
                    rounded-xl px-3 py-2.5 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span className="text-[11px] font-semibold text-slate-600">Choose logo file…</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fd = new FormData();
                        fd.append('image', file);
                        const r = await axiosInstance.post('/templates/upload-image', fd, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        setLogoPreview(r.data.url || r.data.fullUrl || URL.createObjectURL(file));
                      } catch { setLogoPreview(URL.createObjectURL(file)); }
                      setLogo(file);
                    }}/>
                  </label>
                )}
                <p className="text-[9px] text-slate-400">PNG/JPG/SVG · max 2 MB · transparent background recommended</p>
              </div>

              {/* ── Company Seal (from System Config) ─────────────── */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Company Seal</span>
                  <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">System Config</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  The official seal is uploaded in <strong>System Configuration → Institution & Branding</strong> and auto-embedded into every PDF.
                </p>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-indigo-100 px-3 py-2">
                  <code className="text-[10px] font-mono text-indigo-600 flex-1">{'{{system.company_seal}}'}</code>
                  <button type="button"
                    onClick={() => {
                      insertPlaceholder('<img src="{{system.company_seal}}" style="width:80px;height:80px;object-fit:contain;display:inline-block;" alt="Seal"/>');
                    }}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-lg flex-shrink-0">
                    Insert →
                  </button>
                </div>
              </div>

              {/* ── Approver Signature (from user profile) ────────── */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Approver Signature</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">Auto</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Approvers upload their signature in <strong>My Settings → Signature Image</strong>. Auto-embedded when the document is approved.
                </p>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-emerald-100 px-3 py-2">
                  <code className="text-[10px] font-mono text-emerald-600 flex-1">{'{{approver.signature_image}}'}</code>
                  <button type="button"
                    onClick={() => {
                      insertPlaceholder('<img src="{{approver.signature_image}}" style="width:160px;height:60px;object-fit:contain;display:block;margin:4px 0;" alt="Signature"/>');
                    }}
                    className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                    Insert →
                  </button>
                </div>
              </div>

              {/* ── Template versioning info ───────────────────────── */}
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Version Control</span>
                  <span className="text-[9px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full">FR-006</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Version is managed automatically. Every time you save, the version increments.
                  Generated documents always link to the version used — older PDFs are never affected.
                </p>
                <div className="bg-white rounded-xl border border-amber-100 px-3 py-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Current:</span>
                    <span className="text-sm font-black text-amber-700">
                      v{watch('version') || (id ? '?' : 'New')}
                    </span>
                  </div>
                  {id && (
                    <>
                      <div className="w-px h-4 bg-amber-100"/>
                      <span className="text-[10px] text-slate-400">
                        Next save → <strong className="text-amber-600">v{(parseInt(watch('version') || 1) + 1)}</strong>
                      </span>
                    </>
                  )}
                  {!id && (
                    <span className="text-[10px] text-slate-400">
                      First save creates <strong className="text-amber-600">v1</strong>
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400">
                  ⚠️ Version cannot be set manually — this ensures document integrity (FR-006).
                </p>
              </div>

              {/* ── Active / Archived status ───────────────────────── */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Template Status</span>
                  <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">FR-007</span>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" {...register('is_active')}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Active</p>
                    <p className="text-[10px] text-slate-400">Archived templates cannot generate new documents</p>
                  </div>
                </label>
              </div>

            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-[#e8eaf0] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Live Preview
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                  Sample Data
                </span>
              </div>

              {/* A4 paper */}
              <div className="mx-auto bg-white shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
                style={{ width: '100%', minHeight: '420px', borderRadius: '2px' }}>

                {/* PDF Header bar */}
                <div style={{
                  background: 'linear-gradient(90deg, #1e3a5f 0%, #2f5496 100%)',
                  padding: '8px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>
                    {watch('name') || 'DOCUMENT TITLE'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '8px', fontFamily: 'Inter, sans-serif' }}>
                    {SAMPLE.generation_date}
                  </span>
                </div>

                {/* Document content */}
                <div style={{ padding: '20px 24px', fontFamily: 'Inter, Arial, sans-serif', fontSize: '11px', lineHeight: '1.7', color: '#1a1a1a', minHeight: '340px' }}>
                  {logoPreview && (
                    <img src={logoPreview.startsWith('http') || logoPreview.startsWith('data:') || logoPreview.startsWith('blob:')
                      ? logoPreview
                      : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${logoPreview.replace(/^\//, '')}`}
                      alt="logo"
                      style={{ maxHeight: '44px', maxWidth: '160px', objectFit: 'contain', marginBottom: '10px' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}

                  {headerHtml && headerHtml !== '<p></p>' && (
                    <div style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: '8px', marginBottom: '12px' }}
                      dangerouslySetInnerHTML={{ __html: renderPreview(headerHtml) }}/>
                  )}

                  {bodyHtml && bodyHtml !== '<p></p>'
                    ? <div dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml) }}/>
                    : <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '10px', textAlign: 'center', padding: '40px 0' }}>
                        Start writing in the Body editor to see the preview here
                      </div>
                  }

                  {footerHtml && footerHtml !== '<p></p>' && (
                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '14px', paddingTop: '8px', fontSize: '10px', color: '#6b7280' }}
                      dangerouslySetInnerHTML={{ __html: renderPreview(footerHtml) }}/>
                  )}
                </div>

                {/* PDF Footer bar */}
                <div style={{
                  borderTop: '1px solid #e5e7eb',
                  padding: '6px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f9fafb',
                }}>
                  <span style={{ fontSize: '7px', color: '#9ca3af', fontFamily: 'monospace' }}>
                    DOC-20260820-XXXXX
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '7px', color: '#9ca3af', fontFamily: 'Inter, sans-serif' }}>
                      Page 1 of 1
                    </span>
                    <div style={{ width: '24px', height: '24px', background: '#e5e7eb', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '6px', color: '#9ca3af' }}>QR</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark indicator */}
              {watchedWatermark && (
                <div className="mt-2 text-center text-[10px] text-slate-500">
                  Watermark: <span className="font-bold text-red-500">{watchedWatermark}</span>
                </div>
              )}

              {/* Legend */}
              <div className="mt-3 space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Colour legend</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { color: '#dbeafe', textColor: '#1e40af', label: 'Matched data' },
                    { color: '#fef9c3', textColor: '#854d0e', label: 'Unresolved field' },
                    { color: '#f0fdf4', textColor: '#15803d', label: '{{#if}} block' },
                    { color: '#fff7ed', textColor: '#c2410c', label: '{{#each}} loop' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <span style={{ background: l.color, color: l.textColor, fontSize: '8px', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                        {l.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}
