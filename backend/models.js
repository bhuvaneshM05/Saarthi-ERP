const mongoose = require("mongoose");

// ── Inventory ─────────────────────────────────────────
const InventorySchema = new mongoose.Schema({
  name:          { type: String, required: true },
  sku:           { type: String, required: true },
  category:      { type: String, default: "Raw Material" },
  quantity:      { type: Number, default: 0 },
  unit:          { type: String, default: "units" },
  reorder_point: { type: Number, default: 0 },
  unit_cost:     { type: Number, default: 0 },
  location:      { type: String, default: "Warehouse A" },
  supplier:      { type: String, default: "" },
  last_updated:  { type: Date, default: Date.now },
});

// ── Production ────────────────────────────────────────
const ProductionSchema = new mongoose.Schema({
  order_no:       { type: String },
  product:        { type: String, required: true },
  quantity:       { type: Number, default: 0 },
  status:         { type: String, default: "Planned" },
  start_date:     { type: String },
  end_date:       { type: String },
  assigned_to:    { type: String },
  completion_pct: { type: Number, default: 0 },
});

// ── Procurement ───────────────────────────────────────
const ProcurementSchema = new mongoose.Schema({
  po_number:     { type: String },
  supplier:      { type: String, required: true },
  item:          { type: String, required: true },
  quantity:      { type: Number, default: 0 },
  unit:          { type: String, default: "units" },
  unit_price:    { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  status:        { type: String, default: "Pending" },
  order_date:    { type: String },
  expected_date: { type: String, default: "TBD" },
});

// ── Sales ─────────────────────────────────────────────
const SalesSchema = new mongoose.Schema({
  order_no:      { type: String },
  customer:      { type: String, required: true },
  product:       { type: String, required: true },
  quantity:      { type: Number, default: 0 },
  unit_price:    { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  status:        { type: String, default: "Pending" },
  order_date:    { type: String },
  delivery_date: { type: String },
});

// ── Finance ───────────────────────────────────────────
const FinanceSchema = new mongoose.Schema({
  type:        { type: String, default: "Revenue" },
  description: { type: String, required: true },
  amount:      { type: Number, default: 0 },
  category:    { type: String, default: "Other" },
  status:      { type: String, default: "Pending" },
  date:        { type: String },
});

// ── HR ────────────────────────────────────────────────
const HRSchema = new mongoose.Schema({
  emp_id:         { type: String },
  name:           { type: String, required: true },
  department:     { type: String, default: "Production" },
  designation:    { type: String },
  salary:         { type: Number, default: 0 },
  status:         { type: String, default: "Active" },
  join_date:      { type: String },
  attendance_pct: { type: Number, default: 100 },
});

// ── Quality ───────────────────────────────────────────
const QualitySchema = new mongoose.Schema({
  inspection_no: { type: String },
  product:       { type: String, required: true },
  batch:         { type: String },
  result:        { type: String, default: "Pass" },
  defects:       { type: Number, default: 0 },
  inspector:     { type: String },
  date:          { type: String },
  notes:         { type: String, default: "" },
});

// ── Leads (LeadForge) ─────────────────────────────────
const LeadSchema = new mongoose.Schema({
  company_name:    { type: String },
  industry:        { type: String },
  location:        { type: String },
  employee_count:  { type: String },
  annual_revenue:  { type: String },
  website:         { type: String },
  decision_maker:  { type: Object },
  pain_points:     [String],
  tech_stack:      [String],
  fit_score:       { type: Number },
  fit_reason:      { type: String },
  created_at:      { type: Date, default: Date.now },
});

// ── VoiceCoach Sessions ───────────────────────────────
const SessionSchema = new mongoose.Schema({
  lead_id:        { type: String },
  rep_name:       { type: String },
  persona_system: { type: String },
  transcript:     [Object],
  started_at:     { type: Date, default: Date.now },
});

module.exports = {
  Inventory:   mongoose.model("Inventory",   InventorySchema),
  Production:  mongoose.model("Production",  ProductionSchema),
  Procurement: mongoose.model("Procurement", ProcurementSchema),
  Sales:       mongoose.model("Sales",       SalesSchema),
  Finance:     mongoose.model("Finance",     FinanceSchema),
  HR:          mongoose.model("HR",          HRSchema),
  Quality:     mongoose.model("Quality",     QualitySchema),
  Lead:        mongoose.model("Lead",        LeadSchema),
  Session:     mongoose.model("Session",     SessionSchema),
};
