/**
 * Supabase Client & API Service
 * Foresee Technology CCTV Service
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://urzrfdkpeakvhalbtmpv.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// -------------------------------------------------------------
// 1. INITIAL DATA FETCH
// -------------------------------------------------------------
export async function fetchInitialData() {
  try {
    const [techsRes, tasksRes, checkinsRes] = await Promise.all([
      supabase.from('technicians').select('*').order('name'),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('checkins').select('*').order('created_at', { ascending: false })
    ]);

    let technicians = [];
    if (techsRes.data && techsRes.data.length > 0) {
      technicians = techsRes.data.map(t => t.name);
    }

    let tasks = [];
    if (tasksRes.data && Array.isArray(tasksRes.data)) {
      tasks = tasksRes.data.map(t => ({
        id: t.id,
        title: t.title,
        desc: t.description || '-',
        category: t.category || 'ติดตั้งงานใหม่',
        priority: t.priority || 'ปกติ',
        location: t.location || '-',
        techs: t.techs || [],
        startDate: t.start_date || '',
        deadline: t.deadline || '-',
        status: t.status || 'รอดำเนินการ',
        progress: t.progress || 0,
        latestUpdate: t.latest_update || 'ยังไม่มีอัปเดต',
        customer: t.customer || {},
        oldDeadline: t.old_deadline || '-',
        reason: t.extend_reason || '-',
        updateBy: t.updated_by || '-'
      }));
    }

    let activeCheckins = [];
    let closedCheckins = [];

    if (checkinsRes.data && Array.isArray(checkinsRes.data)) {
      checkinsRes.data.forEach(c => {
        const item = {
          id: c.id,
          taskId: c.task_id || null,
          task: c.task_title,
          techs: c.techs || [],
          time: c.checkin_time || '09:00',
          outTime: c.checkout_time || '-',
          duration: c.duration || '-',
          status: c.status,
          outcome: c.outcome || '',
          note: c.note || '',
          photos: c.photos || [],
          progress: c.progress || 0,
          date: new Date(c.created_at).toLocaleDateString('th-TH')
        };

        if (c.status === 'กำลังทำ' || c.status === 'กำลังปฏิบัติงาน') {
          activeCheckins.push(item);
        } else {
          closedCheckins.push(item);
        }
      });
    }

    return {
      technicians,
      tasks,
      activeCheckins,
      closedCheckins
    };
  } catch (err) {
    console.warn("fetchInitialData error from Supabase:", err);
    return null;
  }
}

// -------------------------------------------------------------
// 2. REALTIME SUBSCRIPTION
// -------------------------------------------------------------
export function subscribeToRealtimeChanges({ onTasksChange, onCheckinsChange, onTechsChange }) {
  const channel = supabase
    .channel('public_db_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
      console.log('Realtime task update:', payload);
      if (onTasksChange) onTasksChange(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, (payload) => {
      console.log('Realtime checkin update:', payload);
      if (onCheckinsChange) onCheckinsChange(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, (payload) => {
      console.log('Realtime technician update:', payload);
      if (onTechsChange) onTechsChange(payload);
    })
    .subscribe();

  return channel;
}

// -------------------------------------------------------------
// 3. STORAGE UPLOAD (PHOTOS)
// -------------------------------------------------------------
export async function uploadPhotoToSupabase(base64Data, filename) {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${(filename || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `uploads/${safeName}`;

    const { data, error } = await supabase.storage
      .from('work-photos')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn("Storage upload error:", error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('work-photos')
      .getPublicUrl(filePath);

    return publicUrlData ? publicUrlData.publicUrl : null;
  } catch (err) {
    console.warn("uploadPhotoToSupabase exception:", err);
    return null;
  }
}

// -------------------------------------------------------------
// 4. TASKS API
// -------------------------------------------------------------
export async function saveTaskApi(task) {
  try {
    const payload = {
      id: task.id,
      title: task.title,
      description: task.desc || '-',
      category: task.category || 'ติดตั้งงานใหม่',
      priority: task.priority || 'ปกติ',
      location: task.location || '-',
      techs: Array.isArray(task.techs) ? task.techs : [],
      start_date: task.startDate || '',
      deadline: task.deadline || '-',
      status: task.status || 'รอดำเนินการ',
      progress: task.progress || 0,
      latest_update: task.latestUpdate || 'ยังไม่มีอัปเดต',
      customer: task.customer || {},
      updated_by: task.updateBy || 'แอดมิน',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('tasks')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn("saveTaskApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteTaskApi(id) {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, id };
  } catch (err) {
    console.warn("deleteTaskApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function updateTaskProgressApi({ taskId, taskTitle, progress, status, note, updateBy, updateEntry, photos = [] }) {
  try {
    // 1. Upload photos to Supabase Storage if provided
    let photoUrls = [];
    if (photos && photos.length > 0) {
      for (const p of photos) {
        if (p.base64) {
          const url = await uploadPhotoToSupabase(p.base64, p.name);
          if (url) photoUrls.push(url);
        }
      }
    }

    // 2. Update task in database
    const updateData = {
      progress: progress,
      status: status,
      latest_update: updateEntry || `[คืบหน้า ${progress}%: ${status}] ${note || ''} (โดย ${updateBy})`,
      updated_by: updateBy,
      updated_at: new Date().toISOString()
    };

    let query = supabase.from('tasks').update(updateData);
    if (taskId) {
      query = query.eq('id', taskId);
    } else if (taskTitle) {
      query = query.eq('title', taskTitle);
    }

    const { error } = await query;
    if (error) throw error;

    return { success: true, photoUrls };
  } catch (err) {
    console.warn("updateTaskProgressApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function extendTaskDeadlineApi({ taskId, newDeadline, oldDeadline, reason, updateBy }) {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        deadline: newDeadline,
        old_deadline: oldDeadline,
        extend_reason: reason,
        updated_by: updateBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("extendTaskDeadlineApi error:", err);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// 5. CHECK-INS / CHECK-OUTS API
// -------------------------------------------------------------
export async function saveCheckinApi(data) {
  try {
    const payload = {
      id: data.id,
      task_id: data.taskId || null,
      task_title: data.task,
      techs: Array.isArray(data.techs) ? data.techs : [data.techs],
      job_type: data.jobType || 'ติดตั้งกล้องวงจรปิด',
      location: data.locationText || '-',
      coords: data.coords ? `${data.coords.lat}, ${data.coords.lng}` : '',
      map_url: data.mapUrl || '',
      checkin_time: data.time,
      status: 'กำลังทำ',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('checkins')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (err) {
    console.warn("saveCheckinApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function saveCheckoutApi(payload) {
  try {
    const { error } = await supabase
      .from('checkins')
      .update({
        checkout_time: payload.outTime,
        duration: payload.duration,
        outcome: payload.outcome,
        note: payload.note || '',
        status: 'เสร็จสิ้น',
        closer_name: payload.closerName || '',
        photos: payload.photoUrls || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.id);

    if (error) throw error;
    return { success: true, id: payload.id };
  } catch (err) {
    console.warn("saveCheckoutApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteCheckinApi(id) {
  try {
    const { error } = await supabase
      .from('checkins')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, id };
  } catch (err) {
    console.warn("deleteCheckinApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function clearAllCheckinsApi() {
  try {
    const { error } = await supabase
      .from('checkins')
      .delete()
      .neq('id', '___NEVER_MATCH___');

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("clearAllCheckinsApi error:", err);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// 6. TECHNICIANS API
// -------------------------------------------------------------
export async function addNewTechnicianApi(name) {
  try {
    const { error } = await supabase
      .from('technicians')
      .insert({ name });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("addNewTechnicianApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteTechnicianApi(name) {
  try {
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('name', name);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("deleteTechnicianApi error:", err);
    return { success: false, error: err.message };
  }
}
