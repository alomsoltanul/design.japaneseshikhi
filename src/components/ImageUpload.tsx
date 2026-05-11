import { useRef, useState } from 'react'

interface ImageUploadProps {
  bgImage: string | null
  onChange: (img: string | null) => void
}

export function ImageUpload({ bgImage, onChange }: ImageUploadProps) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onChange(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="sec-label">Background / Feature Image</div>
      <div
        className={`img-drop${drag ? ' drag' : ''}${bgImage ? ' has' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]) }}
      >
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]) }} />
        {bgImage
          ? <>
              <div className="img-drop-txt" style={{ color: '#2A9D8F', fontWeight: 700 }}>✓ Image loaded</div>
              <img src={bgImage} className="img-thumb" alt="" />
            </>
          : <>
              <div className="img-drop-icon">🖼</div>
              <div className="img-drop-txt">Click or drag & drop an image<br />Works on Photo BG &amp; Img Card</div>
            </>
        }
      </div>
      {bgImage && (
        <button className="img-clear" onClick={e => { e.stopPropagation(); onChange(null) }}>
          ✕ Remove image
        </button>
      )}
    </div>
  )
}
