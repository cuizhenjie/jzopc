'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { useId } from 'react';

/**
 * 富文本编辑器（tiptap v3，全后台共用）。
 *
 * - 数据形态：HTML 字符串（body_html 列）；编辑存量「一段一行」数据时，
 *   由使用方把段落数组拼成 <p> HTML 传入；
 * - SSR 安全：immediatelyRender: false，服务端只输出占位框；
 * - 工具栏覆盖运营日常：标题/加粗/斜体/下划线/删除线/引用/有序无序列表/
 *   链接/图片/撤销重做；清空格式兜底。
 *
 * 注意：图片/链接都要求 https?:// 开头，防止 javascript: 注入；
 *   输出在**前台渲染时**仍统一过 sanitize-html（纵深防御，存储不等于可信）。
 */

function promptUrl(type: 'link' | 'image'): string | null {
  const hint = type === 'link' ? '链接地址（https://…）' : '图片地址（https://…）';
  const url = window.prompt(hint);
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    window.alert('仅支持 http(s) 链接');
    return null;
  }
  return trimmed;
}

function ToolbarButton({
  editor,
  label,
  title,
  onClick,
  active,
  disabled,
}: {
  editor: Editor;
  label: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-[var(--color-brand-navy)] text-white'
          : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand-navy)]'
      }`}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '输入正文……支持标题 / 加粗 / 列表 / 引用 / 链接 / 图片',
  minHeight = 320,
}: {
  /** 初始 HTML（仅挂载时生效；切换编辑对象请给父组件换 key） */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editorId = useId();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'rte-prose',
        'data-editor-id': editorId,
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  if (!editor) {
    return (
      <div
        className="rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-ink-3)]"
        style={{ minHeight }}
      >
        编辑器加载中…
      </div>
    );
  }

  const btn = (
    label: React.ReactNode,
    title: string,
    onClick: () => void,
    active?: boolean,
    disabled?: boolean,
  ) => (
    <ToolbarButton key={title} editor={editor} label={label} title={title} onClick={onClick} active={active} disabled={disabled} />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white focus-within:border-[var(--color-brand-blue)]">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5">
        {btn('↶', '撤销', () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {btn('↷', '重做', () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
        {btn('H2', '二级标题', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('H3', '三级标题', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
        {btn(<b>B</b>, '加粗', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn(<i>I</i>, '斜体', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn(<u>U</u>, '下划线', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
        {btn(<s>S</s>, '删除线', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
        {btn('❝', '引用', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        {btn('• 列表', '无序列表', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('1. 列表', '有序列表', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
        {btn('🔗', '链接', () => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = promptUrl('link');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }, editor.isActive('link'))}
        {btn('🖼', '图片', () => {
          const url = promptUrl('image');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        })}
        {btn('⌫格式', '清除格式', () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
      </div>

      {/* 编辑区 */}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="rte-scope px-4 py-3"
      />
    </div>
  );
}
