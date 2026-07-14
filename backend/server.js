require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");
const models   = require("./models");
const { callLLM, parseJSON, getSnapshot, sendEmailReport, sendWhatsAppReport, sendTelegramReport } = require("./utils");
const { Inventory, Production, Procurement, Sales, Finance, HR, Quality, Lead, Session } = models;

const app  = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: ["http://localhost:3000","http://localhost:5173"], credentials: true }));
app.use(express.json());

// ── Seed sample data ──────────────────────────────────
async function seedDB() {
  if (await Inventory.countDocuments() > 0) return;
  await Inventory.insertMany([
    { name:"Steel Rods",      sku:"STL-001", category:"Raw Material",  quantity:1200, unit:"kg",     reorder_point:300, unit_cost:85,   location:"Warehouse A", supplier:"Tata Steel" },
    { name:"Copper Wire",     sku:"COP-002", category:"Raw Material",  quantity:450,  unit:"meters", reorder_point:200, unit_cost:320,  location:"Warehouse B", supplier:"Hindalco" },
    { name:"Finished Motors", sku:"MOT-003", category:"Finished Goods",quantity:85,   unit:"units",  reorder_point:20,  unit_cost:4500, location:"Warehouse C", supplier:"Internal" },
    { name:"Bearings 6205",   sku:"BRG-004", category:"Spare Parts",   quantity:320,  unit:"units",  reorder_point:100, unit_cost:125,  location:"Warehouse A", supplier:"SKF India" },
    { name:"Circuit Boards",  sku:"PCB-005", category:"Components",    quantity:60,   unit:"units",  reorder_point:50,  unit_cost:890,  location:"Warehouse B", supplier:"Microchip India" },
  ]);
  await Production.insertMany([
    { order_no:"WO-2024-001", product:"Electric Motor 3HP", quantity:50, status:"In Progress", start_date:"2024-01-15", end_date:"2024-01-25", assigned_to:"Team Alpha", completion_pct:65 },
    { order_no:"WO-2024-002", product:"Control Panel",      quantity:20, status:"Planned",     start_date:"2024-01-20", end_date:"2024-01-30", assigned_to:"Team Beta",  completion_pct:0  },
    { order_no:"WO-2024-003", product:"Pump Assembly",      quantity:15, status:"Completed",   start_date:"2024-01-05", end_date:"2024-01-12", assigned_to:"Team Alpha", completion_pct:100},
  ]);
  await Procurement.insertMany([
    { po_number:"PO-2024-001", supplier:"Tata Steel", item:"Steel Rods",    quantity:500, unit:"kg",     unit_price:82,  total:41000, status:"Delivered",  order_date:"2024-01-10", expected_date:"2024-01-15" },
    { po_number:"PO-2024-002", supplier:"SKF India",  item:"Bearings 6205", quantity:200, unit:"units",  unit_price:118, total:23600, status:"Pending",    order_date:"2024-01-18", expected_date:"2024-01-25" },
    { po_number:"PO-2024-003", supplier:"Hindalco",   item:"Copper Wire",   quantity:300, unit:"meters", unit_price:315, total:94500, status:"In Transit", order_date:"2024-01-16", expected_date:"2024-01-22" },
  ]);
  await Sales.insertMany([
    { order_no:"SO-2024-001", customer:"Bharat Electronics", product:"Electric Motor 3HP", quantity:10, unit_price:6500,  total:65000,  status:"Delivered",  order_date:"2024-01-08", delivery_date:"2024-01-18" },
    { order_no:"SO-2024-002", customer:"Larsen & Toubro",    product:"Control Panel",      quantity:5,  unit_price:15000, total:75000,  status:"Processing", order_date:"2024-01-17", delivery_date:"2024-01-28" },
    { order_no:"SO-2024-003", customer:"BHEL",               product:"Pump Assembly",      quantity:8,  unit_price:22000, total:176000, status:"Pending",    order_date:"2024-01-19", delivery_date:"2024-02-05" },
  ]);
  await Finance.insertMany([
    { type:"Revenue", description:"Payment from Bharat Electronics", amount:65000,  category:"Sales",         status:"Received", date:"2024-01-18" },
    { type:"Expense", description:"Steel Rods Purchase",             amount:41000,  category:"Raw Materials",  status:"Paid",     date:"2024-01-15" },
    { type:"Expense", description:"Employee Salaries Jan",           amount:285000, category:"Payroll",        status:"Pending",  date:"2024-01-31" },
    { type:"Revenue", description:"Advance from L&T",               amount:37500,  category:"Sales",         status:"Received", date:"2024-01-17" },
  ]);
  await HR.insertMany([
    { emp_id:"EMP001", name:"Rajesh Kumar",  department:"Production",  designation:"Senior Engineer",     salary:75000, status:"Active",   join_date:"2020-03-15", attendance_pct:96 },
    { emp_id:"EMP002", name:"Priya Sharma",  department:"Sales",       designation:"Sales Manager",       salary:85000, status:"Active",   join_date:"2019-07-01", attendance_pct:98 },
    { emp_id:"EMP003", name:"Arjun Patel",   department:"Procurement", designation:"Procurement Officer", salary:65000, status:"Active",   join_date:"2021-01-10", attendance_pct:94 },
    { emp_id:"EMP004", name:"Meera Nair",    department:"Finance",     designation:"Finance Analyst",     salary:70000, status:"Active",   join_date:"2020-08-20", attendance_pct:97 },
    { emp_id:"EMP005", name:"Vikram Singh",  department:"Quality",     designation:"QC Inspector",        salary:55000, status:"On Leave", join_date:"2022-05-05", attendance_pct:88 },
  ]);
  await Quality.insertMany([
    { inspection_no:"QC-2024-001", product:"Electric Motor 3HP", batch:"BATCH-001", result:"Pass", defects:0, inspector:"Vikram Singh", date:"2024-01-20", notes:"All parameters within spec" },
    { inspection_no:"QC-2024-002", product:"Control Panel",      batch:"BATCH-002", result:"Fail", defects:2, inspector:"Vikram Singh", date:"2024-01-21", notes:"Minor wiring issues" },
  ]);
  console.log("Database seeded");
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log("MongoDB connected"); seedDB(); })
  .catch(err => console.error("MongoDB error:", err.message));

// ── AI system prompt ──────────────────────────────────
const AI_SYSTEM = `You are Saarthi, an ERP assistant for a manufacturing company.
CRITICAL: Respond with ONLY a raw JSON object. No markdown. No explanation.
Format: {"reply":"your response","action":null,"action_params":{}}
Actions: increase_stock|decrease_stock|set_stock|create_inventory|create_po|create_so|update_production_status|add_finance|send_report
Examples:
User:"check steel rods stock" -> {"reply":"Steel Rods has the current quantity in stock.","action":null,"action_params":{}}
User:"increase steel rods by 500" -> {"reply":"Increasing Steel Rods by 500 kg.","action":"increase_stock","action_params":{"item_name":"Steel Rods","amount":500}}
User:"add new item Aluminium 500 kg cost 150" -> {"reply":"Adding to inventory.","action":"create_inventory","action_params":{"name":"Aluminium Sheets","sku":"ALU-006","category":"Raw Material","quantity":500,"unit":"kg","reorder_point":100,"unit_cost":150,"location":"Warehouse A","supplier":"Unknown"}}
User:"create PO 200 bearings SKF 125 each" -> {"reply":"Creating PO.","action":"create_po","action_params":{"supplier":"SKF India","item":"Bearings 6205","quantity":200,"unit":"units","unit_price":125}}
User:"send report to x@y.com" -> {"reply":"Sending report.","action":"send_report","action_params":{"email":"x@y.com"}}
Output ONLY the JSON.`;

async function executeAction(action, params) {
  try {
    if (action === "increase_stock") {
      const item = await Inventory.findOne({ name: new RegExp(params.item_name || "", "i") });
      if (!item) return `Item '${params.item_name}' not found`;
      item.quantity += parseFloat(params.amount || 0);
      item.last_updated = new Date();
      await item.save();
      return `Stock of ${item.name} increased by ${params.amount}. New total: ${item.quantity} ${item.unit}`;
    }
    if (action === "decrease_stock") {
      const item = await Inventory.findOne({ name: new RegExp(params.item_name || "", "i") });
      if (!item) return `Item not found`;
      if (item.quantity < params.amount) return `Insufficient stock. Only ${item.quantity} available`;
      item.quantity -= parseFloat(params.amount || 0);
      item.last_updated = new Date();
      await item.save();
      return `Stock of ${item.name} decreased by ${params.amount}. New total: ${item.quantity} ${item.unit}`;
    }
    if (action === "set_stock") {
      const item = await Inventory.findOne({ name: new RegExp(params.item_name || "", "i") });
      if (!item) return `Item not found`;
      item.quantity = parseFloat(params.amount || 0);
      item.last_updated = new Date();
      await item.save();
      return `${item.name} stock set to ${item.quantity} ${item.unit}`;
    }
    if (action === "create_inventory") {
      const item = await Inventory.create({ name:params.name||"New Item", sku:params.sku||`SKU-${Date.now()}`, category:params.category||"Raw Material", quantity:parseFloat(params.quantity||0), unit:params.unit||"units", reorder_point:parseFloat(params.reorder_point||10), unit_cost:parseFloat(params.unit_cost||0), location:params.location||"Warehouse A", supplier:params.supplier||"Unknown" });
      return `'${item.name}' added to inventory with qty ${item.quantity} ${item.unit}`;
    }
    if (action === "create_po") {
      const count = await Procurement.countDocuments();
      const po = await Procurement.create({ po_number:`PO-${new Date().getFullYear()}-${String(count+1).padStart(3,"0")}`, supplier:params.supplier||"", item:params.item||"", quantity:parseFloat(params.quantity||0), unit:params.unit||"units", unit_price:parseFloat(params.unit_price||0), total:parseFloat(params.quantity||0)*parseFloat(params.unit_price||0), status:"Pending", order_date:new Date().toISOString().split("T")[0], expected_date:"TBD" });
      return `${po.po_number} created for ${po.item} from ${po.supplier}`;
    }
    if (action === "create_so") {
      const count = await Sales.countDocuments();
      const so = await Sales.create({ order_no:`SO-${new Date().getFullYear()}-${String(count+1).padStart(3,"0")}`, customer:params.customer||"", product:params.product||"", quantity:parseInt(params.quantity||0), unit_price:parseFloat(params.unit_price||0), total:parseInt(params.quantity||0)*parseFloat(params.unit_price||0), status:"Pending", order_date:new Date().toISOString().split("T")[0], delivery_date:params.delivery_date||"TBD" });
      return `${so.order_no} created for ${so.customer}`;
    }
    if (action === "update_production_status") {
      const query = params.order_no || params.product || "";
      const prod = await Production.findOne({ $or:[{order_no:new RegExp(query,"i")},{product:new RegExp(query,"i")}] });
      if (!prod) return `Production order not found`;
      prod.status = params.status || prod.status;
      if (params.status === "Completed") prod.completion_pct = 100;
      await prod.save();
      return `${prod.order_no} updated to ${prod.status}`;
    }
    if (action === "add_finance") {
      const entry = await Finance.create({ type:params.type||"Revenue", description:params.description||"", amount:parseFloat(params.amount||0), category:params.category||"Other", status:params.status||"Pending", date:new Date().toISOString().split("T")[0] });
      return `Finance entry added: ${entry.type} Rs.${entry.amount.toLocaleString()}`;
    }
    if (action === "send_report") {
      const snap = await getSnapshot(models);
      if (params.email)    { const r = await sendEmailReport(params.email, snap);       return r.message; }
      if (params.whatsapp) { const r = await sendWhatsAppReport(params.whatsapp, snap); return r.message; }
      if (params.telegram) { const r = await sendTelegramReport(params.telegram, snap); return r.message; }
      return "Specify email, whatsapp, or telegram";
    }
    return `Action '${action}' acknowledged`;
  } catch (err) { return `Action failed: ${err.message}`; }
}

// ── Routes ────────────────────────────────────────────
app.get("/health", async (req, res) => {
  res.json({ status:"ok", provider:"Groq", model:process.env.GROQ_MODEL||"llama-3.3-70b-versatile", email_configured:!!(process.env.SMTP_EMAIL&&process.env.SMTP_PASSWORD), whatsapp_configured:!!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN), telegram_configured:!!process.env.TELEGRAM_BOT_TOKEN });
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const snap = await getSnapshot(models);
    const [rs,rp,rf] = await Promise.all([Sales.find().sort({_id:-1}).limit(3), Production.find().sort({_id:-1}).limit(3), Finance.find().sort({_id:-1}).limit(4)]);
    res.json({...snap, recent_sales:rs, recent_production:rp, recent_finance:rf});
  } catch(err){res.status(500).json({error:err.message});}
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history=[] } = req.body;
    const snap = await getSnapshot(models);
    const snapStr = `LIVE ERP DATA:\nINVENTORY: ${snap.inventory_list}\nSALES: ${snap.sales_list}\nPRODUCTION: ${snap.production_list}\nPROCUREMENT: ${snap.procurement_list}\nHR: ${snap.hr_list}\nSUMMARY: Revenue Rs.${snap.total_revenue.toLocaleString()} | Expenses Rs.${snap.total_expenses.toLocaleString()} | Net Rs.${snap.net_profit.toLocaleString()} | Open sales:${snap.open_sales_orders} | Active prod:${snap.active_production_orders} | Staff:${snap.total_employees}(${snap.employees_on_leave} on leave)`;
    const messages = [...history.slice(-6), {role:"user",content:message}];
    const raw = await callLLM(AI_SYSTEM+"\n\n"+snapStr, messages, 800);
    let data;
    try{data=parseJSON(raw);}catch(_){data={reply:raw,action:null,action_params:{}};}
    let action_result = null;
    if (data.action) action_result = await executeAction(data.action, data.action_params||{});
    res.json({reply:data.reply||raw, action:data.action, action_result, snapshot:snap});
  } catch(err){res.status(500).json({error:err.message});}
});

// INVENTORY
app.get("/api/inventory", async (req,res)=>{try{const items=await Inventory.find();const low=items.filter(i=>i.quantity<=i.reorder_point);res.json({items,total:items.length,low_stock_count:low.length,low_stock:low});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/inventory", async (req,res)=>{try{res.json(await Inventory.create({...req.body,last_updated:new Date()}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/inventory/:id", async (req,res)=>{try{const i=await Inventory.findByIdAndUpdate(req.params.id,{...req.body,last_updated:new Date()},{new:true});if(!i)return res.status(404).json({error:"Not found"});res.json(i);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/inventory/:id", async (req,res)=>{try{await Inventory.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// PRODUCTION
app.get("/api/production", async (req,res)=>{try{const o=await Production.find();res.json({orders:o,total:o.length,in_progress:o.filter(x=>x.status==="In Progress").length,planned:o.filter(x=>x.status==="Planned").length,completed:o.filter(x=>x.status==="Completed").length});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/production", async (req,res)=>{try{const c=await Production.countDocuments();res.json(await Production.create({...req.body,order_no:`WO-${new Date().getFullYear()}-${String(c+1).padStart(3,"0")}`,status:req.body.status||"Planned",completion_pct:req.body.completion_pct||0}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/production/:id", async (req,res)=>{try{const o=await Production.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!o)return res.status(404).json({error:"Not found"});res.json(o);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/production/:id", async (req,res)=>{try{await Production.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// PROCUREMENT
app.get("/api/procurement", async (req,res)=>{try{const o=await Procurement.find();res.json({orders:o,total:o.length,pending:o.filter(x=>x.status==="Pending").length,total_value:o.reduce((s,x)=>s+x.total,0)});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/procurement", async (req,res)=>{try{const c=await Procurement.countDocuments();res.json(await Procurement.create({...req.body,po_number:`PO-${new Date().getFullYear()}-${String(c+1).padStart(3,"0")}`,total:(req.body.quantity||0)*(req.body.unit_price||0),status:req.body.status||"Pending",order_date:new Date().toISOString().split("T")[0]}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/procurement/:id", async (req,res)=>{try{const e=await Procurement.findById(req.params.id);const b={...req.body};if(b.quantity||b.unit_price)b.total=(b.quantity||e.quantity)*(b.unit_price||e.unit_price);const o=await Procurement.findByIdAndUpdate(req.params.id,b,{new:true});if(!o)return res.status(404).json({error:"Not found"});res.json(o);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/procurement/:id", async (req,res)=>{try{await Procurement.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// SALES
app.get("/api/sales", async (req,res)=>{try{const o=await Sales.find();res.json({orders:o,total:o.length,total_revenue:o.reduce((s,x)=>s+x.total,0),pending:o.filter(x=>x.status==="Pending").length});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/sales", async (req,res)=>{try{const c=await Sales.countDocuments();res.json(await Sales.create({...req.body,order_no:`SO-${new Date().getFullYear()}-${String(c+1).padStart(3,"0")}`,total:(req.body.quantity||0)*(req.body.unit_price||0),status:req.body.status||"Pending",order_date:new Date().toISOString().split("T")[0]}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/sales/:id", async (req,res)=>{try{const e=await Sales.findById(req.params.id);const b={...req.body};if(b.quantity||b.unit_price)b.total=(b.quantity||e.quantity)*(b.unit_price||e.unit_price);const o=await Sales.findByIdAndUpdate(req.params.id,b,{new:true});if(!o)return res.status(404).json({error:"Not found"});res.json(o);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/sales/:id", async (req,res)=>{try{await Sales.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// FINANCE
app.get("/api/finance", async (req,res)=>{try{const e=await Finance.find();const rev=e.filter(x=>x.type==="Revenue").reduce((s,x)=>s+x.amount,0);const exp=e.filter(x=>x.type==="Expense").reduce((s,x)=>s+x.amount,0);res.json({entries:e,total_revenue:rev,total_expenses:exp,net_profit:rev-exp});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/finance", async (req,res)=>{try{res.json(await Finance.create({...req.body,date:req.body.date||new Date().toISOString().split("T")[0]}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/finance/:id", async (req,res)=>{try{const e=await Finance.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!e)return res.status(404).json({error:"Not found"});res.json(e);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/finance/:id", async (req,res)=>{try{await Finance.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// HR
app.get("/api/hr", async (req,res)=>{try{const e=await HR.find();res.json({employees:e,total:e.length,active:e.filter(x=>x.status==="Active").length,on_leave:e.filter(x=>x.status==="On Leave").length,total_payroll:e.reduce((s,x)=>s+x.salary,0)});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/hr", async (req,res)=>{try{const c=await HR.countDocuments();res.json(await HR.create({...req.body,emp_id:`EMP${String(c+1).padStart(3,"0")}`,status:req.body.status||"Active",attendance_pct:req.body.attendance_pct||100}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/hr/:id", async (req,res)=>{try{const e=await HR.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!e)return res.status(404).json({error:"Not found"});res.json(e);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/hr/:id", async (req,res)=>{try{await HR.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// QUALITY
app.get("/api/quality", async (req,res)=>{try{const i=await Quality.find();res.json({inspections:i,pass_rate:i.length?(i.filter(x=>x.result==="Pass").length/i.length)*100:0});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/quality", async (req,res)=>{try{const c=await Quality.countDocuments();res.json(await Quality.create({...req.body,inspection_no:`QC-${new Date().getFullYear()}-${String(c+1).padStart(3,"0")}`,date:req.body.date||new Date().toISOString().split("T")[0]}));}catch(e){res.status(500).json({error:e.message});}});
app.put("/api/quality/:id", async (req,res)=>{try{const i=await Quality.findByIdAndUpdate(req.params.id,req.body,{new:true});if(!i)return res.status(404).json({error:"Not found"});res.json(i);}catch(e){res.status(500).json({error:e.message});}});
app.delete("/api/quality/:id", async (req,res)=>{try{await Quality.findByIdAndDelete(req.params.id);res.json({deleted:true});}catch(e){res.status(500).json({error:e.message});}});

// REPORTS
app.post("/api/reports/send", async (req,res)=>{
  try{
    const {email,whatsapp,telegram} = req.body;
    const snap = await getSnapshot(models);
    const results = [];
    if(email)    results.push({medium:"email",    address:email,    ...(await sendEmailReport(email,snap))});
    if(whatsapp) results.push({medium:"whatsapp", number:whatsapp,  ...(await sendWhatsAppReport(whatsapp,snap))});
    if(telegram) results.push({medium:"telegram", chat_id:telegram, ...(await sendTelegramReport(telegram,snap))});
    res.json({results, snapshot:snap});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get("/api/reports/snapshot", async (req,res)=>{try{res.json(await getSnapshot(models));}catch(e){res.status(500).json({error:e.message});}});

// SUPPLIER FINDER
const SUPPLIER_SYS=`You are a procurement agent for Indian manufacturing. Return ONLY valid JSON (no markdown):{"suppliers":[{"id":"sup_1","company_name":"","location":"Indian city","contact_person":"","phone":"+91-XXXXXXXXXX","email":"","specialisation":"","min_order_qty":"","lead_time":"","estimated_price":"INR","certifications":[],"rating":4.2,"review":"","match_score":88}],"recommendation":""}Generate 6 realistic Indian suppliers.`;
const supplierCache={};
app.post("/api/suppliers/find", async (req,res)=>{
  try{
    const {product_name,quantity,specs,location="India",budget_range=""} = req.body;
    const key=`${product_name}_${quantity}_${location}`;
    if(supplierCache[key]) return res.json(supplierCache[key]);
    const raw=await callLLM(SUPPLIER_SYS,[{role:"user",content:`Find Indian suppliers for: ${product_name}, qty:${quantity}, specs:${specs}, location:${location}, budget:${budget_range}`}],2500);
    const data=parseJSON(raw);
    data.query=req.body; data.searched_at=new Date().toISOString();
    supplierCache[key]=data;
    res.json(data);
  }catch(e){res.status(500).json({error:e.message});}
});

// LEADFORGE
const LEADFORGE_SYS=`You are LeadForge, a B2B lead intelligence agent for India. Return ONLY valid JSON (no markdown):{"leads":[{"id":"lead_1","company_name":"","industry":"","location":"Indian city","employee_count":"","annual_revenue":"INR","website":"","decision_maker":{"name":"","role":"","linkedin":""},"pain_points":["","",""],"tech_stack":["",""],"fit_score":85,"fit_reason":""}]}Generate exactly 8 realistic Indian B2B leads. fit_score 60-97. Output ONLY the JSON.`;
app.post("/api/leadforge/generate", async (req,res)=>{
  try{
    const {product_description,target_industry,company_size,revenue_range,seed_accounts=[]} = req.body;
    const prompt=`Generate 8 Indian B2B leads:\nProduct:${product_description}\nIndustries:${target_industry}\nSize:${company_size}\nRevenue:${revenue_range}\nSimilar to:${seed_accounts.join(", ")}\nReturn ONLY the JSON.`;
    const raw=await callLLM(LEADFORGE_SYS,[{role:"user",content:prompt}],4000);
    const data=parseJSON(raw);
    const saved=await Promise.all((data.leads||[]).map(l=>Lead.create({...l,created_at:new Date()})));
    res.json({leads:saved});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get("/api/leadforge/leads", async (req,res)=>{try{res.json({leads:await Lead.find().sort({created_at:-1})});}catch(e){res.status(500).json({error:e.message});}});

// VOICECOACH
function buildPersona(lead){
  const dm=lead.decision_maker||{};
  const pains=(lead.pain_points||[]).map(p=>`- ${p}`).join("\n");
  return `You are ${dm.name||"Ravi Sharma"}, ${dm.role||"VP Sales"} at ${lead.company_name}.\nIndustry:${lead.industry}|Size:${lead.employee_count}|Revenue:${lead.annual_revenue}|Location:${lead.location}\nPain points:\n${pains}\nRules: You are the BUYER. Start skeptical. Raise 2+ objections. Occasional Hindi. 2-4 sentence replies. Never break character.`;
}
app.post("/api/voicecoach/start", async (req,res)=>{
  try{
    const {lead_id,rep_name} = req.body;
    const lead=await Lead.findById(lead_id);
    if(!lead) return res.status(404).json({error:"Lead not found"});
    const personaSys=buildPersona(lead);
    const opening=await callLLM(personaSys,[{role:"user",content:"Sales rep just connected and said hello. Respond as the buyer."}],150);
    const session=await Session.create({lead_id:lead._id,rep_name,persona_system:personaSys,transcript:[{role:"assistant",content:opening}]});
    res.json({session_id:session._id,persona_name:lead.decision_maker?.name,company:lead.company_name,opening});
  }catch(e){res.status(500).json({error:e.message});}
});
app.post("/api/voicecoach/chat", async (req,res)=>{
  try{
    const {session_id,content} = req.body;
    const session=await Session.findById(session_id);
    if(!session) return res.status(404).json({error:"Session not found"});
    session.transcript.push({role:"user",content});
    const reply=await callLLM(session.persona_system,session.transcript,200);
    session.transcript.push({role:"assistant",content:reply});
    await session.save();
    res.json({reply,transcript_length:session.transcript.length});
  }catch(e){res.status(500).json({error:e.message});}
});
const REPORT_SYS=`Analyse this sales call. Return ONLY valid JSON:{"overall_score":74,"readiness_level":"Developing","dimensions":{"discovery_questions":{"score":80,"feedback":""},"objection_handling":{"score":65,"feedback":""},"value_proposition":{"score":70,"feedback":""},"rapport_building":{"score":85,"feedback":""},"next_step_framing":{"score":60,"feedback":""}},"talk_ratio":{"rep":55,"buyer":45},"top_strengths":["",""],"improvement_areas":["",""],"recommended_drills":["",""]}`;
app.post("/api/voicecoach/report", async (req,res)=>{
  try{
    const {session_id,transcript} = req.body;
    const session=session_id?await Session.findById(session_id):null;
    const src=session?.transcript||transcript||[];
    const txt=src.map(t=>`${t.role==="user"?"REP":"BUYER"}: ${t.content}`).join("\n");
    const raw=await callLLM(REPORT_SYS,[{role:"user",content:`Evaluate:\n\n${txt}`}],1500);
    const report=parseJSON(raw);
    report.session_id=session_id; report.generated_at=new Date().toISOString();
    res.json(report);
  }catch(e){res.status(500).json({error:e.message});}
});

app.listen(PORT,()=>console.log(`Saarthi ERP Node backend running on http://localhost:${PORT}`));
