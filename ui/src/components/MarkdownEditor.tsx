import { useMemo, useRef, useState } from 'react'
import { marked } from 'marked'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

interface InsertResult {
  text: string
  selStart: number
  selEnd: number
}

type Tab = 'raw' | 'preview'

function MarkdownEditor({ value, onChange, rows = 10, placeholder }: MarkdownEditorProps) {
  const [tab, setTab] = useState<Tab>('raw')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const previewHtml = useMemo(() => {
    try {
      return marked.parse(value, { gfm: true, breaks: true, async: false }) as string
    } catch {
      return ''
    }
  }, [value])

  function applyInline(make: (selected: string) => InsertResult) {
    const textarea = textareaRef.current
    if (textarea === null) {
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end)
    const result = make(selected)
    onChange(value.slice(0, start) + result.text + value.slice(end))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + result.selStart, start + result.selEnd)
    })
  }

  function applyBlock(marker: string) {
    const textarea = textareaRef.current
    if (textarea === null) {
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextNewline = value.indexOf('\n', end)
    const lineEnd = nextNewline === -1 ? value.length : nextNewline
    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const allMarked = lines.length > 0 && lines.every((line) => line.startsWith(marker))
    const blockOut = lines
      .map((line) => (allMarked ? line.slice(marker.length) : marker + line))
      .join('\n')
    onChange(value.slice(0, lineStart) + blockOut + value.slice(lineEnd))
    const newEnd = lineStart + blockOut.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart, newEnd)
    })
  }

  function applyColor(color: string) {
    applyInline((selected) => {
      const prefix = `<span style="color:${color}">`
      const suffix = '</span>'
      return {
        text: `${prefix}${selected}${suffix}`,
        selStart: prefix.length,
        selEnd: prefix.length + selected.length,
      }
    })
  }

  function applySize(size: string) {
    applyInline((selected) => {
      const prefix = `<span style="font-size:${size}">`
      const suffix = '</span>'
      return {
        text: `${prefix}${selected}${suffix}`,
        selStart: prefix.length,
        selEnd: prefix.length + selected.length,
      }
    })
  }

  function applyLink() {
    const url = window.prompt('Link URL', 'https://')
    if (url === null) {
      return
    }
    applyInline((selected) => {
      const label = selected || 'link text'
      return {
        text: `[${label}](${url})`,
        selStart: 1,
        selEnd: 1 + label.length,
      }
    })
  }

  function applyCodeBlock() {
    applyInline((selected) => {
      const text = `\`\`\`\n${selected}\n\`\`\``
      return {
        text,
        selStart: 4,
        selEnd: 4 + selected.length,
      }
    })
  }

  function applyRule() {
    applyInline(() => {
      const text = '\n\n---\n\n'
      return { text, selStart: text.length, selEnd: text.length }
    })
  }

  function wrap(prefix: string, suffix: string) {
    applyInline((selected) => {
      return {
        text: `${prefix}${selected}${suffix}`,
        selStart: prefix.length,
        selEnd: prefix.length + selected.length,
      }
    })
  }

  return (
    <div className="md-editor">
      <div className="md-editor-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'raw'}
          className={`md-editor-tab${tab === 'raw' ? ' active' : ''}`}
          onClick={() => setTab('raw')}
        >
          Raw
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={`md-editor-tab${tab === 'preview' ? ' active' : ''}`}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
      </div>
      {tab === 'raw' ? (
        <>
          <div className="md-editor-toolbar">
            <button type="button" className="md-editor-tool" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('**', '**')}>
              <strong>B</strong>
            </button>
            <button type="button" className="md-editor-tool" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('*', '*')}>
              <em>I</em>
            </button>
            <button type="button" className="md-editor-tool" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('~~', '~~')}>
              <s>S</s>
            </button>
            <button type="button" className="md-editor-tool" title="Inline code" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('`', '`')}>
              &lt;/&gt;
            </button>
            <button type="button" className="md-editor-tool" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>
              Link
            </button>
            <span className="md-editor-divider" />
            <button type="button" className="md-editor-tool" title="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('## ')}>
              H2
            </button>
            <button type="button" className="md-editor-tool" title="Blockquote" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('> ')}>
              Quote
            </button>
            <button type="button" className="md-editor-tool" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('- ')}>
              • List
            </button>
            <button type="button" className="md-editor-tool" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('1. ')}>
              1. List
            </button>
            <button type="button" className="md-editor-tool" title="Code block" onMouseDown={(e) => e.preventDefault()} onClick={applyCodeBlock}>
              {`</>`}
            </button>
            <button type="button" className="md-editor-tool" title="Horizontal rule" onMouseDown={(e) => e.preventDefault()} onClick={applyRule}>
              —
            </button>
            <span className="md-editor-divider" />
            <label className="md-editor-color" title="Text color">
              <span>A</span>
              <input type="color" defaultValue="#ef4444" onChange={(e) => applyColor(e.target.value)} />
            </label>
            <label className="md-editor-size" title="Text size">
              <span>Size</span>
              <select defaultValue="16px" onChange={(e) => applySize(e.target.value)}>
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="18px">18px</option>
                <option value="24px">24px</option>
                <option value="32px">32px</option>
              </select>
            </label>
          </div>
          <textarea
            ref={textareaRef}
            className="md-editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
          />
        </>
      ) : (
        <div className="md-editor-preview markdown-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      )}
    </div>
  )
}

export default MarkdownEditor