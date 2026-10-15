// Calendar dates stay as YYYY-MM-DD; exam times use Saudi Arabia's UTC+03:00.
export const isDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const getRetakeRange = (schedule) => ({
  startDate: schedule?.startDate || schedule?.date || '',
  endDate: schedule?.endDate || schedule?.date || '',
});

export const isRetakeDayAllowed = (schedule, day) => {
  const { startDate, endDate } = getRetakeRange(schedule);
  return schedule?.isOpen !== false && isDateKey(startDate) && isDateKey(endDate)
    && isDateKey(day) && startDate <= endDate && day >= startDate && day <= endDate;
};

export const selectedRetakeDate = (schedule, day) => {
  if (!isRetakeDayAllowed(schedule, day)) {
    throw new Error('يرجى اختيار يوم داخل فترة الإعادة المعتمدة والتأكد من فتح استقبال الطلبات.');
  }
  const time = schedule.time || '08:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('وقت الاختبار غير صالح.');
  return `${day}T${time}:00+03:00`;
};
