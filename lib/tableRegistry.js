const TABLES = {
  announcements: { primaryKey: "id", orderBy: "published_at", orderDirection: "desc" },
  chat_messages: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  chat_room_members: { primaryKey: "id", orderBy: "joined_at", orderDirection: "desc" },
  chat_rooms: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  email_otp_challenges: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  finance_accounts: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  finance_transactions: { primaryKey: "id", orderBy: "transaction_date", orderDirection: "desc" },
  login_otp_sessions: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  notes: { primaryKey: "id", orderBy: "uploaded_at", orderDirection: "desc" },
  otp_verifications: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  profiles: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  registration: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  revision_faculties: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  revision_materials: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  revision_subjects: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  revision_units: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  staff_materials: { primaryKey: "id", orderBy: "uploaded_at", orderDirection: "desc" },
  student_documents: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  student_finance_status: { primaryKey: "user_id", orderBy: "updated_at", orderDirection: "desc" },
  suggested_highlights: { primaryKey: "id", orderBy: "position", orderDirection: "asc" },
  timetable_entries: { primaryKey: "id", orderBy: "day_order", orderDirection: "asc" },
  users: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
};

function isAllowedTable(name) {
  return Boolean(TABLES[name]);
}

function getTableConfig(name) {
  return TABLES[name] || null;
}

function listAllowedTables() {
  return Object.keys(TABLES);
}

module.exports = {
  TABLES,
  isAllowedTable,
  getTableConfig,
  listAllowedTables,
};
