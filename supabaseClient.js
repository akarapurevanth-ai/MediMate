// MediMate — Supabase Integration Client
// This file initializes the Supabase client using your Project URL and public anon key.
// Row-Level Security (RLS) ensures users can only access their own private medical records.

const SUPABASE_PROJECT_URL = 'https://ztyuofxqhjotdzaybgwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0eXVvZnhxaGpvdGR6YXliZ3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjQxODAsImV4cCI6MjEwNzIwMDE4MH0.nCv1TuHr46UlfYyn86GP4Sh0wkUUOSHLzWTyN_TazmE';

// Create Supabase client instance
const supabase = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Expose globally for convenience
if (typeof window !== 'undefined') {
  window.mediMateSupabase = supabase;
}

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

async function authSignUp(email, password, name) {
  if (!supabase) return { error: { message: 'Supabase client not loaded' } };
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || 'User',
        reminderVoice: 'standard',
        language: 'English',
        notifications: true,
        seniorMode: false
      }
    }
  });
}

async function authSignIn(email, password) {
  if (!supabase) return { error: { message: 'Supabase client not loaded' } };
  return await supabase.auth.signInWithPassword({
    email,
    password
  });
}

async function authSignOut() {
  if (!supabase) return { error: { message: 'Supabase client not loaded' } };
  return await supabase.auth.signOut();
}

async function authResetPassword(email) {
  if (!supabase) return { error: { message: 'Supabase client not loaded' } };
  return await supabase.auth.resetPasswordForEmail(email);
}

async function authGetSession() {
  if (!supabase) return { data: { session: null } };
  return await supabase.auth.getSession();
}

function authOnStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================================
// MEDICATIONS DATABASE HELPERS
// ============================================================

async function dbFetchMedications(userId) {
  if (!supabase) return { data: [], error: null };
  let uid = userId;
  if (!uid) {
    const { data: sData } = await supabase.auth.getSession();
    uid = sData?.session?.user?.id;
  }
  if (!uid) return { data: [], error: { message: 'Not authenticated' } };

  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  // Map database columns to MediMate frontend format
  const mapped = (data || []).map(row => ({
    id: row.id,
    name: row.medicine_name || '',
    strength: row.strength || '',
    form: row.form || 'Tablet',
    dose: row.dosage || '',
    instructions: row.instructions || '',
    times: Array.isArray(row.times) && row.times.length ? row.times : (row.scheduled_time ? [String(row.scheduled_time).slice(0, 5)] : ['08:00']),
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    food: row.food || 'any',
    doctor: row.doctor || '',
    notes: row.notes || '',
    status: row.status || 'active'
  }));

  return { data: mapped, error: null };
}

async function dbSaveMedication(med, userId, isEdit = false) {
  if (!supabase || !userId) return { data: null, error: { message: 'Not authenticated' } };

  const row = {
    user_id: userId,
    medicine_name: med.name || '',
    strength: med.strength || '',
    form: med.form || 'Tablet',
    dosage: med.dose || '',
    instructions: med.instructions || '',
    times: Array.isArray(med.times) && med.times.length ? med.times : ['08:00'],
    scheduled_time: (med.times && med.times[0]) ? med.times[0] : '08:00',
    start_date: med.startDate || new Date().toISOString().slice(0, 10),
    end_date: med.endDate || null,
    food: med.food || 'any',
    doctor: med.doctor || '',
    notes: med.notes || '',
    status: med.status || 'active'
  };

  const isExistingUuid = med.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(med.id);

  if (isEdit && isExistingUuid) {
    return await supabase
      .from('medications')
      .update(row)
      .eq('id', med.id)
      .eq('user_id', userId)
      .select();
  } else {
    return await supabase
      .from('medications')
      .insert([row])
      .select();
  }
}

async function dbDeleteMedication(id, userId) {
  if (!supabase) return { error: null };
  let query = supabase.from('medications').delete().eq('id', id);
  if (userId) {
    query = query.eq('user_id', userId);
  }
  return await query;
}

async function dbToggleMedicationStatus(id, currentStatus, userId) {
  if (!supabase) return { error: null };
  const nextStatus = currentStatus === 'active' ? 'completed' : 'active';
  let query = supabase.from('medications').update({ status: nextStatus }).eq('id', id);
  if (userId) {
    query = query.eq('user_id', userId);
  }
  return await query;
}

// ============================================================
// REMINDER HISTORY DATABASE HELPERS
// ============================================================

async function dbFetchReminderHistory(userId) {
  if (!supabase) return { data: [], error: null };
  let uid = userId;
  if (!uid) {
    const { data: sData } = await supabase.auth.getSession();
    uid = sData?.session?.user?.id;
  }
  if (!uid) return { data: [], error: null };

  const { data, error } = await supabase
    .from('reminder_history')
    .select('*')
    .eq('user_id', uid)
    .order('scheduled_at', { ascending: false })
    .limit(50);

  if (error) return { data: [], error };

  const mapped = (data || []).map(row => ({
    id: row.id,
    medId: row.medication_id,
    medName: row.med_name || 'Medicine',
    scheduledAt: row.scheduled_at,
    status: row.status,
    confirmedAt: row.confirmed_at,
    snoozeUntil: row.snooze_until
  }));

  return { data: mapped, error: null };
}

async function dbAddReminderRecord(userId, medId, medName, scheduledAt) {
  if (!supabase || !userId) return { data: null, error: null };

  const isExistingUuid = medId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(medId);
  const row = {
    user_id: userId,
    medication_id: isExistingUuid ? medId : null,
    med_name: medName || 'Medicine',
    scheduled_at: scheduledAt || new Date().toISOString(),
    status: 'pending'
  };

  return await supabase
    .from('reminder_history')
    .insert([row])
    .select();
}

async function dbConfirmReminder(reminderId, confirmedAt, userId) {
  if (!supabase) return { error: null };
  const isExistingUuid = reminderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reminderId);
  if (!isExistingUuid) return { error: null };

  let query = supabase
    .from('reminder_history')
    .update({
      status: 'confirmed',
      confirmed_at: confirmedAt || new Date().toISOString()
    })
    .eq('id', reminderId);

  if (userId) query = query.eq('user_id', userId);
  return await query;
}

async function dbSnoozeReminder(reminderId, minutes, userId) {
  if (!supabase) return { error: null };
  const isExistingUuid = reminderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reminderId);
  if (!isExistingUuid) return { error: null };

  const snoozeTime = new Date(Date.now() + minutes * 60000).toISOString();
  let query = supabase
    .from('reminder_history')
    .update({
      status: 'snoozed',
      snooze_until: snoozeTime
    })
    .eq('id', reminderId);

  if (userId) query = query.eq('user_id', userId);
  return await query;
}

async function dbMissReminder(reminderId, userId) {
  if (!supabase) return { error: null };
  const isExistingUuid = reminderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reminderId);
  if (!isExistingUuid) return { error: null };

  let query = supabase
    .from('reminder_history')
    .update({
      status: 'missed'
    })
    .eq('id', reminderId);

  if (userId) query = query.eq('user_id', userId);
  return await query;
}

// ============================================================
// MEDICAL RECORDS DATABASE HELPERS
// ============================================================

async function dbFetchMedicalRecords(userId) {
  if (!supabase) return { data: [], error: null };
  let uid = userId;
  if (!uid) {
    const { data: sData } = await supabase.auth.getSession();
    uid = sData?.session?.user?.id;
  }
  if (!uid) return { data: [], error: null };

  const { data, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  const mapped = (data || []).map(row => ({
    id: row.id,
    name: row.name || 'Document',
    category: row.category || 'General',
    dataUrl: row.data_url || '',
    size: row.file_size || '',
    date: row.created_at || new Date().toISOString()
  }));

  return { data: mapped, error: null };
}

async function dbSaveMedicalRecord(doc, userId) {
  if (!supabase || !userId) return { data: null, error: { message: 'Not authenticated' } };
  const row = {
    user_id: userId,
    name: doc.name || 'Document',
    category: doc.category || 'General',
    data_url: doc.dataUrl || '',
    file_size: doc.size || ''
  };
  return await supabase.from('medical_records').insert([row]).select();
}

async function dbDeleteMedicalRecord(id, userId) {
  if (!supabase) return { error: null };
  let query = supabase.from('medical_records').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  return await query;
}

// ============================================================
// CAREGIVERS DATABASE HELPERS
// ============================================================

async function dbFetchCaregivers(userId) {
  if (!supabase) return { data: [], error: null };
  let uid = userId;
  if (!uid) {
    const { data: sData } = await supabase.auth.getSession();
    uid = sData?.session?.user?.id;
  }
  if (!uid) return { data: [], error: null };

  const { data, error } = await supabase
    .from('caregivers')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  const mapped = (data || []).map(row => ({
    id: row.id,
    email: row.email || '',
    perms: row.permissions || { schedule: true, confirmed: true, missed: true, instructions: true, docs: false, adherence: true },
    status: row.status || 'invited'
  }));

  return { data: mapped, error: null };
}

async function dbSaveCaregiver(cg, userId) {
  if (!supabase || !userId) return { data: null, error: { message: 'Not authenticated' } };
  const row = {
    user_id: userId,
    email: cg.email || '',
    permissions: cg.perms || { schedule: true, confirmed: true, missed: true, instructions: true, docs: false, adherence: true },
    status: cg.status || 'invited'
  };
  return await supabase.from('caregivers').insert([row]).select();
}

async function dbUpdateCaregiver(id, updates, userId) {
  if (!supabase) return { error: null };
  const row = {};
  if (updates.perms) row.permissions = updates.perms;
  if (updates.status) row.status = updates.status;

  let query = supabase.from('caregivers').update(row).eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  return await query;
}

async function dbDeleteCaregiver(id, userId) {
  if (!supabase) return { error: null };
  let query = supabase.from('caregivers').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  return await query;
}

// ============================================================
// FAVOURITE VOICES DATABASE HELPERS
// ============================================================

async function dbFetchVoices(userId) {
  if (!supabase) return { data: [], error: null };
  let uid = userId;
  if (!uid) {
    const { data: sData } = await supabase.auth.getSession();
    uid = sData?.session?.user?.id;
  }
  if (!uid) return { data: [], error: null };

  const { data, error } = await supabase
    .from('favourite_voices')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  const mapped = (data || []).map(row => ({
    id: row.id,
    label: row.label || '',
    dataUrl: row.data_url || ''
  }));

  return { data: mapped, error: null };
}

async function dbSaveVoice(voice, userId) {
  if (!supabase || !userId) return { data: null, error: { message: 'Not authenticated' } };
  const row = {
    user_id: userId,
    label: voice.label || 'Voice',
    data_url: voice.dataUrl || ''
  };
  return await supabase.from('favourite_voices').insert([row]).select();
}

async function dbDeleteVoice(id, userId) {
  if (!supabase) return { error: null };
  let query = supabase.from('favourite_voices').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  return await query;
}

// ============================================================
// PROFILE & PREFERENCES HELPERS
// ============================================================

async function dbFetchProfile(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return { data, error };
}

async function dbSaveProfile(userId, profileData) {
  if (!supabase || !userId) return { data: null, error: null };
  const row = {
    id: userId,
    name: profileData.name || 'User',
    reminder_prefs: profileData.prefs || { reminderVoice: 'standard', language: 'English', notifications: true, seniorMode: false }
  };
  return await supabase.from('profiles').upsert(row).select();
}

// Export functions to global scope for index.html
if (typeof window !== 'undefined') {
  window.MediMateDB = {
    supabase,
    authSignUp,
    authSignIn,
    authSignOut,
    authResetPassword,
    authGetSession,
    authOnStateChange,
    dbFetchMedications,
    dbSaveMedication,
    dbDeleteMedication,
    dbToggleMedicationStatus,
    dbFetchReminderHistory,
    dbAddReminderRecord,
    dbConfirmReminder,
    dbSnoozeReminder,
    dbMissReminder,
    dbFetchMedicalRecords,
    dbSaveMedicalRecord,
    dbDeleteMedicalRecord,
    dbFetchCaregivers,
    dbSaveCaregiver,
    dbUpdateCaregiver,
    dbDeleteCaregiver,
    dbFetchVoices,
    dbSaveVoice,
    dbDeleteVoice,
    dbFetchProfile,
    dbSaveProfile
  };
}
