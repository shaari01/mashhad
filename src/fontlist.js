// قائمة الخطوط المدمجة (بيانات فقط، بلا ملفات CSS)
export const FONTS = [
  { id: 'Cairo', label: 'القاهرة', kind: 'حديث' },
  { id: 'Amiri', label: 'الأميري (نسخ)', kind: 'نسخ' },
  { id: 'Aref Ruqaa', label: 'رقعة', kind: 'رقعة' },
  { id: 'Noto Nastaliq Urdu', label: 'نستعليق', kind: 'فارسي', lh: 1.9 },
  { id: 'El Messiri', label: 'المسيري', kind: 'هندسي' },
  { id: 'Reem Kufi', label: 'ريم كوفي', kind: 'كوفي' },
  { id: 'Lalezar', label: 'لاله‌زار', kind: 'عريض', bold: false },
  { id: 'Jomhuria', label: 'جمهورية', kind: 'عريض', bold: false, scale: 1.5 },
];
export const fontInfo = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

