import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { FileImage, FileSpreadsheet, Download, RefreshCw, CheckCircle2, Hash, FileEdit } from 'lucide-react';

interface NameMapping {
  oldName: string;
  newName: string;
}

interface MatchedFile {
  originalFile: File;
  originalName: string;
  newName: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'numbering' | 'renaming'>('numbering');
  
  // --- States for Renaming (Step 2) ---
  const [images, setImages] = useState<File[]>([]);
  const [mappings, setMappings] = useState<NameMapping[]>([]);
  const [matchedFiles, setMatchedFiles] = useState<MatchedFile[]>([]);
  
  // --- States for Numbering (Step 1) ---
  const [numberingImages, setNumberingImages] = useState<File[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const numberingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (images.length > 0 && mappings.length > 0) {
      matchFiles(images, mappings);
    }
  }, [images, mappings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(Array.from(e.target.files));
  };
  
  const handleNumberingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setNumberingImages(Array.from(e.target.files));
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const newMappings: NameMapping[] = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row && row.length >= 2 && row[0] != null && row[1] != null) {
          newMappings.push({
            oldName: String(row[0]).trim(),
            newName: String(row[1]).trim()
          });
        }
      }
      setMappings(newMappings);
    } catch (error) {
      console.error("Error reading Excel file:", error);
      alert("حدث خطأ أثناء قراءة ملف الإكسيل.");
    }
  };

  const matchFiles = (currentImages: File[], currentMappings: NameMapping[]) => {
    const matched: MatchedFile[] = [];
    currentImages.forEach(file => {
      const originalName = file.name;
      const lastDotIndex = originalName.lastIndexOf('.');
      const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
      const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';

      let match = currentMappings.find(m => m.oldName === baseName || m.oldName === originalName);
      
      if (!match) {
        const baseNumMatch = baseName.match(/\d+/);
        if (baseNumMatch) {
          const baseNum = parseInt(baseNumMatch[0], 10);
          match = currentMappings.find(m => {
            const mNumMatch = m.oldName.match(/\d+/);
            return mNumMatch ? parseInt(mNumMatch[0], 10) === baseNum : false;
          });
        }
      }
      
      if (match) {
        matched.push({ originalFile: file, originalName, newName: `${match.newName}${extension}` });
      }
    });
    setMatchedFiles(matched);
  };

  const generateRenamedZip = async () => {
    if (matchedFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      matchedFiles.forEach(item => zip.file(item.newName, item.originalFile));
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'الصور_المعنونة.zip');
    } catch (error) {
      alert("حدث خطأ أثناء إنشاء الملف المضغوط.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateNumberedZip = async () => {
    if (numberingImages.length === 0) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      numberingImages.forEach((file, index) => {
        const lastDotIndex = file.name.lastIndexOf('.');
        const extension = lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : '.jpg';
        zip.file(`${index + 1}${extension}`, file);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'الصور_المرقمة.zip');
      // Suggest moving to step 2 automatically
      alert('تم تحميل الصور المرقمة بنجاح! يمكنك الآن إنتاج الإكسيل ثم التوجه لعلامة التبويب الثانية.');
      setActiveTab('renaming');
    } catch (error) {
      alert("حدث خطأ أثناء إنشاء الملف المضغوط.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>إدارة وتسمية الصور الذكية</h1>
        <p>قم بترقيم صورك العشوائية أولاً، ثم اربطها بالأسماء الحقيقية بكل سهولة</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
        <button 
          onClick={() => setActiveTab('numbering')}
          style={{
            padding: '1rem 2rem', border: 'none', borderRadius: '12px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 600, fontFamily: 'Cairo',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: activeTab === 'numbering' ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'numbering' ? 'white' : 'var(--text-muted)'
          }}
        >
          <Hash />
          الخطوة 1: ترقيم الصور
        </button>
        <button 
          onClick={() => setActiveTab('renaming')}
          style={{
            padding: '1rem 2rem', border: 'none', borderRadius: '12px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 600, fontFamily: 'Cairo',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: activeTab === 'renaming' ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'renaming' ? 'white' : 'var(--text-muted)'
          }}
        >
          <FileEdit />
          الخطوة 2: تغيير الأسماء بملف الإكسيل
        </button>
      </div>

      {activeTab === 'numbering' ? (
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div 
            className={`drop-zone ${numberingImages.length > 0 ? 'success' : ''}`}
            onClick={() => numberingInputRef.current?.click()}
            style={{ maxWidth: '600px', margin: '0 auto' }}
          >
            <input type="file" multiple accept="image/*" ref={numberingInputRef} onChange={handleNumberingUpload} className="hidden-input" />
            {numberingImages.length > 0 ? (
              <>
                <CheckCircle2 />
                <h3>{numberingImages.length} صورة جاهزة</h3>
                <p>مستعدون لتحويل أسمائهم إلى 1, 2, 3...</p>
              </>
            ) : (
              <>
                <FileImage />
                <h3>ارفع صورك العشوائية هنا</h3>
                <p>الاضغط لاختيار جميع الصور التي تود ترتيبها</p>
              </>
            )}
          </div>

          {numberingImages.length > 0 && (
            <div className="actions">
              <button className="btn" onClick={generateNumberedZip} disabled={isProcessing}>
                {isProcessing ? <><RefreshCw className="loading-spinner" /> جاري المعالجة...</> : <><Download /> تحويل الصور وتحميلها مرقمة (ZIP)</>}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="drop-zones">
            <div className={`drop-zone ${images.length > 0 ? 'success' : ''}`} onClick={() => imageInputRef.current?.click()}>
              <input type="file" multiple accept="image/*" ref={imageInputRef} onChange={handleImageUpload} className="hidden-input" />
              {images.length > 0 ? (
                <> <CheckCircle2 /> <h3>{images.length} صورة مرقمة جاهزة</h3> </>
              ) : (
                <> <FileImage /> <h3>1. ارفع الصور المرقمة</h3> <p>الصور التي تم ترقيمها مسبقاً</p> </>
              )}
            </div>

            <div className={`drop-zone ${mappings.length > 0 ? 'success' : ''}`} onClick={() => excelInputRef.current?.click()}>
              <input type="file" accept=".xlsx, .xls, .csv" ref={excelInputRef} onChange={handleExcelUpload} className="hidden-input" />
              {mappings.length > 0 ? (
                <> <CheckCircle2 /> <h3>تم قراءة {mappings.length} اسم</h3> </>
              ) : (
                <> <FileSpreadsheet /> <h3>2. ارفع ملف الإكسيل</h3> <p>العمود الأول: الرقم، والثاني: الاسم</p> </>
              )}
            </div>
          </div>

          {matchedFiles.length === 0 && images.length > 0 && mappings.length > 0 && (
            <div className="preview-section" style={{ border: '1px solid var(--danger)', padding: '2rem', borderRadius: '16px' }}>
              <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>لم نتمكن من مطابقة الأسماء ⚠️</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'right' }}>
                <div>
                  <h3 style={{ color: 'var(--primary-color)' }}>الصور المرفوعة (أول 5):</h3>
                  <ul>{images.slice(0, 5).map((img, i) => <li key={i}>{img.name}</li>)}</ul>
                </div>
                <div>
                  <h3 style={{ color: 'var(--primary-color)' }}>بيانات الإكسيل (أول 5):</h3>
                  <ul>{mappings.slice(0, 5).map((m, i) => <li key={i}>الرقم: <strong>{m.oldName}</strong> → الاسم: <strong>{m.newName}</strong></li>)}</ul>
                </div>
              </div>
            </div>
          )}

          {matchedFiles.length > 0 && (
            <div className="preview-section">
              <div className="preview-header">
                <h2>معاينة النتائج</h2>
                <span className="badge">{matchedFiles.length} متطابق</span>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>الرقم الأصلي</th><th>الاسم النهائي للصورة</th></tr></thead>
                  <tbody>{matchedFiles.slice(0, 50).map((file, i) => <tr key={i}><td>{file.originalName}</td><td className="highlight">{file.newName}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="actions">
                <button className="btn" onClick={generateRenamedZip} disabled={isProcessing}>
                  {isProcessing ? <><RefreshCw className="loading-spinner" /> جاري المعالجة...</> : <><Download /> تحميل جميع الصور بأسماءها الحقيقية</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
