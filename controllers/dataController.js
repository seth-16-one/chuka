const { createSupabaseAdminClient } = require("../lib/supabaseAdmin");
const { getTableConfig, isAllowedTable, listAllowedTables } = require("../lib/tableRegistry");

function normalizeTableName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getOrderQuery(builder, config) {
  if (!config?.orderBy) {
    return builder;
  }

  return builder.order(config.orderBy, { ascending: config.orderDirection !== "desc" });
}

async function listRecords(req, res) {
  const table = normalizeTableName(req.params.table);

  if (!isAllowedTable(table)) {
    return res.status(404).json({
      status: "error",
      message: `Unknown table: ${table}`,
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const config = getTableConfig(table);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    let query = supabase.from(table).select("*");
    query = getOrderQuery(query, config);
    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return res.json({
      status: "ok",
      message: `${table} records loaded successfully.`,
      data,
      meta: {
        table,
        allowedTables: listAllowedTables(),
        limit,
        offset,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Failed to load ${table}.`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function getRecord(req, res) {
  const table = normalizeTableName(req.params.table);

  if (!isAllowedTable(table)) {
    return res.status(404).json({
      status: "error",
      message: `Unknown table: ${table}`,
    });
  }

  const config = getTableConfig(table);
  const recordId = req.params.id;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(table).select("*").eq(config.primaryKey, recordId).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: `${table} record not found.`,
      });
    }

    return res.json({
      status: "ok",
      message: `${table} record loaded successfully.`,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Failed to load ${table} record.`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function createRecord(req, res) {
  const table = normalizeTableName(req.params.table);

  if (!isAllowedTable(table)) {
    return res.status(404).json({
      status: "error",
      message: `Unknown table: ${table}`,
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      status: "ok",
      message: `${table} record created successfully.`,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Failed to create ${table} record.`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function updateRecord(req, res) {
  const table = normalizeTableName(req.params.table);

  if (!isAllowedTable(table)) {
    return res.status(404).json({
      status: "error",
      message: `Unknown table: ${table}`,
    });
  }

  const config = getTableConfig(table);
  const recordId = req.params.id;

  try {
    const supabase = createSupabaseAdminClient();
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq(config.primaryKey, recordId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: `${table} record not found.`,
      });
    }

    return res.json({
      status: "ok",
      message: `${table} record updated successfully.`,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Failed to update ${table} record.`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteRecord(req, res) {
  const table = normalizeTableName(req.params.table);

  if (!isAllowedTable(table)) {
    return res.status(404).json({
      status: "error",
      message: `Unknown table: ${table}`,
    });
  }

  const config = getTableConfig(table);
  const recordId = req.params.id;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(config.primaryKey, recordId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: `${table} record not found.`,
      });
    }

    return res.json({
      status: "ok",
      message: `${table} record deleted successfully.`,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `Failed to delete ${table} record.`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

module.exports = {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
};
