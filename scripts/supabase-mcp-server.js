#!/usr/bin/env node
/**
 * Foresee Supabase MCP Server
 * Connects directly to Supabase Project (urzrfdkpeakvhalbtmpv)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://urzrfdkpeakvhalbtmpv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new Server(
  {
    name: "foresee-supabase-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// -------------------------------------------------------------
// LIST AVAILABLE TOOLS
// -------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_tasks",
        description: "Fetch tasks from Supabase with optional status filter or search query",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: 'ทั้งหมด', 'กำลังทำ', 'เสร็จสิ้น', 'รอดำเนินการ'" },
            search: { type: "string", description: "Search query for task title or customer name" },
            limit: { type: "number", description: "Limit number of results (default 50)" }
          }
        }
      },
      {
        name: "create_task",
        description: "Create and assign a new task in Supabase",
        inputSchema: {
          type: "object",
          required: ["title"],
          properties: {
            id: { type: "string", description: "Optional custom Task ID, e.g. 'TASK-123'. If omitted, generates TASK-XXX" },
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Detailed description" },
            category: { type: "string", description: "Job category" },
            priority: { type: "string", description: "Priority: 'ปกติ', 'ด่วน', 'ด่วนที่สุด'" },
            location: { type: "string", description: "Location or GPS coords" },
            techs: { type: "array", items: { type: "string" }, description: "Assigned technician names" },
            deadline: { type: "string", description: "Target deadline (YYYY-MM-DD)" },
            customer: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
                email: { type: "string" },
                lineId: { type: "string" }
              }
            }
          }
        }
      },
      {
        name: "update_task_progress",
        description: "Update the progress percentage and status of a task",
        inputSchema: {
          type: "object",
          required: ["id", "progress"],
          properties: {
            id: { type: "string", description: "Task ID" },
            progress: { type: "number", description: "Progress percentage 0-100" },
            status: { type: "string", description: "Status: 'กำลังทำ' or 'เสร็จสิ้น'" },
            latestUpdate: { type: "string", description: "Progress update message / remarks" },
            updatedBy: { type: "string", description: "Name of updater / technician" }
          }
        }
      },
      {
        name: "delete_task",
        description: "Delete a task by ID from Supabase",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Task ID to delete" }
          }
        }
      },
      {
        name: "get_checkins",
        description: "Fetch check-in records from Supabase",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: 'กำลังทำ' (active) or 'เสร็จสิ้น' (closed)" },
            limit: { type: "number", description: "Limit number of results (default 50)" }
          }
        }
      },
      {
        name: "delete_checkin",
        description: "Delete an active or closed checkin record by ID",
        inputSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Checkin ID (e.g. 'CHK-001')" }
          }
        }
      },
      {
        name: "get_technicians",
        description: "Fetch list of all technicians in the team",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "add_technician",
        description: "Add a new technician name to the team",
        inputSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Technician name" },
            phone: { type: "string", description: "Optional phone number" }
          }
        }
      },
      {
        name: "delete_technician",
        description: "Delete a technician by name",
        inputSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Technician name to remove" }
          }
        }
      },
      {
        name: "get_db_stats",
        description: "Get summary stats of the Supabase database (count of tasks, checkins, technicians)",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ],
  };
});

// -------------------------------------------------------------
// HANDLE TOOL EXECUTION
// -------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_tasks": {
        let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
        if (args?.status && args.status !== "ทั้งหมด") {
          query = query.eq("status", args.status);
        }
        if (args?.search) {
          query = query.ilike("title", `%${args.search}%`);
        }
        if (args?.limit) {
          query = query.limit(args.limit);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "create_task": {
        const taskId = args.id || `TASK-${Math.floor(100 + Math.random() * 900)}`;
        const payload = {
          id: taskId,
          title: args.title,
          description: args.description || "-",
          category: args.category || "ติดตั้งงานใหม่",
          priority: args.priority || "ปกติ",
          location: args.location || "-",
          techs: args.techs || [],
          deadline: args.deadline || "-",
          status: "กำลังทำ",
          progress: 0,
          latest_update: "สร้างงานใหม่",
          customer: args.customer || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from("tasks").insert(payload).select();
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, task: data[0] }, null, 2) }] };
      }

      case "update_task_progress": {
        const updateData = {
          progress: args.progress,
          updated_at: new Date().toISOString()
        };
        if (args.status) updateData.status = args.status;
        if (args.latestUpdate) updateData.latest_update = args.latestUpdate;
        if (args.updatedBy) updateData.updated_by = args.updatedBy;

        const { data, error } = await supabase.from("tasks").update(updateData).eq("id", args.id).select();
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, updated: data }, null, 2) }] };
      }

      case "delete_task": {
        const { error } = await supabase.from("tasks").delete().eq("id", args.id);
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deletedId: args.id }) }] };
      }

      case "get_checkins": {
        let query = supabase.from("checkins").select("*").order("created_at", { ascending: false });
        if (args?.status) {
          query = query.eq("status", args.status);
        }
        if (args?.limit) {
          query = query.limit(args.limit);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "delete_checkin": {
        const { error } = await supabase.from("checkins").delete().eq("id", args.id);
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deletedId: args.id }) }] };
      }

      case "get_technicians": {
        const { data, error } = await supabase.from("technicians").select("*").order("name");
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "add_technician": {
        const { data, error } = await supabase.from("technicians").insert({
          name: args.name,
          phone: args.phone || "-"
        }).select();
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, technician: data[0] }, null, 2) }] };
      }

      case "delete_technician": {
        const { error } = await supabase.from("technicians").delete().eq("name", args.name);
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deletedName: args.name }) }] };
      }

      case "get_db_stats": {
        const [tasksCount, checkinsCount, techsCount] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }),
          supabase.from("checkins").select("*", { count: "exact", head: true }),
          supabase.from("technicians").select("*", { count: "exact", head: true })
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tasksCount: tasksCount.count || 0,
              checkinsCount: checkinsCount.count || 0,
              techniciansCount: techsCount.count || 0,
              projectUrl: SUPABASE_URL
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${err.message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Foresee Supabase MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting MCP Server:", err);
  process.exit(1);
});
