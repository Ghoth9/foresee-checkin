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
        progressHistory: t.customer?.progress_history || [],
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
    const now = new Date();
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("th-TH");

    // 1. Process photos into clean data URLs / URLs
    const cleanPhotos = [];
    if (photos && photos.length > 0) {
      for (const p of photos) {
        if (typeof p === 'string') {
          cleanPhotos.push(p);
        } else if (p.dataUrl) {
          cleanPhotos.push(p.dataUrl);
        } else if (p.base64) {
          const formatted = p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}`;
          cleanPhotos.push(formatted);
        }
      }
    }

    const newHistoryItem = {
      id: `UPD-${Date.now().toString(36)}`,
      time: timeStr,
      date: dateStr,
      progress: Number(progress) || 0,
      status: status || "กำลังทำ",
      note: note || "-",
      tech: updateBy || "ผู้ปฏิบัติงานหน้างาน",
      photos: cleanPhotos,
      createdAt: now.toISOString()
    };

    // 2. Fetch current task to append to progress_history
    let currentTaskQuery = supabase.from('tasks').select('*');
    if (taskId) currentTaskQuery = currentTaskQuery.eq('id', taskId);
    else if (taskTitle) currentTaskQuery = currentTaskQuery.eq('title', taskTitle);
    const { data: currentTasks } = await currentTaskQuery.limit(1);
    const currentTask = currentTasks && currentTasks[0] ? currentTasks[0] : null;

    const existingCust = (currentTask && typeof currentTask.customer === 'object') ? currentTask.customer : {};
    const existingHistory = Array.isArray(existingCust.progress_history) ? existingCust.progress_history : [];
    // Deduplicate history entry if same progress and note within last 10 seconds
    const isDuplicateHistory = existingHistory.some(h => 
      Number(h.progress) === Number(progress) && 
      h.note === (note || "-") && 
      (now.getTime() - new Date(h.createdAt || 0).getTime() < 10000)
    );
    const updatedHistory = isDuplicateHistory ? existingHistory : [...existingHistory, newHistoryItem];

    // 3. Update task in database
    const updateData = {
      progress: Number(progress) || 0,
      status: status,
      latest_update: updateEntry || `[คืบหน้า ${progress}%: ${status}] ${note || ''} (โดย ${updateBy} เมื่อ ${timeStr} น.)`,
      customer: {
        ...existingCust,
        progress_history: updatedHistory
      },
      updated_by: updateBy,
      updated_at: now.toISOString()
    };

    let query = supabase.from('tasks').update(updateData);
    if (taskId) {
      query = query.eq('id', taskId);
    } else if (taskTitle) {
      query = query.eq('title', taskTitle);
    }

    const { error: tErr } = await query;
    if (tErr) console.warn("update task error:", tErr);

    // 4. Update checkins record if exists
    try {
      let checkinQuery = supabase.from('checkins').select('*');
      if (taskId) checkinQuery = checkinQuery.or(`task_id.eq.${taskId},id.eq.${taskId}`);
      else if (taskTitle) checkinQuery = checkinQuery.eq('task_title', taskTitle);
      const { data: matchingCheckins } = await checkinQuery.limit(1);

      if (matchingCheckins && matchingCheckins.length > 0) {
        const chk = matchingCheckins[0];
        await supabase.from('checkins').update({
          progress: Number(progress) || 0,
          status: status,
          updated_at: now.toISOString()
        }).eq('id', chk.id);
      }
    } catch (cErr) {
      console.warn("update checkins link error:", cErr);
    }

    return { success: true, historyItem: newHistoryItem, photos: cleanPhotos };
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
    const cleanPhotos = (data.photos || []).map(p => {
      if (typeof p === 'string') return p;
      if (p.dataUrl) return p.dataUrl;
      if (p.base64) return p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}`;
      return null;
    }).filter(Boolean);

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
      photos: cleanPhotos,
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
    const cleanPhotos = (payload.photos || []).map(p => {
      if (typeof p === 'string') return p;
      if (p.dataUrl) return p.dataUrl;
      if (p.base64) return p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}`;
      return null;
    }).filter(Boolean);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("th-TH");

    const { error } = await supabase
      .from('checkins')
      .update({
        checkout_time: payload.outTime,
        duration: payload.duration,
        outcome: payload.outcome,
        note: payload.note || '',
        status: 'เสร็จสิ้น',
        progress: 100,
        closer_name: payload.closedBy || payload.closerName || '',
        photos: cleanPhotos,
        updated_at: now.toISOString()
      })
      .eq('id', payload.id);

    if (error) throw error;

    // Also update linked task in tasks table
    const targetTaskId = payload.taskId || payload.id;
    if (targetTaskId) {
      try {
        const { data: currentTasks } = await supabase.from('tasks').select('*').eq('id', targetTaskId).limit(1);
        const currentTask = currentTasks && currentTasks[0] ? currentTasks[0] : null;
        if (currentTask) {
          const existingCust = (currentTask && typeof currentTask.customer === 'object') ? currentTask.customer : {};
          const existingHistory = Array.isArray(existingCust.progress_history) ? existingCust.progress_history : [];
          const closeHistoryItem = {
            id: `UPD-CLOSE-${Date.now().toString(36)}`,
            time: timeStr,
            date: dateStr,
            progress: 100,
            status: "เสร็จสิ้น",
            note: `ปิดงาน: ${payload.outcome || 'เสร็จเรียบร้อย'} ${payload.note ? `(${payload.note})` : ''}`,
            tech: payload.closedBy || payload.closerName || "ผู้ปฏิบัติงานหน้างาน",
            photos: cleanPhotos,
            createdAt: now.toISOString()
          };
          await supabase.from('tasks').update({
            progress: 100,
            status: 'เสร็จสิ้น',
            latest_update: `[ปิดงาน 100%] ${payload.outcome || 'เสร็จเรียบร้อย'} (โดย ${payload.closedBy || 'ผู้ปฏิบัติงานหน้างาน'} เมื่อ ${timeStr} น.)`,
            customer: {
              ...existingCust,
              progress_history: [...existingHistory, closeHistoryItem]
            },
            updated_by: payload.closedBy || 'ผู้ปฏิบัติงานหน้างาน',
            updated_at: now.toISOString()
          }).eq('id', targetTaskId);
        }
      } catch (tErr) {
        console.warn("link close task update error:", tErr);
      }
    }

    return { success: true, id: payload.id };
  } catch (err) {
    console.warn("saveCheckoutApi error:", err);
    return { success: false, error: err.message };
  }
}

export async function deletePhotoFromSupabaseApi(photoUrl, taskId, checkinId) {
  try {
    if (!photoUrl) return { success: false, reason: "no_url" };

    // 1. Delete from checkins table
    try {
      let checkinQuery = supabase.from('checkins').select('id, photos');
      if (checkinId) checkinQuery = checkinQuery.or(`id.eq.${checkinId},task_id.eq.${checkinId}`);
      else if (taskId) checkinQuery = checkinQuery.or(`id.eq.${taskId},task_id.eq.${taskId}`);
      const { data: matchedCheckins } = await checkinQuery;

      if (matchedCheckins && matchedCheckins.length > 0) {
        for (const chk of matchedCheckins) {
          if (Array.isArray(chk.photos)) {
            const updatedPhotos = chk.photos.filter(p => {
              const src = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.url || '');
              return src !== photoUrl;
            });
            if (updatedPhotos.length !== chk.photos.length) {
              await supabase.from('checkins').update({
                photos: updatedPhotos,
                updated_at: new Date().toISOString()
              }).eq('id', chk.id);
            }
          }
        }
      }
    } catch (cErr) {
      console.warn("deletePhoto checkins error:", cErr);
    }

    // 2. Delete from tasks table
    try {
      let taskQuery = supabase.from('tasks').select('id, customer');
      if (taskId) taskQuery = taskQuery.eq('id', taskId);
      else if (checkinId) taskQuery = taskQuery.eq('id', checkinId);
      const { data: matchedTasks } = await taskQuery;

      if (matchedTasks && matchedTasks.length > 0) {
        for (const t of matchedTasks) {
          const cust = (t && typeof t.customer === 'object') ? t.customer : {};
          if (Array.isArray(cust.progress_history)) {
            let modified = false;
            const updatedHistory = cust.progress_history.map(h => {
              if (Array.isArray(h.photos)) {
                const filtered = h.photos.filter(p => {
                  const src = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.url || '');
                  return src !== photoUrl;
                });
                if (filtered.length !== h.photos.length) modified = true;
                return { ...h, photos: filtered };
              }
              return h;
            });
            if (modified) {
              await supabase.from('tasks').update({
                customer: { ...cust, progress_history: updatedHistory },
                updated_at: new Date().toISOString()
              }).eq('id', t.id);
            }
          }
        }
      }
    } catch (tErr) {
      console.warn("deletePhoto tasks error:", tErr);
    }

    // 3. Delete from Supabase Storage bucket if it is a hosted file
    try {
      if (photoUrl.includes('/work-photos/')) {
        const parts = photoUrl.split('/work-photos/');
        if (parts[1]) {
          const storagePath = parts[1].split('?')[0];
          await supabase.storage.from('work-photos').remove([storagePath]);
        }
      }
    } catch (sErr) {
      console.warn("deletePhoto storage remove error:", sErr);
    }

    return { success: true };
  } catch (err) {
    console.warn("deletePhotoFromSupabaseApi exception:", err);
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
