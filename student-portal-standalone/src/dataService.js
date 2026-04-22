import { createClient } from '@supabase/supabase-js';

// Standalone Configuration
const supabaseUrl = 'https://onyycbkxuzztwjnztgtw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXljYmt4dXp6dHdqbnp0Z3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzQ0MzMsImV4cCI6MjA5MTY1MDQzM30.FVpmDl8DClaIZHQcKSQ7OoqpYlUgv36PLdMYEVI2fXI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getOmrResults = async () => {
  const { data, error } = await supabase.from('omr_results').select('*');
  if (error) return [];
  return data.map(item => ({ id: item.id, _rowCreatedAt: item.created_at, ...item.data }));
};

export const getOmrExams = async () => {
  const { data, error } = await supabase.from('omr_exams').select('*');
  if (error) return [];
  return data.map(item => ({ id: item.id, ...item.data }));
};

export const getStudents = async () => {
  const { data, error } = await supabase.from('students').select('*');
  if (error) return [];
  return data.map(item => ({ id: item.id, ...item.data }));
};

export const getAppSettings = async () => {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'app_config').single();
  if (error || !data) return { platformName: 'نظام الكنترول' };
  return data.data;
};
