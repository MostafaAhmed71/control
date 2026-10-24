// Robust grade key extractor — works regardless of "ال" prefix or shorthand
export const toGradeKey = (text = '') => {
  if (!text) return '';

  // 1. Basic normalization
  let s = String(text)
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/١/g, '1').replace(/٢/g, '2').replace(/٣/g, '3')
    .replace(/٤/g, '4').replace(/٥/g, '5').replace(/٦/g, '6')
    .replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9').replace(/٠/g, '0')
    .replace(/\s+/g, ' ').trim();

  // 2. Handle pure shorthand (1م, 2ث, 3ب etc.)
  const noSpace = s.replace(/\s/g, '');
  const shorthandMap = {
    '1م': '1متوسط', '2م': '2متوسط', '3م': '3متوسط',
    '1ث': '1ثانوي',  '2ث': '2ثانوي',  '3ث': '3ثانوي',
    '1ب': '1ابتدائي','2ب': '2ابتدائي','3ب': '3ابتدائي',
    '4ب': '4ابتدائي','5ب': '5ابتدائي','6ب': '6ابتدائي',
  };
  if (shorthandMap[noSpace]) return shorthandMap[noSpace];

  // 3. Word-level analysis — remove "ال" from the start of each word
  const words = s.split(' ').map(w => w.startsWith('ال') ? w.slice(2) : w).filter(Boolean);

  // 4. Map ordinal words → number
  const ordinalMap = {
    'اول': 1, 'اولى': 1, '1': 1,
    'ثاني': 2, 'ثانيه': 2, 'ثان': 2, '2': 2,
    'ثالث': 3, 'ثالثه': 3, '3': 3,
    'رابع': 4, 'رابعه': 4, '4': 4,
    'خامس': 5, 'خامسه': 5, '5': 5,
    'سادس': 6, 'سادسه': 6, '6': 6,
  };

  // 5. Map stage words → canonical stage name
  const stageMap = {
    'ابتدائي': 'ابتدائي', 'ابتدائيه': 'ابتدائي',
    'متوسط': 'متوسط', 'متوسطه': 'متوسط',
    'ثانوي': 'ثانوي', 'ثانويه': 'ثانوي',
  };

  let num = null;
  let stage = null;

  for (const w of words) {
    if (ordinalMap[w] !== undefined && num === null) num = ordinalMap[w];
    if (stageMap[w] && !stage) stage = stageMap[w];
  }

  // Also try numeric prefix directly in the original (for "3م"-style missed above)
  if (num === null) {
    const numMatch = noSpace.match(/^([1-6])/);
    if (numMatch) num = parseInt(numMatch[1]);
  }

  if (num !== null && stage) return `${num}${stage}`;

  // 6. Fallback: just return cleaned no-space lowercase
  return noSpace.toLowerCase();
};

export const isLevelMatch = (v1, v2) => {
  if (!v1 || !v2) return false;
  if (v1 === 'All' || v2 === 'All') return true;
  return toGradeKey(v1) === toGradeKey(v2);
};
